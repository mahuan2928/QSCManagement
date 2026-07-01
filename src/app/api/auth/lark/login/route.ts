import { NextResponse } from "next/server";

import { larkAuthClient } from "../../../../../lib/auth/lark";
import { appConfig } from "../../../../../lib/config";

export async function GET(request: Request) {
  if (!appConfig.larkAppId || !appConfig.larkAppSecret || !appConfig.larkRedirectUri) {
    return NextResponse.redirect(new URL("/?error=missing-lark-env", request.url));
  }

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(larkAuthClient.buildAuthorizationUrl(state));
  response.cookies.set("r5c_lark_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
