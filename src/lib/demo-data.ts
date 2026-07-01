import {
  demoMinimumChecklist,
  demoOperationChecklist,
  demoValueChecklist,
} from "./config";
import {
  buildChecklistItems,
  calculateChecklistScore,
  normalizeTaskStatus,
  resolveMinimumGrade,
  resolveOperationGrade,
  resolveValueGrade,
} from "./business-rules";
import type {
  AuditChecklistItem,
  FiveCResult,
  OperationAudit,
  RectificationTask,
  SessionUser,
  Store,
  ValueAudit,
} from "./domain";

const imageBase =
  "https://copilot-sg-og.byteintl.net/api/ide/v1/text_to_image?image_size=landscape_4_3&prompt=";

function makeImage(prompt: string) {
  return `${imageBase}${encodeURIComponent(prompt)}`;
}

const demoStores: Store[] = [
  {
    id: "store-shibuya",
    name: "渋谷店",
    region: "東京",
    block: "東日本 A",
    format: "CITY",
    group: "渋谷グループ",
    svName: "山田 SV",
    svCode: "sv-yamada",
    manager: "佐藤",
    officer: "田中",
    latestAuditDate: "2026-06-20",
    latestOperationScore: 90,
    latestValueScore: 30,
    latestTotalScore: 120,
    previousTotalScore: 108,
    currentRank: 2,
    previousRank: 4,
    hygieneCurrentScore: 82,
    hygienePreviousScore: 79,
  },
  {
    id: "store-shinjuku",
    name: "新宿店",
    region: "東京",
    block: "東日本 A",
    format: "FC",
    group: "新宿グループ",
    svName: "山田 SV",
    svCode: "sv-yamada",
    manager: "井上",
    officer: "松本",
    latestAuditDate: "2026-06-18",
    latestOperationScore: 100,
    latestValueScore: 40,
    latestTotalScore: 140,
    previousTotalScore: 126,
    currentRank: 1,
    previousRank: 2,
    hygieneCurrentScore: 91,
    hygienePreviousScore: 88,
  },
  {
    id: "store-yokohama",
    name: "横浜店",
    region: "神奈川",
    block: "東日本 B",
    format: "ロードサイド",
    group: "横浜グループ",
    svName: "中村 SV",
    svCode: "sv-nakamura",
    manager: "小林",
    officer: "高桥",
    latestAuditDate: "2026-06-15",
    latestOperationScore: 80,
    latestValueScore: 0,
    latestTotalScore: 80,
    previousTotalScore: 65,
    currentRank: 3,
    previousRank: 3,
    hygieneCurrentScore: 78,
    hygienePreviousScore: 75,
  },
];

function createAuditFromStatuses(
  store: Store,
  auditDate: string,
  createdBy: string,
  cycle: "Q1" | "Q2" | "Q3" | "Q4",
  minimumNgKeys: string[],
  operationNgKeys: string[],
  valueNgKeys: string[],
) {
  const minimumItems: AuditChecklistItem[] = buildChecklistItems(demoMinimumChecklist).map((item) => ({
    ...item,
    status: minimumNgKeys.includes(item.key) ? "ng" : "ok",
  }));
  const operationItems: AuditChecklistItem[] = buildChecklistItems(demoOperationChecklist).map((item) => ({
    ...item,
    status: operationNgKeys.includes(item.key) ? "ng" : "ok",
  }));
  const valueItems: AuditChecklistItem[] = buildChecklistItems(demoValueChecklist).map((item) => ({
    ...item,
    status: valueNgKeys.includes(item.key) ? "ng" : "ok",
  }));

  const minimumScore = calculateChecklistScore(minimumItems);
  const minimumPassed = minimumScore === 22;
  const operationScore = minimumPassed ? calculateChecklistScore(operationItems) : 0;
  const valueScore = minimumPassed ? calculateChecklistScore(valueItems) : 0;

  const minimumAudit: OperationAudit = {
    id: `minimum-${store.id}-${auditDate}`,
    storeId: store.id,
    storeName: store.name,
    auditDate,
    score: minimumScore,
    grade: resolveMinimumGrade(minimumScore),
    completionState: "completed",
    isPerfect: minimumPassed,
    items: minimumItems,
  };

  const operationAudit: OperationAudit = {
    id: `op-${store.id}-${auditDate}`,
    storeId: store.id,
    storeName: store.name,
    auditDate,
    score: operationScore,
    grade: resolveOperationGrade(operationScore),
    completionState: "completed",
    isPerfect: operationScore === 50,
    items: operationItems,
  };

  const valueAudit: ValueAudit = {
    id: `va-${store.id}-${auditDate}`,
    storeId: store.id,
    storeName: store.name,
    auditDate,
    score: valueScore,
    grade: resolveValueGrade(valueScore),
    completionState: minimumPassed ? "completed" : "blocked",
    items: valueItems,
  };

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
    stage: minimumPassed ? "completed" : "minimum_failed",
    createdBy,
    minimumAuditId: minimumAudit.id,
    operationAuditId: operationAudit.id,
    valueAuditId: minimumPassed ? valueAudit.id : undefined,
  };

  return { minimumAudit, operationAudit, valueAudit, result };
}

