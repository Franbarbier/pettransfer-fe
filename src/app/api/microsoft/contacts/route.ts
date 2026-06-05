import { NextRequest, NextResponse } from "next/server";

import {
  APP_SESSION_COOKIE,
  createAppSessionToken,
  getAppSessionCookieMaxAge,
  refreshMicrosoftAccessTokenForSession,
  verifyAppSessionToken,
} from "@/lib/appAuth";

export const runtime = "nodejs";

export type ContactSuggestion = {
  displayName: string;
  email: string;
};

type GraphPersonResponse = {
  value?: Array<{
    displayName?: string | null;
    scoredEmailAddresses?: Array<{ address?: string | null }>;
  }>;
  error?: { message?: string; code?: string };
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 2) {
    return NextResponse.json({ contacts: [] });
  }

  const session = verifyAppSessionToken(req.cookies.get(APP_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "La sesión de la app expiró." }, { status: 401 });
  }
  if (!session.microsoftRefreshToken) {
    return NextResponse.json({ error: "Sin permisos de Outlook en esta sesión." }, { status: 409 });
  }

  try {
    const { accessToken, session: refreshedSession } =
      await refreshMicrosoftAccessTokenForSession(session);

    const url = new URL("https://graph.microsoft.com/v1.0/me/people");
    url.searchParams.set("$search", q);
    url.searchParams.set("$select", "displayName,scoredEmailAddresses");
    url.searchParams.set("$top", "8");
    url.searchParams.set("$filter", "personType/class eq 'Person'");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ConsistencyLevel: "eventual",
      },
    });

    const data = (await res.json()) as GraphPersonResponse;

    if (!res.ok) {
      const detail = data.error?.message ?? `Graph respondió ${res.status}`;
      throw new Error(detail);
    }

    const contacts: ContactSuggestion[] = (data.value ?? [])
      .flatMap((p) => {
        const email = p.scoredEmailAddresses?.[0]?.address?.trim();
        if (!email || !email.includes("@")) return [];
        return [{ displayName: p.displayName?.trim() || email, email }];
      });

    const response = NextResponse.json({ contacts });
    response.cookies.set(APP_SESSION_COOKIE, createAppSessionToken(refreshedSession), {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
      maxAge: getAppSessionCookieMaxAge(),
    });
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[microsoft/contacts] Error buscando contactos:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
