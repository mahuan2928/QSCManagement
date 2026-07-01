import { StoreDashboardView } from "../../../../../components/store-dashboard-view";
import { requireSession } from "../../../../../lib/auth/session";
import { buildStoreDashboard } from "../../../../../lib/dashboard";
import { getRepositoryForSession } from "../../../../../lib/repositories";

export default async function StoreDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSession("sv");
  const repository = await getRepositoryForSession(user);
  const { storeId } = await params;
  const resolvedSearchParams = await searchParams;
  const cycleValue = resolvedSearchParams.cycle;
  const cycle = (Array.isArray(cycleValue) ? cycleValue[0] : cycleValue) as
    | "Q1"
    | "Q2"
    | "Q3"
    | "Q4"
    | "all"
    | undefined;
  const data = await buildStoreDashboard(repository, user, storeId, cycle ?? "all");

  return <StoreDashboardView data={data} />;
}
