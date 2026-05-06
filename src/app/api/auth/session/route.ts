import { NextRequest, NextResponse } from "next/server";

import {
  APP_SESSION_COOKIE,
  buildRollingSession,
  createAppSessionToken,
  getAppSessionCookieMaxAge,
  toPublicAppSession,
  verifyAppSessionToken,
} from "@/lib/appAuth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = verifyAppSessionToken(req.cookies.get(APP_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const refreshed = buildRollingSession(session);
  const response = NextResponse.json({
    authenticated: true,
    session: toPublicAppSession(refreshed),
  });
  response.cookies.set(APP_SESSION_COOKIE, createAppSessionToken(refreshed), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: getAppSessionCookieMaxAge(),
  });
  return response;
}
