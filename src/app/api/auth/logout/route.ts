import { NextRequest, NextResponse } from "next/server";

import { APP_SESSION_COOKIE } from "@/lib/appAuth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(APP_SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}
