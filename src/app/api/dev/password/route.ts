import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { password } = (await req.json()) as { password?: string };
    const expectedPassword = process.env.DEV_PASSWORD;

    if (!expectedPassword) {
      return NextResponse.json(
        { error: "Dev password not configured" },
        { status: 500 }
      );
    }

    if (password === expectedPassword) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

