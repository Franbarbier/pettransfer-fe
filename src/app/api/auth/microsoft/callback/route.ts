import { NextRequest, NextResponse } from "next/server";

import {
  APP_AUTH_RETURN_TO_COOKIE,
  APP_AUTH_STATE_COOKIE,
  APP_SESSION_COOKIE,
  buildRollingSession,
  createAppSessionToken,
  exchangeMicrosoftCodeForAppLogin,
  getAppAuthConfigError,
  getAppSessionCookieMaxAge,
} from "@/lib/appAuth";

function buildLoginRedirect(origin: string, message: string, returnTo?: string): string {
  const url = new URL("/login", origin);
  if (returnTo && returnTo.startsWith("/")) {
    url.searchParams.set("returnTo", returnTo);
  }
  url.searchParams.set("error", message);
  return url.toString();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const configError = getAppAuthConfigError();
  if (configError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(configError)}`, req.nextUrl.origin),
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const providerError = req.nextUrl.searchParams.get("error");
  const providerErrorDescription =
    req.nextUrl.searchParams.get("error_description");
  const cookieState = req.cookies.get(APP_AUTH_STATE_COOKIE)?.value;
  const returnTo = req.cookies.get(APP_AUTH_RETURN_TO_COOKIE)?.value || "/demo-coti";

  const clearCookies = (response: NextResponse): NextResponse => {
    response.cookies.set(APP_AUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    response.cookies.set(APP_AUTH_RETURN_TO_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  };

  if (providerError) {
    return clearCookies(
      NextResponse.redirect(
        buildLoginRedirect(
          req.nextUrl.origin,
          providerErrorDescription || providerError,
          returnTo,
        ),
      ),
    );
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return clearCookies(
      NextResponse.redirect(
        buildLoginRedirect(
          req.nextUrl.origin,
          "No se pudo validar el inicio de sesión con Microsoft.",
          returnTo,
        ),
      ),
    );
  }

  try {
    const session = buildRollingSession(
      await exchangeMicrosoftCodeForAppLogin(req.nextUrl.origin, code),
    );
    const response = NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));
    response.cookies.set(APP_SESSION_COOKIE, createAppSessionToken(session), {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
      maxAge: getAppSessionCookieMaxAge(),
    });
    return clearCookies(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return clearCookies(
      NextResponse.redirect(
        buildLoginRedirect(req.nextUrl.origin, message, returnTo),
      ),
    );
  }
}
