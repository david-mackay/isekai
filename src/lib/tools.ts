import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { upsertCard, listCards, type BaseCard } from "./cards";
import { invalidateVectorCache } from "./vector";
import {
  recordMemory,
  upsertCharacterStat,
  upsertRelationship,
  type MemorySource,
} from "@/server/services/memories";
import {
  CARD_TYPES,
  MEMORY_SOURCES,
  resolveCardId,
  StorySummaryPayloadSchema,
  MemoryPayloadSchema,
  CharacterUpdateSchema,
  RelationshipUpdateSchema,
  applyStorySummary,
} from "./storySummary";
import { generateImage } from "./imageGeneration";
import { uploadImageToSupabase } from "./supabaseStorage";
import { v4 as uuidv4 } from "uuid";

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
    description?: string | null;
    data?: Record<string, unknown> | null;
    sessionId?: string | null;
  }) => {
    const updated = await upsertCard(
      {
        type: payload.type,
        name: payload.name,
        description: payload.description ?? undefined,
        data: payload.data ?? {},
      },
      payload.sessionId ?? undefined
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
      description: z.string().optional().nullable(),
      data: z.record(z.string(), z.unknown()).optional().nullable(),
      // Injected by the agent; the model should not fabricate this.
      sessionId: z.string().optional().nullable(),
    }),
  }
);

export const listAllCards = tool(
  async (input: {
    type?: BaseCard["type"] | null;
    name?: string | null;
    sessionId?: string | null;
  }) => {
    const cards = await listCards(
      {
        type: input.type ?? undefined,
        name: input.name ?? undefined,
      },
      input.sessionId ?? undefined
    );
    return JSON.stringify(cards);
  },
  {
    name: "list_cards",
    description:
      "List cards, optionally filtered by type or substring of name.",
    schema: z.object({
      type: z.string().optional().nullable(),
      name: z.string().optional().nullable(),
      // Injected by the agent; the model should not fabricate this.
      sessionId: z.string().optional().nullable(),
    }),
  }
);

export const recordMemoryTool = tool(
  async (payload: {
    sessionId?: string | null;
    summary: string;
    sourceType?: MemorySource | null;
    ownerCardId?: string | null;
    ownerCardName?: string | null;
    ownerCardType?: string | null;
    subjectCardId?: string | null;
    subjectCardName?: string | null;
    subjectCardType?: string | null;
    importance?: number | null;
    tags?: string[] | null;
    context?: Record<string, unknown> | null;
  }) => {
    if (!payload.sessionId) {
      throw new Error("sessionId is required to record a memory.");
    }

    const sessionId = payload.sessionId;
    const ownerId = await resolveCardId(sessionId, {
      id: payload.ownerCardId,
      name: payload.ownerCardName,
      type: payload.ownerCardType,
    });
    const subjectId = await resolveCardId(sessionId, {
      id: payload.subjectCardId,
      name: payload.subjectCardName,
      type: payload.subjectCardType,
    });

    const sourceType =
      payload.sourceType && MEMORY_SOURCES.includes(payload.sourceType)
        ? payload.sourceType
        : "system";

    const memory = await recordMemory({
      storyId: sessionId,
      summary: payload.summary,
      sourceType,
      ownerCardId: ownerId,
      subjectCardId: subjectId,
      importance:
        typeof payload.importance === "number" ? payload.importance : 1,
      tags: payload.tags ?? [],
      context: payload.context ?? {},
    });

    return JSON.stringify({
      success: true,
      memory: {
        id: memory.id,
        ownerCardId: memory.ownerCardId,
        subjectCardId: memory.subjectCardId,
        importance: memory.importance,
        summary: memory.summary,
      },
    });
  },
  {
    name: "record_memory",
    description:
      "Archive a meaningful in-world memory when a character (player or NPC) learns, experiences, or commits to something significant. Use this to preserve facts for future recall.",
    schema: z.object({
      // Injected by the agent; the model should not fabricate this.
      sessionId: z.string().optional().nullable(),
      summary: z
        .string()
        .min(1)
        .describe(
          "One-sentence description of the memory. Focus on the durable fact being remembered."
        ),
      sourceType: z
        .enum(MEMORY_SOURCES)
        .optional()
        .nullable()
        .describe(
          "Who is recording the memory. Defaults to 'system' if omitted."
        ),
      ownerCardId: z.string().optional().nullable(),
      ownerCardName: z.string().optional().nullable(),
      ownerCardType: z
        .enum(CARD_TYPES)
        .optional()
        .nullable()
        .describe("Card type for owner lookup when using a name."),
      subjectCardId: z.string().optional().nullable(),
      subjectCardName: z.string().optional().nullable(),
      subjectCardType: z
        .enum(CARD_TYPES)
        .optional()
        .nullable()
        .describe("Card type for subject lookup when using a name."),
      importance: z
        .number()
        .min(1)
        .max(5)
        .optional()
        .nullable()
        .describe("Higher numbers keep memories fresher for longer."),
      tags: z.array(z.string()).optional().nullable(),
      context: z.record(z.string(), z.unknown()).optional().nullable(),
    }),
  }
);

