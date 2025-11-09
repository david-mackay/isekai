import { NextRequest, NextResponse } from "next/server";
import { upsertCard, type BaseCard } from "@/lib/cards";
import { DEFAULT_WORLD_CARD, WORLDS } from "@/lib/world";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertStoryOwnership } from "@/server/services/stories";

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
        };
        worldKey?: string;
      };
    console.log("🎯 API: Initializing beginning:", {
      key,
      sessionId,
      playerCharacter,
    });

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
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
    await upsertCard(world as Omit<BaseCard, "id" | "updatedAt" | "storyId">, sessionId);

    // Create player character card if character data is provided
    if (playerCharacter) {
      console.log(
        "👤 API: Creating player character card:",
        playerCharacter.name
      );
      await upsertCard(
        {
          type: "character",
          name: "Player Character",
          description: `${playerCharacter.name}, a ${playerCharacter.gender} ${playerCharacter.race}`,
          data: {
            name: playerCharacter.name,
            gender: playerCharacter.gender,
            race: playerCharacter.race,
            backstory: {},
            revealedTraits: [],
            isPlayerCharacter: true,
          },
        },
        sessionId
      );
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
