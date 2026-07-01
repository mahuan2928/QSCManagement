import Link from "next/link";
import { AlertTriangle, Building2, Clock3, ListChecks, Radar } from "lucide-react";

import { StatCard } from "../../../../components/stat-card";
import { StatusBadge } from "../../../../components/status-badge";
import { formatDateTime } from "../../../../lib/business-rules";
import { requireSession } from "../../../../lib/auth/session";
import { getRepositoryForSession } from "../../../../lib/repositories";

export default async function SvDashboardPage() {
  const user = await requireSession("sv");
  const repository = await getRepositoryForSession(user);
  const data = await repository.getSvDashboard(user);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="未対応課題" value={data.summary.pendingTasks} hint="未対応と期限超過を含みます" icon={<ListChecks className="size-4" />} />
        <StatCard label="3日以内の期限" value={data.summary.dueSoonTasks} hint="優先フォローが必要な課題" icon={<Clock3 className="size-4" />} />
        <StatCard label="期限超過" value={data.summary.overdueTasks} hint="即時対応が必要なリスク" icon={<AlertTriangle className="size-4" />} />
        <StatCard label="報告済み未確認" value={data.summary.submittedTasks} hint="SV の確認待ちです" icon={<Radar className="size-4" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">担当店舗</h2>
              <p className="mt-1 text-sm text-zinc-400">権限範囲内で閲覧可能な店舗のみ表示します。</p>
            </div>
            <Link href="/sv/audits/new" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950">
              評価を開始
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {data.stores.map((store) => (
              <div key={store.id} className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-white">
                      <Building2 className="size-4 text-sky-200" />
                      <span className="font-medium">{store.name}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">
                      {store.region} · {store.block}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-white">{store.latestTotalScore ?? "-"}</div>
                    <p className="text-xs text-zinc-400">最新合計スコア</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">是正課題</h2>
              <p className="mt-1 text-sm text-zinc-400">詳細確認とフォローアップに遷移できます。</p>
            </div>
            <Link href="/tasks" className="text-sm text-sky-200">
              すべて見る
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {data.tasks.slice(0, 6).map((task) => (
              <div key={task.id} className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-300">{task.storeName}</p>
                    <h3 className="mt-1 text-base font-medium text-white">{task.issueType}</h3>
                    <p className="mt-2 text-sm text-zinc-400">{task.comment}</p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                <div className="mt-3 text-xs text-zinc-500">期限 {formatDateTime(task.dueDate)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/6 p-4 backdrop-blur">
        <h2 className="text-lg font-semibold text-white">最近の 5C 評価</h2>
        <div className="mt-4 overflow-hidden rounded-[24px] border border-white/8">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950/55 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">店舗</th>
                <th className="px-4 py-3 font-medium">日付</th>
                <th className="px-4 py-3 font-medium">最低遵守</th>
                <th className="px-4 py-3 font-medium">運営基準</th>
                <th className="px-4 py-3 font-medium">価値創造</th>
                <th className="px-4 py-3 font-medium">合計</th>
              </tr>
            </thead>
            <tbody>
              {data.recentResults.map((result) => (
                <tr key={result.id} className="border-t border-white/8 bg-slate-950/20 text-zinc-100">
                  <td className="px-4 py-3">{result.storeName}</td>
                  <td className="px-4 py-3">{result.auditDate}</td>
                  <td className="px-4 py-3">{result.minimumScore}</td>
                  <td className="px-4 py-3">{result.operationScore}</td>
                  <td className="px-4 py-3">{result.valueScore || "-"}</td>
                  <td className="px-4 py-3 font-medium">{result.totalScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