export const upsertCharacterStatTool = tool(
  async (payload: {
    sessionId?: string | null;
    characterId?: string | null;
    characterName?: string | null;
    characterType?: string | null;
    key: string;
    value?: unknown;
    confidence?: number | null;
  }) => {
    if (!payload.sessionId) {
      throw new Error("sessionId is required to update character stats.");
    }
    const sessionId = payload.sessionId;
    const characterId = await resolveCardId(sessionId, {
      id: payload.characterId,
      name: payload.characterName,
      type: payload.characterType ?? "character",
    });
    if (!characterId) {
      throw new Error(
        `Unable to resolve character for stat update: ${
          payload.characterName ?? payload.characterId ?? "unknown"
        }`
      );
    }
    const value =
      payload.value && typeof payload.value === "object"
        ? (payload.value as Record<string, unknown>)
        : (payload.value as string | number | boolean | null | undefined);
    const stat = await upsertCharacterStat({
      storyId: sessionId,
      characterCardId: characterId,
      key: payload.key,
      value: value ?? null,
      confidence:
        typeof payload.confidence === "number" ? payload.confidence : 1,
    });
    return JSON.stringify({
      success: true,
      stat: {
        id: stat.id,
        key: stat.key,
        value: stat.value,
        confidence: stat.confidence,
      },
    });
  },
  {
    name: "upsert_character_stat",
    description:
      "Record or update structured facts about a character (abilities, conditions, resources, etc.). Use after noteworthy changes.",
    schema: z.object({
      // Injected by the agent; the model should not fabricate this.
      sessionId: z.string().optional().nullable(),
      characterId: z.string().optional().nullable(),
      characterName: z.string().optional().nullable(),
      characterType: z.enum(CARD_TYPES).optional().nullable(),
      key: z
        .string()
        .min(1)
        .describe("Identifier for the stat, e.g. 'hit_points' or 'loyalty'."),
      value: z
        .union([
          z.string(),
          z.number(),
          z.boolean(),
          z.record(z.string(), z.unknown()),
          z.array(z.unknown()),
          z.null(),
        ])
        .optional()
        .nullable()
        .describe("Stat value; complex objects are allowed."),
      confidence: z
        .number()
        .min(0)
        .max(5)
        .optional()
        .nullable()
        .describe("Confidence weight (defaults to 1)."),
    }),
  }
);

export const updateRelationshipTool = tool(
  async (payload: {
    sessionId?: string | null;
    sourceId?: string | null;
    sourceName?: string | null;
    sourceType?: string | null;
    targetId?: string | null;
    targetName?: string | null;
    targetType?: string | null;
    summary?: string | null;
    metrics?: Record<string, unknown> | null;
    importance?: number | null;
  }) => {
    // sessionId is always injected by the agent from context
    const sessionId = payload.sessionId;
    if (!sessionId) {
      throw new Error(
        "sessionId is required to update relationships. This should never happen - it's injected automatically."
      );
    }
    const sourceCardId = await resolveCardId(sessionId, {
      id: payload.sourceId,
      name: payload.sourceName,
      type: payload.sourceType ?? "character",
    });
    if (!sourceCardId) {
      throw new Error(
        `Unable to resolve source character: ${
          payload.sourceName ?? payload.sourceId ?? "unknown"
        }`
      );
    }
    const targetCardId = await resolveCardId(sessionId, {
      id: payload.targetId,
      name: payload.targetName,
      type: payload.targetType ?? "character",
    });
    if (!targetCardId) {
      throw new Error(
        `Unable to resolve target character: ${
          payload.targetName ?? payload.targetId ?? "unknown"
        }`
      );
    }
    const relationship = await upsertRelationship({
      storyId: sessionId,
      sourceCardId,
      targetCardId,
      summary: payload.summary ?? null,
      metrics: payload.metrics ?? {},
      importance:
        typeof payload.importance === "number" ? payload.importance : 1,
    });
    return JSON.stringify({
      success: true,
      relationship: {
        id: relationship.id,
        summary: relationship.summary,
        importance: relationship.importance,
      },
    });
  },
  {
    name: "update_relationship",
    description:
      "Track how two characters feel about each other—trust shifts, rivalries, alliances, etc. Use after meaningful interactions.",
    schema: z.object({
      // Injected by the agent; the model should not fabricate this.
      sessionId: z.string().optional().nullable(),
      sourceId: z.string().optional().nullable(),
      sourceName: z.string().optional().nullable(),
      sourceType: z.enum(CARD_TYPES).optional().nullable(),
      targetId: z.string().optional().nullable(),
      targetName: z.string().optional().nullable(),
      targetType: z.enum(CARD_TYPES).optional().nullable(),
      summary: z.string().optional().nullable(),
      metrics: z.record(z.string(), z.unknown()).optional().nullable(),
      importance: z.number().min(0).max(5).optional().nullable(),
    }),
  }
);

