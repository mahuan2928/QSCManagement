"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CheckCheck,
  ListChecks,
  Radar,
  Store as StoreIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardIssueRecord, DashboardOverviewData } from "../lib/domain";
import { StatCard } from "./stat-card";

const pieColors = ["#7dd3fc", "#86efac", "#fcd34d", "#fda4af", "#c4b5fd", "#67e8f9"];

function buildQuery(
  current: URLSearchParams,
  next: Record<string, string | undefined>,
) {
  const params = new URLSearchParams(current.toString());
  Object.entries(next).forEach(([key, value]) => {
    if (!value || value === "all") {
      params.delete(key);
      return;
    }
    params.set(key, value);
  });
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

function buildTasksQuery(options: {
  storeId?: string;
  status?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (options.storeId) {
    params.set("storeId", options.storeId);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.search) {
    params.set("search", options.search);
  }
  const query = params.toString();
  return query ? `/tasks?${query}` : "/tasks";
}

function filterIssueRecords(records: DashboardIssueRecord[], issue?: string) {
  if (!issue) {
    return records.slice(0, 10);
  }
  return records.filter((record) => record.issueType === issue).slice(0, 20);
}

export function DashboardOverview(props: {
  data: DashboardOverviewData;
  selectedIssue?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const issueRecords = useMemo(
    () => filterIssueRecords(props.data.issueRecords, props.selectedIssue),
    [props.data.issueRecords, props.selectedIssue],
  );

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="総店舗数" value={props.data.kpis.totalStores} hint="現在の絞り込み条件に一致する店舗数" icon={<StoreIcon className="size-4" />} />
        <StatCard label="評価済み店舗数" value={props.data.kpis.evaluatedStores} hint="今回スコアが 1 点以上の店舗数" icon={<BarChart3 className="size-4" />} />
        <StatCard label="最低遵守通過率" value={`${props.data.kpis.minimumPassRate}%`} hint="22 / 22 OK で通過した店舗比率" icon={<CheckCheck className="size-4" />} />
        <StatCard label="最低遵守未通過店舗数" value={props.data.kpis.minimumFailedStores} hint="後続評価へ進めない店舗数" icon={<AlertTriangle className="size-4" />} />
        <StatCard label="運営評価完了率" value={`${props.data.kpis.operationCompletionRate}%`} hint="最低遵守通過後に運営評価まで進んだ比率" icon={<Radar className="size-4" />} />
        <StatCard label="整改中問題数" value={props.data.kpis.rectificationOpenCount} hint="未完了の問題指摘件数" icon={<ListChecks className="size-4" />} />
        <StatCard label="超期整改問題数" value={props.data.kpis.overdueRectificationCount} hint="期限超過の問題指摘件数" icon={<AlertTriangle className="size-4" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">評価ランク構成比</h2>
              <p className="mt-1 text-sm text-zinc-400">最低遵守の評価ランク比率です。</p>
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={props.data.gradeComposition}
                  dataKey="value"
                  nameKey="label"
                  outerRadius={100}
                  onClick={(point) => {
                    const payload = point as { label?: string; name?: string };
                    const grade = payload.label ?? payload.name;
                    if (!grade) return;
                    router.push(buildQuery(searchParams, { grade }));
                  }}
                >
                  {props.data.gradeComposition.map((entry, index) => (
                    <Cell key={entry.label} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">フォーマット別評価ランク構成比</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {Object.entries(props.data.formatGradeComposition).map(([format, points]) => (
              <button
                key={format}
                type="button"
                onClick={() => router.push(buildQuery(searchParams, { format }))}
                className="rounded-[24px] border border-white/8 bg-slate-950/35 p-4 text-left"
              >
                <h3 className="text-sm font-medium text-white">{format}</h3>
                <div className="mt-3 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={points} dataKey="value" nameKey="label" outerRadius={55}>
                        {points.map((entry, index) => (
                          <Cell key={entry.label} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">評価 TOP10</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={props.data.top10} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="storeName" type="category" width={80} stroke="#cbd5e1" />
                <Tooltip />
                <Bar
                  dataKey="score"
                  fill="#7dd3fc"
                  radius={[0, 8, 8, 0]}
                  onClick={(data) => {
                    const payload = data as { storeId?: string };
                    if (!payload.storeId) return;
                    router.push(`/dashboard/stores/${payload.storeId}${props.data.filters.cycle && props.data.filters.cycle !== "all" ? `?cycle=${props.data.filters.cycle}` : ""}`);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">評価ワースト10</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={props.data.worst10} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="storeName" type="category" width={80} stroke="#cbd5e1" />
                <Tooltip />
                <Bar
                  dataKey="score"
                  fill="#fda4af"
                  radius={[0, 8, 8, 0]}
                  onClick={(data) => {
                    const payload = data as { storeId?: string };
                    if (!payload.storeId) return;
                    router.push(`/dashboard/stores/${payload.storeId}${props.data.filters.cycle && props.data.filters.cycle !== "all" ? `?cycle=${props.data.filters.cycle}` : ""}`);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">上位改善項目ランキング</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={props.data.topIssues}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="issueKey" stroke="#94a3b8" angle={-20} textAnchor="end" height={70} interval={0} />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="#fcd34d"
                  radius={[8, 8, 0, 0]}
                  onClick={(data) => {
                    const payload = data as { issueKey?: string };
                    if (!payload.issueKey) return;
                    router.push(buildTasksQuery({ search: payload.issueKey }));
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">未通过原因 Top 項目</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={props.data.minimumFailureReasons}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="issueKey" stroke="#94a3b8" angle={-20} textAnchor="end" height={70} interval={0} />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="#fb7185"
                  radius={[8, 8, 0, 0]}
                  onClick={(data) => {
                    const payload = data as { issueKey?: string };
                    if (!payload.issueKey) return;
                    router.push(buildTasksQuery({ search: payload.issueKey }));
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">店舗スタイル別推移</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={props.data.formatTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Bar dataKey="previous" fill="#94a3b8" radius={[8, 8, 0, 0]} />
                <Bar
                  dataKey="current"
                  fill="#7dd3fc"
                  radius={[8, 8, 0, 0]}
                  onClick={(data) => {
                    const payload = data as { label?: string };
                    if (!payload.label) return;
                    router.push(buildQuery(searchParams, { format: payload.label }));
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">花王衛生検査要改善店舗</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={props.data.hygieneNeedsImprovement}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="storeName" stroke="#94a3b8" angle={-20} textAnchor="end" height={70} interval={0} />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar
                  dataKey="score"
                  fill="#f97316"
                  radius={[8, 8, 0, 0]}
                  onClick={(data) => {
                    const payload = data as { storeId?: string };
                    if (!payload.storeId) return;
                    router.push(`/dashboard/stores/${payload.storeId}`);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">前回要改善店舗の改善進捗</h2>
          <div className="mt-4 overflow-hidden rounded-[24px] border border-white/8">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/55 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">店舗</th>
                  <th className="px-4 py-3 font-medium">前回</th>
                  <th className="px-4 py-3 font-medium">今回</th>
                  <th className="px-4 py-3 font-medium">改善幅</th>
                </tr>
              </thead>
              <tbody>
                {props.data.improvementProgress.map((entry) => (
                  <tr
                    key={entry.storeId}
                    className="cursor-pointer border-t border-white/8 bg-slate-950/20 text-zinc-100"
                    onClick={() => router.push(`/dashboard/stores/${entry.storeId}`)}
                  >
                    <td className="px-4 py-3">{entry.storeName}</td>
                    <td className="px-4 py-3">{entry.previousScore}</td>
                    <td className="px-4 py-3">{entry.score}</td>
                    <td className="px-4 py-3 font-medium">{entry.score - entry.previousScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">最低遵守未通過店舗</h2>
          <div className="mt-4 overflow-hidden rounded-[24px] border border-white/8">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/55 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">店舗</th>
                  <th className="px-4 py-3 font-medium">フォーマット</th>
                  <th className="px-4 py-3 font-medium">今回点数</th>
                </tr>
              </thead>
              <tbody>
                {props.data.minimumFailedStores.map((entry) => (
                  <tr
                    key={entry.storeId}
                    className="cursor-pointer border-t border-white/8 bg-slate-950/20 text-zinc-100"
                    onClick={() => router.push(`/dashboard/stores/${entry.storeId}`)}
                  >
                    <td className="px-4 py-3">{entry.storeName}</td>
                    <td className="px-4 py-3">{entry.format}</td>
                    <td className="px-4 py-3">{entry.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="issues" className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">問題指摘ドリルダウン</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {props.selectedIssue ? `「${props.selectedIssue}」に一致する問題指摘` : "改善項目ランキングからドリルダウンできます。"}
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-[24px] border border-white/8">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950/55 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">店舗</th>
                <th className="px-4 py-3 font-medium">問題</th>
                <th className="px-4 py-3 font-medium">カテゴリ</th>
                <th className="px-4 py-3 font-medium">期限</th>
                <th className="px-4 py-3 font-medium">状態</th>
              </tr>
            </thead>
            <tbody>
              {issueRecords.map((record) => (
                <tr
                  key={record.id}
                  className="cursor-pointer border-t border-white/8 bg-slate-950/20 text-zinc-100"
                  onClick={() =>
                    router.push(
                      buildTasksQuery({
                        storeId: record.storeId,
                        status: record.status,
                        search: record.issueType,
                      }),
                    )
                  }
                >
                  <td className="px-4 py-3">{record.storeName}</td>
                  <td className="px-4 py-3">{record.issueType}</td>
                  <td className="px-4 py-3">{record.category}</td>
                  <td className="px-4 py-3">{record.dueDate}</td>
                  <td className="px-4 py-3">{record.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
