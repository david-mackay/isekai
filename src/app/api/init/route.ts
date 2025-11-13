import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { upsertCard, type BaseCard } from "@/lib/cards";
import { DEFAULT_WORLD_CARD, WORLDS } from "@/lib/world";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertStoryOwnership } from "@/server/services/stories";
import { recordMemory } from "@/server/services/memories";
import {
  getOpenRouterApiKey,
  getOpenRouterConfiguration,
} from "@/lib/openrouter";
import { resolveModelId } from "@/lib/modelOptions";

const beginnings = {
  combat: {
    title: "Crucible of Steel",
    description:
      "Steel flashes, stakes are high—your first step lands in a fight.",
    seed: {
      story: [
        {
          type: "story",
          name: "Conflict Zone",
          description: "Tensions primed for violence.",
          data: { hooks: ["ambush at dawn", "beast on the loose"] },
        },
        {
          type: "environment",
          name: "Battleground",
          description: "Constrained terrain with hazards.",
          data: { features: ["cover", "elevation", "flammables"] },
        },
      ],
    },
  },
  romance: {
    title: "Academy of Hearts",
    description:
      "Whispers, duels, and stolen glances at a prestigious academy.",
    seed: {
      story: [
        {
          type: "story",
          name: "Moonspire Academy",
          description: "Scholars, duels, and dances.",
          data: { hooks: ["forbidden club", "faculty intrigue"] },
        },
        {
          type: "environment",
          name: "Grand Quadrangle",
          description: "Dorms and lecture halls converge.",
          data: { events: ["masquerade", "exams week"] },
        },
      ],
    },
  },
  politics: {
    title: "Crown and Shadow",
    description:
      "Courts and war rooms where a single choice can tip a kingdom.",
    seed: {
      story: [
        {
          type: "story",
          name: "Border Marches",
          description: "Two blocs contest a vital route.",
          data: {
            factions: ["Guild Compact", "Wardens' League"],
            hooks: ["grain shortage", "sabotaged envoy"],
          },
        },
        {
          type: "environment",
          name: "Council Hall",
          description: "Marble, banners, and tense guard lines.",
          data: { protocols: ["immunity", "oath-binding"] },
        },
      ],
    },
  },
  exploration: {
    title: "Chart the Unknown",
    description: "Salt wind, secret maps, and the pull of uncharted horizons.",
    seed: {
      story: [
        {
          type: "story",
          name: "Sable Gull (Cutter)",
          description:
            "Pirate/privateer cutter bound for the Shattered Shoals.",
          data: { hooks: ["mutiny brewing", "map fragment"] },
        },
        {
          type: "environment",
          name: "Stormdeck",
          description: "Slick planks, roaring sail, and watchful eyes.",
          data: { hazards: ["rigging", "squalls"] },
        },
      ],
    },
  },
} as const;

type BeginningKey = keyof typeof beginnings;

function extractMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return ((part as { text: string }).text ?? "").toString();
        }
        return "";
      })
      .join("")
      .trim();
  }
  if (
    content &&
    typeof content === "object" &&
    "text" in content &&
    typeof (content as { text?: unknown }).text === "string"
  ) {
    return ((content as { text: string }).text ?? "").trim();
  }
  return "";
}

async function generateBackstorySummary(
  playerName: string,
  backstory: string
): Promise<string> {
  const trimmed = backstory.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const llm = new ChatOpenAI({
      apiKey: getOpenRouterApiKey(),
      model: resolveModelId("openai/gpt-4o-mini"),
      temperature: 0.6,
      configuration: getOpenRouterConfiguration(),
    });
    const ai = await llm.invoke([
      {
        role: "system",
        content:
          "You are a narrative designer for a fantasy RPG. Rewrite the given player-provided backstory as a single evocative sentence in third person that captures their motivation, tone, or defining hook. Avoid second-person language and meta commentary.",
      },
      {
        role: "user",
        content: `Player character: ${playerName}\nBackstory:\n${trimmed}\n\nRespond with one polished sentence.`,
      },
    ]);
    const summary = extractMessageContent(ai.content);
    return summary || `${playerName}'s origins: ${trimmed}`;
  } catch (error) {
    console.warn("⚠️ Failed to generate backstory summary:", error);
    return `${playerName}'s origins: ${trimmed}`;
  }
}

