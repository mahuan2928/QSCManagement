import type {
  AuditChecklistItem,
  ChecklistDefinition,
  DashboardSummary,
  RectificationTask,
  TaskStatus,
} from "./domain";

export const OPERATION_PASS_SCORE = 100;
export const MINIMUM_PASS_SCORE = 22;
export const VALUE_MAX_SCORE = 20;
export const OPERATION_MAX_SCORE = 50;
export const MINIMUM_MAX_SCORE = 22;

export function buildChecklistItems(
  definitions: ChecklistDefinition[],
): AuditChecklistItem[] {
  return definitions.map((definition) => ({
    ...definition,
    status: "ok",
    note: "",
  }));
}

export function calculateChecklistScore(items: AuditChecklistItem[]): number {
  return items.reduce((sum, item) => {
    return item.status === "ok" ? sum + item.maxScore : sum;
  }, 0);
}

export function hasPendingChecklistItems(_items: AuditChecklistItem[]): boolean {
  return false;
}

export function resolveMinimumGrade(score: number): string {
  if (score === 0) {
    return "---";
  }

  if (score === 22) {
    return "C評価";
  }

  return "D評価";
}

export function resolveOperationGrade(score: number): string {
  if (score === 0) {
    return "---";
  }

  if (score === 50) {
    return "B評価";
  }

  return "C評価";
}

export function resolveValueGrade(score: number): string {
  if (score === 0) {
    return "---";
  }

  if (score <= 9) {
    return "B評価";
  }

  if (score <= 17) {
    return "A評価";
  }

  return "S評価";
}

export function canAdvanceAfterMinimum(items: AuditChecklistItem[]): boolean {
  return calculateChecklistScore(items) === MINIMUM_PASS_SCORE;
}

export function isDueSoon(dueDate: string): boolean {
  const due = new Date(dueDate).getTime();
  const now = Date.now();
  const threeDays = 1000 * 60 * 60 * 24 * 3;
  return due >= now && due - now <= threeDays;
}

export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate).getTime() < Date.now();
}

export function normalizeTaskStatus(task: RectificationTask): TaskStatus {
  if (task.status === "resolved") {
    return "resolved";
  }

  if (task.status === "submitted") {
    return "submitted";
  }

  if (isOverdue(task.dueDate)) {
    return "overdue";
  }

  return "open";
}

export function summarizeTasks(tasks: RectificationTask[]): DashboardSummary {
  return tasks.reduce<DashboardSummary>(
    (summary, task) => {
      const status = normalizeTaskStatus(task);

      if (status === "open" || status === "overdue") {
        summary.pendingTasks += 1;
      }

      if (status === "submitted") {
        summary.submittedTasks += 1;
      }

      if (status === "overdue") {
        summary.overdueTasks += 1;
      }

      if (status === "open" && isDueSoon(task.dueDate)) {
        summary.dueSoonTasks += 1;
      }

      return summary;
    },
    {
      pendingTasks: 0,
      dueSoonTasks: 0,
      overdueTasks: 0,
      submittedTasks: 0,
    },
  );
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
