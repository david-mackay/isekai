import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertStoryOwnership } from "@/server/services/stories";
import { readStory } from "@/lib/story";
import { readCards } from "@/lib/cards";
import {
  StorySummaryPayloadSchema,
  applyStorySummary,
  reconcileSummaryPayload,
  type StorySummaryPayload,
} from "@/lib/storySummary";
import {
  getOpenRouterApiKey,
  getOpenRouterConfiguration,
} from "@/lib/openrouter";
import { resolveModelId } from "@/lib/modelOptions";

const RequestSchema = z.object({
  sessionId: z.string(),
  model: z.string().optional(),
});

function toJSONString(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = await req.json();
    const { sessionId, model } = RequestSchema.parse(body);

    await assertStoryOwnership(user.id, sessionId);

    const story = await readStory(sessionId);
    const cards = await readCards(sessionId);
    const characters = cards
      .filter((card) => card.type === "character")
      .map((card) => ({
        id: card.id,
        name: card.name,
        description: card.description ?? "",
        data: card.data ?? {},
      }));

    const truncatedStory =
      story.length > 20000 ? story.slice(story.length - 20000) : story;

    const apiKey = getOpenRouterApiKey();
    const configuration = getOpenRouterConfiguration();
    const structuredModel = new ChatOpenAI({
      apiKey,
      model: resolveModelId(model),
      temperature: 0.2,
      configuration,
    }).withStructuredOutput(StorySummaryPayloadSchema, {
      name: "StorySummary",
    });

    const conversation: Array<{ role: "system" | "user"; content: string }> = [
      {
        role: "system",
        content:
          "You are a campaign archivist. Produce a structured summary of recent events. Capture key facts as memories, note character sheet updates, and refresh relationships. Only output JSON matching the requested schema.",
      },
      {
        role: "user",
        content: [
          "Transcript (truncated to recent events):",
          truncatedStory,
          "\nKnown characters:",
          toJSONString(characters),
          "\nInstructions:",
          "- summary: concise narrative recap in a few sentences.",
          "- summaryLabel: optional custom title (e.g., 'Chapter 3 Recap').",
          "- memories: list durable takeaways; include sourceType/owners when helpful.",
          "- characterUpdates: merge-only patches to reflect new info or newly introduced characters (omit unchanged fields).",
          "- relationshipUpdates: describe trust/rivalry changes with optional metrics.",
          "- For any *_Id field, only use IDs from the Known characters list—never invent one. If the ID is unknown, leave it null and rely on the corresponding name/type fields.",
          "- Arrays must contain only well-formed objects that match the schema. Never emit stray strings, comments, or partial fragments.",
          "- Return strictly valid JSON for the schema—no extra text before or after.",
        ].join("\n"),
      },
    ];

    const MAX_ATTEMPTS = 3;
    let response: StorySummaryPayload | undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        response = await structuredModel.invoke(conversation);
        response = reconcileSummaryPayload(response, cards);
        break;
      } catch (error) {
        lastError = error;
        if (attempt === MAX_ATTEMPTS - 1) {
          throw error;
        }
        const detail =
          error instanceof Error ? error.message : JSON.stringify(error);
        const trimmedDetail =
          detail.length > 1200 ? `${detail.slice(0, 1200)}…` : detail;
        console.warn(
          "[summarize] retrying structured output due to parse error",
          trimmedDetail
        );
        conversation.push({
          role: "user",
          content: [
            "Your previous response failed to parse:",
            trimmedDetail,
            "Resubmit ONLY valid JSON that conforms exactly to the schema.",
            "Every entry in memories/characterUpdates/relationshipUpdates must be an object (no loose strings).",
          ].join("\n"),
        });
      }
    }

    if (!response) {
      throw lastError ?? new Error("Failed to obtain structured summary.");
    }

    const result = await applyStorySummary(sessionId, response);

    return NextResponse.json({
      ok: true,
      summary: response.summary,
      summaryCardId: result.summaryCardId,
      recordedMemoryIds: result.recordedMemoryIds,
      updatedCharacterIds: result.updatedCharacterIds,
      updatedRelationshipIds: result.updatedRelationshipIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ /api/story/summarize error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
