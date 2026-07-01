import { TaskManagementBoard } from "../../../components/task-management-board";
import type { TaskStatus } from "../../../lib/domain";
import { requireSession } from "../../../lib/auth/session";
import { getRepositoryForSession } from "../../../lib/repositories";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSession();
  const repository = await getRepositoryForSession(user);
  const resolvedSearchParams = await searchParams;
  const storeIdValue = resolvedSearchParams.storeId;
  const statusValue = resolvedSearchParams.status;
  const searchValue = resolvedSearchParams.search;
  const storeId = Array.isArray(storeIdValue) ? storeIdValue[0] : storeIdValue;
  const status = (Array.isArray(statusValue) ? statusValue[0] : statusValue) as TaskStatus | "all" | undefined;
  const search = Array.isArray(searchValue) ? searchValue[0] : searchValue;
  const tasks = await repository.listTasks(user, {
    storeId: storeId ?? undefined,
    status: status ?? undefined,
    search: search ?? undefined,
  });
  const stores =
    user.role === "sv"
      ? await repository.getStoresForSv(user)
      : [(await repository.getStoreWorkbench(user)).store];

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
        <h2 className="text-2xl font-semibold text-white">是正管理</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          {user.role === "sv"
            ? "担当店舗の課題クローズ状況、報告結果、期限超過、完了状況を確認できます。"
            : "自店舗の是正項目、対応要求、期限を確認し、詳細画面からそのまま報告を提出できます。"}
        </p>
      </section>
      <TaskManagementBoard
        tasks={tasks}
        user={user}
        stores={stores}
        initialStoreId={storeId ?? "all"}
        initialStatus={status ?? "all"}
        initialKeyword={search ?? ""}
      />
    </div>
  );
}
