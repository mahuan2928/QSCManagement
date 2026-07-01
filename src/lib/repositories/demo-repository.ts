import "server-only";

import {
  canAdvanceAfterMinimum,
  calculateChecklistScore,
  normalizeTaskStatus,
  resolveMinimumGrade,
  resolveOperationGrade,
  resolveValueGrade,
  summarizeTasks,
} from "../business-rules";
import {
  demoMinimumChecklist,
  demoOperationChecklist,
  demoValueChecklist,
} from "../config";
import {
  demoOperationAudits,
  demoResults,
  demoStoresSeed,
  demoTasksSeed,
  demoValueAudits,
} from "../demo-data";
import type {
  CreateAuditInput,
  FiveCResult,
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

interface DemoDatabase {
  stores: Store[];
  results: FiveCResult[];
  operationAudits: OperationAudit[];
  valueAudits: ValueAudit[];
  tasks: RectificationTask[];
}

declare global {
  var __R5C_DEMO_DB__: DemoDatabase | undefined;
}

function clonePhoto(photo: UploadedPhoto): UploadedPhoto {
  return { ...photo };
}

function cloneTask(task: RectificationTask): RectificationTask {
  return {
    ...task,
    beforePhotos: task.beforePhotos.map(clonePhoto),
    afterPhotos: task.afterPhotos.map(clonePhoto),
    history: task.history.map((item) => ({
      ...item,
      photos: item.photos.map(clonePhoto),
    })),
  };
}

function getDb(): DemoDatabase {
  if (!globalThis.__R5C_DEMO_DB__) {
    globalThis.__R5C_DEMO_DB__ = {
      stores: structuredClone(demoStoresSeed),
      results: structuredClone(demoResults),
      operationAudits: structuredClone(demoOperationAudits),
      valueAudits: structuredClone(demoValueAudits),
      tasks: structuredClone(demoTasksSeed).map((task) => ({
        ...task,
        status: normalizeTaskStatus(task),
      })),
    };
  }

  return globalThis.__R5C_DEMO_DB__;
}

function ensureAccessibleStore(user: SessionUser, storeId: string) {
  if (user.role === "sv") {
    const stores = getDb().stores.filter((store) => store.svCode === user.svCode);
    if (!stores.some((store) => store.id === storeId)) {
      throw new Error("現在の SV にはこの店舗へのアクセス権限がありません。");
    }
    return;
  }

  if (user.storeId !== storeId) {
    throw new Error("店舗アカウントは自店舗データのみ参照できます。");
  }
}

function filterTasksForUser(tasks: RectificationTask[], user: SessionUser) {
  return tasks
    .filter((task) => {
      if (user.role === "sv") {
        return getDb()
          .stores.filter((store) => store.svCode === user.svCode)
          .some((store) => store.id === task.storeId);
      }

      return task.storeId === user.storeId;
    })
    .map((task) => ({ ...cloneTask(task), status: normalizeTaskStatus(task) }));
}

function filterResultsForUser(results: FiveCResult[], user: SessionUser) {
  if (user.role === "sv") {
    const storeIds = new Set(
      getDb()
        .stores.filter((store) => store.svCode === user.svCode)
        .map((store) => store.id),
    );
    return results.filter((result) => storeIds.has(result.storeId));
  }

  return results.filter((result) => result.storeId === user.storeId);
}

export class DemoRepository implements BaseRepository {
  async getSvDashboard(user: SessionUser): Promise<SvDashboardData> {
    const stores = await this.getStoresForSv(user);
    const tasks = filterTasksForUser(getDb().tasks, user);
    const recentResults = filterResultsForUser(getDb().results, user)
      .sort((a, b) => b.auditDate.localeCompare(a.auditDate))
      .slice(0, 6);

    return {
      stores,
      tasks,
      recentResults,
      summary: summarizeTasks(tasks),
    };
  }

  async getStoreWorkbench(user: SessionUser): Promise<StoreWorkbenchData> {
    const store = getDb().stores.find((item) => item.id === user.storeId);
    if (!store) {
      throw new Error("対象店舗が見つかりません。");
    }

    const history = filterResultsForUser(getDb().results, user).sort((a, b) =>
      a.auditDate < b.auditDate ? -1 : 1,
    );

    return {
      store,
      latestResult: [...history].sort((a, b) => b.auditDate.localeCompare(a.auditDate))[0],
      history,
      openTasks: filterTasksForUser(getDb().tasks, user),
    };
  }

  async listTasks(user: SessionUser, query?: TaskQuery): Promise<RectificationTask[]> {
    let tasks = filterTasksForUser(getDb().tasks, user);

    if (query?.storeId) {
      tasks = tasks.filter((task) => task.storeId === query.storeId);
    }

    if (query?.status && query.status !== "all") {
      tasks = tasks.filter((task) => task.status === query.status);
    }

    if (query?.search) {
      const keyword = query.search.toLowerCase();
      tasks = tasks.filter((task) => {
        return (
          task.storeName.toLowerCase().includes(keyword) ||
          task.comment.toLowerCase().includes(keyword) ||
          task.issueType.toLowerCase().includes(keyword)
        );
      });
    }

    return tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  async getTask(user: SessionUser, taskId: string): Promise<RectificationTask | null> {
    return (await this.listTasks(user)).find((task) => task.id === taskId) ?? null;
  }

  async getStoresForSv(user: SessionUser): Promise<Store[]> {
    return getDb().stores.filter((store) => store.svCode === user.svCode);
  }

  async getRecentResults(user: SessionUser): Promise<FiveCResult[]> {
    return filterResultsForUser(getDb().results, user).sort((a, b) =>
      b.auditDate.localeCompare(a.auditDate),
    );
  }

  async getHygieneInspections(user: SessionUser) {
    const stores =
      user.role === "sv"
        ? getDb().stores.filter((store) => store.svCode === user.svCode)
        : getDb().stores.filter((store) => store.id === user.storeId);
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

  async getMinimumAudit(auditId: string): Promise<OperationAudit | null> {
    return getDb().operationAudits.find((audit) => audit.id === auditId) ?? null;
  }

  async getOperationAudit(auditId: string): Promise<OperationAudit | null> {
    return getDb().operationAudits.find((audit) => audit.id === auditId) ?? null;
  }

  async getValueAudit(auditId: string): Promise<ValueAudit | null> {
    return getDb().valueAudits.find((audit) => audit.id === auditId) ?? null;
  }

  async createAudit(user: SessionUser, input: CreateAuditInput): Promise<FiveCResult> {
    ensureAccessibleStore(user, input.storeId);

    const db = getDb();
    const store = db.stores.find((item) => item.id === input.storeId);
    if (!store) {
      throw new Error("店舗が存在しません。");
    }

    const minimumScore = calculateChecklistScore(
      input.minimumItems.map((item) => ({ ...item, larkFieldId: undefined })),
    );
    const minimumPassed = canAdvanceAfterMinimum(
      input.minimumItems.map((item) => ({ ...item, larkFieldId: undefined })),
    );
    const minimumAudit: OperationAudit = {
      id: `minimum-${Date.now()}`,
      storeId: store.id,
      storeName: store.name,
      auditDate: input.auditDate,
      score: minimumScore,
      grade: resolveMinimumGrade(minimumScore),
      completionState: input.minimumCompletionState,
      isPerfect: minimumPassed,
      items: input.minimumItems.map((item) => ({ ...item })),
    };

    const operationScore = calculateChecklistScore(
      input.operationItems.map((item) => ({ ...item, larkFieldId: undefined })),
    );
    const operationAudit: OperationAudit = {
      id: `op-${Date.now()}`,
      storeId: store.id,
      storeName: store.name,
      auditDate: input.auditDate,
      score: operationScore,
      grade: resolveOperationGrade(operationScore),
      completionState: input.operationCompletionState,
      isPerfect: operationScore === 50,
      items: input.operationItems.map((item) => ({ ...item })),
    };
    const operationPassed = minimumPassed && operationScore === 50;

    let valueScore = 0;
    let valueAudit: ValueAudit | null = null;
    if (operationPassed) {
      valueScore = calculateChecklistScore(
        input.valueItems.map((item) => ({ ...item, larkFieldId: undefined })),
      );
      valueAudit = {
        id: `va-${Date.now()}`,
        storeId: store.id,
        storeName: store.name,
        auditDate: input.auditDate,
        score: valueScore,
        grade: resolveValueGrade(valueScore),
        completionState: input.valueCompletionState,
        items: input.valueItems.map((item) => ({ ...item })),
      };
      db.valueAudits.unshift(valueAudit);
    }

    const result: FiveCResult = {
      id: `result-${Date.now()}`,
      storeId: store.id,
      storeName: store.name,
      auditDate: input.auditDate,
      cycle: input.cycle,
      minimumScore,
      minimumGrade: resolveMinimumGrade(minimumScore),
      operationScore,
      valueScore,
      totalScore: minimumScore + (minimumPassed ? operationScore : 0) + (operationPassed ? valueScore : 0),
      stage: !minimumPassed ? "minimum_failed" : operationPassed ? "completed" : "operation_in_progress",
      createdBy: input.evaluator,
      minimumAuditId: minimumAudit.id,
      operationAuditId: operationAudit.id,
      valueAuditId: valueAudit?.id,
    };

    db.operationAudits.unshift(minimumAudit);
    db.operationAudits.unshift(operationAudit);
    db.results.unshift(result);

    input.tasks.forEach((task, index) => {
      const createdTask: RectificationTask = {
        id: `task-${Date.now()}-${index}`,
        storeId: store.id,
        storeName: store.name,
        auditDate: input.auditDate,
        category: task.category,
        sourceItemKey: task.sourceItemKey,
        issueType: task.issueType,
        comment: task.comment,
        improvementPlan: task.improvementPlan,
        dueDate: task.dueDate,
        assignee: task.assignee,
        svName: store.svName,
        status: "open",
        confirmationStatus: "pending",
        beforePhotos: task.beforePhotos ?? [],
        afterPhotos: [],
        linkedOperationAuditId: task.category === "minimum" ? minimumAudit.id : operationAudit.id,
        linkedValueAuditId: valueAudit?.id,
        linkedResultId: result.id,
        history: [],
      };

      db.tasks.unshift(createdTask);
    });

    const storeIndex = db.stores.findIndex((item) => item.id === store.id);
    db.stores[storeIndex] = {
      ...store,
      latestAuditDate: input.auditDate,
      latestOperationScore: minimumPassed ? operationScore : 0,
      latestValueScore: operationPassed ? valueScore : 0,
      latestTotalScore:
        minimumScore + (minimumPassed ? operationScore : 0) + (operationPassed ? valueScore : 0),
    };

    return result;
  }

  async submitTaskFeedback(
    user: SessionUser,
    taskId: string,
    input: SubmitFeedbackInput,
  ): Promise<RectificationTask> {
    const db = getDb();
    const index = db.tasks.findIndex((task) => task.id === taskId);
    if (index < 0) {
      throw new Error("是正項目が存在しません。");
    }

    const task = db.tasks[index];
    ensureAccessibleStore(user, task.storeId);

    const feedback = {
      id: `feedback-${Date.now()}`,
      taskId,
      comment: input.comment,
      photos: input.photos.map(clonePhoto),
      submittedAt: new Date().toISOString(),
      submittedBy: user.name,
    };

    const updated: RectificationTask = {
      ...task,
      status: "submitted",
      feedbackComment: input.comment,
      feedbackSubmittedAt: feedback.submittedAt,
      afterPhotos: input.photos.map(clonePhoto),
      history: [...task.history, feedback],
    };

    db.tasks[index] = updated;
    return cloneTask(updated);
  }

  async markTaskResolved(user: SessionUser, taskId: string): Promise<RectificationTask> {
    if (user.role !== "sv") {
      throw new Error("是正完了の確定はSVのみ可能です。");
    }

    const db = getDb();
    const index = db.tasks.findIndex((task) => task.id === taskId);
    if (index < 0) {
      throw new Error("是正項目が存在しません。");
    }

    const task = db.tasks[index];
    ensureAccessibleStore(user, task.storeId);

    const updated: RectificationTask = {
      ...task,
      status: "resolved",
      confirmationStatus: "approved",
    };
    db.tasks[index] = updated;
    return cloneTask(updated);
  }

  async getSchema(): Promise<TableSchema[]> {
    return [
      {
        tableId: "tblPXXFwLGJh96Np",
        tableName: "店舗マスタ(これを使用する)",
        fields: [
          { fieldId: "店舗名", fieldName: "店舗名", type: "text" },
          { fieldId: "地域", fieldName: "地域", type: "text" },
          { fieldId: "ブロック", fieldName: "ブロック", type: "text" },
          { fieldId: "SV", fieldName: "SV", type: "text" },
          { fieldId: "今回点数（運営）", fieldName: "今回点数（運営）", type: "formula" },
          { fieldId: "今回点数（創造）", fieldName: "今回点数（創造）", type: "formula" },
        ],
      },
      {
        tableId: "tblVQA4TkDmBAImb",
        tableName: "最低遵守項目",
        fields: [
          { fieldId: "最低遵守点数", fieldName: "最低遵守点数", type: "formula" },
          { fieldId: "店舗評価", fieldName: "店舗評価", type: "formula" },
          { fieldId: "評価完了チェック", fieldName: "評価完了チェック", type: "checkbox" },
        ],
      },
      {
        tableId: "tbldp5mMzD6BRkuj",
        tableName: "運営基準項目",
        fields: [
          { fieldId: "運営基準点数", fieldName: "運営基準点数", type: "formula" },
          { fieldId: "店舗評価", fieldName: "店舗評価", type: "formula" },
          { fieldId: "評価完了チェック", fieldName: "評価完了チェック", type: "checkbox" },
        ],
      },
      {
        tableId: "tblq0BeYXTzhCqcs",
        tableName: "価値創造項目",
        fields: [
          { fieldId: "価値創造点数", fieldName: "価値創造点数", type: "formula" },
          { fieldId: "店舗評価", fieldName: "店舗評価", type: "formula" },
          { fieldId: "評価完了チェック", fieldName: "評価完了チェック", type: "checkbox" },
        ],
      },
      {
        tableId: "tblatoQ7jqgteyQP",
        tableName: "問題指摘",
        fields: [
          { fieldId: "アンケート集別", fieldName: "アンケート集別", type: "singleSelect" },
          { fieldId: "第〇クール", fieldName: "第〇クール", type: "singleSelect" },
          { fieldId: "種別", fieldName: "種別", type: "singleSelect" },
          { fieldId: "改善方法 ※SV設定", fieldName: "改善方法 ※SV設定", type: "text" },
          { fieldId: "改善期限", fieldName: "改善期限", type: "date" },
          { fieldId: "写真", fieldName: "写真", type: "attachment" },
          { fieldId: "コメント", fieldName: "コメント", type: "text" },
        ],
      },
      {
        tableId: "doc-5c-manual",
        tableName: "5C使用説明書",
        fields: [],
      },
      {
        tableId: "demo-config-minimum",
        tableName: "最低遵守サンプル設定",
        fields: demoMinimumChecklist.map((item) => ({
          fieldId: item.key,
          fieldName: item.label,
          type: "singleSelect",
        })),
      },
      {
        tableId: "demo-config-op",
        tableName: "運営基準サンプル設定",
        fields: demoOperationChecklist.map((item) => ({
          fieldId: item.key,
          fieldName: item.label,
          type: "singleSelect",
        })),
      },
      {
        tableId: "demo-config-value",
        tableName: "価値創造サンプル設定",
        fields: demoValueChecklist.map((item) => ({
          fieldId: item.key,
          fieldName: item.label,
          type: "singleSelect",
        })),
      },
    ];
  }
}
