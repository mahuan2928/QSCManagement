import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildProductionSession, setLarkUserAccessToken, setSession } from "../../../../../lib/auth/session";
import { larkAuthClient } from "../../../../../lib/auth/lark";
import { appConfig } from "../../../../../lib/config";

interface LarkStoreRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

async function resolveRole(accessToken: string, openId: string, name: string) {
  const response = await fetch(
    `${appConfig.larkOpenApiBaseUrl}/open-apis/bitable/v1/apps/${appConfig.larkBaseAppToken}/tables/${appConfig.larkStoreTableId}/records/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ page_size: 500 }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("`店舗マスター` の取得に失敗したため、本番モードのロール判定ができません。");
  }

  const json = (await response.json()) as {
    code: number;
    msg?: string;
    data?: { items?: LarkStoreRecord[] };
  };

  if (json.code !== 0) {
    throw new Error(json.msg ?? "`店舗マスター` の取得に失敗しました。");
  }

  const records = json.data?.items ?? [];
  const storeRecord = records.find((record) => {
    const owner = `${record.fields[appConfig.storeOwnerFieldId] ?? record.fields["店舗ユーザーID"] ?? ""}`;
    return owner === openId || owner === name;
  });
  if (storeRecord) {
    return buildProductionSession({
      id: `prod-store-${openId}`,
      role: "store",
      name,
      storeId: storeRecord.record_id,
      storeName: `${storeRecord.fields["店舗名"] ?? name}`,
      larkOpenId: openId,
    });
  }

  const svRecord = records.find((record) => {
    const owner = `${record.fields[appConfig.svOwnerFieldId] ?? record.fields["SV"] ?? ""}`;
    return owner === openId || owner === name;
  });
  if (svRecord) {
    return buildProductionSession({
      id: `prod-sv-${openId}`,
      role: "sv",
      name,
      svCode: `${svRecord.fields[appConfig.svOwnerFieldId] ?? openId}`,
      larkOpenId: openId,
    });
  }

  throw new Error(
    "現在の Lark アカウントに対応する店舗または SV が `店舗マスター` に見つかりません。`SVユーザーID` / `店舗ユーザーID` の紐付けを確認してください。",
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("r5c_lark_state")?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/?error=invalid-lark-state", request.url));
  }

  try {
    const token = await larkAuthClient.requestToken(code);
    const userInfo = await larkAuthClient.requestUserInfo(token.access_token);
    const session = await resolveRole(token.access_token, userInfo.open_id, userInfo.name);

    await setSession(session);
    await setLarkUserAccessToken(token.access_token);

    return NextResponse.redirect(
      new URL(session.role === "sv" ? "/sv/dashboard" : "/store/my-5c", request.url),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "lark-auth-error";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, request.url));
  }
}
