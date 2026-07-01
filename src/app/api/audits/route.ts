import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "../../../lib/auth/session";
import { getRepositoryForSession } from "../../../lib/repositories";

const auditItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  group: z.string(),
  maxScore: z.number(),
  status: z.enum(["ok", "ng"]),
  note: z.string().optional(),
});

const taskSchema = z.object({
  id: z.string(),
  category: z.enum(["minimum", "operation", "value"]),
  sourceItemKey: z.string(),
  issueType: z.string().min(1),
  comment: z.string().min(1),
  improvementPlan: z.string().min(1),
  dueDate: z.string().min(1),
  assignee: z.string().min(1),
  beforePhotos: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().min(1),
      }),
    )
    .optional(),
});

const schema = z.object({
  storeId: z.string().min(1),
  cycle: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  auditDate: z.string().min(1),
  evaluator: z.string().min(1),
  minimumItems: z.array(auditItemSchema),
  operationItems: z.array(auditItemSchema),
  valueItems: z.array(auditItemSchema),
  minimumCompletionState: z.enum(["draft", "saved", "completed", "blocked"]),
  operationCompletionState: z.enum(["draft", "saved", "completed", "blocked"]),
  valueCompletionState: z.enum(["draft", "saved", "completed", "blocked"]),
  tasks: z.array(taskSchema),
});

function formatZodError(error: z.ZodError) {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return "入力内容を確認してください。";
  }

  const path = firstIssue.path.join(".");
  if (path.includes("improvementPlan")) {
    return "問題指摘を送信するには、改善方法 / SV 指示を入力してください。";
  }
  if (path.includes("assignee")) {
    return "問題指摘を送信するには、担当者を入力してください。";
  }
  if (path.includes("comment")) {
    return "問題指摘の内容を入力してください。";
  }
  if (path.includes("dueDate")) {
    return "改善期限を入力してください。";
  }

  return "入力内容を確認してください。";
}

export async function POST(request: Request) {
  const user = await requireSession("sv");
  const repository = await getRepositoryForSession(user);

  try {
    const payload = schema.parse(await request.json());
    const result = await repository.createAudit(user, payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "5C評価の送信に失敗しました。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
