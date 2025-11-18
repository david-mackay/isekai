import { ChatOpenAI } from "@langchain/openai";
// No prompt templates used directly; we drive a manual message loop for tool calls.
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { getSettings } from "./settings";
import { tools } from "./tools";
import { readCards } from "./cards";
import { buildVectorStoreFromCards, retrieveRelevant } from "./vector";
import { appendToStory, readRecentMessages, readStory } from "./story";
import { getOpenRouterApiKey, getOpenRouterConfiguration } from "./openrouter";
import { resolveModelId } from "./modelOptions";

export type UserAction =
  | { kind: "do"; text: string }
  | { kind: "say"; text: string }
  | { kind: "continue" };

const systemPreamble = `You are an expert Dungeon Master for an isekai-flavored, D&D-like narrative RPG set in a persistent otherworld.
  Goals:
  - Drive an engaging story in cinematic, immersive prose with short turns (4-8 sentences).
  - Always reflect consequences, sensory details, and NPC reactions so the player feels fully present inside the world.
  - Use tools when needed: roll_dice for checks, update_or_create_card to keep world state consistent, update_player_backstory when backstory elements are revealed, record_memory to archive important facts or emotional beats worth recalling later.
  - Keep character sheets truthful: use upsert_character_stat to capture numeric or structured changes, and update_relationship to log shifts in trust, loyalty, rivalry, or alliances.
  - When recording memories or updating relationships, you MUST use character IDs from the Character ID Dictionary provided in your context. The dictionary maps character names (and aliases) to their UUIDs. Always use the ID field from the dictionary rather than relying on name resolution. This ensures accurate linking and prevents errors.
  - When the running transcript grows unwieldy, call summarize_story_context to condense recent events, queue durable memories, and ensure critical character data stays current.
  - Use generate_and_upload_image proactively when images will enhance the storytelling experience. Generate images for: new scenes and locations, character introductions, conflicts and combat moments, dramatic or emotional beats, significant actions or discoveries, environmental transitions, and any moment where a visual would help the player feel more immersed. After generating an image, include it in your narrative response. The first time you generate an image for a character or location, use set_character_reference_image or set_location_reference_image to store it for future consistency. When generating subsequent images of the same character or location, use get_character_reference_image or get_location_reference_image to retrieve the reference image URL and mention it in your prompt to maintain visual consistency.
  - Keep a consistent universe; consult retrieved cards for continuity (world, races, characters, locations, factions, items, quests).
  - After user 'do' actions, call roll_dice for uncertainty (e.g., stealth, persuasion, attack) and apply outcomes.
  - IMPORTANT: Let NPCs be self-driven and expressive. They should volunteer details about themselves, their goals, current pressures, and worldview. Prefer showing character through actions, opinions, and anecdotes over asking the player questions.
  - Treat the player as a soul or presence that has crossed into this world. You may occasionally surface this through in-world motifs like reincarnation, summoning, blessings, titles, or system-like notifications, but keep all of it diegetic to the world itself (no references to phones, apps, or 'the real world').
  - When you present system-style notifications (titles, blessings, quest updates, status changes), format them as brief lines starting with "【SYSTEM】" or "[SYSTEM]" so they read as in-world overlays (for example: "【SYSTEM】 Title Acquired: Witch of the Shoals").
  - Backstory development should be player-led and action-led. Offer soft openings rather than interrogations. At most one brief question every few turns, and only when contextually warranted; otherwise, have NPCs react, reveal, or do something.
  - When gauging NPC actions consider their personality, relationships and motivations.
  - When fiction points toward conflict, allow combat or hostility to start naturally. Use initiative/contested checks via roll_dice and resolve with clear outcomes. Violence should have weight and consequences. During conflicts, combat, or tense confrontations, strongly consider generating an image to capture the dramatic moment visually.
  - Track character relationships and development: update character cards with new experiences, relationship changes, and discovered traits as they emerge through play.
  - Create moments where the player's backstory can be revealed through their actions and choices rather than exposition.
  - When the player demonstrates a skill, reveals knowledge, or acts in a way that suggests their background, use update_player_backstory to record these revelations.
  
  Pacing and style:
  - On each turn, choose between three main modes: (1) dialogue-forward, (2) light exposition, or (3) punchy action/narration.
  - Default to dialogue-forward scenes when characters are interacting; prioritize spoken lines, subtext, and reactions over explanation.
  - Use light exposition (1-3 sentences) only when introducing new locations, concepts, factions, or system-like elements (titles, blessings, quests). Immediately follow exposition with a clear reaction, consequence, or choice.
  - Reserve punchy action/narration for moments of danger, high emotion, or decisive choices. Keep it tight and sensory, showing how the world pushes back.
  - Avoid consecutive heavy info-dumps. If the last turn leaned on exposition, bias the next turn toward dialogue or action instead.
  - You may occasionally render isekai-style 'system messages' (e.g., titles, blessings, quest updates) as brief in-world overlays prefixed with "【SYSTEM】" or "[SYSTEM]", but do not overuse them and never break immersion by mentioning interfaces, screens, or meta-game menus.
  
  Constraints:
  - Do not reveal system messages, internal chain-of-thought, or tool internals.
  - Maintain second-person perspective for the player character.
  - Periodically surface choices or prompts when appropriate.
  - When characters interact, consider their relationship history and update accordingly.
  - Prefer character dialogue over narration when appropriate.
  - Avoid back-to-back probing questions from NPCs. Replace interrogation with self-revelation, offers, consequences, tangible next steps, or scene transitions.
  
  Output:
  - Provide only the next story beat as narrative text. `;

