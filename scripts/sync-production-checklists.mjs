import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const configDir = path.join(projectRoot, "src", "config", "production");

const MINIMUM_COUNT = 22;
const OPERATION_COUNT = 50;
const VALUE_COUNT = 20;

function createChecklistItems({ prefix, count, group, titlePrefix }) {
  return Array.from({ length: count }, (_, index) => {
    const order = String(index + 1).padStart(3, "0");
    return {
      key: `${prefix}-${order}`,
      label: `${titlePrefix} ${order}`,
      group,
      maxScore: 1,
      larkFieldId: `__UNRESOLVED_${prefix.toUpperCase()}_${order}_FIELD_ID__`,
      larkFieldName: `__UNRESOLVED_${prefix.toUpperCase()}_${order}_FIELD_NAME__`,
      description: "Replace with the exact writable OK/NG field from the production Base schema.",
    };
  });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(fileName, value) {
  fs.writeFileSync(
    path.join(configDir, fileName),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

ensureDir(configDir);

writeJson("base-schema-manifest.production.json", {
  appToken: "RADabvBDpavPzFsMmIHj7KOxpXc",
  tables: {
    stores: {
      tableId: "tblKmUWvhrg8v1n0",
      tableName: "店舗関連表",
    },
    minimum: {
      tableId: "tblVQA4TkDmBAImb",
      tableName: "最低遵守項目",
      scoreFieldName: "最低遵守点数",
      gradeFieldName: "店舗評価",
      completionFieldName: "評価完了チェック",
    },
    operation: {
      tableId: "tbldp5mMzD6BRkuj",
      tableName: "運営基準項目",
      scoreFieldName: "運営基準点数",
      gradeFieldName: "店舗評価",
      completionFieldName: "評価完了チェック",
    },
    value: {
      tableId: "tblq0BeYXTzhCqcs",
      tableName: "価値創造項目",
      scoreFieldName: "価値創造点数",
      gradeFieldName: "店舗評価",
      completionFieldName: "評価完了チェック",
    },
    issues: {
      tableId: "tblatoQ7jqgteyQP",
      tableName: "問題指摘",
      surveyTypeFieldName: "アンケート集別",
      cycleFieldName: "第〇クール",
      typeFieldName: "種別",
      minimumIssueFieldName: "最低遵守指摘項目",
      operationIssueFieldName: "運営基準指摘項目",
      valueIssueFieldName: "価値創造指摘項目",
      improvementFieldName: "改善方法 ※SV設定",
      dueDateFieldName: "改善期限",
      photoFieldName: "写真",
      commentFieldName: "コメント",
    },
    itemMaster: {
      tableId: "tblQJcMuzwota38S",
      tableName: "評価項目マスター",
    },
  },
});

writeJson(
  "minimum-checklist.production.json",
  createChecklistItems({
    prefix: "minimum",
    count: MINIMUM_COUNT,
    group: "最低遵守",
    titlePrefix: "最低遵守項目",
  }),
);

writeJson(
  "operation-checklist.production.json",
  createChecklistItems({
    prefix: "operation",
    count: OPERATION_COUNT,
    group: "運営基準",
    titlePrefix: "運営基準項目",
  }),
);

writeJson(
  "value-checklist.production.json",
  createChecklistItems({
    prefix: "value",
    count: VALUE_COUNT,
    group: "価値創造",
    titlePrefix: "価値創造項目",
  }),
);

console.log("Production checklist JSON files have been generated in src/config/production");
