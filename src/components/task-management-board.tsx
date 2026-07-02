"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Camera, CircleCheckBig, Search } from "lucide-react";

import { formatDateTime, isDueSoon, isOverdue } from "../lib/business-rules";
import type { RectificationTask, SessionUser, Store, TaskStatus, UploadedPhoto } from "../lib/domain";
import { StatusBadge } from "./status-badge";

function toPreviewPhotos(files: File[]): UploadedPhoto[] {
  return files.map((file) => ({
    name: file.name,
    url: URL.createObjectURL(file),
  }));
}

function replaceTask(tasks: RectificationTask[], nextTask: RectificationTask) {
  return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
}

export function TaskManagementBoard(props: {
  tasks: RectificationTask[];
  user: SessionUser;
  stores: Store[];
  initialStoreId?: string;
  initialStatus?: TaskStatus | "all";
  initialKeyword?: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(props.tasks);
  const [selectedTaskId, setSelectedTaskId] = useState(props.tasks[0]?.id);
  const [status, setStatus] = useState<TaskStatus | "all">(props.initialStatus ?? "all");
  const [storeId, setStoreId] = useState(props.initialStoreId ?? "all");
  const [keyword, setKeyword] = useState(props.initialKeyword ?? "");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const keywordMatched =
        !keyword ||
        [task.storeName, task.issueType, task.comment, task.feedbackComment ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(keyword.toLowerCase());
      const storeMatched = storeId === "all" || task.storeId === storeId;
      const statusMatched = status === "all" || task.status === status;
      return keywordMatched && storeMatched && statusMatched;
    });
  }, [keyword, status, storeId, tasks]);

  const selectedTask =
    filteredTasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? null;

  const submitFeedback = () => {
    if (!selectedTask) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      const formData = new FormData();
      formData.set("comment", comment);
      photoFiles.forEach((file) => {
        formData.append("photos", file);
      });

      const response = await fetch(`/api/tasks/${selectedTask.id}/feedback`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        setMessage(json.error ?? "送信に失敗しました。時間を置いて再度お試しください。");
        return;
      }

      const updatedTask = (await response.json()) as RectificationTask;
      setTasks((current) => replaceTask(current, updatedTask));
      setComment("");
      setPhotos([]);
      setPhotoFiles([]);
      setMessage("是正報告を送信しました。");
      router.refresh();
    });
  };

  const resolveTask = () => {
    if (!selectedTask) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/tasks/${selectedTask.id}/resolve`, { method: "POST" });
      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        setMessage(json.error ?? "ステータス更新に失敗しました。");
        return;
      }
      const updatedTask = (await response.json()) as RectificationTask;
      setTasks((current) => replaceTask(current, updatedTask));
      setMessage("是正完了に更新しました。");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 border-b border-white/8 pb-4 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2">
            <Search className="size-4 text-zinc-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="店舗名 / 問題内容で検索"
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
            />
          </div>
          <select
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
          >
            <option value="all">全店舗</option>
            {props.stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as TaskStatus | "all")}
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
          >
            <option value="all">全ステータス</option>
            <option value="open">未対応</option>
            <option value="submitted">報告済み</option>
            <option value="overdue">期限超過</option>
            <option value="resolved">完了</option>
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {filteredTasks.map((task) => (
            <button
              type="button"
              key={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                task.id === selectedTask?.id
                  ? "border-sky-300/40 bg-sky-400/10"
                  : "border-white/8 bg-slate-950/35 hover:bg-white/8"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-300">{task.storeName}</p>
                  <h3 className="mt-1 text-base font-medium text-white">{task.issueType}</h3>
                  <p className="mt-2 text-sm text-zinc-400">{task.comment}</p>
                </div>
                <StatusBadge status={task.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span>期限 {formatDateTime(task.dueDate)}</span>
                {isDueSoon(task.dueDate) && task.status === "open" ? <span>3日以内に期限到来</span> : null}
                {isOverdue(task.dueDate) && task.status !== "resolved" ? <span>期限超過</span> : null}
              </div>
            </button>
          ))}
          {filteredTasks.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/10 p-8 text-center text-sm text-zinc-400">
              条件に一致する是正項目はありません。
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
        {selectedTask ? (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-300">{selectedTask.storeName}</p>
                <h3 className="mt-1 text-lg font-semibold text-white">{selectedTask.issueType}</h3>
              </div>
              <StatusBadge status={selectedTask.status} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-3">
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <CalendarClock className="size-4 text-sky-200" />
                  期限
                </div>
                <p className="mt-2 text-sm text-white">{formatDateTime(selectedTask.dueDate)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-slate-950/35 p-3">
                <div className="text-sm text-zinc-300">対応要求</div>
                <p className="mt-2 text-sm text-white">{selectedTask.improvementPlan}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/35 p-3">
              <p className="text-sm text-zinc-300">問題内容</p>
              <p className="mt-2 text-sm leading-6 text-zinc-100">{selectedTask.comment}</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm text-zinc-300">改善前写真</p>
                <div className="grid gap-2">
                  {selectedTask.beforePhotos.map((photo) => (
                    <img
                      key={photo.url}
                      src={photo.url}
                      alt={photo.name}
                      className="h-28 w-full rounded-2xl object-cover"
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm text-zinc-300">改善後写真</p>
                <div className="grid gap-2">
                  {selectedTask.afterPhotos.length ? (
                    selectedTask.afterPhotos.map((photo) => (
                      <img
                        key={photo.url}
                        src={photo.url}
                        alt={photo.name}
                        className="h-28 w-full rounded-2xl object-cover"
                      />
                    ))
                  ) : (
                    <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">
                      改善後写真は未登録です
                    </div>
                  )}
                </div>
              </div>
            </div>

            {props.user.role === "store" ? (
              <div className="mt-5 rounded-[24px] border border-sky-400/15 bg-sky-400/6 p-4">
                <h4 className="text-sm font-medium text-white">是正報告を提出</h4>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="是正内容、改善結果、再発防止策を入力してください"
                  className="mt-3 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-3 text-sm outline-none placeholder:text-zinc-500"
                />
                <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-white/12 px-3 py-3 text-sm text-zinc-300">
                  <Camera className="size-4" />
                  改善後写真をアップロード
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      if (!event.target.files) return;
                      const files = Array.from(event.target.files);
                      setPhotoFiles(files);
                      setPhotos(toPreviewPhotos(files));
                    }}
                  />
                </label>
                {photos.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {photos.map((photo) => (
                      <img
                        key={photo.url}
                        src={photo.url}
                        alt={photo.name}
                        className="h-20 w-full rounded-2xl object-cover"
                      />
                    ))}
                  </div>
                ) : null}
                {message ? <p className="mt-3 text-sm text-rose-200">{message}</p> : null}
                <button
                  type="button"
                  onClick={submitFeedback}
                  disabled={pending || !comment.trim() || photos.length === 0}
                  className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "送信中..." : "是正報告を送信"}
                </button>
              </div>
            ) : null}

            {props.user.role === "sv" ? (
              <div className="mt-5 rounded-[24px] border border-emerald-400/15 bg-emerald-400/6 p-4">
                <h4 className="text-sm font-medium text-white">SV フォローアクション</h4>
                <p className="mt-2 text-sm text-zinc-300">
                  店舗の報告内容を確認し、クローズ完了後に完了ステータスへ更新します。
                </p>
                {selectedTask.feedbackComment ? (
                  <div className="mt-3 rounded-2xl border border-white/8 bg-slate-950/45 p-3 text-sm text-zinc-100">
                    店舗報告：{selectedTask.feedbackComment}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={resolveTask}
                  disabled={pending || selectedTask.status === "resolved"}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CircleCheckBig className="size-4" />
                  是正完了として確定
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full min-h-80 items-center justify-center rounded-[24px] border border-dashed border-white/10 text-sm text-zinc-500">
            表示できる是正詳細がありません。
          </div>
        )}
      </section>
    </div>
  );
}
