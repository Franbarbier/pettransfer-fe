import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  APP_SESSION_COOKIE,
  buildRollingSession,
  createAppSessionToken,
  type AppSession,
  getAppSessionCookieMaxAge,
  verifyAppSessionToken,
} from "./appAuth";

export async function getCurrentAppSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(APP_SESSION_COOKIE)?.value;
  return verifyAppSessionToken(token);
}

export async function requireAppSession(returnTo: string): Promise<AppSession> {
  const session = await getCurrentAppSession();
  if (!session) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

export async function refreshAppSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const current = verifyAppSessionToken(cookieStore.get(APP_SESSION_COOKIE)?.value);
  if (!current) return;
  const nextSession = buildRollingSession(current);
  cookieStore.set(APP_SESSION_COOKIE, createAppSessionToken(nextSession), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getAppSessionCookieMaxAge(),
  });
}
