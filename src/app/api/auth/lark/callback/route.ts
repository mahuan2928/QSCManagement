import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildProductionSession, setLarkUserAccessToken, setSession } from "../../../../../lib/auth/session";
import { larkAuthClient } from "../../../../../lib/auth/lark";
import { appConfig } from "../../../../../lib/config";

interface LarkStoreRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

interface BitableResponse<T> {
  code: number;
  msg?: string;
  data?: T;
}

interface LarkTableItem {
  table_id: string;
  name: string;
}

function toCandidateValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => toCandidateValues(item));
  }
  if (typeof value === "string") {
    return [value];
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) => toCandidateValues(item));
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [String(value)];
}

async function searchStoreRecords(accessToken: string, tableId: string) {
  const items: LarkStoreRecord[] = [];
  let pageToken: string | undefined;

  while (true) {
    const response = await fetch(
      `${appConfig.larkOpenApiBaseUrl}/open-apis/bitable/v1/apps/${appConfig.larkBaseAppToken}/tables/${tableId}/records/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ page_size: 500, ...(pageToken ? { page_token: pageToken } : {}) }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("`店舗マスター` の取得に失敗したため、本番モードのロール判定ができません。");
    }

    const json = (await response.json()) as BitableResponse<{
      items?: LarkStoreRecord[];
      has_more?: boolean;
      page_token?: string;
    }>;

    if (json.code !== 0) {
      return json;
    }

    items.push(...(json.data?.items ?? []));
    if (!json.data?.has_more || !json.data.page_token) {
      return {
        code: 0,
        data: {
          items,
        },
      };
    }

    pageToken = json.data.page_token;
  }
}

async function resolveStoreTableId(accessToken: string) {
  const response = await fetch(
    `${appConfig.larkOpenApiBaseUrl}/open-apis/bitable/v1/apps/${appConfig.larkBaseAppToken}/tables?page_size=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("`店舗マスター` の表一覧取得に失敗しました。");
  }

  const json = (await response.json()) as BitableResponse<{ items?: LarkTableItem[] }>;
  if (json.code !== 0) {
    throw new Error(json.msg ?? "`店舗マスター` の表一覧取得に失敗しました。");
  }

  const tables = json.data?.items ?? [];
  const matched = tables.find((table) =>
    ["店舗関連表", "店舗マスタ(これを使用する)", "店舗マスタ", "店舗マスター"].some((name) =>
      table.name.includes(name),
    ),
  );

  if (!matched) {
    throw new Error("`店舗マスター` の実表が見つかりません。Base の表名を確認してください。");
  }

  return matched.table_id;
}

async function resolveRole(accessToken: string, openId: string, userId: string | undefined, name: string) {
  let json = await searchStoreRecords(accessToken, appConfig.larkStoreTableId);

  if (json.code !== 0 && json.msg === "WrongTableId") {
    const actualTableId = await resolveStoreTableId(accessToken);
    json = await searchStoreRecords(accessToken, actualTableId);
  }

  if (json.code !== 0) {
    throw new Error(json.msg ?? "`店舗マスター` の取得に失敗しました。");
  }

  const records = json.data?.items ?? [];
  const storeRecord = records.find((record) => {
    const ownerCandidates = [
      ...toCandidateValues(record.fields[appConfig.storeOwnerFieldId]),
      ...toCandidateValues(record.fields["店舗ユーザーID"]),
    ];
    return ownerCandidates.includes(openId) || (!!userId && ownerCandidates.includes(userId));
  });
  if (storeRecord) {
    return buildProductionSession({
      id: `prod-store-${openId}`,
      role: "store",
      name,
      storeId: storeRecord.record_id,
      storeName: `${storeRecord.fields["店舗名"] ?? name}`,
      larkOpenId: openId,
      larkUserId: userId,
    });
  }

  const svRecord = records.find((record) => {
    const ownerCandidates = [
      ...toCandidateValues(record.fields[appConfig.svOwnerFieldId]),
      ...toCandidateValues(record.fields["SVユーザーID"]),
      ...toCandidateValues(record.fields["SV"]),
    ];
    return ownerCandidates.includes(openId) || (!!userId && ownerCandidates.includes(userId));
  });
  if (svRecord) {
    return buildProductionSession({
      id: `prod-sv-${openId}`,
      role: "sv",
      name,
      svCode: `${svRecord.fields[appConfig.svOwnerFieldId] ?? openId}`,
      larkOpenId: openId,
      larkUserId: userId,
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
    const session = await resolveRole(token.access_token, userInfo.open_id, userInfo.user_id, userInfo.name);

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