export const summarizeStoryTool = tool(
  async (payload: {
    sessionId?: string | null;
    summary: string;
    summaryLabel?: string | null;
    memories?: z.infer<typeof MemoryPayloadSchema>[] | null;
    characterUpdates?: z.infer<typeof CharacterUpdateSchema>[] | null;
    relationshipUpdates?: z.infer<typeof RelationshipUpdateSchema>[] | null;
  }) => {
    if (!payload.sessionId) {
      throw new Error("sessionId is required to summarize the story.");
    }
    const sessionId = payload.sessionId;
    const result = await applyStorySummary(sessionId, {
      summary: payload.summary,
      summaryLabel: payload.summaryLabel ?? undefined,
      memories: payload.memories ?? undefined,
      characterUpdates: payload.characterUpdates ?? undefined,
      relationshipUpdates: payload.relationshipUpdates ?? undefined,
    });
    return JSON.stringify({
      success: true,
      ...result,
    });
  },
  {
    name: "summarize_story_context",
    description:
      "Condense lengthy transcripts into a durable campaign summary. Optionally attach new memories and refresh character sheets when the log grows unwieldy.",
    schema: StorySummaryPayloadSchema.extend({
      // Injected by the agent; the model should not fabricate this.
      sessionId: z.string().optional().nullable(),
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
    sessionId?: string | null;
  }) => {
    // Get or create the player character card
    let playerCard = await listCards(
      { type: "character", name: "Player Character" },
      payload.sessionId ?? undefined
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
        payload.sessionId ?? undefined
      );
      playerCard = [newCard];
    }

    const currentData = (playerCard[0].data ?? {}) as Record<string, unknown>;
    const backstory =
      (currentData.backstory as Record<
        string,
        Array<{
          element: string;
          description: string;
          revealedAt: string;
        }>
      >) ?? {};
    const revealedTraits = Array.isArray(currentData.revealedTraits)
      ? (currentData.revealedTraits as string[])
      : [];

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
      payload.sessionId ?? undefined
    );

    invalidateVectorCache(payload.sessionId ?? undefined);
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
      // Injected by the agent; the model should not fabricate this.
      sessionId: z.string().optional().nullable(),
    }),
  }
);

