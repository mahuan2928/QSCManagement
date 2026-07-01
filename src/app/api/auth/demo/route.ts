import { NextResponse } from "next/server";

import { getDemoProfile, setSession } from "../../../../lib/auth/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const profileId = `${formData.get("profileId") ?? ""}`;
  const profile = getDemoProfile(profileId);

  if (!profile) {
    return NextResponse.json({ error: "无效的 Demo 角色。" }, { status: 400 });
  }

  await setSession(profile);
  const destination = profile.role === "sv" ? "/sv/dashboard" : "/store/my-5c";
  return NextResponse.redirect(new URL(destination, request.url));
}
