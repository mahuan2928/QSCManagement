"use client";

import type { TaskStatus } from "../lib/domain";
import { cn } from "../lib/utils";

const styleMap: Record<TaskStatus, string> = {
  open: "bg-sky-500/10 text-sky-200 ring-sky-400/30",
  overdue: "bg-rose-500/10 text-rose-200 ring-rose-400/30",
  submitted: "bg-amber-500/10 text-amber-100 ring-amber-300/30",
  resolved: "bg-emerald-500/10 text-emerald-100 ring-emerald-300/30",
};

const labelMap: Record<TaskStatus, string> = {
  open: "未対応",
  overdue: "期限超過",
  submitted: "報告済み",
  resolved: "完了",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        styleMap[status],
      )}
    >
      {labelMap[status]}
    </span>
  );
}
