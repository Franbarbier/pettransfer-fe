import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  createMicrosoftOAuthUrl,
  getMicrosoftMailConfigError,
} from "@/lib/microsoftGraphMail";

const STATE_COOKIE = "ms_graph_oauth_state";
const RETURN_TO_COOKIE = "ms_graph_oauth_return_to";

export async function GET(req: NextRequest) {
  const configError = getMicrosoftMailConfigError();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 503 });
  }

  const state = crypto.randomBytes(24).toString("hex");
  const returnToRaw = req.nextUrl.searchParams.get("returnTo");
  const returnTo =
    returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : "/demo-coti";

  const redirectUrl = createMicrosoftOAuthUrl(req.nextUrl.origin, state);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 15,
  });

  response.cookies.set(RETURN_TO_COOKIE, returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 15,
  });

  return response;
}
