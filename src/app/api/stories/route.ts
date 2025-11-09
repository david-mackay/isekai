import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/server/auth/session";
import {
  createStory,
  listStories,
  type CreateStoryInput,
} from "@/server/services/stories";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const stories = await listStories(user.id);
    return NextResponse.json({ stories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("/api/stories GET error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as Partial<Omit<CreateStoryInput, "userId">> & {
      title?: string;
    };

    if (!body.title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const story = await createStory({
      userId: user.id,
      title: body.title,
      beginningKey: body.beginningKey ?? null,
      worldKey: body.worldKey ?? null,
      characterName: body.characterName ?? null,
      characterGender: body.characterGender ?? null,
      characterRace: body.characterRace ?? null,
    });

    return NextResponse.json({ story }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("/api/stories POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