export const generateAndUploadImageTool = tool(
  async (payload: {
    prompt: string;
    imageModelId?: string | null;
    sessionId?: string | null;
  }) => {
    const toolStartTime = Date.now();
    console.log("🎨 Generate Image Tool: Starting", {
      sessionId: payload.sessionId,
      imageModelId: payload.imageModelId,
      promptLength: payload.prompt.length,
    });

    try {
      // Generate the image
      const imageBuffer = await generateImage(
        payload.prompt,
        payload.imageModelId ?? undefined
      );

      // Create a unique key for the image
      const imageKey = `generated/${
        payload.sessionId || "default"
      }/${uuidv4()}`;
      console.log("🎨 Generate Image Tool: Generated image, uploading...", {
        imageKey,
        imageSize: imageBuffer.length,
      });

      // Upload to Supabase
      const imageUrl = await uploadImageToSupabase(imageBuffer, imageKey);

      const totalTime = Date.now() - toolStartTime;
      console.log(
        `🎨 Generate Image Tool: Successfully completed in ${totalTime}ms`,
        {
          imageUrl: imageUrl.substring(0, 100) + "...",
        }
      );

      return JSON.stringify({
        success: true,
        imageUrl,
        message: "Image generated and uploaded successfully",
      });
    } catch (error) {
      const totalTime = Date.now() - toolStartTime;
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error(`🎨 Generate Image Tool: Failed after ${totalTime}ms`, {
        error: message,
        sessionId: payload.sessionId,
      });
      return JSON.stringify({
        success: false,
        error: message,
      });
    }
  },
  {
    name: "generate_and_upload_image",
    description:
      "Generate an image using AI and upload it to storage. Use this proactively when images will enhance the storytelling experience. Generate images for: new scenes and locations, character introductions, conflicts and combat moments, dramatic or emotional beats, significant actions or discoveries, environmental transitions, tense confrontations, action sequences, and any moment where a visual would help the player feel more immersed. Don't be conservative—if a moment is visually interesting, dramatic, or would benefit from visual representation, generate an image. Returns the URL of the uploaded image which should be included in the story message.",
    schema: z.object({
      prompt: z
        .string()
        .min(1)
        .describe(
          "Detailed prompt describing the image to generate. Include scene details, character descriptions, mood, and style."
        ),
      // imageModelId and sessionId are injected by the agent; the model should not provide these.
      imageModelId: z.string().optional().nullable(),
      sessionId: z.string().optional().nullable(),
    }),
  }
);

export const getCharacterReferenceImageTool = tool(
  async (payload: {
    characterId?: string | null;
    characterName?: string | null;
    sessionId?: string | null;
  }) => {
    if (!payload.sessionId) {
      throw new Error("sessionId is required");
    }
    const sessionId = payload.sessionId;
    const characterId = await resolveCardId(sessionId, {
      id: payload.characterId,
      name: payload.characterName,
      type: "character",
    });

    if (!characterId) {
      return JSON.stringify({
        success: false,
        error: `Character not found: ${
          payload.characterName ?? payload.characterId ?? "unknown"
        }`,
      });
    }

    const cards = await listCards({ type: "character" }, sessionId);
    const characterCard = cards.find((c) => c.id === characterId);

    if (!characterCard) {
      return JSON.stringify({
        success: false,
        error: "Character card not found",
      });
    }

    const data = (characterCard.data ?? {}) as Record<string, unknown>;
    const referenceImageUrl =
      typeof data.referenceImageUrl === "string"
        ? data.referenceImageUrl
        : null;

    return JSON.stringify({
      success: true,
      characterId,
      characterName: characterCard.name,
      referenceImageUrl,
      hasReferenceImage: referenceImageUrl !== null,
    });
  },
  {
    name: "get_character_reference_image",
    description:
      "Retrieve the stored reference image URL for a character. Use this when generating images of characters to maintain visual consistency.",
    schema: z.object({
      characterId: z.string().optional().nullable(),
      characterName: z.string().optional().nullable(),
      // Injected by the agent; the model should not fabricate this.
      sessionId: z.string().optional().nullable(),
    }),
  }
);

export const setCharacterReferenceImageTool = tool(
  async (payload: {
    characterId?: string | null;
    characterName?: string | null;
    imageUrl: string;
    sessionId?: string | null;
  }) => {
    if (!payload.sessionId) {
      throw new Error("sessionId is required");
    }
    const sessionId = payload.sessionId;
    const characterId = await resolveCardId(sessionId, {
      id: payload.characterId,
      name: payload.characterName,
      type: "character",
    });

    if (!characterId) {
      throw new Error(
        `Character not found: ${
          payload.characterName ?? payload.characterId ?? "unknown"
        }`
      );
    }

    const cards = await listCards({ type: "character" }, sessionId);
    const characterCard = cards.find((c) => c.id === characterId);

    if (!characterCard) {
      throw new Error("Character card not found");
    }

    const currentData = (characterCard.data ?? {}) as Record<string, unknown>;
    const updatedData = {
      ...currentData,
      referenceImageUrl: payload.imageUrl,
    };

    await upsertCard(
      {
        ...characterCard,
        data: updatedData,
      },
      sessionId
    );

    invalidateVectorCache(sessionId);
    return JSON.stringify({
      success: true,
      characterId,
      characterName: characterCard.name,
      referenceImageUrl: payload.imageUrl,
      message: "Reference image stored successfully",
    });
  },
  {
    name: "set_character_reference_image",
    description:
      "Store a reference image URL for a character. Use this the first time an image is generated for a character to maintain visual consistency in future generations.",
    schema: z.object({
      characterId: z.string().optional().nullable(),
      characterName: z.string().optional().nullable(),
      imageUrl: z
        .string()
        .url()
        .describe("URL of the reference image to store"),
      // Injected by the agent; the model should not fabricate this.
      sessionId: z.string().optional().nullable(),
    }),
  }
);

