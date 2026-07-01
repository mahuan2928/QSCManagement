"use client";

import { create } from "zustand";

import {
  buildChecklistItems,
  calculateChecklistScore,
  canAdvanceAfterMinimum,
} from "../lib/business-rules";
import type { AuditChecklistItem, Store, UploadedPhoto } from "../lib/domain";

interface TaskDraft {
  id: string;
  category: "minimum" | "operation" | "value";
  sourceItemKey: string;
  issueType: string;
  comment: string;
  improvementPlan: string;
  dueDate: string;
  assignee: string;
  beforePhotos: UploadedPhoto[];
}

interface AuditWizardState {
  step: 1 | 2 | 3 | 4 | 5;
  storeId: string;
  cycle: "Q1" | "Q2" | "Q3" | "Q4";
  auditDate: string;
  evaluator: string;
  minimumItems: AuditChecklistItem[];
  operationItems: AuditChecklistItem[];
  valueItems: AuditChecklistItem[];
  tasks: TaskDraft[];
  setStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  updateMeta: (input: {
    storeId?: string;
    cycle?: "Q1" | "Q2" | "Q3" | "Q4";
    auditDate?: string;
    evaluator?: string;
  }) => void;
  updateMinimumItem: (key: string, value: Partial<AuditChecklistItem>) => void;
  updateOperationItem: (key: string, value: Partial<AuditChecklistItem>) => void;
  updateValueItem: (key: string, value: Partial<AuditChecklistItem>) => void;
  upsertTask: (task: TaskDraft) => void;
  removeTask: (taskId: string) => void;
  reset: (
    stores: Store[],
    evaluator: string,
    minimumItems: AuditChecklistItem[],
    operationItems: AuditChecklistItem[],
    valueItems: AuditChecklistItem[],
  ) => void;
}

export function createTaskId(key: string) {
  return `task-${key}`;
}

export const useAuditWizardStore = create<AuditWizardState>((set) => ({
  step: 1,
  storeId: "",
  cycle: "Q1",
  auditDate: new Date().toISOString().slice(0, 10),
  evaluator: "",
  minimumItems: [],
  operationItems: [],
  valueItems: [],
  tasks: [],
  setStep: (step) => set({ step }),
  updateMeta: (input) => set((state) => ({ ...state, ...input })),
  updateMinimumItem: (key, value) =>
    set((state) => ({
      minimumItems: state.minimumItems.map((item) =>
        item.key === key ? { ...item, ...value } : item,
      ),
    })),
  updateOperationItem: (key, value) =>
    set((state) => ({
      operationItems: state.operationItems.map((item) =>
        item.key === key ? { ...item, ...value } : item,
      ),
    })),
  updateValueItem: (key, value) =>
    set((state) => ({
      valueItems: state.valueItems.map((item) =>
        item.key === key ? { ...item, ...value } : item,
      ),
    })),
  upsertTask: (task) =>
    set((state) => {
      const current = state.tasks.filter((item) => item.id !== task.id);
      return { tasks: [...current, task] };
    }),
  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== taskId),
    })),
  reset: (stores, evaluator, minimumItems, operationItems, valueItems) =>
    set({
      step: 1,
      storeId: stores[0]?.id ?? "",
      cycle: "Q1",
      auditDate: new Date().toISOString().slice(0, 10),
      evaluator,
      minimumItems,
      operationItems,
      valueItems,
      tasks: [],
    }),
}));

export function useMinimumGate(items: AuditChecklistItem[]) {
  const score = calculateChecklistScore(items);
  return {
    score,
    canProceed: canAdvanceAfterMinimum(items),
  };
}

export function buildDefaultChecklist(
  operationItems: AuditChecklistItem[],
  valueItems: AuditChecklistItem[],
) {
  return {
    operationItems: operationItems.length ? operationItems : buildChecklistItems([]),
    valueItems: valueItems.length ? valueItems : buildChecklistItems([]),
  };
}
