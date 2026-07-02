import { z } from "zod";

import manifestJson from "../config/production/base-schema-manifest.production.json";
import minimumChecklistJson from "../config/production/minimum-checklist.production.json";
import operationChecklistJson from "../config/production/operation-checklist.production.json";
import valueChecklistJson from "../config/production/value-checklist.production.json";
import type { ChecklistDefinition } from "./domain";

const checklistItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  group: z.string().min(1),
  maxScore: z.number().positive(),
  larkFieldId: z.string().min(1).optional(),
  larkFieldName: z.string().min(1).optional(),
  description: z.string().optional(),
});

const checklistSchema = z.array(checklistItemSchema);

const manifestSchema = z.object({
  appToken: z.string().min(1),
  tables: z.object({
    stores: z.object({
      tableId: z.string().min(1),
      tableName: z.string().min(1),
      formatFieldName: z.string().min(1),
      groupFieldName: z.string().min(1),
      svFieldName: z.string().min(1),
      managerFieldName: z.string().min(1),
      officerFieldName: z.string().min(1),
      latestDateFieldName: z.string().min(1),
      currentOperationScoreFieldName: z.string().min(1),
      currentValueScoreFieldName: z.string().min(1),
      currentTotalScoreFieldName: z.string().min(1),
      previousTotalScoreFieldName: z.string().min(1),
      currentRankFieldName: z.string().min(1),
      previousRankFieldName: z.string().min(1),
      hygieneCurrentScoreFieldName: z.string().min(1),
      hygienePreviousScoreFieldName: z.string().min(1),
    }),
    hygiene: z
      .object({
        tableId: z.string().min(1),
        tableName: z.string().min(1),
        storeFieldName: z.string().min(1),
        periodFieldName: z.string().min(1),
        scoreFieldName: z.string().min(1),
      })
      .optional(),
    minimum: z.object({
      tableId: z.string().min(1),
      tableName: z.string().min(1),
      scoreFieldName: z.string().min(1),
      gradeFieldName: z.string().min(1),
      completionFieldName: z.string().min(1),
    }),
    operation: z.object({
      tableId: z.string().min(1),
      tableName: z.string().min(1),
      scoreFieldName: z.string().min(1),
      gradeFieldName: z.string().min(1),
      completionFieldName: z.string().min(1),
    }),
    value: z.object({
      tableId: z.string().min(1),
      tableName: z.string().min(1),
      scoreFieldName: z.string().min(1),
      gradeFieldName: z.string().min(1),
      completionFieldName: z.string().min(1),
    }),
    issues: z.object({
      tableId: z.string().min(1),
      tableName: z.string().min(1),
      surveyTypeFieldName: z.string().min(1),
      cycleFieldName: z.string().min(1),
      typeFieldName: z.string().min(1),
      minimumIssueFieldName: z.string().min(1),
      operationIssueFieldName: z.string().min(1),
      valueIssueFieldName: z.string().min(1),
      improvementFieldName: z.string().min(1),
      dueDateFieldName: z.string().min(1),
      beforePhotoFieldName: z.string().min(1),
      afterPhotoFieldName: z.string().min(1),
      commentFieldName: z.string().min(1),
    }),
    itemMaster: z.object({
      tableId: z.string().min(1),
      tableName: z.string().min(1),
    }),
  }),
});

function hasUnresolvedValue(value: string | undefined) {
  return typeof value === "string" && value.startsWith("__UNRESOLVED_");
}

function assertChecklistCount(items: ChecklistDefinition[], expectedCount: number, name: string) {
  if (items.length !== expectedCount) {
    throw new Error(`${name} 映射数量不正确，期望 ${expectedCount} 项，实际 ${items.length} 项。`);
  }
}

function assertChecklistResolved(items: ChecklistDefinition[], name: string) {
  const unresolved = items.filter(
    (item) => hasUnresolvedValue(item.larkFieldId) || hasUnresolvedValue(item.larkFieldName),
  );

  if (unresolved.length > 0) {
    throw new Error(
      `${name} 仍有 ${unresolved.length} 个未解析字段映射。请先根据真实 Base schema 填写 production JSON。`,
    );
  }
}

export const productionBaseManifest = manifestSchema.parse(manifestJson);
export const productionMinimumChecklist = checklistSchema.parse(
  minimumChecklistJson,
) as ChecklistDefinition[];
export const productionOperationChecklist = checklistSchema.parse(
  operationChecklistJson,
) as ChecklistDefinition[];
export const productionValueChecklist = checklistSchema.parse(
  valueChecklistJson,
) as ChecklistDefinition[];

assertChecklistCount(productionMinimumChecklist, 22, "最低遵守項目");
assertChecklistCount(productionOperationChecklist, 50, "運営基準項目");
assertChecklistCount(productionValueChecklist, 20, "価値創造項目");

export function getChecklistConfigForMode(mode: "demo" | "production", fallback: {
  minimum: ChecklistDefinition[];
  operation: ChecklistDefinition[];
  value: ChecklistDefinition[];
}) {
  if (mode === "demo") {
    return fallback;
  }

  return {
    minimum: productionMinimumChecklist,
    operation: productionOperationChecklist,
    value: productionValueChecklist,
  };
}

export function assertProductionChecklistResolved() {
  assertChecklistResolved(productionMinimumChecklist, "最低遵守項目");
  assertChecklistResolved(productionOperationChecklist, "運営基準項目");
  assertChecklistResolved(productionValueChecklist, "価値創造項目");
}
