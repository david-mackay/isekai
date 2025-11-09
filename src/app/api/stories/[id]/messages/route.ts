import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/server/auth/session";
import {
  assertStoryOwnership,
  getStoryMessages,
} from "@/server/services/stories";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthenticatedUser();
    await assertStoryOwnership(user.id, params.id);
    const messages = await getStoryMessages(params.id);
    return NextResponse.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "STORY_NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error(
      `/api/stories/${params.id}/messages GET error`,
      error
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
