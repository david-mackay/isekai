import { NextRequest, NextResponse } from "next/server";
import { readCards, type BaseCard } from "@/lib/cards";
import { readStory } from "@/lib/story";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertStoryOwnership } from "@/server/services/stories";
import { ChatOpenAI } from "@langchain/openai";
import {
  getOpenRouterApiKey,
  getOpenRouterConfiguration,
} from "@/lib/openrouter";
import { resolveModelId } from "@/lib/modelOptions";

type FeedPost = {
  id: string;
  author: { name: string };
  content: string;
  hoursAgo: number;
  likes?: number;
  comments?: number;
  postType?: "status" | "photo" | "story";
};

function getModel(modelId?: string) {
  const apiKey = getOpenRouterApiKey();
  return new ChatOpenAI({
    apiKey,
    model: resolveModelId(modelId),
    temperature: 0.8,
    configuration: getOpenRouterConfiguration(),
  });
}

function summarizeCharacter(c: BaseCard): Record<string, unknown> {
  return {
    name: c.name,
    description: c.description || "",
    data: c.data || {},
  };
}

function coerceArrayJson(text: string): unknown {
  const first = text.indexOf("[");
  const last = text.lastIndexOf("]");
  const slice = first >= 0 && last >= 0 ? text.slice(first, last + 1) : text;
  return JSON.parse(slice);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as {
      sessionId?: string;
      count?: number;
      model?: string;
    };
    const sessionId = body.sessionId;
    const count = Math.min(Math.max(body.count ?? 6, 1), 12);
    const modelId = body.model;
    console.log("📣 /api/feed request", { sessionId, count });

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId", posts: [] },
        { status: 400 }
      );
    }

    try {
      await assertStoryOwnership(user.id, sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "STORY_NOT_FOUND") {
        return NextResponse.json(
          { error: "Story not found", posts: [] },
          { status: 404 }
        );
      }
      throw error;
    }

    const cards = await readCards(sessionId);
    const storySoFar = await readStory(sessionId);
    const characters = cards.filter((c) => c.type === "character");
    const world = cards.find((c) => c.type === "world");
    const beginning = cards.find((c) => c.type === "beginning");
    console.log("📦 cards summary", {
      totalCards: cards.length,
      characters: characters.length,
      hasWorld: Boolean(world),
      hasBeginning: Boolean(beginning),
      storyChars: storySoFar?.length ?? 0,
    });

    const characterSummaries = characters.slice(0, 25).map(summarizeCharacter);
    const worldLine = world
      ? `World: ${world.name} — ${world.description ?? ""}`
      : "";
    const beginningKey =
      (beginning?.data as { key?: string } | undefined)?.key || "";

    const model = getModel(modelId);
    const system = `You are a social media ghostwriter producing a compact feed that looks like Instagram/Facebook.
Rules:
- Write short, punchy posts (1-3 sentences) with occasional emoji; no hashtags.
- Each post has an author that is one of the characters provided.
- Keep everything in-universe, consistent with bios and recent story context.
- Vary formats: status, photo caption, or story-like snippet. Avoid meta commentary.
- Output ONLY JSON: an array of objects with keys {author, content, hoursAgo, likes, comments, postType}.
- hoursAgo: integer from 1..36 (randomish), likes/comments: realistic small integers.
`;
    const payload = JSON.stringify({
      count,
      world: worldLine,
      beginningKey,
      characters: characterSummaries,
      recentStory: storySoFar.slice(-2000),
      schema: {
        author: "string (character name)",
        content: "string (the post body)",
        hoursAgo: "integer 1..36",
        likes: "integer 0..999",
        comments: "integer 0..200",
        postType: "'status'|'photo'|'story'",
      },
    });

    const ai = await model.invoke([
      { role: "system", content: system },
      {
        role: "user",
        content: `Generate ${count} posts. JSON only.\n${payload}`,
      },
    ]);
    const text =
      typeof ai.content === "string"
        ? ai.content
        : Array.isArray(ai.content)
        ? ai.content
            .map((c) =>
              typeof c === "string" ? c : (c as { text?: string }).text || ""
            )
            .join("")
        : "";
    console.log(
      "🧾 model response len",
      text.length,
      "preview:",
      text.slice(0, 400)
    );
    const parsed = coerceArrayJson(text) as unknown;
    if (!Array.isArray(parsed))
      throw new Error("Model did not return an array");
    console.log("✅ parsed array length", (parsed as unknown[]).length);

    const posts: FeedPost[] = parsed
      .map((p, idx) => {
        const obj = p as Record<string, unknown>;
        const authorName = String(
          obj.author ||
            characters[idx % Math.max(characters.length, 1)]?.name ||
            "Unknown"
        );
        const content = String(obj.content || "").trim();
        const hoursAgo = Math.max(
          1,
          Math.min(
            36,
            Number(obj.hoursAgo) || Math.floor(Math.random() * 24) + 1
          )
        );
        const likes = Math.max(
          0,
          Number(obj.likes) || Math.floor(Math.random() * 200)
        );
        const comments = Math.max(
          0,
          Number(obj.comments) || Math.floor(Math.random() * 60)
        );
        const postType =
          obj.postType === "photo" || obj.postType === "story"
            ? (obj.postType as FeedPost["postType"])
            : "status";
        return {
          id: crypto.randomUUID(),
          author: { name: authorName },
          content,
          hoursAgo,
          likes,
          comments,
          postType,
        } as FeedPost;
      })
      .filter((p) => p.content && p.author.name);
    console.log("📊 final posts length", posts.length);
    return NextResponse.json({ posts });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("❌ /api/feed error", message);
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthorized", posts: [] },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: message, posts: [] }, { status: 200 });
  }
}
