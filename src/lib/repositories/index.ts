import "server-only";

import { getLarkUserAccessToken, getSessionUser } from "../auth/session";
import type { SessionUser } from "../domain";
import type { BaseRepository } from "./base-repository";
import { DemoRepository } from "./demo-repository";
import { LarkBaseRepository } from "./lark-base-repository";

export async function getRepositoryForSession(
  session?: SessionUser | null,
): Promise<BaseRepository> {
  const currentSession = session ?? (await getSessionUser());

  if (!currentSession || currentSession.mode === "demo") {
    return new DemoRepository();
  }

  const accessToken = await getLarkUserAccessToken();
  if (!accessToken) {
    throw new Error("Lark の `user_access_token` が取得できません。再度ログインしてください。");
  }

  return new LarkBaseRepository(accessToken);
}
