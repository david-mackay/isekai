import { NextRequest, NextResponse } from "next/server";
import { runTurn, type UserAction } from "@/lib/agent";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertStoryOwnership } from "@/server/services/stories";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as {
      kind: UserAction["kind"];
      text?: string;
      sessionId?: string;
      targetCharacter?: string;
      model?: string;
    };
    console.log("🎮 API: Received DM request:", body);

    if (!body || !body.kind) {
      console.error("❌ API: Missing kind in request");
      return NextResponse.json({ error: "Missing kind" }, { status: 400 });
    }

    if (!body.sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    try {
      await assertStoryOwnership(user.id, body.sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "STORY_NOT_FOUND") {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }
      throw error;
    }

    const kind = body.kind;
    if ((kind === "do" || kind === "say") && !body.text) {
      console.error("❌ API: Missing text for action:", kind);
      return NextResponse.json(
        { error: "Missing text for action" },
        { status: 400 }
      );
    }
    const action: UserAction =
      kind === "continue"
        ? { kind: "continue" }
        : kind === "say"
        ? { kind: "say", text: body.text! }
        : { kind: "do", text: body.text! };

    console.log("🎲 API: Running turn with action:", action);
    const result = await runTurn(
      action,
      body.sessionId,
      body.targetCharacter,
      body.model
    );
    console.log("✅ API: Turn completed successfully");

    return NextResponse.json({ content: result });
  } catch (e: unknown) {
    console.error("❌ API: Error running turn:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