const shibuyaAudit = createAuditFromStatuses(
  demoStores[0],
  "2026-06-20",
  "山田 SV",
  "Q2",
  ["minimum-02"],
  [],
  [],
);

const shinjukuAudit = createAuditFromStatuses(
  demoStores[1],
  "2026-06-18",
  "山田 SV",
  "Q2",
  [],
  [],
  [],
);

const yokohamaAudit = createAuditFromStatuses(
  demoStores[2],
  "2026-06-15",
  "中村 SV",
  "Q2",
  ["minimum-05"],
  ["operation-12", "operation-18"],
  [],
);

const demoTasks: RectificationTask[] = [
  {
    id: "task-shibuya-1",
    storeId: "store-shibuya",
    storeName: "渋谷店",
    auditDate: "2026-06-20",
    category: "minimum",
    sourceItemKey: "minimum-02",
    issueType: "最低遵守",
    comment: "挨拶・身だしなみの基準が満たされていません。",
    improvementPlan: "スタッフ全員へ基準を再周知し、改善後写真とコメントを提出してください。",
    dueDate: "2026-07-03",
    assignee: "渋谷店 店長",
    svName: "山田 SV",
    status: "open",
    confirmationStatus: "pending",
    beforePhotos: [
      {
        name: "改善前.jpg",
        url: makeImage(
          "retail store entrance with messy restocking boxes blocking customer path, realistic operations audit photo",
        ),
      },
    ],
    afterPhotos: [],
    linkedOperationAuditId: shibuyaAudit.minimumAudit.id,
    linkedResultId: shibuyaAudit.result.id,
    history: [],
  },
  {
    id: "task-yokohama-1",
    storeId: "store-yokohama",
    storeName: "横浜店",
    auditDate: "2026-06-15",
    category: "minimum",
    sourceItemKey: "minimum-05",
    issueType: "賞味期限管理",
    comment: "冷蔵ケース内で期限間近の商品が混在し、ラベル表示も不明瞭です。",
    improvementPlan: "売場を再区分し、ラベルを貼り直したうえで、朝礼で期限点検ルールを再周知してください。",
    dueDate: "2026-06-22",
    assignee: "横浜店 副店長",
    svName: "中村 SV",
    status: "submitted",
    confirmationStatus: "pending",
    beforePhotos: [
      {
        name: "改善前.jpg",
        url: makeImage(
          "convenience store refrigerator with mixed expiry-date labels and disorganized food arrangement, realistic audit photo",
        ),
      },
    ],
    afterPhotos: [
      {
        name: "改善後.jpg",
        url: makeImage(
          "retail fridge reorganized with clean expiry-date labels, realistic improvement verification photo",
        ),
      },
    ],
    feedbackComment: "陳列を再編成し、ラベルを貼り直しました。今後は班長が毎日再確認します。",
    feedbackSubmittedAt: "2026-06-20T09:30:00.000Z",
    linkedOperationAuditId: yokohamaAudit.minimumAudit.id,
    linkedResultId: yokohamaAudit.result.id,
    history: [
      {
        id: "feedback-yokohama-1",
        taskId: "task-yokohama-1",
        comment: "陳列を再編成し、ラベルを貼り直しました。今後は班長が毎日再確認します。",
        photos: [
          {
            name: "改善後.jpg",
            url: makeImage(
              "retail fridge reorganized with clean expiry-date labels, realistic improvement verification photo",
            ),
          },
        ],
        submittedAt: "2026-06-20T09:30:00.000Z",
        submittedBy: "横浜店",
      },
    ],
  },
];

demoTasks.forEach((task) => {
  task.status = normalizeTaskStatus(task);
});

export const demoResults = [shibuyaAudit.result, shinjukuAudit.result, yokohamaAudit.result];
export const demoOperationAudits = [
  shibuyaAudit.minimumAudit,
  shinjukuAudit.minimumAudit,
  yokohamaAudit.minimumAudit,
  shibuyaAudit.operationAudit,
  shinjukuAudit.operationAudit,
  yokohamaAudit.operationAudit,
];
export const demoValueAudits = [
  shibuyaAudit.valueAudit,
  shinjukuAudit.valueAudit,
  yokohamaAudit.valueAudit,
];
export const demoStoresSeed = demoStores;
export const demoTasksSeed = demoTasks;

export const demoProfiles: Record<string, SessionUser> = {
  "demo-sv": {
    id: "demo-sv",
    role: "sv",
    mode: "demo",
    name: "山田 SV",
    svCode: "sv-yamada",
  },
  "demo-store": {
    id: "demo-store",
    role: "store",
    mode: "demo",
    name: "渋谷店",
    storeId: "store-shibuya",
    storeName: "渋谷店",
  },
};
