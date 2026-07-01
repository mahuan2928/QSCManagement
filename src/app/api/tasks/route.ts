import { NextResponse } from "next/server";

import { requireSession } from "../../../lib/auth/session";
import { getRepositoryForSession } from "../../../lib/repositories";

export async function GET(request: Request) {
  const user = await requireSession();
  const repository = await getRepositoryForSession(user);
  const url = new URL(request.url);
  const data = await repository.listTasks(user, {
    storeId: url.searchParams.get("storeId") ?? undefined,
    status: (url.searchParams.get("status") as "all" | "open" | "submitted" | "resolved" | "overdue" | null) ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });

  return NextResponse.json(data);
}
