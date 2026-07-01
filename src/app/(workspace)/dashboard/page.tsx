import { EnterpriseDashboard } from "../../../components/enterprise-dashboard";
import { requireSession } from "../../../lib/auth/session";
import { getRepositoryForSession } from "../../../lib/repositories";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSession("sv");
  const repository = await getRepositoryForSession(user);
  const resolvedSearchParams = await searchParams;
  const selectedStoreValue = resolvedSearchParams.storeId;
  const selectedStoreId = Array.isArray(selectedStoreValue) ? selectedStoreValue[0] : selectedStoreValue;

  const [stores, results, tasks, hygieneInspections] = await Promise.all([
    repository.getStoresForSv(user),
    repository.getRecentResults(user),
    repository.listTasks(user, { status: "all" }),
    repository.getHygieneInspections(user),
  ]);

  return (
    <EnterpriseDashboard
      stores={[...stores].sort((left, right) => left.name.localeCompare(right.name))}
      results={results}
      tasks={tasks}
      hygieneInspections={hygieneInspections}
      initialStoreId={selectedStoreId ?? stores[0]?.id}
      updatedAt={new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())}
    />
  );
}
