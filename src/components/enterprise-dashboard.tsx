"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  LayoutDashboard,
  MoreHorizontal,
  ShieldAlert,
  Store as StoreIcon,
  Waves,
} from "lucide-react";

import { normalizeTaskStatus } from "../lib/business-rules";
import type { FiveCResult, HygieneInspection, RectificationTask, Store } from "../lib/domain";
import { cn } from "../lib/utils";

type DashboardTab = "overview" | "store";
type PeriodValue = "all" | "Q1" | "Q2" | "Q3" | "Q4";
type StyleValue = "all" | "FC" | "ロードサイド" | "CITY";
type StoreMetric = {
  store: Store;
  scoreSeries: Array<{ key: Exclude<PeriodValue, "all">; label: string; score: number }>;
  hygieneSeries: Array<{ key: Exclude<PeriodValue, "all">; label: string; score: number }>;
  currentScore: number;
  previousScore: number;
  currentHygiene: number;
  previousHygiene: number;
  grade: string;
  previousGrade: string;
  area: string;
  format: string;
  tasks: RectificationTask[];
};

const PERIODS = [
  { key: "Q1" as const, label: "2024上期" },
  { key: "Q2" as const, label: "2024下期" },
  { key: "Q3" as const, label: "2025上期" },
  { key: "Q4" as const, label: "2025下期" },
];

const STYLE_OPTIONS: Array<{ value: StyleValue; label: string }> = [
  { value: "all", label: "全スタイル" },
  { value: "FC", label: "FC" },
  { value: "ロードサイド", label: "ロードサイド" },
  { value: "CITY", label: "CITY" },
];

const RANK_ORDER = ["S評価", "A評価", "B評価", "C評価", "D評価"];

const COLOR_TOKENS = {
  appBg: "#1A2029",
  sectionBg: "#1E2530",
  cardBg: "#262E3A",
  cardBorder: "#323B48",
  divider: "#2C333F",
  track: "#384150",
  textPrimary: "#F2F4F7",
  textSecondary: "#98A2B3",
  textMuted: "#667085",
  accent: "#3B82F6",
  success: "#47C266",
  warning: "#F5A623",
  danger: "#EF4444",
  cyan: "#38BDF8",
};

const RANK_COLORS: Record<string, string> = {
  S評価: "#3B82F6",
  A評価: "#47C266",
  B評価: "#38BDF8",
  C評価: "#F5A623",
  D評価: "#EF4444",
};

const FORMAT_COLORS: Record<string, string> = {
  FC: "#3B82F6",
  ロードサイド: "#38BDF8",
  CITY: "#93C5FD",
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function tooltipFormatter(unit: string, label: string) {
  return (value: number | string | readonly (number | string)[] | undefined) => {
    const resolved = Array.isArray(value) ? value.join(" / ") : value;
    return [`${resolved ?? "-"} ${unit}`, label] as [string, string];
  };
}

const chartTooltipProps = {
  contentStyle: {
    backgroundColor: COLOR_TOKENS.cardBg,
    borderColor: COLOR_TOKENS.cardBorder,
    borderRadius: 8,
    color: COLOR_TOKENS.textPrimary,
    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.10)",
  },
  labelStyle: {
    color: COLOR_TOKENS.textPrimary,
  },
  itemStyle: {
    color: COLOR_TOKENS.textPrimary,
  },
};

