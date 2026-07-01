import type {
  AuditChecklistItem,
  DashboardFilters,
  DashboardGradePoint,
  DashboardHygienePoint,
  DashboardIssuePoint,
  DashboardIssueRecord,
  DashboardKpi,
  DashboardOverviewData,
  DashboardRankingEntry,
  DashboardTrendPoint,
  RectificationTask,
  SessionUser,
  Store,
  StoreDashboardData,
} from "./domain";
import { normalizeTaskStatus } from "./business-rules";
import type { BaseRepository } from "./repositories/base-repository";

function normalizeFilterValue(value?: string) {
  return value && value !== "all" ? value : undefined;
}

export function parseDashboardFilters(searchParams?: Record<string, string | string[] | undefined>): DashboardFilters {
  const read = (key: string) => {
    const value = searchParams?.[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    cycle: (read("cycle") as DashboardFilters["cycle"]) ?? "all",
    format: normalizeFilterValue(read("format")),
    group: normalizeFilterValue(read("group")),
    sv: normalizeFilterValue(read("sv")),
    manager: normalizeFilterValue(read("manager")),
    grade: normalizeFilterValue(read("grade")),
  };
}

function dedupeSorted(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
}

function matchesFilters(store: Store, filters: DashboardFilters) {
  if (filters.format && (store.format ?? "未設定") !== filters.format) {
    return false;
  }
  if (filters.group && (store.group ?? store.block ?? "未設定") !== filters.group) {
    return false;
  }
  if (filters.sv && store.svName !== filters.sv) {
    return false;
  }
  if (filters.manager && (store.manager ?? "未設定") !== filters.manager) {
    return false;
  }
  return true;
}

function toRankingEntry(store: Store, score: number, minimumPassed: boolean): DashboardRankingEntry {
  return {
    storeId: store.id,
    storeName: store.name,
    format: store.format ?? "未設定",
    group: store.group ?? store.block ?? "未設定",
    score,
    previousScore: store.previousTotalScore ?? 0,
    minimumPassed,
  };
}

function aggregateGrades(values: string[]) {
  const counts = values.reduce<Record<string, number>>((accumulator, grade) => {
    accumulator[grade] = (accumulator[grade] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function buildKpis(
  stores: Store[],
  tasks: RectificationTask[],
  minimumPassedStores: number,
  operationCompletedStores: number,
): DashboardKpi {
  const openTasks = tasks.filter((task) => normalizeTaskStatus(task) !== "resolved");
  const overdueTasks = tasks.filter((task) => normalizeTaskStatus(task) === "overdue");

  return {
    totalStores: stores.length,
    evaluatedStores: stores.filter((store) => (store.latestTotalScore ?? 0) > 0).length,
    minimumPassRate: stores.length ? Math.round((minimumPassedStores / stores.length) * 100) : 0,
    minimumFailedStores: stores.length - minimumPassedStores,
    operationCompletionRate: stores.length ? Math.round((operationCompletedStores / stores.length) * 100) : 0,
    rectificationOpenCount: openTasks.length,
    overdueRectificationCount: overdueTasks.length,
  };
}

function getCurrentResultMap(stores: Store[], results: Awaited<ReturnType<BaseRepository["getRecentResults"]>>, filters: DashboardFilters) {
  const byStore = new Map<string, (typeof results)[number]>();

  for (const store of stores) {
    const current = results.find(
      (result) =>
        result.storeId === store.id && (!filters.cycle || filters.cycle === "all" || result.cycle === filters.cycle),
    );
    if (current) {
      byStore.set(store.id, current);
    }
  }

  return byStore;
}

export async function buildDashboardOverview(
  repository: BaseRepository,
  user: SessionUser,
  filters: DashboardFilters,
): Promise<DashboardOverviewData> {
  const stores = (await repository.getStoresForSv(user)).filter((store) => matchesFilters(store, filters));
  const storeIds = new Set(stores.map((store) => store.id));
  const results = await repository.getRecentResults(user);
  const tasks = (await repository.listTasks(user)).filter((task) => storeIds.has(task.storeId));
  const hygieneInspections = (await repository.getHygieneInspections(user)).filter((item) =>
    storeIds.has(item.storeId),
  );
  const currentResults = getCurrentResultMap(stores, results, filters);

  const filteredGrades = Array.from(currentResults.values())
    .filter((result) => !filters.grade || result.minimumGrade === filters.grade)
    .map((result) => result.minimumGrade);

  const filteredStores = stores.filter((store) => {
    if (!filters.grade) {
      return true;
    }
    return currentResults.get(store.id)?.minimumGrade === filters.grade;
  });
  const filteredStoreIds = new Set(filteredStores.map((store) => store.id));
  const filteredTasks = tasks.filter((task) => filteredStoreIds.has(task.storeId));
  const rankingEntries = filteredStores.map((store) => {
    const result = currentResults.get(store.id);
    const score = result?.totalScore ?? store.latestTotalScore ?? 0;
    return toRankingEntry(store, score, (result?.minimumScore ?? 0) === 22);
  });

  const formatGradeComposition = filteredStores.reduce<Record<string, DashboardGradePoint[]>>((accumulator, store) => {
    const result = currentResults.get(store.id);
    if (!result) {
      return accumulator;
    }
    const key = store.format ?? "未設定";
    const grades = accumulator[key] ?? [];
    const current = grades.find((point) => point.label === result.minimumGrade);
    if (current) {
      current.value += 1;
    } else {
      grades.push({ label: result.minimumGrade, value: 1 });
    }
    accumulator[key] = grades.sort((a, b) => b.value - a.value);
    return accumulator;
  }, {});

  const topIssues = filteredTasks.reduce<Record<string, number>>((accumulator, task) => {
    const key = task.issueType || task.sourceItemKey;
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  const formatTrends = filteredStores.reduce<
    Record<string, DashboardTrendPoint & { count: number }>
  >((accumulator, store) => {
    const key = store.format ?? "未設定";
    const current = accumulator[key] ?? {
      label: key,
      previous: 0,
      current: 0,
      count: 0,
    };
    current.previous += store.previousTotalScore ?? 0;
    current.current += store.latestTotalScore ?? 0;
    current.count += 1;
    accumulator[key] = current;
    return accumulator;
  }, {});

  const minimumAuditEntries = await Promise.all(
    Array.from(currentResults.values())
      .filter((result) => result.minimumScore < 22)
      .map(async (result) => ({
        result,
        audit: await repository.getMinimumAudit(result.minimumAuditId),
      })),
  );

  const minimumFailureReasons = minimumAuditEntries.reduce<Record<string, number>>((accumulator, entry) => {
    entry.audit?.items
      .filter((item) => item.status === "ng")
      .forEach((item) => {
        accumulator[item.label] = (accumulator[item.label] ?? 0) + 1;
      });
    return accumulator;
  }, {});

  const issueRecords: DashboardIssueRecord[] = filteredTasks.map((task) => ({
    id: task.id,
    storeId: task.storeId,
    storeName: task.storeName,
    issueType: task.issueType,
    category: task.category,
    dueDate: task.dueDate,
    status: normalizeTaskStatus(task),
  }));

  const minimumPassedStores = Array.from(currentResults.values()).filter((result) => result.minimumScore === 22).length;
  const operationCompletedStores = Array.from(currentResults.values()).filter((result) => result.operationScore > 0).length;

  return {
    filters,
    kpis: buildKpis(filteredStores, filteredTasks, minimumPassedStores, operationCompletedStores),
    availableFormats: dedupeSorted(stores.map((store) => store.format)),
    availableGroups: dedupeSorted(stores.map((store) => store.group ?? store.block)),
    availableManagers: dedupeSorted(stores.map((store) => store.manager)),
    availableSvs: dedupeSorted(stores.map((store) => store.svName)),
    gradeComposition: aggregateGrades(filteredGrades),
    formatGradeComposition,
    top10: [...rankingEntries].sort((a, b) => b.score - a.score).slice(0, 10),
    worst10: [...rankingEntries]
      .filter((entry) => entry.score >= 1)
      .sort((a, b) => a.score - b.score)
      .slice(0, 10),
    topIssues: Object.entries(topIssues)
      .map(([issueKey, value]) => ({ issueKey, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    formatTrends: Object.values(formatTrends).map((typed) => {
      return {
        label: typed.label,
        previous: typed.count ? Number((typed.previous / typed.count).toFixed(1)) : 0,
        current: typed.count ? Number((typed.current / typed.count).toFixed(1)) : 0,
      };
    }),
    improvementProgress: filteredStores
      .filter((store) => (store.previousTotalScore ?? 0) > 1 && (store.previousTotalScore ?? 0) < 20)
      .map((store) => toRankingEntry(store, store.latestTotalScore ?? 0, (currentResults.get(store.id)?.minimumScore ?? 0) === 22))
      .sort((a, b) => (b.score - b.previousScore) - (a.score - a.previousScore))
      .slice(0, 10),
    hygieneNeedsImprovement: (() => {
      const latestByStore = new Map<string, DashboardHygienePoint>();
      hygieneInspections.forEach((inspection) => {
        const current = latestByStore.get(inspection.storeId);
        if (!current || inspection.period.includes("今回") || inspection.period.includes("下期")) {
          latestByStore.set(inspection.storeId, {
            storeId: inspection.storeId,
            storeName: inspection.storeName,
            score: inspection.score,
          });
        }
      });

      return [...latestByStore.values()]
        .filter((point) => point.score < 85)
        .sort((a, b) => a.score - b.score);
    })(),
    minimumFailureReasons: Object.entries(minimumFailureReasons)
      .map(([issueKey, value]) => ({ issueKey, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    minimumFailedStores: filteredStores
      .filter((store) => (currentResults.get(store.id)?.minimumScore ?? 0) < 22)
      .map((store) =>
        toRankingEntry(store, currentResults.get(store.id)?.totalScore ?? store.latestTotalScore ?? 0, false),
      ),
    issueRecords,
  };
}

function findPreviousResult(results: Awaited<ReturnType<BaseRepository["getRecentResults"]>>, storeId: string, currentId?: string) {
  return results.find((result) => result.storeId === storeId && result.id !== currentId);
}

export async function buildStoreDashboard(
  repository: BaseRepository,
  user: SessionUser,
  storeId: string,
  cycle: StoreDashboardData["cycle"] = "all",
): Promise<StoreDashboardData> {
  const stores = await repository.getStoresForSv(user);
  const store = stores.find((item) => item.id === storeId);
  if (!store) {
    throw new Error("対象店舗が見つかりません。");
  }

  const results = await repository.getRecentResults(user);
  const currentResult =
    results.find((result) => result.storeId === storeId && (cycle === "all" || result.cycle === cycle)) ??
    results.find((result) => result.storeId === storeId);
  const previousResult = currentResult ? findPreviousResult(results, storeId, currentResult.id) : undefined;
  const currentRanking = [...results]
    .filter((result) => cycle === "all" || result.cycle === cycle)
    .sort((a, b) => b.totalScore - a.totalScore);

  const currentRank = currentResult ? currentRanking.findIndex((result) => result.id === currentResult.id) + 1 : null;
  const previousRanking = previousResult ? currentRanking.findIndex((result) => result.id === previousResult.id) + 1 : null;

  const minimumAudit = currentResult ? await repository.getMinimumAudit(currentResult.minimumAuditId) : null;
  const operationAudit = currentResult?.operationAuditId
    ? await repository.getOperationAudit(currentResult.operationAuditId)
    : null;
  const valueAudit = currentResult?.valueAuditId ? await repository.getValueAudit(currentResult.valueAuditId) : null;
  const hygieneInspections = (await repository.getHygieneInspections(user))
    .filter((inspection) => inspection.storeId === storeId)
    .sort((a, b) => b.period.localeCompare(a.period));
  const tasks = (await repository.listTasks(user, { storeId, status: "all" })).sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
  const latestHygiene = hygieneInspections[0]?.score ?? store.hygieneCurrentScore ?? 0;
  const previousHygiene = hygieneInspections[1]?.score ?? store.hygienePreviousScore ?? 0;
  const enrichedStore = {
    ...store,
    hygieneCurrentScore: latestHygiene,
    hygienePreviousScore: previousHygiene,
  };

  return {
    store: enrichedStore,
    cycle,
    currentResult,
    previousResult,
    currentRank,
    previousRank: previousRanking || store.previousRank || null,
    rankDelta:
      currentRank && (previousRanking || store.previousRank)
        ? (previousRanking || store.previousRank || 0) - currentRank
        : null,
    scoreDelta:
      (currentResult?.totalScore ?? store.latestTotalScore ?? 0) -
      (previousResult?.totalScore ?? store.previousTotalScore ?? 0),
    minimumStatusLabel:
      (currentResult?.minimumScore ?? 0) === 22
        ? "22/22 OK：通過、運営評価可"
        : "最低遵守未通過：運営基準 / 価値創造は不可",
    minimumItems: minimumAudit?.items ?? [],
    operationItems: operationAudit?.items ?? [],
    valueItems: valueAudit?.items ?? [],
    openTasks: tasks.filter((task) => {
      const status = normalizeTaskStatus(task);
      return status === "open" || status === "submitted";
    }),
    overdueTasks: tasks.filter((task) => normalizeTaskStatus(task) === "overdue"),
    resolvedTasks: tasks.filter((task) => normalizeTaskStatus(task) === "resolved"),
  };
}
