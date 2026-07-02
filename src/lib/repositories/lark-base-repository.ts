import "server-only";

import { appConfig } from "../config";
import {
  canAdvanceAfterMinimum,
  calculateChecklistScore,
  normalizeTaskStatus,
  resolveMinimumGrade,
  summarizeTasks,
} from "../business-rules";
import {
  productionBaseManifest,
  productionMinimumChecklist,
  productionOperationChecklist,
  productionValueChecklist,
} from "../production-config";
import type {
  CreateAuditInput,
  FiveCResult,
  HygieneInspection,
  OperationAudit,
  RectificationTask,
  SessionUser,
  Store,
  StoreWorkbenchData,
  SubmitFeedbackInput,
  SvDashboardData,
  TableSchema,
  TaskQuery,
  UploadedPhoto,
  ValueAudit,
} from "../domain";
import type { BaseRepository } from "./base-repository";

interface LarkRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

interface ListRecordsResponse {
  items?: LarkRecord[];
  page_token?: string;
  has_more?: boolean;
}

interface LarkField {
  field_id: string;
  field_name: string;
  is_primary?: boolean;
  type?: number;
  ui_type?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface LarkUserValue {
  id?: string;
  name?: string;
}

export class LarkBaseRepository implements BaseRepository {
  private readonly recordListCache = new Map<string, Promise<LarkRecord[]>>();

  private readonly accessibleStoreRecordsCache = new Map<string, Promise<LarkRecord[]>>();

  private activeRequests = 0;

  private readonly requestQueue: Array<() => void> = [];

  constructor(private readonly userAccessToken: string) {}

  private async withRequestSlot<T>(task: () => Promise<T>): Promise<T> {
    const maxConcurrentRequests = 2;

    if (this.activeRequests >= maxConcurrentRequests) {
      await new Promise<void>((resolve) => {
        this.requestQueue.push(resolve);
      });
    }

    this.activeRequests += 1;

    try {
      return await task();
    } finally {
      this.activeRequests -= 1;
      const next = this.requestQueue.shift();
      next?.();
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await this.withRequestSlot(() =>
        fetch(`${appConfig.larkOpenApiBaseUrl}${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${this.userAccessToken}`,
            "Content-Type": "application/json; charset=utf-8",
            ...(init?.headers ?? {}),
          },
          cache: "no-store",
        }),
      );

      const rawText = await response.text();
      let json: { code?: number; data?: T; msg?: string } | null = null;
      try {
        json = rawText ? (JSON.parse(rawText) as { code?: number; data?: T; msg?: string }) : null;
      } catch {
        json = null;
      }

      const rateLimited = response.status === 429 || json?.msg === "TooManyRequest";
      if (rateLimited && attempt < maxAttempts) {
        await sleep(250 * 2 ** (attempt - 1));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Lark OpenAPI リクエストに失敗しました: ${response.status} ${rawText}`);
      }

      if (json?.code && json.code !== 0) {
        throw new Error(json.msg ?? "Lark OpenAPI 返回异常。");
      }

      return (json?.data ?? json) as T;
    }

    throw new Error("Lark OpenAPI リクエストに失敗しました。");
  }

  private async getTenantAccessToken(): Promise<string> {
    const response = await fetch(`${appConfig.larkOpenApiBaseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        app_id: appConfig.larkAppId,
        app_secret: appConfig.larkAppSecret,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("テナントトークンの取得に失敗しました。");
    }

    const json = (await response.json()) as { code?: number; msg?: string; tenant_access_token?: string };
    if (json.code !== 0 || !json.tenant_access_token) {
      throw new Error(json.msg ?? "テナントトークンの取得に失敗しました。");
    }

    return json.tenant_access_token;
  }

