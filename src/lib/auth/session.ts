import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { demoProfiles } from "../demo-data";
import type { SessionMode, SessionUser, UserRole } from "../domain";

const SESSION_COOKIE = "r5c_session";
const LARK_ACCESS_TOKEN_COOKIE = "r5c_lark_uat";
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? process.env.R5C_SESSION_SECRET ?? process.env.LARK_APP_SECRET ?? "dev-session-secret";
const COOKIE_SECURE = process.env.NODE_ENV === "production";

function signValue(value: string) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function decodeSession(value: string | undefined): SessionUser | null {
  if (!value) {
    return null;
  }

  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) {
      return null;
    }

    const expected = signValue(payload);
    if (
      expected.length !== signature.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return null;
    }

    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
  } catch {
    return null;
  }
}

function encodeSession(session: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${signValue(payload)}`;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireSession(role?: UserRole): Promise<SessionUser> {
  const session = await getSessionUser();

  if (!session) {
    redirect("/");
  }

  if (role && session.role !== role) {
    redirect(session.role === "sv" ? "/sv/dashboard" : "/store/my-5c");
  }

  return session;
}

export async function setSession(session: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(LARK_ACCESS_TOKEN_COOKIE);
}

export function getDemoProfile(profileId: string): SessionUser | null {
  return demoProfiles[profileId] ?? null;
}

export function buildProductionSession(input: {
  id: string;
  role: UserRole;
  name: string;
  storeId?: string;
  storeName?: string;
  svCode?: string;
  larkOpenId?: string;
  larkUserId?: string;
}): SessionUser {
  return {
    ...input,
    mode: "production" satisfies SessionMode,
  };
}

export async function setLarkUserAccessToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(LARK_ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: 60 * 60 * 2,
  });
}

export async function getLarkUserAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(LARK_ACCESS_TOKEN_COOKIE)?.value ?? null;
}
