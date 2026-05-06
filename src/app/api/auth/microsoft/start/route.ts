import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  APP_AUTH_RETURN_TO_COOKIE,
  APP_AUTH_STATE_COOKIE,
  buildMicrosoftLoginUrl,
  getAppAuthConfigError,
} from "@/lib/appAuth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const configError = getAppAuthConfigError();
  if (configError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(configError)}`, req.nextUrl.origin),
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const returnToRaw = req.nextUrl.searchParams.get("returnTo");
  const returnTo =
    returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : "/demo-coti";

  const response = NextResponse.redirect(
    buildMicrosoftLoginUrl(req.nextUrl.origin, state),
  );
  response.cookies.set(APP_AUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 15,
  });
  response.cookies.set(APP_AUTH_RETURN_TO_COOKIE, returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 15,
  });
  return response;
}
