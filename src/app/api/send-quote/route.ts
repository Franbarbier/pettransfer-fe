import { NextRequest, NextResponse } from "next/server";

import {
  APP_SESSION_COOKIE,
  createAppSessionToken,
  getAppSessionCookieMaxAge,
  refreshMicrosoftAccessTokenForSession,
  verifyAppSessionToken,
} from "@/lib/appAuth";

export const runtime = "nodejs";

type SendQuoteBody = {
  to: string;
  pdfBase64: string;
  customerName?: string;
  subject?: string;
  body?: string;
};

export async function POST(req: NextRequest) {
  let body: SendQuoteBody;
  try {
    body = (await req.json()) as SendQuoteBody;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { to, pdfBase64, customerName, subject: customSubject, body: customBody } = body;

  if (!to || !pdfBase64) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: to, pdfBase64" },
      { status: 400 }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return NextResponse.json({ error: "Email destinatario inválido" }, { status: 400 });
  }

  const session = verifyAppSessionToken(req.cookies.get(APP_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json(
      {
        error: "La sesión de la app expiró. Volvé a iniciar sesión.",
      },
      { status: 401 },
    );
  }

  if (!session.microsoftRefreshToken) {
    return NextResponse.json(
      {
        error:
          "Tu sesión no tiene permisos para enviar mails. Cerrá sesión y volvé a entrar con Microsoft.",
      },
      { status: 409 },
    );
  }

  const subject = customSubject?.trim() || (customerName
    ? `Cotización LATAM Pet Transport — ${customerName}`
    : "Cotización LATAM Pet Transport");

  const pdfBuffer = Buffer.from(pdfBase64, "base64");

  try {
    const { accessToken, session: refreshedSession } =
      await refreshMicrosoftAccessTokenForSession(session);
    const graphRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: "Text",
            content: customBody?.trim() || (customerName
              ? `Adjunto encontrará la cotización para ${customerName}.\n\nLATAM Pet Transport`
              : "Adjunto encontrará la cotización solicitada.\n\nLATAM Pet Transport"),
          },
          toRecipients: [{ emailAddress: { address: to } }],
          attachments: [
            {
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: customerName
                ? `cotizacion-${customerName.replace(/\s+/g, "-")}.pdf`
                : "cotizacion-latam-pet.pdf",
              contentType: "application/pdf",
              contentBytes: pdfBuffer.toString("base64"),
            },
          ],
        },
        saveToSentItems: true,
      }),
    });

    if (!graphRes.ok) {
      const data = (await graphRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(data.error?.message || `Microsoft Graph respondió ${graphRes.status}.`);
    }

    const response = NextResponse.json({
      ok: true,
      from: refreshedSession.email,
    });
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
    console.error("[send-quote] Error enviando email con Microsoft Graph:", msg);
    return NextResponse.json(
      { error: `Microsoft Graph error: ${msg}` },
      { status: 500 },
    );
  }
}
