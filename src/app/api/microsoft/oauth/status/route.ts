import { NextResponse } from "next/server";

import { getMicrosoftMailConnectionStatus } from "@/lib/microsoftGraphMail";

export async function GET() {
  const status = await getMicrosoftMailConnectionStatus();
  return NextResponse.json(status, { status: status.configured ? 200 : 503 });
}
