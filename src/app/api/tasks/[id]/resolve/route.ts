import { NextResponse } from "next/server";

import { requireSession } from "../../../../../lib/auth/session";
import { getRepositoryForSession } from "../../../../../lib/repositories";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireSession("sv");
  const repository = await getRepositoryForSession(user);
  const params = await context.params;

  try {
    const task = await repository.markTaskResolved(user, params.id);
    return NextResponse.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ステータス更新に失敗しました。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
