import { NextResponse } from "next/server";

import { clearStoredMicrosoftMailAuth } from "@/lib/microsoftGraphMail";

export async function POST() {
  await clearStoredMicrosoftMailAuth();
  return NextResponse.json({ ok: true });
}
