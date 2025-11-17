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
      "Steel flashes and divine intent hangs in the air. You arrive mid-conflict, already bound to a fate someone else set in motion, with instincts that feel half-remembered from another life.",
    seed: {
      story: [
        {
          type: "story",
          name: "Conflict Zone",
          description:
            "A borderland where skirmishes blur into holy war and grudges span generations. Something here has been waiting specifically for you.",
          data: {
            hooks: [
              "ambush at dawn",
              "beast on the loose",
              "mysterious patron watching",
            ],
            omens: [
              "cold iron humming near you",
              "unfamiliar sigil burning behind your eyes",
            ],
            systemTags: ["combat_tutorial", "blessing_lock"],
          },
        },
        {
          type: "environment",
          name: "Battleground",
          description:
            "Constrained terrain littered with fallen standards, shattered wards, and half-buried relics that react faintly to your presence.",
          data: {
            features: ["cover", "elevation", "flammables"],
            hazards: ["unstable ward-glyphs", "stray projectiles"],
            lore: ["old dueling grounds repurposed for a secret war"],
          },
        },
      ],
    },
  },
  romance: {
    title: "Academy of Hearts",
    description:
      "Whispers coil through marble halls where duels and declarations share the same stage. You surface into a life already enrolled, with relationships, rumors, and expectations you never agreed to.",
    seed: {
      story: [
        {
          type: "story",
          name: "Moonspire Academy",
          description:
            "An elite academy where magic, swordplay, and politics are graded together—and some faculty seem to recognize you from a destiny you don't remember choosing.",
          data: {
            hooks: [
              "forbidden club",
              "faculty intrigue",
              "mismatched dorm assignment",
            ],
            socialWeb: [
              "childhood friend who remembers you",
              "rival who insists you wronged them",
            ],
            systemTags: ["social_tutorial", "favor_reputation"],
          },
        },
        {
          type: "environment",
          name: "Grand Quadrangle",
          description:
            "Dorms, lecture halls, and dueling circles converge beneath floating lanterns and watchful gargoyles that track every promise you make.",
          data: {
            events: ["masquerade", "exams week", "dueling festival"],
            secrets: ["sealed garden only opens for summoned souls"],
          },
        },
      ],
    },
  },
  politics: {
    title: "Crown and Shadow",
    description:
      "Courts, war rooms, and back alleys where a single choice can tilt kingdoms. You step into a role someone else abandoned—a mask, a title, or a body with oaths already attached.",
    seed: {
      story: [
        {
          type: "story",
          name: "Border Marches",
          description:
            "Two rival blocs contest a vital trade route that also hides the scars of older, stranger wars. Your arrival quietly completes a pattern in their prophecies.",
          data: {
            factions: ["Guild Compact", "Wardens' League"],
            hooks: [
              "grain shortage",
              "sabotaged envoy",
              "missing royal 'you' replaced",
            ],
            systemTags: ["reputation_matrix", "hidden_alignment"],
          },
        },
        {
          type: "environment",
          name: "Council Hall",
          description:
            "Marble, banners, and tense guard lines etched with oaths that flare at lies. Somewhere in the architecture, a sigil reacts only to your presence.",
          data: {
            protocols: ["immunity", "oath-binding"],
            factionsPresent: ["royal envoys", "shadow emissaries"],
            lore: ["council chamber built atop an older summoning circle"],
          },
        },
      ],
    },
  },
  exploration: {
    title: "Chart the Unknown",
    description:
      "Salt wind, secret maps, and the pull of uncharted horizons. You awaken mid-voyage with the uncanny sense that the sea already knows you—and is keeping score.",
    seed: {
      story: [
        {
          type: "story",
          name: "Sable Gull (Cutter)",
          description:
            "A fast, battle-scarred cutter bound for the Shattered Shoals, crewed by people who swear they've seen you in dreams or omens before.",
          data: {
            hooks: [
              "mutiny brewing",
              "map fragment",
              "crew superstition about you",
            ],
            systemTags: ["exploration_track", "hidden_class_unlock"],
          },
        },
        {
          type: "environment",
          name: "Stormdeck",
          description:
            "Slick planks, roaring sail, watchful eyes—and storm-sigils burned into the mast that pulse faintly when you grip the railing.",
          data: {
            hazards: ["rigging", "squalls", "rogue wave"],
            omens: [
              "distant bell only you hear",
              "constellation that shifts when you look away",
            ],
          },
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