export const getLocationReferenceImageTool = tool(
  async (payload: {
    locationId?: string | null;
    locationName?: string | null;
    sessionId?: string | null;
  }) => {
    if (!payload.sessionId) {
      throw new Error("sessionId is required");
    }
    const sessionId = payload.sessionId;
    const locationId = await resolveCardId(sessionId, {
      id: payload.locationId,
      name: payload.locationName,
      type: "environment",
    });

    if (!locationId) {
      return JSON.stringify({
        success: false,
        error: `Location not found: ${
          payload.locationName ?? payload.locationId ?? "unknown"
        }`,
      });
    }

    const cards = await listCards({ type: "environment" }, sessionId);
    const locationCard = cards.find((c) => c.id === locationId);

    if (!locationCard) {
      return JSON.stringify({
        success: false,
        error: "Location card not found",
      });
    }

    const data = (locationCard.data ?? {}) as Record<string, unknown>;
    const referenceImageUrl =
      typeof data.referenceImageUrl === "string"
        ? data.referenceImageUrl
        : null;

    return JSON.stringify({
      success: true,
      locationId,
      locationName: locationCard.name,
      referenceImageUrl,
      hasReferenceImage: referenceImageUrl !== null,
    });
  },
  {
    name: "get_location_reference_image",
    description:
      "Retrieve the stored reference image URL for a location. Use this when generating images of locations to maintain visual consistency.",
    schema: z.object({
      locationId: z.string().optional().nullable(),
      locationName: z.string().optional().nullable(),
      // Injected by the agent; the model should not fabricate this.
      sessionId: z.string().optional().nullable(),
    }),
  }
);

export const setLocationReferenceImageTool = tool(
  async (payload: {
    locationId?: string | null;
    locationName?: string | null;
    imageUrl: string;
    sessionId?: string | null;
  }) => {
    if (!payload.sessionId) {
      throw new Error("sessionId is required");
    }
    const sessionId = payload.sessionId;
    const locationId = await resolveCardId(sessionId, {
      id: payload.locationId,
      name: payload.locationName,
      type: "environment",
    });

    if (!locationId) {
      throw new Error(
        `Location not found: ${
          payload.locationName ?? payload.locationId ?? "unknown"
        }`
      );
    }

    const cards = await listCards({ type: "environment" }, sessionId);
    const locationCard = cards.find((c) => c.id === locationId);

    if (!locationCard) {
      throw new Error("Location card not found");
    }

    const currentData = (locationCard.data ?? {}) as Record<string, unknown>;
    const updatedData = {
      ...currentData,
      referenceImageUrl: payload.imageUrl,
    };

    await upsertCard(
      {
        ...locationCard,
        data: updatedData,
      },
      sessionId
    );

    invalidateVectorCache(sessionId);
    return JSON.stringify({
      success: true,
      locationId,
      locationName: locationCard.name,
      referenceImageUrl: payload.imageUrl,
      message: "Reference image stored successfully",
    });
  },
  {
    name: "set_location_reference_image",
    description:
      "Store a reference image URL for a location. Use this the first time an image is generated for a location to maintain visual consistency in future generations.",
    schema: z.object({
      locationId: z.string().optional().nullable(),
      locationName: z.string().optional().nullable(),
      imageUrl: z
        .string()
        .url()
        .describe("URL of the reference image to store"),
      // Injected by the agent; the model should not fabricate this.
      sessionId: z.string().optional().nullable(),
    }),
  }
);

export const tools = [
  rollDice,
  updateOrCreateCard,
  listAllCards,
  recordMemoryTool,
  upsertCharacterStatTool,
  updateRelationshipTool,
  summarizeStoryTool,
  updatePlayerBackstory,
  generateAndUploadImageTool,
  getCharacterReferenceImageTool,
  setCharacterReferenceImageTool,
  getLocationReferenceImageTool,
  setLocationReferenceImageTool,
];
