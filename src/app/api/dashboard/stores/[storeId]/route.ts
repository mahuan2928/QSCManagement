import { NextResponse } from "next/server";

import { requireSession } from "../../../../../lib/auth/session";
import { buildStoreDashboard } from "../../../../../lib/dashboard";
import { getRepositoryForSession } from "../../../../../lib/repositories";

export async function GET(
  request: Request,
  context: { params: Promise<{ storeId: string }> },
) {
  const user = await requireSession("sv");
  const repository = await getRepositoryForSession(user);
  const { storeId } = await context.params;
  const { searchParams } = new URL(request.url);
  const cycle = (searchParams.get("cycle") as "Q1" | "Q2" | "Q3" | "Q4" | "all" | null) ?? "all";
  return NextResponse.json(await buildStoreDashboard(repository, user, storeId, cycle));
}
