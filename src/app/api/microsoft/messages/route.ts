import { NextRequest, NextResponse } from "next/server";

import {
  APP_SESSION_COOKIE,
  createAppSessionToken,
  getAppSessionCookieMaxAge,
  refreshMicrosoftAccessTokenForSession,
  verifyAppSessionToken,
} from "@/lib/appAuth";

export const runtime = "nodejs";

export type GraphMailMessage = {
  id: string;
  subject: string;
  conversationId: string;
  receivedDateTime: string;
  isDraft: boolean;
  from: { emailAddress: { name: string; address: string } };
};

type GraphMessagesResponse = {
  value?: GraphMailMessage[];
  error?: { message?: string; code?: string };
};

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim() ?? "";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.includes('"')) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
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

    // $search busca en toda la casilla (inbox + sent + etc.) sin restricciones de carpeta.
    // No se puede combinar con $orderby — se ordena en memoria después.
    const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
    url.searchParams.set("$search", `"${email}"`);
    url.searchParams.set("$select", "id,subject,conversationId,receivedDateTime,isDraft,from");
    url.searchParams.set("$top", "25");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = (await res.json()) as GraphMessagesResponse;

    if (!res.ok) {
      const detail = data.error?.message ?? `Graph respondió ${res.status}`;
      throw new Error(detail);
    }

    const messages = (data.value ?? [])
      .filter((m) => !m.isDraft)
      .sort((a, b) => b.receivedDateTime.localeCompare(a.receivedDateTime))
      .slice(0, 10);

    const response = NextResponse.json({ messages });
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
    console.error("[microsoft/messages] Error buscando mails:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
