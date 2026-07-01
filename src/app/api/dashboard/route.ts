import { NextResponse } from "next/server";

import { requireSession } from "../../../lib/auth/session";
import { getRepositoryForSession } from "../../../lib/repositories";

export async function GET() {
  const user = await requireSession();
  const repository = await getRepositoryForSession(user);

  if (user.role === "sv") {
    return NextResponse.json(await repository.getSvDashboard(user));
  }

  return NextResponse.json(await repository.getStoreWorkbench(user));
}
