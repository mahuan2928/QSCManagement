"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Camera, CheckCheck, ClipboardCheck, Store as StoreIcon } from "lucide-react";

import {
  buildChecklistItems,
  calculateChecklistScore,
  canAdvanceAfterMinimum,
} from "../lib/business-rules";
import { createTaskId, useAuditWizardStore } from "../hooks/use-audit-wizard-store";
import type { ChecklistDefinition, Store, UploadedPhoto } from "../lib/domain";

async function filesToDataUrls(fileList: FileList): Promise<UploadedPhoto[]> {
  const files = Array.from(fileList);
  return Promise.all(
    files.map(
      (file) =>
        new Promise<UploadedPhoto>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({ name: file.name, url: `${reader.result ?? ""}` });
          };
          reader.readAsDataURL(file);
        }),
    ),
  );
}

function ChecklistSection(props: {
  title: string;
  description: string;
  items: ReturnType<typeof buildChecklistItems>;
  onChange: (key: string, value: "ok" | "ng") => void;
  category: "minimum" | "operation" | "value";
  issueFieldLabel: string;
}) {
  const tasks = useAuditWizardStore((state) => state.tasks);
  const upsertTask = useAuditWizardStore((state) => state.upsertTask);
  const removeTask = useAuditWizardStore((state) => state.removeTask);
  const groups = props.items.reduce<Record<string, typeof props.items>>((accumulator, item) => {
    accumulator[item.group] = [...(accumulator[item.group] ?? []), item];
    return accumulator;
  }, {});

  useEffect(() => {
    const ngItems = props.items.filter((item) => item.status === "ng");
    const allowed = new Set(ngItems.map((item) => createTaskId(item.key)));

    ngItems.forEach((item) => {
      const taskId = createTaskId(item.key);
      if (tasks.some((task) => task.id === taskId)) {
        return;
      }

      upsertTask({
        id: taskId,
        category: props.category,
        sourceItemKey: item.key,
        issueType: item.group,
        comment: `${item.label} が基準未達です`,
        improvementPlan: "",
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        assignee: "",
        beforePhotos: [],
      });
    });

    tasks
      .filter((task) => task.category === props.category && !allowed.has(task.id))
      .forEach((task) => removeTask(task.id));
  }, [props.category, props.items, removeTask, tasks, upsertTask]);

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
      <div className="border-b border-white/8 pb-4">
        <h3 className="text-lg font-semibold text-white">{props.title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{props.description}</p>
      </div>
      <div className="mt-4 space-y-4">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="rounded-3xl border border-white/8 bg-slate-950/35 p-4">
            <h4 className="text-sm font-medium text-sky-100">{group}</h4>
            <div className="mt-3 space-y-3">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-white/8 bg-slate-950/35 p-3"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-white">{item.label}</p>
                      <p className="mt-1 text-xs text-zinc-500">配点 {item.maxScore}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(["ok", "ng"] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => props.onChange(item.key, status)}
                          className={`rounded-full px-3 py-2 text-xs transition ${
                            item.status === status
                              ? status === "ok"
                                ? "bg-emerald-300 text-slate-950"
                                : "bg-rose-300 text-slate-950"
                              : "border border-white/10 bg-white/5 text-zinc-300"
                          }`}
                        >
                          {status === "ok" ? "OK" : "NG"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {item.status === "ng" ? (() => {
                    const taskId = createTaskId(item.key);
                    const current = tasks.find((task) => task.id === taskId) ?? {
                      id: taskId,
                      category: props.category,
                      sourceItemKey: item.key,
                      issueType: item.group,
                      comment: `${item.label} が基準未達です`,
                      improvementPlan: "",
                      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                      assignee: "",
                      beforePhotos: [],
                    };

                    return (
                      <div className="mt-4 rounded-2xl border border-amber-300/18 bg-amber-300/8 p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-1 size-4 text-amber-200" />
                          <div>
                            <h5 className="text-sm font-semibold text-white">NG 項目の是正タスク</h5>
                            <p className="mt-1 text-xs text-zinc-300">
                              この NG 項目を `問題指摘` に起票します。
                            </p>
                            <p className="mt-1 text-[11px] text-zinc-500">
                              {props.issueFieldLabel} に書き戻します。
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <input
                            value={current.issueType}
                            onChange={(event) =>
                              upsertTask({
                                ...current,
                                issueType: event.target.value,
                              })
                            }
                            placeholder="問題種別"
                            className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm"
                          />
                          <input
                            value={current.assignee}
                            onChange={(event) =>
                              upsertTask({
                                ...current,
                                assignee: event.target.value,
                              })
                            }
                            placeholder="担当者"
                            className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm"
                          />
                          <textarea
                            value={current.comment}
                            onChange={(event) =>
                              upsertTask({
                                ...current,
                                comment: event.target.value,
                              })
                            }
                            placeholder="問題内容"
                            className="min-h-24 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm md:col-span-2"
                          />
                          <textarea
                            value={current.improvementPlan}
                            onChange={(event) =>
                              upsertTask({
                                ...current,
                                improvementPlan: event.target.value,
                              })
                            }
                            placeholder="改善方法 / SV 指示"
                            className="min-h-24 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm md:col-span-2"
                          />
                          <input
                            type="date"
                            value={current.dueDate}
                            onChange={(event) =>
                              upsertTask({
                                ...current,
                                dueDate: event.target.value,
                              })
                            }
                            className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm"
                          />
                          <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-white/12 px-3 py-3 text-sm text-zinc-300 md:col-span-2">
                            <Camera className="size-4" />
                            改善前写真をアップロード
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={async (event) => {
                                if (!event.target.files) return;
                                upsertTask({
                                  ...current,
                                  beforePhotos: await filesToDataUrls(event.target.files),
                                });
                              }}
                            />
                          </label>
                          {current.beforePhotos.length ? (
                            <div className="grid grid-cols-3 gap-2 md:col-span-2">
                              {current.beforePhotos.map((photo) => (
                                <img
                                  key={photo.url}
                                  src={photo.url}
                                  alt={photo.name}
                                  className="h-20 w-full rounded-2xl object-cover"
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="flex h-20 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500 md:col-span-2">
                              改善前写真は未登録です
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })() : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AuditWizard(props: {
  stores: Store[];
  evaluator: string;
  minimumDefinitions: ChecklistDefinition[];
  operationDefinitions: ChecklistDefinition[];
  valueDefinitions: ChecklistDefinition[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const store = useAuditWizardStore();
  const minimumItems = useAuditWizardStore((state) => state.minimumItems);
  const operationItems = useAuditWizardStore((state) => state.operationItems);
  const valueItems = useAuditWizardStore((state) => state.valueItems);

  useEffect(() => {
    store.reset(
      props.stores,
      props.evaluator,
      buildChecklistItems(props.minimumDefinitions),
      buildChecklistItems(props.operationDefinitions),
      buildChecklistItems(props.valueDefinitions),
    );
  }, [
    props.evaluator,
    props.minimumDefinitions,
    props.operationDefinitions,
    props.stores,
    props.valueDefinitions,
  ]);

  const minimumScore = useMemo(() => calculateChecklistScore(minimumItems), [minimumItems]);
  const operationScore = useMemo(() => calculateChecklistScore(operationItems), [operationItems]);
  const valueScore = useMemo(() => calculateChecklistScore(valueItems), [valueItems]);
  const minimumNgItems = minimumItems.filter((item) => item.status === "ng");
  const operationNgItems = operationItems.filter((item) => item.status === "ng");
  const valueNgItems = valueItems.filter((item) => item.status === "ng");
  const minimumPassed = canAdvanceAfterMinimum(minimumItems);
  const operationPassed = minimumPassed && operationScore === 50;
  const relevantTasks = store.tasks.filter((task) => {
    if (task.category === "minimum") {
      return minimumNgItems.some((item) => item.key === task.sourceItemKey);
    }
    if (task.category === "operation") {
      return operationNgItems.some((item) => item.key === task.sourceItemKey);
    }
    return valueNgItems.some((item) => item.key === task.sourceItemKey);
  });
  const hasIncompleteTaskDraft = relevantTasks.some(
    (task) =>
      !task.issueType.trim() ||
      !task.comment.trim() ||
      !task.improvementPlan.trim() ||
      !task.dueDate.trim() ||
      !task.assignee.trim(),
  );
  const canSubmitMinimumFailure = minimumNgItems.length > 0 && !hasIncompleteTaskDraft;

  useEffect(() => {
    setMessage("");
  }, [minimumItems, operationItems, valueItems, store.tasks]);

  const submitAudit = (minimumBlocked: boolean) => {
    startTransition(async () => {
      const payload = {
        storeId: store.storeId,
        cycle: store.cycle,
        auditDate: store.auditDate,
        evaluator: store.evaluator,
        minimumItems,
        operationItems: minimumBlocked ? [] : operationItems,
        valueItems: minimumBlocked || !operationPassed ? [] : valueItems,
        minimumCompletionState: "completed",
        operationCompletionState: minimumBlocked ? "blocked" : "completed",
        valueCompletionState: minimumBlocked || !operationPassed ? "blocked" : "completed",
        tasks: store.tasks,
      };

      const response = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        setMessage(json.error ?? "送信に失敗しました");
        return;
      }
      window.location.href = "/sv/dashboard";
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="rounded-2xl border border-white/8 bg-slate-950/35 p-3">
            <span className="text-xs text-zinc-400">店舗</span>
            <select
              value={store.storeId}
              onChange={(event) => store.updateMeta({ storeId: event.target.value })}
              className="mt-2 w-full bg-transparent text-sm outline-none"
            >
              {props.stores.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="rounded-2xl border border-white/8 bg-slate-950/35 p-3">
            <span className="text-xs text-zinc-400">クール</span>
            <select
              value={store.cycle}
              onChange={(event) =>
                store.updateMeta({ cycle: event.target.value as "Q1" | "Q2" | "Q3" | "Q4" })
              }
              className="mt-2 w-full bg-transparent text-sm outline-none"
            >
              {["Q1", "Q2", "Q3", "Q4"].map((cycle) => (
                <option key={cycle} value={cycle}>
                  {cycle}
                </option>
              ))}
            </select>
          </label>
          <label className="rounded-2xl border border-white/8 bg-slate-950/35 p-3">
            <span className="text-xs text-zinc-400">評価日</span>
            <input
              type="date"
              value={store.auditDate}
              onChange={(event) => store.updateMeta({ auditDate: event.target.value })}
              className="mt-2 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <label className="rounded-2xl border border-white/8 bg-slate-950/35 p-3">
            <span className="text-xs text-zinc-400">評価者</span>
            <input
              value={store.evaluator}
              onChange={(event) => store.updateMeta({ evaluator: event.target.value })}
              className="mt-2 w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
      </section>

      <ChecklistSection
        title="ステップ 2 · 最低遵守項目"
        description="22 項目はすべて初期値が OK です。問題がある項目だけ NG に切り替えてください。22 項目すべてが OK の場合のみ、運営基準項目へ進めます。"
        items={minimumItems}
        onChange={(key, value) => store.updateMinimumItem(key, { status: value })}
        category="minimum"
        issueFieldLabel="最低遵守指摘項目"
      />

      <section className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">ステップ 3 · 最低遵守ゲート判定</h3>
            <p className="mt-1 text-sm text-zinc-400">
              最低遵守点数が 22 のときだけ運営基準項目を解放します。21 以下の場合は問題指摘と是正フローに入ります。
            </p>
          </div>
          <div className="rounded-3xl border border-white/8 bg-slate-950/35 px-4 py-3 text-right">
            <div className="text-xs text-zinc-400">最低遵守点数</div>
            <div className="text-3xl font-semibold text-white">{minimumScore} / 22</div>
          </div>
        </div>
        {minimumPassed ? (
          <div className="mt-4 rounded-[24px] border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-50">
            最低遵守 22/22 OK のため、運営基準項目を解放します。
          </div>
        ) : (
          <div className="mt-4 rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
            最低遵守が未通過です。運営基準項目 / 価値創造項目には進めません。未通過項目を問題指摘へ起票してください。
          </div>
        )}
      </section>

      {minimumPassed ? (
        <>
          <ChecklistSection
            title="ステップ 4 · 運営基準項目"
            description="最低遵守 22/22 OK 後に入力可能です。50 項目すべてが OK（50/50）になると、価値創造項目を解放します。"
            items={operationItems}
            onChange={(key, value) => store.updateOperationItem(key, { status: value })}
            category="operation"
            issueFieldLabel="運営基準指摘項目"
          />
          {operationPassed ? (
            <ChecklistSection
              title="ステップ 5 · 価値創造項目"
              description="運営基準 50/50 OK 後に入力可能です。20 項目中 OK 数で A / B / S 評価を算出します。"
              items={valueItems}
              onChange={(key, value) => store.updateValueItem(key, { status: value })}
              category="value"
              issueFieldLabel="価値創造指摘項目"
            />
          ) : (
            <section className="rounded-[28px] border border-white/10 bg-white/4 p-5 opacity-80">
              <h3 className="text-lg font-semibold text-white">ステップ 5 · 価値創造項目（ロック中）</h3>
              <p className="mt-2 text-sm text-zinc-300">
                価値創造項目は運営基準 50/50 満点のときのみ解放されます。現在の運営基準点数: {operationScore} / 50
              </p>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-[28px] border border-white/10 bg-white/4 p-5 opacity-70">
          <h3 className="text-lg font-semibold text-white">後続評価はロック中</h3>
          <p className="mt-2 text-sm text-zinc-300">
            最低遵守項目が全てOKになるまで、運営基準評価には進めません。
          </p>
        </section>
      )}

      <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-white/8 bg-slate-950/35 p-4">
            <StoreIcon className="size-5 text-sky-200" />
            <p className="mt-3 text-sm text-zinc-400">対象店舗</p>
            <p className="mt-1 text-lg text-white">
              {props.stores.find((item) => item.id === store.storeId)?.name ?? "-"}
            </p>
          </div>
          <div className="rounded-3xl border border-white/8 bg-slate-950/35 p-4">
            <ClipboardCheck className="size-5 text-sky-200" />
            <p className="mt-3 text-sm text-zinc-400">最低遵守 / 運営 / 価値創造</p>
            <p className="mt-1 text-lg text-white">
              {minimumScore} / {minimumPassed ? operationScore : "-"} / {minimumPassed ? valueScore : "-"}
            </p>
          </div>
          <div className="rounded-3xl border border-white/8 bg-slate-950/35 p-4">
            <CheckCheck className="size-5 text-sky-200" />
            <p className="mt-3 text-sm text-zinc-400">ゲート状態</p>
            <p className="mt-1 text-lg text-white">{minimumPassed ? "通過" : "未通過"}</p>
          </div>
          <div className="rounded-3xl border border-white/8 bg-slate-950/35 p-4">
            <CheckCheck className="size-5 text-sky-200" />
            <p className="mt-3 text-sm text-zinc-400">起票済み是正件数</p>
            <p className="mt-1 text-lg text-white">{store.tasks.length}</p>
          </div>
        </div>
        {message ? <p className="mt-4 text-sm text-rose-200">{message}</p> : null}
        <div className="mt-5 flex flex-col gap-3 md:flex-row">
          {!minimumPassed ? (
            <button
              type="button"
              disabled={pending || !canSubmitMinimumFailure}
              onClick={() => submitAudit(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-amber-200 disabled:opacity-50"
            >
              最低遵守を送信して問題指摘を起票
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => submitAudit(false)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-sky-100 disabled:opacity-50"
            >
              5C評価を送信
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
        {!minimumPassed && hasIncompleteTaskDraft ? (
          <p className="mt-3 text-sm text-amber-100">
            問題指摘を送信するには、各タスクの担当者と改善方法を入力してください。
          </p>
        ) : null}
      </section>
    </div>
  );
}
