import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertStoryOwnership } from "@/server/services/stories";
import { readStory, readRecentMessages } from "@/lib/story";
import { readCards } from "@/lib/cards";
import { generateImage } from "@/lib/imageGeneration";
import { uploadImageToSupabase } from "@/lib/supabaseStorage";
import { v4 as uuidv4 } from "uuid";
import { getOpenRouterApiKey } from "@/lib/openrouter";
import OpenAI from "openai";
import { resolveImageModelId } from "@/lib/modelOptions";

// Check if user is authenticated as dev
async function requireDevAuth(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("x-dev-auth");
  if (!authHeader) return false;

  // In a real implementation, you'd verify this properly
  // For now, we'll check sessionStorage on client side
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as {
      sessionId: string;
      prompt?: string;
      imageModelId?: string;
    };

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

    console.log("🎨 Dev Image Generation: Manual trigger", {
      sessionId: body.sessionId,
      hasCustomPrompt: !!body.prompt,
    });

    let prompt = body.prompt;

    // If no prompt provided, generate one based on current scene
    if (!prompt) {
      const storySoFar = await readStory(body.sessionId);
      const recentMessages = await readRecentMessages(body.sessionId, 6);
      const cards = await readCards(body.sessionId);

      // Get recent DM messages for context
      const recentDMMessages = recentMessages
        .filter((m) => m.role === "dm")
        .slice(-3)
        .map((m) => m.content)
        .join("\n");

      // Get location/environment cards
      const locations = cards.filter((c) => c.type === "environment");
      const currentLocation = locations[0]; // Could be smarter about this

      // Create a prompt generation request
      const apiKey = getOpenRouterApiKey();
      const openai = new OpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.OPEN_ROUTER_HTTP_REFERER || "",
          "X-Title": process.env.OPEN_ROUTER_TITLE || "",
        },
      });

      const promptGenPrompt = `Based on this story context, create a detailed image generation prompt for the current scene. Focus on the visual details, mood, and key elements visible in the scene.

Recent story context:
${recentDMMessages}

${
  currentLocation
    ? `Current location: ${currentLocation.name} - ${
        currentLocation.description || ""
      }`
    : ""
}

Create a detailed, vivid image prompt that captures the current scene. Include:
- Setting and environment details
- Character appearances if relevant
- Mood and atmosphere
- Visual style (fantasy, isekai, cinematic)
- Key visual elements

Respond with ONLY the image prompt, no additional text.`;

      const completion = await openai.chat.completions.create({
        model: "openrouter/sherlock-think-alpha", // Use text model for prompt generation
        messages: [
          {
            role: "user",
            content: promptGenPrompt,
          },
        ],
      });

      prompt = completion.choices[0]?.message?.content?.trim() || "";

      if (!prompt) {
        // Fallback prompt
        prompt = `A scene from ${
          currentLocation?.name || "an isekai fantasy world"
        }. ${recentDMMessages.slice(-200)}`;
      }

      console.log("🎨 Dev Image Generation: Generated prompt", {
        promptLength: prompt.length,
        promptPreview: prompt.slice(0, 100) + "...",
      });
    }

    // Generate and upload image
    const imageBuffer = await generateImage(
      prompt,
      body.imageModelId ? resolveImageModelId(body.imageModelId) : undefined
    );

    const imageKey = `generated/${body.sessionId}/${uuidv4()}`;
    const imageUrl = await uploadImageToSupabase(imageBuffer, imageKey);

    console.log("🎨 Dev Image Generation: Success", {
      imageUrl: imageUrl.substring(0, 100) + "...",
    });

    return NextResponse.json({
      success: true,
      imageUrl,
      prompt,
    });
  } catch (error) {
    console.error("🎨 Dev Image Generation: Error", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
