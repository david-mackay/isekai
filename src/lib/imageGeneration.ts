import OpenAI from "openai";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getOpenRouterApiKey, getOpenRouterConfiguration } from "./openrouter";
import { resolveImageModelId } from "./modelOptions";

export async function generateImage(
  prompt: string,
  imageModelId?: string
): Promise<Buffer> {
  const apiKey = getOpenRouterApiKey();
  const config = getOpenRouterConfiguration();
  const model = resolveImageModelId(imageModelId);

  console.log("🖼️  Image Generation: Starting image generation", {
    model,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 100) + "...",
  });

  const openai = new OpenAI({
    apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.defaultHeaders,
  });

  const startTime = Date.now();
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });
  const generationTime = Date.now() - startTime;
  console.log(
    `🖼️  Image Generation: API call completed in ${generationTime}ms`
  );

  const message = completion.choices[0]?.message;
  if (!message) {
    console.error("🖼️  Image Generation: No message in response", {
      completion: JSON.stringify(completion, null, 2),
    });
    throw new Error("No response from image generation API");
  }

  // Log full response structure for debugging
  let contentLength = 0;
  if (typeof message.content === "string") {
    contentLength = message.content.length;
  } else if (
    message.content &&
    typeof message.content === "object" &&
    "length" in message.content
  ) {
    contentLength = (message.content as unknown[]).length;
  }
  console.log("🖼️  Image Generation: Full response structure", {
    messageType: typeof message.content,
    messageContentType: Array.isArray(message.content)
      ? "array"
      : typeof message.content,
    messageContentLength: contentLength,
    fullMessage: JSON.stringify(message, null, 2),
  });

  let imageData: string | null = null;
  let isBase64 = false;

  // Check for images array first (OpenRouter image generation format)
  // Structure: { role: "assistant", content: "", images: [{ type: "image_url", image_url: { url: "data:image/..." } }] }
  if (
    message &&
    typeof message === "object" &&
    "images" in message &&
    Array.isArray((message as { images?: unknown }).images)
  ) {
    const images = (message as { images: unknown[] }).images;
    const imageItem = images.find(
      (img: unknown) =>
        typeof img === "object" &&
        img !== null &&
        "type" in img &&
        (img as { type: string }).type === "image_url" &&
        "image_url" in img
    );
    if (
      imageItem &&
      typeof imageItem === "object" &&
      "image_url" in imageItem &&
      typeof (imageItem as { image_url: unknown }).image_url === "object" &&
      (imageItem as { image_url: { url?: string } }).image_url?.url
    ) {
      const url = (imageItem as { image_url: { url: string } }).image_url.url;
      // Check if it's a base64 data URL
      if (url.startsWith("data:image/")) {
        const base64Match = url.match(
          /data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/
        );
        if (base64Match) {
          imageData = base64Match[1];
          isBase64 = true;
          console.log(
            "🖼️  Image Generation: Found base64 image data in message.images array"
          );
        }
      } else {
        imageData = url;
        isBase64 = false;
        console.log(
          "🖼️  Image Generation: Found image URL in message.images array"
        );
      }
    }
  }

  // Fallback: For image generation models, the response might be in content or in a different format
  // Check if there's an image URL or base64 data in the response
  if (!imageData && typeof message.content === "string") {
    // Check for base64 data URL first
    const base64Match = message.content.match(
      /data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/
    );
    if (base64Match) {
      imageData = base64Match[1];
      isBase64 = true;
      console.log("🖼️  Image Generation: Found base64 image data in content");
    } else {
      // Check for HTTP URL
      const imageUrlMatch = message.content.match(/https?:\/\/[^\s"']+/);
      if (imageUrlMatch) {
        imageData = imageUrlMatch[0];
        isBase64 = false;
      } else {
        // Try to parse as JSON if it's structured
        try {
          const parsed = JSON.parse(message.content);
          if (parsed.url || parsed.image_url) {
            const url = parsed.url || parsed.image_url;
            if (typeof url === "string") {
              imageData = url;
              isBase64 = url.startsWith("data:image/");
            }
          }
        } catch {
          // Not JSON, continue
        }
      }
    }
  }

  // Check for image_url in the response structure (array content)
  if (!imageData && message.content && Array.isArray(message.content)) {
    const imageContent = message.content.find(
      (c: unknown) =>
        typeof c === "object" &&
        c !== null &&
        "type" in c &&
        (c as { type: string }).type === "image_url"
    );
    if (
      imageContent &&
      typeof imageContent === "object" &&
      "image_url" in imageContent &&
      typeof (imageContent as { image_url: unknown }).image_url === "object" &&
      (imageContent as { image_url: { url?: string } }).image_url?.url
    ) {
      const url = (imageContent as { image_url: { url: string } }).image_url
        .url;
      // Check if it's a base64 data URL
      if (url.startsWith("data:image/")) {
        const base64Match = url.match(
          /data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/
        );
        if (base64Match) {
          imageData = base64Match[1];
          isBase64 = true;
          console.log(
            "🖼️  Image Generation: Found base64 image data in image_url"
          );
        }
      } else {
        imageData = url;
        isBase64 = false;
      }
    }
  }

  if (!imageData) {
    console.error(
      "🖼️  Image Generation: Failed to extract image data from response",
      {
        messageContent:
          typeof message.content === "string"
            ? message.content.substring(0, 500) + "..."
            : Array.isArray(message.content)
            ? JSON.stringify(message.content, null, 2).substring(0, 500) + "..."
            : String(message.content).substring(0, 500) + "...",
        fullCompletion:
          JSON.stringify(completion, null, 2).substring(0, 1000) + "...",
      }
    );
    throw new Error("Could not extract image data from response");
  }

  let imageBuffer: Buffer;

  if (isBase64) {
    // Decode base64 data
    console.log("🖼️  Image Generation: Decoding base64 image data...", {
      dataLength: imageData.length,
    });
    const decodeStartTime = Date.now();
    imageBuffer = Buffer.from(imageData, "base64");
    const decodeTime = Date.now() - decodeStartTime;
    const imageSize = imageBuffer.length;
    console.log(
      `🖼️  Image Generation: Decoded base64 image (${(imageSize / 1024).toFixed(
        2
      )}KB) in ${decodeTime}ms`
    );
  } else {
    // Download the image from URL
    console.log("🖼️  Image Generation: Downloading image from URL...", {
      imageUrl: imageData.substring(0, 100) + "...",
    });
    const downloadStartTime = Date.now();
    const response = await fetch(imageData);
    if (!response.ok) {
      console.error("🖼️  Image Generation: Failed to download image", {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(
        `Failed to download generated image: ${response.statusText}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const downloadTime = Date.now() - downloadStartTime;
    const imageSize = arrayBuffer.byteLength;
    console.log(
      `🖼️  Image Generation: Downloaded image (${(imageSize / 1024).toFixed(
        2
      )}KB) in ${downloadTime}ms`
    );
    imageBuffer = Buffer.from(arrayBuffer);
  }

  // Save image locally for debugging (in dev mode)
  if (process.env.NODE_ENV !== "production") {
    try {
      const debugDir = join(process.cwd(), ".debug", "images");
      await mkdir(debugDir, { recursive: true });
      const timestamp = Date.now();
      const filename = `generated-${timestamp}.png`;
      const filepath = join(debugDir, filename);
      await writeFile(filepath, imageBuffer);
      console.log(`🖼️  Image Generation: Saved debug image to ${filepath}`);
    } catch (error) {
      console.warn("🖼️  Image Generation: Failed to save debug image", error);
    }
  }

  return imageBuffer;
}
