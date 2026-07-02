import { NextResponse } from "next/server";

import { getLarkUserAccessToken, getSessionUser } from "../../../../../lib/auth/session";
import { appConfig } from "../../../../../lib/config";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileToken: string }> },
) {
  const session = await getSessionUser();
  const accessToken = await getLarkUserAccessToken();

  if (!session || session.mode !== "production" || !accessToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { fileToken } = await params;
  const response = await fetch(
    `${appConfig.larkOpenApiBaseUrl}/open-apis/drive/v1/medias/${encodeURIComponent(fileToken)}/download`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return new NextResponse("Failed to load image", { status: response.status });
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const buffer = await response.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
