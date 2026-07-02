import { NextResponse } from "next/server";

import { requireSession } from "../../../../../lib/auth/session";
import type { UploadedPhoto } from "../../../../../lib/domain";
import { getRepositoryForSession } from "../../../../../lib/repositories";

async function fileToUploadedPhoto(file: File): Promise<UploadedPhoto> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  return {
    name: file.name,
    url: `data:${mimeType};base64,${buffer.toString("base64")}`,
  };
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/tasks/[id]/feedback">,
) {
  const user = await requireSession("store");
  const repository = await getRepositoryForSession(user);
  const params = await context.params;

  try {
    const formData = await request.formData();
    const comment = `${formData.get("comment") ?? ""}`.trim();
    const files = formData
      .getAll("photos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!comment) {
      return NextResponse.json({ error: "是正コメントを入力してください。" }, { status: 400 });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "改善後写真を 1 枚以上アップロードしてください。" }, { status: 400 });
    }

    const payload = {
      comment,
      photos: await Promise.all(files.map((file) => fileToUploadedPhoto(file))),
    };
    const task = await repository.submitTaskFeedback(user, params.id, payload);
    return NextResponse.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "是正報告の送信に失敗しました。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
