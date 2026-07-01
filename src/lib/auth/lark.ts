import "server-only";

import { appConfig } from "../config";

interface LarkTokenResponse {
  access_token: string;
  refresh_token?: string;
}

interface LarkUserInfoResponse {
  open_id: string;
  union_id?: string;
  user_id?: string;
  name: string;
}

function buildAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    client_id: appConfig.larkAppId,
    redirect_uri: appConfig.larkRedirectUri,
    response_type: "code",
    scope: appConfig.oauthScope,
    state,
  });
  return `${appConfig.larkAuthBaseUrl}/open-apis/authen/v1/authorize?${params.toString()}`;
}

async function requestToken(code: string): Promise<LarkTokenResponse> {
  const response = await fetch(`${appConfig.larkOpenApiBaseUrl}/open-apis/authen/v2/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: appConfig.larkAppId,
      client_secret: appConfig.larkAppSecret,
      code,
      redirect_uri: appConfig.larkRedirectUri,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Lark OAuth に失敗しました: ${detail}`);
  }

  const json = (await response.json()) as {
    code: number;
    msg?: string;
    data?: LarkTokenResponse;
  };
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg ?? "`user_access_token` を取得できません。");
  }
  return json.data;
}

async function requestUserInfo(accessToken: string): Promise<LarkUserInfoResponse> {
  const response = await fetch(`${appConfig.larkOpenApiBaseUrl}/open-apis/authen/v1/user_info`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
  if (!response.ok) {
    throw new Error("Lark ユーザー情報の取得に失敗しました。");
  }

  const json = (await response.json()) as {
    code: number;
    msg?: string;
    data?: LarkUserInfoResponse;
  };
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg ?? "Lark ユーザー情報の取得に失敗しました。");
  }
  return json.data;
}

export const larkAuthClient = {
  buildAuthorizationUrl,
  requestToken,
  requestUserInfo,
};
