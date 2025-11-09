import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { upsertCard, listCards, type BaseCard } from "./cards";

export const rollDice = tool(
  async ({ formula }: { formula: string }) => {
    const match = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
    if (!match)
      return JSON.stringify({ error: "Invalid dice formula", formula });
    const count = parseInt(match[1] || "1", 10);
    const sides = parseInt(match[2], 10);
    const mod = match[3] ? parseInt(match[3], 10) : 0;
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(1 + Math.floor(Math.random() * sides));
    }
    const total = rolls.reduce((a, b) => a + b, 0) + mod;
    return JSON.stringify({ formula, rolls, modifier: mod, total });
  },
  {
    name: "roll_dice",
    description:
      "Roll polyhedral dice like d20, d6, or custom NdM (e.g., 2d6+1). Returns total and individual rolls.",
    schema: z.object({
      formula: z.string().describe("Dice formula, e.g. '1d20+3' or '2d6+1'"),
    }),
  }
);

export const updateOrCreateCard = tool(
  async (payload: {
    type: BaseCard["type"];
    name: string;
    description?: string;
    data?: Record<string, unknown>;
    sessionId?: string;
  }) => {
    const updated = await upsertCard(
      {
        type: payload.type,
        name: payload.name,
        description: payload.description,
        data: payload.data ?? {},
      },
      payload.sessionId
    );
    return JSON.stringify(updated);
  },
  {
    name: "update_or_create_card",
    description:
      "Create or update a story, character, environment, item, faction, or quest card by name and type. Merges new data.",
    schema: z.object({
      type: z.enum([
        "story",
        "character",
        "environment",
        "item",
        "faction",
        "quest",
        "world",
      ]),
      name: z.string(),
      description: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
      sessionId: z.string().optional(),
    }),
  }
);

export const listAllCards = tool(
  async (input: {
    type?: BaseCard["type"];
    name?: string;
    sessionId?: string;
  }) => {
    const cards = await listCards(
      { type: input.type, name: input.name },
      input.sessionId
    );
    return JSON.stringify(cards);
  },
  {
    name: "list_cards",
    description:
      "List cards, optionally filtered by type or substring of name.",
    schema: z.object({
      type: z.string().optional(),
      name: z.string().optional(),
      sessionId: z.string().optional(),
    }),
  }
);

export const updatePlayerBackstory = tool(
  async (payload: {
    backstoryElement: string;
    category:
      | "skill"
      | "background"
      | "relationship"
      | "experience"
      | "secret"
      | "motivation";
    description: string;
    sessionId?: string;
  }) => {
    // Get or create the player character card
    let playerCard = await listCards(
      { type: "character", name: "Player Character" },
      payload.sessionId
    );

    if (playerCard.length === 0) {
      // Create player character card if it doesn't exist
      const newCard = await upsertCard(
        {
          type: "character",
          name: "Player Character",
          description:
            "The player's character, whose backstory develops through play",
          data: {
            backstory: {},
            revealedTraits: [],
          },
        },
        payload.sessionId
      );
      playerCard = [newCard];
    }

    const currentData = playerCard[0].data || {};
    const backstory = currentData.backstory || {};
    const revealedTraits = currentData.revealedTraits || [];

    // Add the new backstory element
    if (!backstory[payload.category]) {
      backstory[payload.category] = [];
    }

    backstory[payload.category].push({
      element: payload.backstoryElement,
      description: payload.description,
      revealedAt: new Date().toISOString(),
    });

    // Update revealed traits list
    if (!revealedTraits.includes(payload.backstoryElement)) {
      revealedTraits.push(payload.backstoryElement);
    }

    await upsertCard(
      {
        ...playerCard[0],
        data: {
          ...currentData,
          backstory,
          revealedTraits,
        },
      },
      payload.sessionId
    );

    invalidateVectorCache(payload.sessionId);
    return JSON.stringify({
      success: true,
      message: `Added backstory element: ${payload.backstoryElement} (${payload.category})`,
      totalElements: revealedTraits.length,
    });
  },
  {
    name: "update_player_backstory",
    description:
      "Record new backstory elements as they are revealed through the player's actions, dialogue, or character reactions. Use this when the player demonstrates a skill, mentions their past, or when NPCs discover something about them.",
    schema: z.object({
      backstoryElement: z
        .string()
        .describe(
          "A brief title for this backstory element (e.g. 'Trained in Stealth', 'Noble Background', 'Fear of Heights')"
        ),
      category: z
        .enum([
          "skill",
          "background",
          "relationship",
          "experience",
          "secret",
          "motivation",
        ])
        .describe("The type of backstory element being revealed"),
      description: z
        .string()
        .describe(
          "A detailed description of how this was revealed and what it means"
        ),
      sessionId: z.string().optional(),
    }),
  }
);

export const tools = [
  rollDice,
  updateOrCreateCard,
  listAllCards,
  updatePlayerBackstory,
];
