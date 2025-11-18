import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertStoryOwnership, addStoryMessage } from "@/server/services/stories";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as {
      sessionId: string;
      imageUrl: string;
      content?: string;
    };

    if (!body.sessionId || !body.imageUrl) {
      return NextResponse.json(
        { error: "Missing sessionId or imageUrl" },
        { status: 400 }
      );
    }

    try {
      await assertStoryOwnership(user.id, body.sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "STORY_NOT_FOUND") {
        return NextResponse.json(
          { error: "Story not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    console.log("📝 Dev Append Image: Storing message", {
      sessionId: body.sessionId,
      imageUrlLength: body.imageUrl.length,
      imageUrlPreview: body.imageUrl.substring(0, 100),
      imageUrlEnd: body.imageUrl.substring(body.imageUrl.length - 50),
    });

    const message = await addStoryMessage(
      body.sessionId,
      "dm",
      body.content || "[DEV] Generated scene image",
      body.imageUrl
    );

    console.log("📝 Dev Append Image: Message stored", {
      messageId: message.id,
      storedImageUrlLength: message.imageUrl?.length ?? 0,
      storedImageUrlPreview: message.imageUrl?.substring(0, 100),
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("❌ API: Error appending image message:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