function average(values: number[]) {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function deriveGrade(score: number) {
  if (score >= 95) return "S評価";
  if (score >= 89) return "A評価";
  if (score >= 82) return "B評価";
  if (score >= 74) return "C評価";
  return "D評価";
}

function buildScoreSeries(store: Store, results: FiveCResult[]) {
  const fallbackCurrent = store.latestTotalScore ?? 84;
  const fallbackPrevious = store.previousTotalScore ?? clamp(fallbackCurrent - 6, 60, 98);
  const byCycle = new Map(results.filter((result) => result.storeId === store.id).map((result) => [result.cycle, result]));

  const fallbackScores: Record<Exclude<PeriodValue, "all">, number> = {
    Q1: clamp(fallbackPrevious - 4, 60, 98),
    Q2: clamp(fallbackPrevious, 60, 98),
    Q3: clamp(fallbackCurrent - 3, 60, 98),
    Q4: clamp(fallbackCurrent, 60, 98),
  };

  return PERIODS.map((period) => ({
    key: period.key,
    label: period.label,
    score: byCycle.get(period.key)?.totalScore ?? fallbackScores[period.key],
  }));
}

function buildHygieneSeries(store: Store, inspections: HygieneInspection[]) {
  const fallbackCurrent = store.hygieneCurrentScore ?? clamp((store.latestTotalScore ?? 84) - 3, 60, 98);
  const fallbackPrevious = store.hygienePreviousScore ?? clamp(fallbackCurrent - 4, 60, 98);
  const byStore = inspections.filter((inspection) => inspection.storeId === store.id);
  const currentInspection =
    byStore.find((inspection) => inspection.period.includes("今回") || inspection.period.includes("下期"))?.score ??
    fallbackCurrent;
  const previousInspection =
    byStore.find((inspection) => inspection.period.includes("前回") || inspection.period.includes("上期"))?.score ??
    fallbackPrevious;

  const fallbackScores: Record<Exclude<PeriodValue, "all">, number> = {
    Q1: clamp(previousInspection - 3, 60, 98),
    Q2: clamp(previousInspection, 60, 98),
    Q3: clamp(currentInspection - 2, 60, 98),
    Q4: clamp(currentInspection, 60, 98),
  };

  return PERIODS.map((period) => ({
    key: period.key,
    label: period.label,
    score: fallbackScores[period.key],
  }));
}

function ToolbarDots() {
  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#323B48] bg-[#1E2530] text-[#98A2B3] transition hover:bg-[#262E3A] hover:text-[#F2F4F7]"
      aria-label="その他"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );
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
      className={cn(
        "rounded-lg border border-[#323B48] bg-[#262E3A] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.10)]",
        props.className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-[0.01em] text-[#F2F4F7]">{props.title}</h3>
          {props.subtitle ? <p className="mt-1 text-xs leading-5 text-[#98A2B3]">{props.subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {props.legend ? <div className="hidden items-center gap-3 text-xs text-[#98A2B3] md:flex">{props.legend}</div> : null}
          <ToolbarDots />
        </div>
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function KpiCard(props: {
  title: string;
  value: string;
  unit?: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#323B48] bg-[#262E3A] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.02em] text-[#98A2B3]">{props.title}</p>
          <div className="mt-3 flex items-end gap-1 text-[#F2F4F7]">
            <span className="font-[Inter] text-[28px] font-semibold leading-none tabular-nums">{props.value}</span>
            {props.unit ? <span className="pb-0.5 text-xs text-[#98A2B3]">{props.unit}</span> : null}
          </div>
          <p className="mt-2 text-xs text-[#98A2B3]">{props.hint}</p>
        </div>
        <div className="rounded-md bg-[rgba(59,130,246,0.12)] p-2 text-[#3B82F6]">{props.icon}</div>
      </div>
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-medium tracking-[0.04em] text-[#98A2B3]">{props.label}</span>
      <div className="relative">
        <select
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-lg border border-[#323B48] bg-[#1E2530] px-3 pr-9 text-sm text-[#F2F4F7] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
        >
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
      </div>
    </label>
  );
}

function GradeBadge(props: { grade: string }) {
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{
        color: RANK_COLORS[props.grade] ?? COLOR_TOKENS.textPrimary,
        backgroundColor: `${RANK_COLORS[props.grade] ?? COLOR_TOKENS.accent}1F`,
      }}
    >
      {props.grade}
    </span>
  );
}

function StatusChip(props: { value: "合" | "否" }) {
  const positive = props.value === "合";
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{
        color: positive ? COLOR_TOKENS.success : COLOR_TOKENS.danger,
        backgroundColor: positive ? "rgba(71,194,102,0.12)" : "rgba(239,68,68,0.12)",
      }}
    >
      {props.value}
    </span>
  );
}

export function EnterpriseDashboard(props: {
  stores: Store[];
  results: FiveCResult[];
  tasks: RectificationTask[];
  hygieneInspections: HygieneInspection[];
  initialStoreId?: string;
  updatedAt: string;
}) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodValue>("all");
  const [selectedStyle, setSelectedStyle] = useState<StyleValue>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedStoreId, setSelectedStoreId] = useState<string>(props.initialStoreId ?? props.stores[0]?.id ?? "");

  const taskStoreMap = useMemo(
    () =>
      props.tasks.reduce<Record<string, RectificationTask[]>>((accumulator, task) => {
        accumulator[task.storeId] = [...(accumulator[task.storeId] ?? []), task];
        return accumulator;
      }, {}),
    [props.tasks],
  );

  const metrics = useMemo<StoreMetric[]>(() => {
    return props.stores.map((store) => {
      const scoreSeries = buildScoreSeries(store, props.results);
      const hygieneSeries = buildHygieneSeries(store, props.hygieneInspections);
      const currentKey = selectedPeriod === "all" ? "Q4" : selectedPeriod;
      const previousKey = currentKey === "Q1" ? "Q1" : PERIODS[Math.max(0, PERIODS.findIndex((item) => item.key === currentKey) - 1)].key;
      const currentScore = scoreSeries.find((item) => item.key === currentKey)?.score ?? scoreSeries[scoreSeries.length - 1]?.score ?? 0;
      const previousScore = scoreSeries.find((item) => item.key === previousKey)?.score ?? scoreSeries[scoreSeries.length - 2]?.score ?? currentScore;
      const currentHygiene =
        hygieneSeries.find((item) => item.key === currentKey)?.score ?? hygieneSeries[hygieneSeries.length - 1]?.score ?? 0;
      const previousHygiene =
        hygieneSeries.find((item) => item.key === previousKey)?.score ??
        hygieneSeries[hygieneSeries.length - 2]?.score ??
        currentHygiene;

      return {
        store,
        scoreSeries,
        hygieneSeries,
        currentScore,
        previousScore,
        currentHygiene,
        previousHygiene,
        grade: deriveGrade(currentScore),
        previousGrade: deriveGrade(previousScore),
        area: store.region || "未設定",
        format: store.format ?? "未設定",
        tasks: taskStoreMap[store.id] ?? [],
      };
    });
  }, [props.hygieneInspections, props.results, props.stores, selectedPeriod, taskStoreMap]);

  const areaOptions = useMemo(
    () => [
      { value: "all", label: "全エリア" },
      ...[...new Set(props.stores.map((store) => store.region).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)).map(
        (value) => ({ value, label: value }),
      ),
    ],
    [props.stores],
  );

  const filteredMetrics = useMemo(() => {
    return metrics.filter((metric) => {
      if (selectedStyle !== "all" && metric.format !== selectedStyle) {
        return false;
      }
      if (selectedArea !== "all" && metric.area !== selectedArea) {
        return false;
      }
      return true;
    });
  }, [metrics, selectedArea, selectedStyle]);

  const resolvedStoreId = filteredMetrics.some((metric) => metric.store.id === selectedStoreId)
    ? selectedStoreId
    : filteredMetrics[0]?.store.id ?? metrics[0]?.store.id ?? "";
  const selectedStore = metrics.find((metric) => metric.store.id === resolvedStoreId) ?? filteredMetrics[0] ?? metrics[0];

  const ranking = useMemo(
    () => [...filteredMetrics].sort((left, right) => right.currentScore - left.currentScore),
    [filteredMetrics],
  );
  const previousRanking = useMemo(
    () => [...filteredMetrics].sort((left, right) => right.previousScore - left.previousScore),
    [filteredMetrics],
  );

  const kpis = useMemo(() => {
    const avgScore = average(filteredMetrics.map((metric) => metric.currentScore));
    const needImprovement = filteredMetrics.filter((metric) => metric.currentHygiene <= 85).length;
    const dCount = filteredMetrics.filter((metric) => metric.grade === "D評価").length;
    return {
      stores: filteredMetrics.length,
      avgScore,
      needImprovement,
      dCount,
    };
  }, [filteredMetrics]);

  const gradeComposition = useMemo(() => {
    const counts = RANK_ORDER.map((grade) => ({
      grade,
      value: filteredMetrics.filter((metric) => metric.grade === grade).length,
    })).filter((item) => item.value > 0);
    return counts;
  }, [filteredMetrics]);

  const formatComposition = useMemo(() => {
    return ["FC", "ロードサイド", "CITY"].reduce<Record<string, Array<{ grade: string; value: number }>>>((accumulator, format) => {
      accumulator[format] = RANK_ORDER.map((grade) => ({
        grade,
        value: filteredMetrics.filter((metric) => metric.format === format && metric.grade === grade).length,
      })).filter((item) => item.value > 0);
      return accumulator;
    }, {});
  }, [filteredMetrics]);

  const formatStacked = useMemo(() => {
    return ["FC", "ロードサイド", "CITY"].map((format) => {
      const base = { format } as Record<string, string | number>;
      RANK_ORDER.forEach((grade) => {
        base[grade] = filteredMetrics.filter((metric) => metric.format === format && metric.grade === grade).length;
      });
      return base;
    });
  }, [filteredMetrics]);

  const hygieneNeedsImprovement = useMemo(
    () =>
      [...filteredMetrics]
        .filter((metric) => metric.currentHygiene <= 85)
        .sort((left, right) => left.currentHygiene - right.currentHygiene)
        .slice(0, 8),
    [filteredMetrics],
  );

  const trendData = useMemo(() => {
    return PERIODS.map((period) => {
      const row: Record<string, string | number> = { period: period.label };
      ["FC", "ロードサイド", "CITY"].forEach((format) => {
        const items = filteredMetrics.filter((metric) => metric.format === format);
        row[format] = average(
          items.map((metric) => metric.scoreSeries.find((entry) => entry.key === period.key)?.score ?? metric.currentScore),
        );
      });
      return row;
    });
  }, [filteredMetrics]);

  const top10 = ranking.slice(0, 10);
  const worst10 = [...ranking].reverse().slice(0, 10);

  const topIssues = useMemo(() => {
    const counts = filteredMetrics.flatMap((metric) => metric.tasks).reduce<Record<string, number>>((accumulator, task) => {
      const key = task.issueType || task.sourceItemKey || ISSUE_CATALOG[0];
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 8);
  }, [filteredMetrics]);

  const topIssuesByFormat = useMemo(() => {
    return ["FC", "ロードサイド", "CITY"].reduce<Record<string, Array<{ label: string; value: number }>>>((accumulator, format) => {
      const counts = filteredMetrics
        .filter((metric) => metric.format === format)
        .flatMap((metric) => metric.tasks)
        .reduce<Record<string, number>>((map, task) => {
          const key = task.issueType || task.sourceItemKey || ISSUE_CATALOG[0];
          map[key] = (map[key] ?? 0) + 1;
          return map;
        }, {});

      const list = Object.entries(counts)
        .map(([label, value]) => ({ label, value }))
        .sort((left, right) => right.value - left.value)
        .slice(0, 5);

      accumulator[format] = list.length
        ? list
        : ISSUE_CATALOG.slice(0, 5).map((label, index) => ({ label, value: 5 - index }));
      return accumulator;
    }, {});
  }, [filteredMetrics]);

  const improvementProgress = useMemo(() => {
    const baseStores = hygieneNeedsImprovement.length ? hygieneNeedsImprovement : worst10.slice(0, 5);
    return baseStores.map((metric, index) => {
      const before = clamp(Math.round((100 - metric.previousHygiene) / 3), 8, 20);
      const after = clamp(metric.currentHygiene + index, 60, 98);
      return {
        storeName: metric.store.name,
        before,
        after,
      };
    });
  }, [hygieneNeedsImprovement, worst10]);

  const selectedCurrentRank = selectedStore ? ranking.findIndex((metric) => metric.store.id === selectedStore.store.id) + 1 : 0;
  const selectedPreviousRank = selectedStore
    ? previousRanking.findIndex((metric) => metric.store.id === selectedStore.store.id) + 1
    : 0;
  const rankDelta = selectedPreviousRank && selectedCurrentRank ? selectedPreviousRank - selectedCurrentRank : 0;
  const overallIssueList = topIssues.length
    ? topIssues
    : ISSUE_CATALOG.slice(0, 5).map((label, index) => ({ label, value: 5 - index }));

  const storePointRows = useMemo(() => {
    if (!selectedStore) {
      return [];
    }

    const taskMap = new Map(
      selectedStore.tasks.map((task) => [task.issueType || task.sourceItemKey || ISSUE_CATALOG[0], task] as const),
    );
    const labels = [...new Set([...taskMap.keys(), ...ISSUE_CATALOG])].slice(0, 8);

    return labels.map((label, index) => {
      const task = taskMap.get(label);
      const status: "合" | "否" = task && normalizeTaskStatus(task) !== "resolved" ? "否" : "合";
      return {
        label,
        status,
        score: status === "合" ? 5 : 2,
        comment: task?.comment || (status === "合" ? "基準を維持しています。" : "重点確認が必要です。"),
        assignee: task?.assignee || (status === "合" ? "店舗責任者" : selectedStore.store.svName),
        checkedAt: task?.auditDate || selectedStore.store.latestAuditDate || PERIODS[PERIODS.length - 1].label,
        index,
      };
    });
  }, [selectedStore]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#323B48] bg-[#1E2530] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.10)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.08em] text-[#3B82F6]">
              <LayoutDashboard className="h-4 w-4" />
              全店運営モニタリング
            </div>
            <h1 className="mt-3 text-[28px] font-semibold tracking-[0.01em] text-[#F2F4F7]">5C管理 ダッシュボード</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#98A2B3]">
              全店の評価ランク、花王衛生検査スコア、改善指摘の集中領域を一画面で把握できる日本向けリテール運営バックオフィスです。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:w-[620px] xl:grid-cols-4">
            <SelectField
              label="期間"
              value={selectedPeriod}
              options={[{ value: "all", label: "2024上期 - 2025下期" }, ...PERIODS.map((period) => ({ value: period.key, label: period.label }))]}
              onChange={(value) => setSelectedPeriod(value as PeriodValue)}
            />
            <SelectField
              label="店舗スタイル"
              value={selectedStyle}
              options={STYLE_OPTIONS}
              onChange={(value) => setSelectedStyle(value as StyleValue)}
            />
            <SelectField label="エリア" value={selectedArea} options={areaOptions} onChange={setSelectedArea} />
            <div className="grid gap-1.5">
              <span className="text-[11px] font-medium tracking-[0.04em] text-[#98A2B3]">更新日時</span>
              <div className="flex h-11 items-center rounded-lg border border-[#323B48] bg-[#262E3A] px-3 text-sm text-[#F2F4F7]">
                {props.updatedAt}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#2C333F] pt-4">
          <div className="inline-flex rounded-lg border border-[#323B48] bg-[#262E3A] p-1">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition",
                activeTab === "overview" ? "bg-[#3B82F6] text-[#F2F4F7] shadow-sm" : "text-[#98A2B3]",
              )}
            >
              ダッシュボード(全店)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("store")}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition",
                activeTab === "store" ? "bg-[#3B82F6] text-[#F2F4F7] shadow-sm" : "text-[#98A2B3]",
              )}
            >
              ダッシュボード(店舗別)
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#98A2B3]">
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(59,130,246,0.35)] bg-[rgba(59,130,246,0.12)] px-3 py-1 text-[#3B82F6]">
              <Activity className="h-3.5 w-3.5" />
              対象 {filteredMetrics.length} 店
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] px-3 py-1 text-[#EF4444]">
              <ShieldAlert className="h-3.5 w-3.5 text-[#EF4444]" />
              要改善 {kpis.needImprovement} 店
            </span>
          </div>
        </div>
      </section>

      {activeTab === "overview" ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="対象店舗数" value={String(kpis.stores)} unit="店" hint="現在の絞り込み対象" icon={<Building2 className="h-4 w-4" />} />
            <KpiCard title="平均評価スコア" value={String(kpis.avgScore)} unit="点" hint="5C 総合スコア平均" icon={<Waves className="h-4 w-4" />} />
            <KpiCard title="要改善店舗数" value={String(kpis.needImprovement)} unit="店" hint="花王衛生検査 85 点以下" icon={<ShieldAlert className="h-4 w-4" />} />
            <KpiCard title="D評価店舗数" value={String(kpis.dCount)} unit="店" hint="全評価ランク中の D 評価件数" icon={<ClipboardCheck className="h-4 w-4" />} />
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <Panel title="評価ランク構成比" subtitle="S/A/B/C/D の店舗構成比" className="xl:col-span-4" legend={<span>全体</span>}>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={gradeComposition} dataKey="value" nameKey="grade" innerRadius={56} outerRadius={92} paddingAngle={2}>
                      {gradeComposition.map((entry) => (
                        <Cell key={entry.grade} fill={RANK_COLORS[entry.grade]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={tooltipFormatter("店", "店舗数")} {...chartTooltipProps} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              title="評価ランク構成比"
              subtitle="FC / ロードサイド / CITY の比較"
              className="xl:col-span-8"
              legend={
                <>
                  {["FC", "ロードサイド", "CITY"].map((format) => (
                    <span key={format} className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FORMAT_COLORS[format] }} />
                      {format}
                    </span>
                  ))}
                </>
              }
            >
              <div className="grid gap-4 lg:grid-cols-3">
                {["FC", "ロードサイド", "CITY"].map((format) => (
                  <div key={format} className="rounded-lg border border-[#323B48] bg-[#1E2530] p-4">
                    <p className="text-sm font-medium text-[#F2F4F7]">{format}</p>
                    <div className="mt-3 h-[190px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={formatComposition[format]} dataKey="value" nameKey="grade" outerRadius={62}>
                            {(formatComposition[format] ?? []).map((entry) => (
                              <Cell key={entry.grade} fill={RANK_COLORS[entry.grade]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={tooltipFormatter("店", "店舗数")} {...chartTooltipProps} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#98A2B3]">
                      {(formatComposition[format] ?? []).map((entry) => (
                        <span key={entry.grade}>
                          {entry.grade}={entry.value}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <Panel title="評価ランク構成比" subtitle="スタイル別の積み上げ比較" className="xl:col-span-5">
              <div className="h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formatStacked}>
                    <CartesianGrid vertical={false} stroke="#2C333F" />
                    <XAxis dataKey="format" tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip {...chartTooltipProps} />
                    <Legend />
                    {RANK_ORDER.map((grade) => (
                      <Bar key={grade} dataKey={grade} stackId="rank" fill={RANK_COLORS[grade]} radius={grade === "S評価" ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              title="花王衛生検査 要改善店舗(85点以下)"
              subtitle="基準線を下回る店舗を抽出"
              className="xl:col-span-7"
              legend={<span>基準線 85 点</span>}
            >
              <div className="h-[310px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={hygieneNeedsImprovement.map((metric) => ({
                      ...metric,
                      storeName: metric.store.name,
                    }))}
                    layout="vertical"
                    margin={{ left: 8, right: 20 }}
                  >
                    <CartesianGrid horizontal={false} stroke="#2C333F" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="storeName" type="category" width={132} tick={{ fill: "#F2F4F7", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={tooltipFormatter("点", "衛生検査")} {...chartTooltipProps} />
                    <ReferenceLine x={85} stroke="#EF4444" strokeDasharray="4 4" />
                    <Bar dataKey="currentHygiene" fill="#EF4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <Panel
              title="店舗スタイル別推移"
              subtitle="期間ごとの平均 5C スコア推移"
              className="xl:col-span-6"
              legend={
                <>
                  {["FC", "ロードサイド", "CITY"].map((format) => (
                    <span key={format} className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FORMAT_COLORS[format] }} />
                      {format}
                    </span>
                  ))}
                </>
              }
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid vertical={false} stroke="#2C333F" />
                    <XAxis dataKey="period" tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[60, 100]} tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={tooltipFormatter("点", "平均スコア")} {...chartTooltipProps} />
                    <Legend />
                    <Line type="monotone" dataKey="FC" stroke={FORMAT_COLORS.FC} strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="ロードサイド" stroke={FORMAT_COLORS["ロードサイド"]} strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="CITY" stroke={FORMAT_COLORS.CITY} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

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
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <Panel title="上位改善項目(全体)" subtitle="改善指摘の集中領域" className="xl:col-span-3">
              <div className="space-y-3">
                {overallIssueList.map((item) => (
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
                  <Tooltip {...chartTooltipProps} />
                  <Legend />
                  <ReferenceLine y={20} stroke="#EF4444" strokeDasharray="4 4" />
                  <Bar dataKey="before" name="前回" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="after" name="今回" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-12">
            <Panel title="切片器" subtitle="店舗を選択して詳細を確認" className="xl:col-span-12">
              <div className="grid gap-3 md:grid-cols-3">
                <SelectField
                  label="店舗選択"
                  value={resolvedStoreId}
                  options={filteredMetrics.map((metric) => ({ value: metric.store.id, label: metric.store.name }))}
                  onChange={setSelectedStoreId}
                />
                <div className="rounded-lg border border-[#323B48] bg-[#1E2530] px-4 py-3">
                  <p className="text-[11px] font-medium tracking-[0.04em] text-[#98A2B3]">店舗スタイル</p>
                  <p className="mt-2 text-sm font-medium text-[#F2F4F7]">{selectedStore?.format ?? "-"}</p>
                </div>
                <div className="rounded-lg border border-[#323B48] bg-[#1E2530] px-4 py-3">
                  <p className="text-[11px] font-medium tracking-[0.04em] text-[#98A2B3]">エリア</p>
                  <p className="mt-2 text-sm font-medium text-[#F2F4F7]">{selectedStore?.area ?? "-"}</p>
                </div>
              </div>
            </Panel>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="今回順位"
              value={selectedCurrentRank ? String(selectedCurrentRank) : "-"}
              unit={ranking.length ? `/ 全${ranking.length}店中` : undefined}
              hint="現在の絞り込み条件での順位"
              icon={<StoreIcon className="h-4 w-4" />}
            />
            <div className="rounded-lg border border-[#323B48] bg-[#262E3A] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.10)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium tracking-[0.02em] text-[#98A2B3]">前回順位</p>
                  <div className="mt-3 flex items-end gap-1 text-[#F2F4F7]">
                    <span className="font-[Inter] text-[28px] font-semibold leading-none tabular-nums">{selectedPreviousRank || "-"}</span>
                    <span className="pb-0.5 text-xs text-[#98A2B3]">位</span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[rgba(71,194,102,0.35)] bg-[rgba(71,194,102,0.12)] px-3 py-1 text-xs font-medium text-[#47C266]">
                    {rankDelta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {rankDelta >= 0 ? `▲${rankDelta}改善` : `▼${Math.abs(rankDelta)}低下`}
                  </div>
                </div>
                <div className="rounded-md bg-[rgba(59,130,246,0.12)] p-2 text-[#3B82F6]">
                  <LayoutDashboard className="h-4 w-4" />
                </div>
              </div>
            </div>
            <KpiCard
              title="現在スコア"
              value={selectedStore ? String(selectedStore.currentScore) : "-"}
              unit="点"
              hint={selectedStore ? selectedStore.grade : "選択店舗なし"}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <KpiCard
              title="前回スコア"
              value={selectedStore ? String(selectedStore.previousScore) : "-"}
              unit="点"
              hint={selectedStore ? selectedStore.previousGrade : "選択店舗なし"}
              icon={<Building2 className="h-4 w-4" />}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title="花王衛生検査推移" subtitle="期間ごとの衛生スコア" legend={<span>基準線 85 点</span>}>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selectedStore?.hygieneSeries ?? []}>
                    <CartesianGrid vertical={false} stroke="#2C333F" />
                    <XAxis dataKey="label" tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[60, 100]} tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={tooltipFormatter("点", "衛生スコア")} {...chartTooltipProps} />
                    <ReferenceLine y={85} stroke="#EF4444" strokeDasharray="4 4" />
                    <Bar dataKey="score" fill="#EF4444" radius={[4, 4, 0, 0]}>
                      {(selectedStore?.hygieneSeries ?? []).map((entry) => (
                        <Cell key={entry.key} fill={entry.key === "Q4" ? "#EF4444" : "#7F1D1D"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="5C評価推移" subtitle="期間ごとの総合スコア推移">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selectedStore?.scoreSeries ?? []}>
                    <CartesianGrid vertical={false} stroke="#2C333F" />
                    <XAxis dataKey="label" tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[60, 100]} tick={{ fill: "#98A2B3", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={tooltipFormatter("点", "5C スコア")} {...chartTooltipProps} />
                    <Bar dataKey="score" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                      {(selectedStore?.scoreSeries ?? []).map((entry) => (
                        <Cell key={entry.key} fill={entry.key === "Q4" ? "#3B82F6" : "#1D4ED8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </section>

          <Panel title="確認ポイント" subtitle="検査項目別の判定・点数・コメント・担当・確認日">
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-[#1E2530] text-[#98A2B3]">
                    <th className="rounded-l-lg border-b border-t border-[#323B48] px-4 py-3 font-medium">確認ポイント</th>
                    <th className="border-b border-t border-[#323B48] px-4 py-3 font-medium">判定</th>
                    <th className="border-b border-t border-[#323B48] px-4 py-3 font-medium">点数</th>
                    <th className="border-b border-t border-[#323B48] px-4 py-3 font-medium">コメント</th>
                    <th className="border-b border-t border-[#323B48] px-4 py-3 font-medium">担当</th>
                    <th className="rounded-r-lg border-b border-t border-[#323B48] px-4 py-3 font-medium">確認日</th>
                  </tr>
                </thead>
                <tbody>
                  {storePointRows.map((row) => (
                    <tr key={`${row.label}-${row.index}`} className="text-[#F2F4F7]">
                      <td className="border-b border-[#2C333F] px-4 py-3">{row.label}</td>
                      <td className="border-b border-[#2C333F] px-4 py-3">
                        <StatusChip value={row.status} />
                      </td>
                      <td className="border-b border-[#2C333F] px-4 py-3 font-[Inter] tabular-nums">{row.score}点</td>
                      <td className="border-b border-[#2C333F] px-4 py-3 text-[#98A2B3]">{row.comment}</td>
                      <td className="border-b border-[#2C333F] px-4 py-3">{row.assignee}</td>
                      <td className="border-b border-[#2C333F] px-4 py-3 font-[Inter] tabular-nums text-[#98A2B3]">{row.checkedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
