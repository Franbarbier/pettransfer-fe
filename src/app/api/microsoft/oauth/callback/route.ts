import { NextRequest, NextResponse } from "next/server";

import {
  exchangeMicrosoftCodeForToken,
  getMicrosoftMailConfigError,
} from "@/lib/microsoftGraphMail";

const STATE_COOKIE = "ms_graph_oauth_state";
const RETURN_TO_COOKIE = "ms_graph_oauth_return_to";

function buildReturnUrl(origin: string, returnTo: string, status: string, message?: string): string {
  const url = new URL(returnTo, origin);
  url.searchParams.set("outlook", status);
  if (message) url.searchParams.set("outlook_message", message);
  return url.toString();
}

export async function GET(req: NextRequest) {
  const configError = getMicrosoftMailConfigError();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 503 });
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  const returnTo = req.cookies.get(RETURN_TO_COOKIE)?.value || "/demo-coti";

  const clearCookies = (response: NextResponse) => {
    response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(RETURN_TO_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  };

  if (error) {
    return clearCookies(
      NextResponse.redirect(
        buildReturnUrl(
          req.nextUrl.origin,
          returnTo,
          "error",
          errorDescription || error,
        ),
      ),
    );
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return clearCookies(
      NextResponse.redirect(
        buildReturnUrl(
          req.nextUrl.origin,
          returnTo,
          "error",
          "No se pudo validar la autorización de Microsoft.",
        ),
      ),
    );
  }

  try {
    await exchangeMicrosoftCodeForToken(req.nextUrl.origin, code);
    return clearCookies(
      NextResponse.redirect(
        buildReturnUrl(req.nextUrl.origin, returnTo, "connected"),
      ),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return clearCookies(
      NextResponse.redirect(
        buildReturnUrl(req.nextUrl.origin, returnTo, "error", message),
      ),
    );
  }
}
