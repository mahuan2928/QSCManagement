"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Store as StoreIcon, Trophy } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AuditChecklistItem, StoreDashboardData } from "../lib/domain";
import { StatCard } from "./stat-card";

function ChecklistMiniChart(props: { title: string; items: AuditChecklistItem[]; passColor: string }) {
  const data = props.items.map((item) => ({
    label: item.label.replace("項目 ", ""),
    value: item.status === "ok" ? 1 : 0,
  }));

  return (
    <div className="rounded-[24px] border border-white/8 bg-slate-950/30 p-4">
      <h3 className="text-sm font-semibold text-white">{props.title}</h3>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="label" stroke="#94a3b8" hide />
            <YAxis stroke="#94a3b8" domain={[0, 1]} ticks={[0, 1]} />
            <Tooltip />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`${entry.label}-${index}`} fill={entry.value ? props.passColor : "#fb7185"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StoreDashboardView(props: { data: StoreDashboardData }) {
  const router = useRouter();
  const comparisonData = [
    {
      label: "前回",
      score: props.data.previousResult?.totalScore ?? props.data.store.previousTotalScore ?? 0,
    },
    {
      label: "今回",
      score: props.data.currentResult?.totalScore ?? props.data.store.latestTotalScore ?? 0,
    },
  ];
  const hygieneData = [
    { label: "前回", score: props.data.store.hygienePreviousScore ?? 0 },
    { label: "今回", score: props.data.store.hygieneCurrentScore ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5"
        >
          <ArrowLeft className="size-4" />
          全店 Dashboard に戻る
        </button>
      </div>

      <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
        <h1 className="text-2xl font-semibold text-white">{props.data.store.name}</h1>
        <p className="mt-2 text-sm text-zinc-300">
          {props.data.store.format ?? "未設定"} / {props.data.store.group ?? props.data.store.block ?? "未設定"} / SV: {props.data.store.svName}
          {props.data.store.manager ? ` / マネージャー: ${props.data.store.manager}` : ""}
        </p>
        <div className="mt-4 rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
          {props.data.minimumStatusLabel}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="今回順位" value={props.data.currentRank ?? "-"} hint="現在の絞り込みでの順位" icon={<Trophy className="size-4" />} />
        <StatCard label="前回順位" value={props.data.previousRank ?? "-"} hint="前回または店舗マスタの順位" icon={<Trophy className="size-4" />} />
        <StatCard label="今回 5C 点数合計" value={props.data.currentResult?.totalScore ?? props.data.store.latestTotalScore ?? "-"} hint="今回評価の合計点" icon={<StoreIcon className="size-4" />} />
        <StatCard label="前回 5C 点数合計" value={props.data.previousResult?.totalScore ?? props.data.store.previousTotalScore ?? "-"} hint="前回評価の合計点" icon={<StoreIcon className="size-4" />} />
        <StatCard label="順位変化" value={props.data.rankDelta ?? "-"} hint="プラスは順位改善" icon={<Trophy className="size-4" />} />
        <StatCard label="点数変化" value={props.data.scoreDelta} hint="前回との差分" icon={<CheckCircle2 className="size-4" />} />
        <StatCard label="未完了問題数" value={props.data.openTasks.length} hint="是正中または確認待ち" icon={<ClipboardList className="size-4" />} />
        <StatCard label="超期問題数" value={props.data.overdueTasks.length} hint="期限超過の問題指摘" icon={<AlertTriangle className="size-4" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">5C 評価推移</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="score" fill="#7dd3fc" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">花王衛生検査推移</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hygieneData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="score" fill="#f97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ChecklistMiniChart title="最低遵守 22 項目" items={props.data.minimumItems} passColor="#86efac" />
        <ChecklistMiniChart title="運営基準 50 項目" items={props.data.operationItems} passColor="#7dd3fc" />
        <ChecklistMiniChart title="価値創造 20 項目" items={props.data.valueItems} passColor="#c4b5fd" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">問題指摘 / 是正中</h2>
          <ul className="mt-4 space-y-3">
            {props.data.openTasks.map((task) => (
              <li key={task.id} className="rounded-2xl border border-white/8 bg-slate-950/30 p-4">
                <p className="text-sm font-medium text-white">{task.issueType}</p>
                <p className="mt-1 text-xs text-zinc-400">{task.dueDate} / {task.status}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">超期整改</h2>
          <ul className="mt-4 space-y-3">
            {props.data.overdueTasks.map((task) => (
              <li key={task.id} className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4">
                <p className="text-sm font-medium text-white">{task.issueType}</p>
                <p className="mt-1 text-xs text-zinc-200">{task.dueDate} / {task.status}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">完了済み整改</h2>
          <ul className="mt-4 space-y-3">
            {props.data.resolvedTasks.map((task) => (
              <li key={task.id} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                <p className="text-sm font-medium text-white">{task.issueType}</p>
                <p className="mt-1 text-xs text-zinc-200">{task.dueDate} / {task.status}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
