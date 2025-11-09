import { NextRequest, NextResponse } from "next/server";
import { listCards } from "@/lib/cards";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertStoryOwnership } from "@/server/services/stories";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") || undefined;
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    try {
      await assertStoryOwnership(user.id, sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "STORY_NOT_FOUND") {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }
      throw error;
    }

    const characters = await listCards({ type: "character" }, sessionId);
    const simplified = characters.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || "",
      data: c.data || {},
    }));
    return NextResponse.json({ characters: simplified });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

