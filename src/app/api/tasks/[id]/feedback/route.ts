import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "../../../../../lib/auth/session";
import { getRepositoryForSession } from "../../../../../lib/repositories";

const schema = z.object({
  comment: z.string().min(1, "是正コメントを入力してください。"),
  photos: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().min(1),
      }),
    )
    .min(1, "改善後写真を 1 枚以上アップロードしてください。"),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/tasks/[id]/feedback">,
) {
  const user = await requireSession("store");
  const repository = await getRepositoryForSession(user);
  const params = await context.params;

  try {
    const payload = schema.parse(await request.json());
    const task = await repository.submitTaskFeedback(user, params.id, payload);
    return NextResponse.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "是正報告の送信に失敗しました。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
