import { NextRequest, NextResponse } from "next/server";

import {
  getMicrosoftGraphAccessToken,
  getMicrosoftMailConnectionStatus,
} from "@/lib/microsoftGraphMail";

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

  const connection = await getMicrosoftMailConnectionStatus();
  if (!connection.configured) {
    return NextResponse.json(
      {
        error:
          connection.error ||
          "Microsoft Graph no está configurado en el servidor.",
      },
      { status: 503 },
    );
  }

  if (!connection.connected) {
    return NextResponse.json(
      {
        error:
          "La cuenta Outlook todavía no fue autorizada. Conectala antes de enviar el mail.",
      },
      { status: 409 },
    );
  }

  const subject = customSubject?.trim() || (customerName
    ? `Cotización LATAM Pet Transport — ${customerName}`
    : "Cotización LATAM Pet Transport");

  const pdfBuffer = Buffer.from(pdfBase64, "base64");

  try {
    const accessToken = await getMicrosoftGraphAccessToken();
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-quote] Error enviando email con Microsoft Graph:", msg);
    return NextResponse.json(
      { error: `Microsoft Graph error: ${msg}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    from: connection.email,
  });
}