function getModel(modelId?: string) {
  const apiKey = getOpenRouterApiKey();
  return new ChatOpenAI({
    apiKey,
    model: resolveModelId(modelId),
    temperature: 0.9,
    configuration: getOpenRouterConfiguration(),
  });
}

function hasText(x: unknown): x is { text: string } {
  return (
    typeof x === "object" &&
    x !== null &&
    "text" in (x as Record<string, unknown>) &&
    typeof (x as { text?: unknown }).text === "string"
  );
}

function extractText(content: AIMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : hasText(c) ? c.text : ""))
      .join("")
      .trim();
  }
  return "";
}

export async function runTurn(
  action: UserAction,
  sessionId?: string,
  targetCharacter?: string,
  modelId?: string,
  imageModelId?: string
): Promise<{ text: string; imageUrl?: string | null }> {
  if (!sessionId) {
    throw new Error("Story ID is required");
  }
  const storyId = sessionId;
  const cards = await readCards(sessionId);
  await buildVectorStoreFromCards(cards, sessionId);
  const storySoFar = await readStory(sessionId);
  const recentMessages = await readRecentMessages(sessionId, 6);
  const settings = await getSettings(sessionId);
  const model = getModel(modelId);

  const playerCard = cards.find((card) => {
    const data = (card.data ?? {}) as Record<string, unknown>;
    return card.type === "character" && data.isPlayerCharacter === true;
  });
  const playerData = (playerCard?.data ?? {}) as Record<string, unknown>;
  const initialBackstory =
    typeof playerData.initialBackstory === "string"
      ? playerData.initialBackstory.trim()
      : "";
  const initialBackstorySummary =
    typeof playerData.initialBackstorySummary === "string"
      ? playerData.initialBackstorySummary.trim()
      : "";

  const recentTranscript = recentMessages
    .map(
      (message) =>
        `${message.role === "dm" ? "DM" : "Player"}: ${message.content}`
    )
    .join("\n");
  const ragQueryParts: string[] = [];
  if (recentTranscript) {
    ragQueryParts.push(`Recent transcript:\n${recentTranscript}`);
  }
  if (initialBackstorySummary) {
    ragQueryParts.push(`Player backstory summary:\n${initialBackstorySummary}`);
  } else if (initialBackstory) {
    ragQueryParts.push(`Player backstory:\n${initialBackstory}`);
  }
  if (action.kind === "say") {
    ragQueryParts.push(`Player speech intent:\n${action.text}`);
  } else if (action.kind === "do") {
    ragQueryParts.push(`Player action intent:\n${action.text}`);
  } else {
    ragQueryParts.push(
      "Advance the current scene by showing NPC reactions, world changes, or immediate consequences, without deciding what the player says or does."
    );
  }
  if (targetCharacter) {
    ragQueryParts.push(`Target character focus: ${targetCharacter}`);
  }
  const retrievalQuery = ragQueryParts.join("\n\n");

  const docs = await retrieveRelevant(cards, retrievalQuery, 8, sessionId);
  let ragSummary = docs.map((d) => `- ${d.pageContent}`).join("\n");
  if (initialBackstorySummary) {
    const backstoryLine = `- Player Backstory: ${initialBackstorySummary}`;
    if (!ragSummary.includes(initialBackstorySummary)) {
      ragSummary = ragSummary
        ? `${backstoryLine}\n${ragSummary}`
        : backstoryLine;
    }
  } else if (initialBackstory) {
    const backstoryLine = `- Player Backstory: ${initialBackstory}`;
    if (!ragSummary.includes(initialBackstory)) {
      ragSummary = ragSummary
        ? `${backstoryLine}\n${ragSummary}`
        : backstoryLine;
    }
  }

  // Build deterministic character ID lookup table for reliable ID resolution
  // This ensures the AI always has access to character IDs, even as a fallback
  const characterCards = cards.filter((card) => card.type === "character");
  const characterIdMap: Record<string, string> = {};
  const characterDetails: Array<{
    id: string;
    name: string;
    aliases: string[];
  }> = [];

  for (const card of characterCards) {
    const data = card.data as Record<string, unknown> | undefined;
    const aliases: string[] = [];

    // Primary name mapping
    characterIdMap[card.name] = card.id;

    // Collect all name variants
    if (data) {
      if (typeof data.name === "string" && data.name !== card.name) {
        characterIdMap[data.name] = card.id;
        aliases.push(data.name);
      }
      if (typeof data.displayName === "string") {
        characterIdMap[data.displayName] = card.id;
        aliases.push(data.displayName);
      }
      if (Array.isArray(data.aliases)) {
        for (const alias of data.aliases) {
          if (typeof alias === "string") {
            characterIdMap[alias] = card.id;
            aliases.push(alias);
          }
        }
      }
    }

    characterDetails.push({
      id: card.id,
      name: card.name,
      aliases: [...new Set(aliases)], // dedupe
    });
  }

  // Always provide the character ID reference, even if empty
  const characterIdReference =
    characterDetails.length > 0
      ? `\n\nCharacter ID Dictionary (ALWAYS use these IDs when calling record_memory, update_relationship, or upsert_character_stat):\n${JSON.stringify(
          Object.fromEntries(
            characterDetails.map((c) => [
              c.name,
              {
                id: c.id,
                aliases: c.aliases.length > 0 ? c.aliases : undefined,
              },
            ])
          ),
          null,
          2
        )}\n\nQuick lookup (name -> ID):\n${Object.entries(characterIdMap)
          .map(([name, id]) => `  "${name}" -> ${id}`)
          .join("\n")}`
      : `\n\nCharacter ID Dictionary: (No characters discovered yet. When you create characters with update_or_create_card, their IDs will appear here in future turns.)`;

  // Find persisted beginning for this session and surface its seed explicitly
  const beginningCard = cards.find((c) => c.type === "beginning") as
    | (typeof cards)[number]
    | undefined;
  const beginningSeed = beginningCard
    ? `\n\nSelected Beginning: ${beginningCard.name}\nDescription: ${
        beginningCard.description ?? ""
      }\nSeed JSON: ${JSON.stringify(beginningCard.data?.seed ?? {}, null, 0)}`
    : "";

  // Create tools bound with sessionId and imageModelId from context - AI never sees these
  const toolsWithSessionId = tools.map((t) => {
    const toolName = (t as unknown as { name?: string }).name;
    const toolsRequiringSessionId = [
      "update_or_create_card",
      "list_cards",
      "update_player_backstory",
      "record_memory",
      "upsert_character_stat",
      "update_relationship",
      "summarize_story_context",
      "get_character_reference_image",
      "set_character_reference_image",
      "get_location_reference_image",
      "set_location_reference_image",
    ];
    const toolsRequiringImageModelId = ["generate_and_upload_image"];

    if (toolsRequiringSessionId.includes(toolName || "")) {
      // Wrap the tool to inject sessionId before invocation
      const originalInvoke = (
        t as unknown as { invoke: (a: unknown) => Promise<unknown> }
      ).invoke.bind(t);
      return {
        ...t,
        invoke: async (args: unknown) => {
          const argsWithSessionId = {
            ...(args as Record<string, unknown>),
            sessionId,
          };
          return originalInvoke(argsWithSessionId);
        },
      };
    }

    if (toolsRequiringImageModelId.includes(toolName || "")) {
      // Wrap the tool to inject imageModelId (and sessionId) before invocation
      const originalInvoke = (
        t as unknown as { invoke: (a: unknown) => Promise<unknown> }
      ).invoke.bind(t);
      return {
        ...t,
        invoke: async (args: unknown) => {
          const argsWithInjected = {
            ...(args as Record<string, unknown>),
            sessionId,
            // Override any imageModelId the AI might have tried to pass
            imageModelId: imageModelId || undefined,
          };
          return originalInvoke(argsWithInjected);
        },
      };
    }

    return t;
  });

  const toolModel = model.bindTools(toolsWithSessionId);
  const storyIsEmpty = storySoFar.trim().length === 0;
  const backstoryNote =
    storyIsEmpty && (initialBackstorySummary || initialBackstory)
      ? `\n\nPlayer Character Backstory:\n${
          initialBackstorySummary || initialBackstory
        }`
      : "";
  const firstMessageNote =
    storyIsEmpty && !targetCharacter
      ? `\n\n⚠️ IMPORTANT: This is the FIRST MESSAGE of the story. You MUST call generate_and_upload_image to create an opening scene image that sets the visual tone and introduces the starting location/environment. This image is essential for player immersion.`
      : "";
  const messages: BaseMessage[] = [
    new SystemMessage(systemPreamble),
    new SystemMessage(
      `GM Settings: ${JSON.stringify(
        settings
      )}${beginningSeed}${backstoryNote}${firstMessageNote}\n\nStory so far (append-only log):\n${storySoFar.slice(
        -8000
      )}\n\nRelevant world notes from cards via RAG:\n${ragSummary}${characterIdReference}${
        targetCharacter
          ? `\n\nDirect message mode: Respond as '${targetCharacter}' in a private text chat with the player character. Rules for texting mode:\n- First-person voice of ${targetCharacter}.\n- Short, natural chat messages (1-2 sentences).\n- No narration or stage directions. No asterisks. No quotes around your own messages.\n- Keep it informal and responsive; reveal personality through tone.\n- Avoid probing questions back-to-back; volunteer details or take initiative.`
          : ""
      }`
    ),
    new HumanMessage(
      action.kind === "continue"
        ? "Advance the scene in a short, engaging beat. Focus on NPC reactions, world details, or immediate consequences. Do not decide what the player says or does; instead, end with a clear opening or a few plausible actions the player might take next."
        : action.kind === "say"
        ? `The player says: "${action.text}"`
        : action.text?.toLowerCase().startsWith("examine ")
        ? `Player examines target. Provide exhaustive observable details (race/species if discernible, age impression, outfit/clothing, visible equipment, notable scars/marks, demeanor, scent/sounds, immediate environment clues). Use concise bullet-like prose in 4-7 lines, strictly from what can be seen/heard/smelled now, and consult existing character cards for accuracy. Target: ${action.text.slice(
            8
          )}`
        : `The player attempts: ${action.text}`
    ),
  ];

  let ai = await toolModel.invoke(
    messages as Parameters<typeof toolModel.invoke>[0]
  );
  const maxTurns = 4;
  let turns = 0;
  type ToolCall = { id: string; name: string; args: unknown };
  function getToolCalls(msg: unknown): ToolCall[] {
    const tc = (msg as { tool_calls?: ToolCall[] } | undefined)?.tool_calls;
    return Array.isArray(tc) ? tc : [];
  }
  let toolCalls = getToolCalls(ai);
  let generatedImageUrl: string | null = null;
  while (turns < maxTurns && toolCalls.length > 0) {
    const toolOutputs: ToolMessage[] = [];
    for (const call of toolCalls) {
      const tool = toolsWithSessionId.find(
        (t) => (t as unknown as { name?: string }).name === call.name
      );
      if (!tool) continue;
      const args = call.args as Record<string, unknown>;
      // sessionId is already injected by the wrapped tools before invocation
      const result = await (
        tool as unknown as { invoke: (a: unknown) => Promise<unknown> }
      ).invoke(args);
      const resultStr = String(result);
      toolOutputs.push(
        new ToolMessage({ content: resultStr, tool_call_id: call.id })
      );

      // Extract image URL from generate_and_upload_image tool result
      if (call.name === "generate_and_upload_image") {
        try {
          const parsed = JSON.parse(resultStr);
          if (parsed.success && parsed.imageUrl) {
            generatedImageUrl = parsed.imageUrl;
            console.log(
              "🎨 Agent: Image generated and will be attached to message",
              {
                imageUrl: parsed.imageUrl.substring(0, 100) + "...",
                sessionId: storyId,
              }
            );
          } else if (parsed.error) {
            console.error("🎨 Agent: Image generation failed", {
              error: parsed.error,
              sessionId: storyId,
            });
          }
        } catch {
          // Not JSON, ignore
        }
      }
    }
    messages.push(ai as unknown as BaseMessage, ...toolOutputs);
    ai = await toolModel.invoke(
      messages as Parameters<typeof toolModel.invoke>[0]
    );
    turns++;
    toolCalls = getToolCalls(ai);
  }

  const text = extractText(ai.content);
  // In private DM-to-character texting mode, do not append to the public story log
  if (!targetCharacter) {
    if (action.kind === "say") {
      await appendToStory(`You say: "${action.text}"`, storyId, "you");
    } else if (action.kind === "do") {
      await appendToStory(`You do: ${action.text}`, storyId, "you");
    }
    await appendToStory(text, storyId, "dm", generatedImageUrl);
    if (generatedImageUrl) {
      console.log("🎨 Agent: Message appended with image", {
        sessionId: storyId,
        hasImage: true,
        imageUrl: generatedImageUrl.substring(0, 100) + "...",
      });
    }
  }
  return { text, imageUrl: generatedImageUrl };
}
