import { NextRequest, NextResponse } from "next/server";

import { APP_SESSION_COOKIE, verifyAppSessionToken } from "@/lib/appAuth";

export async function GET(req: NextRequest) {
  const session = verifyAppSessionToken(req.cookies.get(APP_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        error: "No hay sesión activa en la app.",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    configured: true,
    connected: Boolean(session.microsoftRefreshToken),
    email: session.email,
    displayName: session.name,
  });
}
