import { NextResponse } from "next/server";

import { requireSession } from "../../../../../lib/auth/session";
import { buildDashboardOverview, parseDashboardFilters } from "../../../../../lib/dashboard";
import { getRepositoryForSession } from "../../../../../lib/repositories";

export async function GET(request: Request) {
  const user = await requireSession("sv");
  const repository = await getRepositoryForSession(user);
  const { searchParams } = new URL(request.url);
  const filters = parseDashboardFilters(Object.fromEntries(searchParams.entries()));
  const overview = await buildDashboardOverview(repository, user, filters);
  return NextResponse.json(overview.worst10);
}