  private extractUserIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => (item && typeof item === "object" ? (item as LarkUserValue).id : ""))
      .filter((id): id is string => Boolean(id));
  }

  private async sendResultToStoreOwners(storeRecord: LarkRecord, result: FiveCResult, tasks: CreateAuditInput["tasks"]) {
    const recipientIds = [
      ...this.extractUserIds(storeRecord.fields["店舗アカウント"]),
      ...this.extractUserIds(storeRecord.fields["管理官"]),
    ].filter((value, index, array) => array.indexOf(value) === index);

    if (!recipientIds.length || !appConfig.larkAppSecret) {
      return;
    }

    const taskCount = tasks.length;
    const messageText = [
      `【5C評価結果通知】`,
      `店舗: ${result.storeName}`,
      `評価日: ${result.auditDate}`,
      `クール: ${result.cycle}`,
      `最低遵守: ${result.minimumScore}点 (${result.minimumGrade})`,
      `運営基準: ${result.operationScore}点`,
      `価値創造: ${result.valueScore}点`,
      `総合点: ${result.totalScore}点`,
      `是正タスク: ${taskCount}件`,
      `${new URL(appConfig.larkRedirectUri).origin}/store/my-5c`,
    ].join("\n");

    const tenantAccessToken = await this.getTenantAccessToken();

    await Promise.all(
      recipientIds.map(async (recipientId) => {
        const response = await fetch(
          `${appConfig.larkOpenApiBaseUrl}/open-apis/im/v1/messages?receive_id_type=open_id`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tenantAccessToken}`,
              "Content-Type": "application/json; charset=utf-8",
            },
            body: JSON.stringify({
              receive_id: recipientId,
              msg_type: "text",
              content: JSON.stringify({ text: messageText }),
            }),
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`通知送信に失敗しました: ${response.status}`);
        }

        const json = (await response.json()) as { code?: number; msg?: string };
        if (json.code !== 0) {
          throw new Error(json.msg ?? "通知送信に失敗しました。");
        }
      }),
    );
  }

  private async listRecords(tableId: string): Promise<LarkRecord[]> {
    const cached = this.recordListCache.get(tableId);
    if (cached) {
      return cached;
    }

    const requestPromise = (async () => {
      const items: LarkRecord[] = [];
      let pageToken: string | undefined;

      do {
        const data = await this.request<ListRecordsResponse>(
          `/open-apis/bitable/v1/apps/${appConfig.larkBaseAppToken}/tables/${tableId}/records/search`,
          {
            method: "POST",
            body: JSON.stringify({ page_size: 500, ...(pageToken ? { page_token: pageToken } : {}) }),
          },
        );

        items.push(...(data.items ?? []));
        pageToken = data.has_more ? data.page_token : undefined;
      } while (pageToken);

      return items;
    })()
      .catch((error) => {
        this.recordListCache.delete(tableId);
        throw error;
      });

    this.recordListCache.set(tableId, requestPromise);
    return requestPromise;
  }

  private async listFields(tableId: string): Promise<LarkField[]> {
    const data = await this.request<{ items?: LarkField[] }>(
      `/open-apis/bitable/v1/apps/${appConfig.larkBaseAppToken}/tables/${tableId}/fields?page_size=200`,
    );
    return data.items ?? [];
  }

  private async getRecord(tableId: string, recordId: string): Promise<LarkRecord | null> {
    const data = await this.request<{ record?: LarkRecord }>(
      `/open-apis/bitable/v1/apps/${appConfig.larkBaseAppToken}/tables/${tableId}/records/${recordId}`,
    );

    return data.record ?? null;
  }

  private async createRecord(tableId: string, fields: Record<string, unknown>) {
    await this.request(
      `/open-apis/bitable/v1/apps/${appConfig.larkBaseAppToken}/tables/${tableId}/records`,
      {
        method: "POST",
        body: JSON.stringify({ fields }),
      },
    );
    this.recordListCache.delete(tableId);
  }

  private async updateRecord(tableId: string, recordId: string, fields: Record<string, unknown>) {
    await this.request(
      `/open-apis/bitable/v1/apps/${appConfig.larkBaseAppToken}/tables/${tableId}/records/${recordId}`,
      {
        method: "PUT",
        body: JSON.stringify({ fields }),
      },
    );
    this.recordListCache.delete(tableId);
  }

  private coerceText(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number") {
      return `${value}`;
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    return "";
  }

  private coerceNumber(value: unknown): number {
    if (typeof value === "number") {
      return value;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private coercePhotos(value: unknown): UploadedPhoto[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item, index) => {
      const typed = item as { name?: string; url?: string; tmp_url?: string; file_token?: string };
      return {
        name: typed.name ?? `画像-${index + 1}`,
        url: typed.file_token
          ? `/api/lark/media/${encodeURIComponent(typed.file_token)}`
          : typed.url ?? typed.tmp_url ?? "",
      };
    });
  }

  private coerceTextArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (typeof item === "number") {
          return `${item}`;
        }

        if (item && typeof item === "object") {
          const typed = item as { record_id?: string; text?: string; name?: string };
          return typed.record_id ?? typed.text ?? typed.name ?? "";
        }

        return "";
      })
      .filter(Boolean);
  }

  private toCandidateValues(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.toCandidateValues(item));
    }

    if (typeof value === "string") {
      return [value];
    }

    if (typeof value === "number") {
      return [`${value}`];
    }

    if (value && typeof value === "object") {
      return Object.values(value as Record<string, unknown>).flatMap((item) =>
        this.toCandidateValues(item),
      );
    }

    return [];
  }

  private coerceCycle(value: unknown): "Q1" | "Q2" | "Q3" | "Q4" {
    const cycle = this.coerceText(value);
    if (cycle === "Q1" || cycle === "Q2" || cycle === "Q3" || cycle === "Q4") {
      return cycle;
    }

    return "Q1";
  }

  private mapPhotoForLark(photo: UploadedPhoto) {
    if (photo.fileToken) {
      return {
        file_token: photo.fileToken,
      };
    }

    return {
      name: photo.name,
      url: photo.url,
    };
  }

  private getAccessibleStore(store: LarkRecord, user: SessionUser) {
    if (user.role === "sv") {
      const ownerCandidates = [
        ...this.toCandidateValues(store.fields[appConfig.svOwnerFieldId]),
        ...this.toCandidateValues(store.fields["SV"]),
      ];
      const userCandidates = [user.larkOpenId, user.larkUserId, user.svCode].filter(
        (value): value is string => Boolean(value),
      );
      return userCandidates.some((value) => ownerCandidates.includes(value));
    }

    const ownerCandidates = [
      ...this.toCandidateValues(store.fields[appConfig.storeOwnerFieldId]),
      ...this.toCandidateValues(store.fields["店舗ユーザーID"]),
    ];
    const userCandidates = [user.larkOpenId, user.larkUserId, user.storeId].filter(
      (value): value is string => Boolean(value),
    );
    return userCandidates.some((value) => ownerCandidates.includes(value));
  }

  private async getAccessibleStoreRecords(user: SessionUser): Promise<LarkRecord[]> {
    const cacheKey = `${user.role}:${user.id}`;
    const cached = this.accessibleStoreRecordsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const requestPromise = this.listRecords(appConfig.larkStoreTableId)
      .then((records) => records.filter((record) => this.getAccessibleStore(record, user)))
      .catch((error) => {
        this.accessibleStoreRecordsCache.delete(cacheKey);
        throw error;
      });

    this.accessibleStoreRecordsCache.set(cacheKey, requestPromise);
    return requestPromise;
  }

  private mapStore(record: LarkRecord): Store {
    const storeFields = productionBaseManifest.tables.stores;
    return {
      id: record.record_id,
      name: this.coerceText(record.fields["店舗名"]),
      region: this.coerceText(record.fields["地域"]),
      block: this.coerceText(record.fields["ブロック"]),
      format: this.coerceText(record.fields[storeFields.formatFieldName]),
      group: this.coerceText(record.fields[storeFields.groupFieldName] ?? record.fields["店舗グループ"]),
      svName: this.coerceText(record.fields[storeFields.svFieldName]),
      svCode: this.coerceText(record.fields[appConfig.svOwnerFieldId] ?? record.fields[storeFields.svFieldName]),
      manager: this.coerceText(record.fields[storeFields.managerFieldName]),
      officer: this.coerceText(record.fields[storeFields.officerFieldName]),
      latestAuditDate: this.coerceText(record.fields[storeFields.latestDateFieldName]),
      latestOperationScore: this.coerceNumber(record.fields[storeFields.currentOperationScoreFieldName]),
      latestValueScore: this.coerceNumber(record.fields[storeFields.currentValueScoreFieldName]),
      latestTotalScore: this.coerceNumber(
        record.fields[storeFields.currentTotalScoreFieldName] ?? record.fields["今回5C点数合計"],
      ),
      previousTotalScore: this.coerceNumber(
        record.fields[storeFields.previousTotalScoreFieldName] ?? record.fields["前回5C点数合計"],
      ),
      currentRank: this.coerceNumber(record.fields[storeFields.currentRankFieldName]),
      previousRank: this.coerceNumber(record.fields[storeFields.previousRankFieldName]),
      hygieneCurrentScore: this.coerceNumber(
        record.fields[storeFields.hygieneCurrentScoreFieldName] ??
          record.fields["2025年(下期)"] ??
          record.fields["花王衛生検査"],
      ),
      hygienePreviousScore: this.coerceNumber(record.fields[storeFields.hygienePreviousScoreFieldName]),
    };
  }

  private hasResolvedChecklistMappings(definitions: typeof productionMinimumChecklist) {
    return definitions.every(
      (definition) =>
        !definition.larkFieldId?.startsWith("__UNRESOLVED_") &&
        !definition.larkFieldName?.startsWith("__UNRESOLVED_"),
    );
  }

  private async resolveChecklistFieldTargets(
    tableId: string,
    definitions: typeof productionMinimumChecklist,
    excludedFieldNames: string[],
  ) {
    if (this.hasResolvedChecklistMappings(definitions)) {
      return definitions.map((definition) => ({
        key: definition.key,
        target: definition.larkFieldId ?? definition.larkFieldName ?? definition.label,
      }));
    }

    const fields = await this.listFields(tableId);
    const excluded = new Set(excludedFieldNames);
    const candidateUiTypes = new Set(["SingleSelect", "Checkbox", "Text"]);
    const candidates = fields.filter((field) => {
      if (field.is_primary) {
        return false;
      }
      if (excluded.has(field.field_name)) {
        return false;
      }
      if (field.field_name.startsWith("作成") || field.field_name.startsWith("更新")) {
        return false;
      }
      if (!field.ui_type) {
        return true;
      }
      return candidateUiTypes.has(field.ui_type);
    });

    if (candidates.length < definitions.length) {
      throw new Error(
        `本番 Base のチェック項目フィールドを自動解決できません。tableId=${tableId}, expected=${definitions.length}, actual=${candidates.length}`,
      );
    }

    return definitions.map((definition, index) => ({
      key: definition.key,
      target: candidates[index]?.field_id ?? candidates[index]?.field_name ?? definition.label,
    }));
  }

  private async buildChecklistFieldPayload(
    tableId: string,
    definitions: typeof productionMinimumChecklist,
    items: CreateAuditInput["minimumItems"],
    excludedFieldNames: string[],
  ) {
    const fieldTargets = await this.resolveChecklistFieldTargets(tableId, definitions, excludedFieldNames);
    return Object.fromEntries(
      fieldTargets.map((definition) => {
        const answer = items.find((item) => item.key === definition.key);
        const value =
          answer?.status === "ok" ? "OK" : answer?.status === "ng" ? "NG" : "";
        return [definition.target, value];
      }),
    );
  }

  private resolveIssueCategoryLabel(category: RectificationTask["category"]) {
    if (category === "minimum") {
      return "最低遵守項目";
    }

    if (category === "value") {
      return "価値創造項目";
    }

    return "運営基準項目";
  }

  private resolveIssueFieldName(category: RectificationTask["category"]) {
    if (category === "minimum") {
      return productionBaseManifest.tables.issues.minimumIssueFieldName;
    }

    if (category === "value") {
      return productionBaseManifest.tables.issues.valueIssueFieldName;
    }

    return productionBaseManifest.tables.issues.operationIssueFieldName;
  }

  private resolveResultStage(options: {
    minimumScore: number;
    hasOperation: boolean;
    hasValue: boolean;
  }): FiveCResult["stage"] {
    if (options.minimumScore < 22) {
      return "minimum_failed";
    }

    if (options.hasValue) {
      return "completed";
    }

    if (options.hasOperation) {
      return "operation_in_progress";
    }

    return "minimum_passed";
  }

  private mapChecklistItemsFromRecord(
    record: LarkRecord,
    definitions: typeof productionMinimumChecklist,
  ) {
    return definitions.map((definition) => {
      const fieldName = definition.larkFieldId ?? definition.larkFieldName ?? definition.label;
      const raw = this.coerceText(record.fields[fieldName]).toUpperCase();
      return {
        ...definition,
        status: raw === "NG" ? ("ng" as const) : ("ok" as const),
        note: "",
      };
    });
  }

  private async mapAuditRecord(
    tableId: string,
    recordId: string,
    definitions: typeof productionMinimumChecklist,
    scoreFieldName: string,
    gradeFieldName: string,
  ): Promise<OperationAudit | null> {
    const record = await this.getRecord(tableId, recordId);
    if (!record) {
      return null;
    }

    const storeName = this.coerceText(record.fields["店舗名"]);
    const linkedStoreId = this.coerceTextArray(record.fields["店舗"])[0] || storeName;
    const items = this.mapChecklistItemsFromRecord(record, definitions);
    const score = this.coerceNumber(record.fields[scoreFieldName]);

    return {
      id: record.record_id,
      storeId: linkedStoreId,
      storeName,
      auditDate: this.coerceText(record.fields["対応日"]),
      score,
      grade: this.coerceText(record.fields[gradeFieldName]),
      completionState: this.coerceText(record.fields["評価完了チェック"]) === "true" ? "completed" : "completed",
      isPerfect: score === items.reduce((sum, item) => sum + item.maxScore, 0),
      items,
    };
  }

  async getSvDashboard(user: SessionUser): Promise<SvDashboardData> {
    const [stores, tasks, recentResults] = await Promise.all([
      this.getStoresForSv(user),
      this.listTasks(user),
      this.getRecentResults(user),
    ]);
    return { stores, tasks, recentResults, summary: summarizeTasks(tasks) };
  }

  async getStoreWorkbench(user: SessionUser): Promise<StoreWorkbenchData> {
    const stores = (await this.getAccessibleStoreRecords(user)).map((record) => this.mapStore(record));
    const store = stores[0];
    if (!store) {
      throw new Error("現在の店舗が見つかりません。`店舗ユーザーID` と Lark アカウントの紐付けを確認してください。");
    }
    const [history, openTasks] = await Promise.all([this.getRecentResults(user), this.listTasks(user)]);
    return {
      store,
      latestResult: history[0],
      history,
      openTasks,
    };
  }

  async listTasks(user: SessionUser, query?: TaskQuery): Promise<RectificationTask[]> {
    const stores = (await this.getAccessibleStoreRecords(user)).map((record) => this.mapStore(record));
    const accessibleStoreIds = new Set(stores.map((store) => store.id));
    const accessibleStoreNames = new Set(stores.map((store) => store.name));
    const items = await this.listRecords(appConfig.larkIssueTableId);
    let tasks: RectificationTask[] = items.flatMap((record) => {
        const storeRef = this.coerceTextArray(record.fields["店舗"])[0];
        const storeName =
          this.coerceText(record.fields["店舗名"]) || this.coerceText(record.fields["店舗"]);
        const store = stores.find(
          (current) => current.id === storeRef || current.name === storeName,
        );

        if (!store) {
          return [];
        }

        const surveyType = this.coerceText(
          record.fields[productionBaseManifest.tables.issues.surveyTypeFieldName],
        );
        const category: RectificationTask["category"] = surveyType.includes("最低")
          ? "minimum"
          : surveyType.includes("価値")
            ? "value"
            : "operation";
        const sourceItemKey = this.coerceText(
          record.fields[this.resolveIssueFieldName(category)],
        );
        const rawStatus = this.coerceText(
          record.fields["改善ステータス"] ?? record.fields["改善ステータス "],
        ).toLowerCase();
        const feedbackComment = this.coerceText(
          record.fields[productionBaseManifest.tables.issues.feedbackCommentFieldName] ??
            record.fields["整改结果"],
        );

        const task: RectificationTask = {
          id: record.record_id,
          storeId: store.id,
          storeName: store.name,
          auditDate: this.coerceText(record.fields["対応日"]),
          category,
          sourceItemKey,
          issueType:
            surveyType ||
            this.coerceText(record.fields[productionBaseManifest.tables.issues.typeFieldName]) ||
            sourceItemKey,
          comment: this.coerceText(record.fields[productionBaseManifest.tables.issues.commentFieldName]),
          improvementPlan: this.coerceText(
            record.fields[productionBaseManifest.tables.issues.improvementFieldName],
          ),
          dueDate: this.coerceText(record.fields[productionBaseManifest.tables.issues.dueDateFieldName]),
          assignee: this.coerceText(record.fields["担当者"]),
          svName: this.coerceText(record.fields["SV"]),
          status: normalizeTaskStatus({
            id: record.record_id,
            storeId: store.id,
            storeName: store.name,
            auditDate: "",
            category,
            sourceItemKey,
            issueType: "",
            comment: "",
            improvementPlan: "",
            dueDate: this.coerceText(record.fields[productionBaseManifest.tables.issues.dueDateFieldName]),
            assignee: "",
            svName: "",
            status: rawStatus === "resolved" ? "resolved" : feedbackComment ? "submitted" : "open",
            confirmationStatus: "pending",
            beforePhotos: [],
            afterPhotos: [],
            history: [],
          }),
          confirmationStatus: rawStatus === "resolved" ? "approved" : "pending",
          beforePhotos: this.coercePhotos(
            record.fields[productionBaseManifest.tables.issues.beforePhotoFieldName] ??
              record.fields["写真"],
          ),
          afterPhotos: this.coercePhotos(
            record.fields[productionBaseManifest.tables.issues.afterPhotoFieldName],
          ),
          feedbackComment,
          feedbackSubmittedAt:
            this.coerceText(record.fields[productionBaseManifest.tables.issues.feedbackSubmittedAtFieldName]) ||
            this.coerceText(record.fields["整改提交时间"]),
          history: [],
        };

        return accessibleStoreIds.has(task.storeId) || accessibleStoreNames.has(task.storeName)
          ? [task]
          : [];
      });

    if (query?.storeId) {
      tasks = tasks.filter((task) => task.storeId === query.storeId);
    }
    if (query?.status && query.status !== "all") {
      tasks = tasks.filter((task) => task.status === query.status);
    }
    if (query?.search) {
      const keyword = query.search.toLowerCase();
      tasks = tasks.filter((task) =>
        [
          task.storeName,
          task.issueType,
          task.comment,
          task.sourceItemKey,
          task.improvementPlan,
          task.feedbackComment ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword),
      );
    }
    return tasks;
  }

  async getTask(user: SessionUser, taskId: string): Promise<RectificationTask | null> {
    return (await this.listTasks(user)).find((task) => task.id === taskId) ?? null;
  }

  async getStoresForSv(user: SessionUser): Promise<Store[]> {
    const stores = await this.getAccessibleStoreRecords(user);
    return stores.map(this.mapStore.bind(this));
  }

  async getRecentResults(user: SessionUser): Promise<FiveCResult[]> {
    const stores = (await this.getAccessibleStoreRecords(user)).map((record) => this.mapStore(record));
    const [minimumRecords, operationRecords, valueRecords] = await Promise.all([
      this.listRecords(appConfig.larkMinimumTableId),
      this.listRecords(appConfig.larkOperationTableId),
      this.listRecords(appConfig.larkValueTableId),
    ]);

    const storeById = new Map(stores.map((store) => [store.id, store]));
    const storeByName = new Map(stores.map((store) => [store.name, store]));
    const latestMinimumByStoreId = new Map<string, LarkRecord>();
    const operationByStoreAndDate = new Map<string, LarkRecord>();
    const valueByStoreAndDate = new Map<string, LarkRecord>();

    const resolveStore = (record: LarkRecord) => {
      const linkedStoreId = this.coerceTextArray(record.fields["店舗"])[0];
      const storeName = this.coerceText(record.fields["店舗名"]);
      return (linkedStoreId ? storeById.get(linkedStoreId) : undefined) ?? storeByName.get(storeName);
    };

    const buildStoreDateKey = (storeId: string, auditDate: string) => `${storeId}::${auditDate}`;

    for (const record of minimumRecords) {
      const store = resolveStore(record);
      if (!store) {
        continue;
      }

      const auditDate = this.coerceText(record.fields["対応日"]);
      const previous = latestMinimumByStoreId.get(store.id);
      if (!previous || this.coerceText(previous.fields["対応日"]).localeCompare(auditDate) < 0) {
        latestMinimumByStoreId.set(store.id, record);
      }
    }

    for (const record of operationRecords) {
      const store = resolveStore(record);
      if (!store) {
        continue;
      }

      const auditDate = this.coerceText(record.fields["対応日"]);
      const key = buildStoreDateKey(store.id, auditDate);
      const previous = operationByStoreAndDate.get(key);
      if (!previous || this.coerceText(previous.fields["対応日"]).localeCompare(auditDate) < 0) {
        operationByStoreAndDate.set(key, record);
      }
    }

    for (const record of valueRecords) {
      const store = resolveStore(record);
      if (!store) {
        continue;
      }

      const auditDate = this.coerceText(record.fields["対応日"]);
      const key = buildStoreDateKey(store.id, auditDate);
      const previous = valueByStoreAndDate.get(key);
      if (!previous || this.coerceText(previous.fields["対応日"]).localeCompare(auditDate) < 0) {
        valueByStoreAndDate.set(key, record);
      }
    }

    return stores
      .flatMap((store) => {
        const minimumRecord = latestMinimumByStoreId.get(store.id);

        if (!minimumRecord) {
          return [];
        }

        const auditDate = this.coerceText(minimumRecord.fields["対応日"]);
        const minimumScore = this.coerceNumber(
          minimumRecord.fields[productionBaseManifest.tables.minimum.scoreFieldName],
        );
        const cycle = this.coerceCycle(
          minimumRecord.fields[productionBaseManifest.tables.issues.cycleFieldName],
        );
        const storeDateKey = buildStoreDateKey(store.id, auditDate);
        const operationRecord = operationByStoreAndDate.get(storeDateKey);
        const valueRecord = valueByStoreAndDate.get(storeDateKey);
        const operationScore = operationRecord
          ? this.coerceNumber(operationRecord.fields[productionBaseManifest.tables.operation.scoreFieldName])
          : 0;
        const valueScore = valueRecord
          ? this.coerceNumber(valueRecord.fields[productionBaseManifest.tables.value.scoreFieldName])
          : 0;

        const result: FiveCResult = {
          id: `result-${store.id}-${auditDate}`,
          storeId: store.id,
          storeName: store.name,
          auditDate,
          cycle,
          minimumScore,
          minimumGrade: resolveMinimumGrade(minimumScore),
          operationScore,
          valueScore,
          totalScore: minimumScore + operationScore + valueScore,
          stage: this.resolveResultStage({
            minimumScore,
            hasOperation: Boolean(operationRecord),
            hasValue: Boolean(valueRecord),
          }),
          createdBy: store.svName,
          minimumAuditId: minimumRecord.record_id,
          operationAuditId: operationRecord?.record_id ?? "",
          valueAuditId: valueRecord?.record_id,
        };

        return [result];
      })
      .sort((a, b) => b.auditDate.localeCompare(a.auditDate));
  }

  async getHygieneInspections(user: SessionUser): Promise<HygieneInspection[]> {
    const stores = (await this.getAccessibleStoreRecords(user)).map((record) => this.mapStore(record));
    const configuredTable = productionBaseManifest.tables.hygiene;

    if (!configuredTable) {
      return stores.flatMap((store) => [
        {
          id: `${store.id}-hygiene-previous`,
          storeId: store.id,
          storeName: store.name,
          period: "前回",
          score: store.hygienePreviousScore ?? 0,
        },
        {
          id: `${store.id}-hygiene-current`,
          storeId: store.id,
          storeName: store.name,
          period: "今回",
          score: store.hygieneCurrentScore ?? 0,
        },
      ]);
    }

    const storeByName = new Map(stores.map((store) => [store.name, store]));
    const records = await this.listRecords(configuredTable.tableId);
    return records.flatMap((record) => {
      const storeName =
        this.coerceText(record.fields[configuredTable.storeFieldName]) || this.coerceText(record.fields["店舗名"]);
      const store = storeByName.get(storeName);
      if (!store) {
        return [];
      }

      return [
        {
          id: record.record_id,
          storeId: store.id,
          storeName: store.name,
          period: this.coerceText(record.fields[configuredTable.periodFieldName]) || "衛生検査",
          score: this.coerceNumber(record.fields[configuredTable.scoreFieldName]),
        },
      ];
    });
  }

  async getMinimumAudit(auditId: string): Promise<OperationAudit | null> {
    return this.mapAuditRecord(
      appConfig.larkMinimumTableId,
      auditId,
      productionMinimumChecklist,
      productionBaseManifest.tables.minimum.scoreFieldName,
      productionBaseManifest.tables.minimum.gradeFieldName,
    );
  }

  async getOperationAudit(auditId: string): Promise<OperationAudit | null> {
    return this.mapAuditRecord(
      appConfig.larkOperationTableId,
      auditId,
      productionOperationChecklist,
      productionBaseManifest.tables.operation.scoreFieldName,
      productionBaseManifest.tables.operation.gradeFieldName,
    );
  }

  async getValueAudit(auditId: string): Promise<ValueAudit | null> {
    const audit = await this.mapAuditRecord(
      appConfig.larkValueTableId,
      auditId,
      productionValueChecklist,
      productionBaseManifest.tables.value.scoreFieldName,
      productionBaseManifest.tables.value.gradeFieldName,
    );

    if (!audit) {
      return null;
    }

    return {
      ...audit,
      items: audit.items,
    };
  }

  async createAudit(user: SessionUser, input: CreateAuditInput): Promise<FiveCResult> {
    const accessibleStoreRecords = await this.getAccessibleStoreRecords(user);
    const storeRecord = accessibleStoreRecords.find((record) => this.mapStore(record).id === input.storeId);
    const store = storeRecord ? this.mapStore(storeRecord) : undefined;
    if (!store) {
      throw new Error("指定した店舗への書き込み権限がありません。");
    }

    const minimumScore = calculateChecklistScore(
      input.minimumItems.map((item) => ({ ...item, larkFieldId: undefined })),
    );
    const minimumPassed = canAdvanceAfterMinimum(
      input.minimumItems.map((item) => ({ ...item, larkFieldId: undefined })),
    );
    const operationScore = minimumPassed
      ? calculateChecklistScore(input.operationItems.map((item) => ({ ...item, larkFieldId: undefined })))
      : 0;
    const operationPassed = minimumPassed && operationScore === 50;
    const valueScore = operationPassed
      ? calculateChecklistScore(input.valueItems.map((item) => ({ ...item, larkFieldId: undefined })))
      : 0;
    const minimumAuditId = `minimum-${Date.now()}`;
    const operationAuditId = minimumPassed ? `operation-${Date.now()}` : "";
    const valueAuditId = operationPassed ? `value-${Date.now()}` : undefined;
    const minimumFieldPayload = await this.buildChecklistFieldPayload(
      appConfig.larkMinimumTableId,
      productionMinimumChecklist,
      input.minimumItems,
      [
        "店舗",
        "店舗名",
        "対応日",
        productionBaseManifest.tables.issues.cycleFieldName,
        productionBaseManifest.tables.minimum.scoreFieldName,
        productionBaseManifest.tables.minimum.gradeFieldName,
        productionBaseManifest.tables.minimum.completionFieldName,
      ],
    );

    await this.createRecord(appConfig.larkMinimumTableId, {
      店舗: [store.id],
      対応日: input.auditDate,
      [productionBaseManifest.tables.issues.cycleFieldName]: input.cycle,
      [productionBaseManifest.tables.minimum.completionFieldName]:
        input.minimumCompletionState === "completed",
      ...minimumFieldPayload,
    });

    if (minimumPassed) {
      const operationFieldPayload = await this.buildChecklistFieldPayload(
        appConfig.larkOperationTableId,
        productionOperationChecklist,
        input.operationItems,
        [
          "店舗",
          "店舗名",
          "対応日",
          productionBaseManifest.tables.issues.cycleFieldName,
          productionBaseManifest.tables.operation.scoreFieldName,
          productionBaseManifest.tables.operation.gradeFieldName,
          productionBaseManifest.tables.operation.completionFieldName,
        ],
      );
      await this.createRecord(appConfig.larkOperationTableId, {
        店舗: [store.id],
        対応日: input.auditDate,
        [productionBaseManifest.tables.issues.cycleFieldName]: input.cycle,
        [productionBaseManifest.tables.operation.completionFieldName]:
          input.operationCompletionState === "completed",
        ...operationFieldPayload,
      });

      if (operationPassed) {
        const valueFieldPayload = await this.buildChecklistFieldPayload(
          appConfig.larkValueTableId,
          productionValueChecklist,
          input.valueItems,
          [
            "店舗",
            "店舗名",
            "対応日",
            productionBaseManifest.tables.issues.cycleFieldName,
            productionBaseManifest.tables.value.scoreFieldName,
            productionBaseManifest.tables.value.gradeFieldName,
            productionBaseManifest.tables.value.completionFieldName,
          ],
        );
        await this.createRecord(appConfig.larkValueTableId, {
          店舗: [store.id],
          対応日: input.auditDate,
          [productionBaseManifest.tables.issues.cycleFieldName]: input.cycle,
          [productionBaseManifest.tables.value.completionFieldName]:
            input.valueCompletionState === "completed",
          ...valueFieldPayload,
        });
      }
    }

    for (const task of input.tasks) {
      await this.createRecord(appConfig.larkIssueTableId, {
        店舗: store.name,
        [productionBaseManifest.tables.issues.surveyTypeFieldName]:
          this.resolveIssueCategoryLabel(task.category),
        [productionBaseManifest.tables.issues.cycleFieldName]: input.cycle,
        [productionBaseManifest.tables.issues.typeFieldName]: task.issueType,
        [this.resolveIssueFieldName(task.category)]: task.sourceItemKey,
        [productionBaseManifest.tables.issues.improvementFieldName]: task.improvementPlan,
        [productionBaseManifest.tables.issues.dueDateFieldName]: task.dueDate,
        [productionBaseManifest.tables.issues.commentFieldName]: task.comment,
        担当者: task.assignee,
        SV: user.name,
        [productionBaseManifest.tables.issues.beforePhotoFieldName]: (task.beforePhotos ?? []).map((photo) =>
          this.mapPhotoForLark(photo),
        ),
      });
    }

    const result: FiveCResult = {
      id: `submitted-${Date.now()}`,
      storeId: store.id,
      storeName: store.name,
      auditDate: input.auditDate,
      cycle: input.cycle,
      minimumScore,
      minimumGrade: resolveMinimumGrade(minimumScore),
      operationScore,
      valueScore,
      totalScore: minimumScore + operationScore + valueScore,
      stage: this.resolveResultStage({
        minimumScore,
        hasOperation: minimumPassed,
        hasValue: operationPassed,
      }),
      createdBy: user.name,
      minimumAuditId,
      operationAuditId,
      valueAuditId,
    };

    if (storeRecord) {
      void this.sendResultToStoreOwners(storeRecord, result, input.tasks).catch((error) => {
        console.error("Failed to notify store owners after audit submission:", error);
      });
    }

    return result;
  }

  async submitTaskFeedback(
    _user: SessionUser,
    taskId: string,
    input: SubmitFeedbackInput,
  ): Promise<RectificationTask> {
    await this.updateRecord(appConfig.larkIssueTableId, taskId, {
      [productionBaseManifest.tables.issues.feedbackCommentFieldName]: input.comment,
      [productionBaseManifest.tables.issues.feedbackSubmittedAtFieldName]: new Date().toISOString(),
      [productionBaseManifest.tables.issues.afterPhotoFieldName]: input.photos.map((photo) =>
        this.mapPhotoForLark(photo),
      ),
      改善ステータス: "submitted",
    });

    const task = await this.getTask(_user, taskId);
    if (!task) {
      throw new Error("是正項目が見つかりません。");
    }

    return {
      ...task,
      status: "submitted",
      feedbackComment: input.comment,
      feedbackSubmittedAt: new Date().toISOString(),
      afterPhotos: input.photos,
    };
  }

  async markTaskResolved(_user: SessionUser, taskId: string): Promise<RectificationTask> {
    await this.updateRecord(appConfig.larkIssueTableId, taskId, {
      改善ステータス: "resolved",
      [productionBaseManifest.tables.issues.svConfirmationStatusFieldName]: "approved",
      [productionBaseManifest.tables.issues.svConfirmationAtFieldName]: new Date().toISOString(),
    });

    const task = await this.getTask(_user, taskId);
    if (!task) {
      throw new Error("是正項目が見つかりません。");
    }
    return { ...task, status: "resolved", confirmationStatus: "approved" };
  }

  async getSchema(): Promise<TableSchema[]> {
    const tableIds = [
      appConfig.larkStoreTableId,
      appConfig.larkMinimumTableId,
      appConfig.larkOperationTableId,
      appConfig.larkValueTableId,
      appConfig.larkIssueTableId,
      appConfig.larkItemMasterTableId,
    ];
    return Promise.all(
      tableIds.map(async (tableId) => {
        const data = await this.request<{ items?: Array<{ field_id: string; field_name: string; type: number }> }>(
          `/open-apis/bitable/v1/apps/${appConfig.larkBaseAppToken}/tables/${tableId}/fields?page_size=500`,
        );
        const tableName =
          Object.values(productionBaseManifest.tables).find((table) => table.tableId === tableId)?.tableName ??
          tableId;
        return {
          tableId,
          tableName,
          fields: (data.items ?? []).map((field) => ({
            fieldId: field.field_id,
            fieldName: field.field_name,
            type: `${field.type}`,
          })),
        };
      }),
    );
  }
}
