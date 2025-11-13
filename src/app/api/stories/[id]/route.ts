import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertStoryOwnership, deleteStory } from "@/server/services/stories";

function toSummary(story: Awaited<ReturnType<typeof assertStoryOwnership>>) {
  return {
    id: story.id,
    title: story.title,
    beginningKey: story.beginningKey,
    worldKey: story.worldKey,
    characterName: story.characterName,
    characterGender: story.characterGender,
    characterRace: story.characterRace,
    messageCount: story.messageCount,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
    lastPlayedAt: story.lastPlayedAt.toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    const story = await assertStoryOwnership(user.id, id);
    return NextResponse.json({ story: toSummary(story) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "STORY_NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("/api/stories/[id] GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    await assertStoryOwnership(user.id, id);
    await deleteStory(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "STORY_NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("/api/stories/[id] DELETE error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
