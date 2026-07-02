"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DeferredMetric = {
  store: { id: string; name: string };
  format: string;
  area: string;
  currentHygiene: number;
  previousHygiene: number;
  currentScore: number;
  grade: string;
  tasks: Array<{ issueType: string; sourceItemKey: string }>;
};

type DeferredRankingItem = {
  store: { id: string; name: string };
  format: string;
  area: string;
  currentScore: number;
  grade: string;
  currentHygiene: number;
  previousHygiene: number;
};

const ISSUE_CATALOG = [
  "床・通路の清掃",
  "棚・什器の整理整頓",
  "値札・POPの汚破れ",
  "バックヤード整理",
  "冷ケース清掃",
  "試食コーナー衛生",
  "ゴミ分別",
  "手指消毒設置",
];

const RANK_COLORS: Record<string, string> = {
  S評価: "#3B82F6",
  A評価: "#47C266",
  B評価: "#38BDF8",
  C評価: "#F5A623",
  D評価: "#EF4444",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function Panel(props: {
  title: string;
  subtitle?: string;
  legend?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-[#323B48] bg-[#262E3A] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.10)] ${props.className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-[0.01em] text-[#F2F4F7]">{props.title}</h3>
          {props.subtitle ? <p className="mt-1 text-xs leading-5 text-[#98A2B3]">{props.subtitle}</p> : null}
        </div>
        {props.legend ? <div className="hidden items-center gap-3 text-xs text-[#98A2B3] md:flex">{props.legend}</div> : null}
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function GradeBadge(props: { grade: string }) {
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{
        color: RANK_COLORS[props.grade] ?? "#F2F4F7",
        backgroundColor: `${RANK_COLORS[props.grade] ?? "#3B82F6"}1F`,
      }}
    >
      {props.grade}
    </span>
  );
}

export type DeferredOverviewPanelsProps = {
  metrics: DeferredMetric[];
  ranking: DeferredRankingItem[];
  mode: "hygiene" | "ranking" | "issues";
};

export function DeferredOverviewPanels(props: DeferredOverviewPanelsProps) {
  const hygieneNeedsImprovement = [...props.metrics]
    .filter((metric) => metric.currentHygiene <= 85)
    .sort((left, right) => left.currentHygiene - right.currentHygiene)
    .slice(0, 8)
    .map((metric) => ({
      storeName: metric.store.name,
      currentHygiene: metric.currentHygiene,
    }));

  const top10 = props.ranking.slice(0, 10);
  const worst10 = [...props.ranking].reverse().slice(0, 10);

  const topIssues = props.metrics.reduce<Record<string, number>>((accumulator, metric) => {
    metric.tasks.forEach((task) => {
      const key = task.issueType || task.sourceItemKey || ISSUE_CATALOG[0];
      accumulator[key] = (accumulator[key] ?? 0) + 1;
    });
    return accumulator;
  }, {});

  const overallIssueList = Object.entries(topIssues)
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);

  const topIssuesByFormat = ["FC", "ロードサイド", "CITY"].reduce<Record<string, Array<{ label: string; value: number }>>>(
    (accumulator, format) => {
      const counts = props.metrics
        .filter((metric) => metric.format === format)
        .reduce<Record<string, number>>((map, metric) => {
          metric.tasks.forEach((task) => {
            const key = task.issueType || task.sourceItemKey || ISSUE_CATALOG[0];
            map[key] = (map[key] ?? 0) + 1;
          });
          return map;
        }, {});

      accumulator[format] = Object.entries(counts)
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value)
        .slice(0, 5);

      if (!accumulator[format].length) {
        accumulator[format] = ISSUE_CATALOG.slice(0, 5).map((label, index) => ({ label, value: 5 - index }));
      }

      return accumulator;
    },
    {},
  );

  const improvementProgress = (hygieneNeedsImprovement.length ? props.ranking.filter((item) => hygieneNeedsImprovement.some((target) => target.storeName === item.store.name)) : worst10.slice(0, 5)).map(
    (metric, index) => ({
      storeName: metric.store.name,
      before: clamp(Math.round((100 - metric.previousHygiene) / 3), 8, 20),
      after: clamp(metric.currentHygiene + index, 60, 98),
    }),
  );

  if (props.mode === "hygiene") {
    return (
      <Panel
        title="花王衛生検査 要改善店舗(85点以下)"
        subtitle="基準線を下回る店舗を抽出"
        legend={<span>基準線 85 点</span>}
      >
        <div className="h-[310px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hygieneNeedsImprovement} layout="vertical" margin={{ left: 8, right: 20 }}>
              <CartesianGrid horizontal={false} stroke="#2C333F" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="storeName" type="category" width={132} tick={{ fill: "#F2F4F7", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <ReferenceLine x={85} stroke="#EF4444" strokeDasharray="4 4" />
              <Bar dataKey="currentHygiene" fill="#EF4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    );
  }

  if (props.mode === "ranking") {
    return (
      <>
        <Panel title="評価 TOP10" subtitle="スコア上位店舗" className="xl:col-span-3">
          <div className="space-y-3">
            {top10.map((metric, index) => (
              <div key={metric.store.id} className="flex items-center justify-between rounded-lg border border-[#323B48] bg-[#1E2530] px-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-[#F2F4F7]">{index + 1}. {metric.store.name}</p>
                  <p className="mt-1 text-xs text-[#98A2B3]">{metric.format} / {metric.area}</p>
                </div>
                <div className="text-right">
                  <p className="font-[Inter] text-sm font-semibold tabular-nums text-[#F2F4F7]">{metric.currentScore}点</p>
                  <div className="mt-1">
                    <GradeBadge grade={metric.grade} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="評価ワースト10" subtitle="優先フォロー店舗" className="xl:col-span-3">
          <div className="space-y-3">
            {worst10.map((metric, index) => (
              <div key={metric.store.id} className="flex items-center justify-between rounded-lg border border-[#323B48] bg-[#1E2530] px-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-[#F2F4F7]">{index + 1}. {metric.store.name}</p>
                  <p className="mt-1 text-xs text-[#98A2B3]">{metric.format} / {metric.area}</p>
                </div>
                <div className="text-right">
                  <p className="font-[Inter] text-sm font-semibold tabular-nums text-[#F2F4F7]">{metric.currentScore}点</p>
                  <div className="mt-1">
                    <GradeBadge grade={metric.grade} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </>
    );
  }

  const issueList = overallIssueList.length
    ? overallIssueList
    : ISSUE_CATALOG.slice(0, 5).map((label, index) => ({ label, value: 5 - index }));

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-12">
        <Panel title="上位改善項目(全体)" subtitle="改善指摘の集中領域" className="xl:col-span-3">
          <div className="space-y-3">
            {issueList.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-[#323B48] bg-[#1E2530] px-3 py-3">
                <span className="text-sm text-[#F2F4F7]">{item.label}</span>
                <span className="font-[Inter] text-sm font-semibold tabular-nums text-[#F2F4F7]">{item.value}件</span>
              </div>
            ))}
          </div>
        </Panel>

        {["FC", "ロードサイド", "CITY"].map((format) => (
          <Panel key={format} title={`上位改善項目(${format})`} subtitle={`${format} の重点改善テーマ`} className="xl:col-span-3">
            <div className="space-y-3">
              {topIssuesByFormat[format].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-[#323B48] bg-[#1E2530] px-3 py-3">
                  <span className="text-sm text-[#F2F4F7]">{item.label}</span>
                  <span className="font-[Inter] text-sm font-semibold tabular-nums text-[#F2F4F7]">{item.value}件</span>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </section>

      <Panel
        title="前回要改善店舗の改善進捗(20点以下)"
        subtitle="前回の重点是正対象店舗に対する before / after 比較"
        legend={<span>before は重点是正指数</span>}
      >
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={improvementProgress}>
              <CartesianGrid vertical={false} stroke="#2C333F" />
              <XAxis dataKey="storeName" tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={20} stroke="#EF4444" strokeDasharray="4 4" />
              <Bar dataKey="before" name="前回" fill="#EF4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="after" name="今回" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
