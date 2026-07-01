import Link from "next/link";
import { ClipboardList, ShieldCheck, Store as StoreIcon } from "lucide-react";

import { ScoreTrendChart } from "../../../../components/score-trend-chart";
import { StatCard } from "../../../../components/stat-card";
import { StatusBadge } from "../../../../components/status-badge";
import { requireSession } from "../../../../lib/auth/session";
import { getRepositoryForSession } from "../../../../lib/repositories";

export default async function MyFiveCPage() {
  const user = await requireSession("store");
  const repository = await getRepositoryForSession(user);
  const workbench = await repository.getStoreWorkbench(user);

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">My Store</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{workbench.store.name} · マイ 5C</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">「自店の結果」と「自店の是正」に絞ったシンプルな画面で、スマホでもすぐに確認・報告できます。</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="最新合計スコア" value={workbench.latestResult?.totalScore ?? "-"} hint="Base の数式集計値を表示します" icon={<StoreIcon className="size-4" />} />
        <StatCard label="最低遵守" value={workbench.latestResult?.minimumScore ?? "-"} hint="22 / 22 OK のときのみ後続評価が解放されます" icon={<ShieldCheck className="size-4" />} />
        <StatCard label="運営基準 / 価値創造" value={workbench.latestResult ? `${workbench.latestResult.operationScore} / ${workbench.latestResult.valueScore}` : "-"} hint="最低遵守が未通過の場合は 0 または非表示扱いです" icon={<ClipboardList className="size-4" />} />
        <StatCard label="未完了の是正" value={workbench.openTasks.filter((task) => task.status !== "resolved").length} hint="是正管理からそのまま報告できます" icon={<ClipboardList className="size-4" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <ScoreTrendChart results={workbench.history} />

        <div className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">現在の是正項目</h3>
              <p className="mt-1 text-sm text-zinc-400">最新の対応要求と進捗を確認できます。</p>
            </div>
            <Link href="/tasks" className="text-sm text-sky-200">
              報告する
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {workbench.openTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-300">{task.issueType}</p>
                    <h4 className="mt-1 text-base font-medium text-white">{task.comment}</h4>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                <p className="mt-3 text-sm text-zinc-400">{task.improvementPlan}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