async function createInitialBackstoryMemory(options: {
  storyId: string;
  playerCardId: string;
  playerName: string;
  backstory: string;
}) {
  const trimmed = options.backstory.trim();
  if (!trimmed) return;
  const summary = await generateBackstorySummary(options.playerName, trimmed);
  await recordMemory({
    storyId: options.storyId,
    summary,
    sourceType: "player",
    ownerCardId: options.playerCardId,
    subjectCardId: options.playerCardId,
    tags: ["backstory", "origin"],
    importance: 4,
    context: {
      initialBackstory: trimmed,
    },
  });
  await upsertCard(
    {
      type: "character",
      name: "Player Character",
      data: {
        initialBackstorySummary: summary,
      },
    },
    options.storyId
  );
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const { key, sessionId, playerCharacter, worldKey } =
      (await req.json()) as {
        key: BeginningKey;
        sessionId?: string;
        playerCharacter?: {
          name: string;
          gender: string;
          race: string;
          backstory?: string;
        };
        worldKey?: string;
      };
    console.log("🎯 API: Initializing beginning:", {
      key,
      sessionId,
      playerCharacter,
    });

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
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

    if (!key || !(key in beginnings)) {
      console.error("❌ API: Invalid beginning key:", key);
      return NextResponse.json(
        { error: "Invalid beginning key" },
        { status: 400 }
      );
    }

    const def = beginnings[key];
    console.log("📦 API: Seeding cards for beginning:", def.title);

    // Ensure a 'world' card with immutable traits exists (idempotent upsert)
    const world = (worldKey && WORLDS[worldKey]) || DEFAULT_WORLD_CARD;
    await upsertCard(
      world as Omit<BaseCard, "id" | "updatedAt" | "storyId">,
      sessionId
    );

    // Create player character card if character data is provided
    if (playerCharacter) {
      console.log(
        "👤 API: Creating player character card:",
        playerCharacter.name
      );
      const initialBackstory = playerCharacter.backstory
        ? playerCharacter.backstory.trim()
        : "";
      const playerCard = await upsertCard(
        {
          type: "character",
          name: "Player Character",
          description: `${playerCharacter.name}, a ${playerCharacter.gender} ${playerCharacter.race}`,
          data: {
            name: playerCharacter.name,
            gender: playerCharacter.gender,
            race: playerCharacter.race,
            ...(initialBackstory ? { initialBackstory } : {}),
            backstory: {},
            revealedTraits: [],
            isPlayerCharacter: true,
          },
        },
        sessionId
      );
      if (
        initialBackstory &&
        !(playerCard.data as Record<string, unknown>)?.initialBackstorySummary
      ) {
        await createInitialBackstoryMemory({
          storyId: sessionId,
          playerCardId: playerCard.id,
          playerName: playerCharacter.name,
          backstory: initialBackstory,
        });
      }
    }

    // Persist the selected beginning as its own entity for the session
    await upsertCard(
      {
        type: "beginning",
        name: def.title,
        description: def.description,
        data: {
          key,
          title: def.title,
          description: def.description,
          seed: def.seed,
        },
      },
      sessionId
    );

    for (const card of def.seed.story) {
      console.log("💾 API: Upserting card:", card.name);
      await upsertCard(
        {
          type: card.type as
            | "story"
            | "character"
            | "environment"
            | "item"
            | "faction"
            | "quest",
          name: card.name,
          description: card.description,
          data: card.data,
        },
        sessionId
      );
    }

    console.log("✅ API: Beginning successfully initialized:", def.title);
    return NextResponse.json({
      ok: true,
      title: def.title,
      description: def.description,
    });
  } catch (e: unknown) {
    console.error("❌ API: Error initializing beginning:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const list = Object.entries(beginnings).map(([k, v]) => ({
    key: k,
    title: v.title,
    description: v.description,
  }));
  const worlds = Object.keys(WORLDS).map((k) => ({ key: k, title: k }));
  return NextResponse.json({ beginnings: list, worlds });
}
