import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/server/auth/session";
import {
  assertStoryOwnership,
  getStoryMessages,
} from "@/server/services/stories";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const parsedLimit = limitParam
      ? Number.parseInt(limitParam, 10)
      : undefined;
    const limit =
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : undefined;
    const user = await requireAuthenticatedUser();
    await assertStoryOwnership(user.id, id);
    const messages = await getStoryMessages(id, { limit });
    return NextResponse.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "STORY_NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error(`/api/stories/${id}/messages GET error`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
