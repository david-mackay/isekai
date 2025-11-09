import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/server/auth/session";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({ authenticated: true, user });
}
