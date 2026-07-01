import { NextResponse } from "next/server";

import { requireSession } from "../../../lib/auth/session";
import { getRepositoryForSession } from "../../../lib/repositories";

export async function GET() {
  const user = await requireSession();
  const repository = await getRepositoryForSession(user);
  return NextResponse.json(await repository.getSchema());
}
