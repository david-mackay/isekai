export type ModelOption = {
  id: string;
  label: string;
  description?: string;
};

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "deepseek/deepseek-chat-v3-0324",
    label: "DeepSeek Chat V3 0324",
    description: "DeepSeek's latest model (RolePlay #1)",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Google's Gemini 2.5 Pro (Premium)",
  },
  {
    id: "mistralai/mistral-nemo",
    label: "Mistral Nemo",
    description: "Roleplay Cheapest Model",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Google's Gemini 2.5 Flash (Moderate)",
  },
  {
    id: "openrouter/sherlock-think-alpha",
    label: "Sherlock Think Alpha",
    description: "OpenRouter's Sherlock Think Alpha (Free)",
  },
  {
    id: "x-ai/grok-4-fast",
    label: "Grok 4 Fast",
    description: "X.ai's fast Grok 4 model",
  },
];

export const DEFAULT_MODEL_ID = "openrouter/sherlock-think-alpha";

export const IMAGE_MODEL_OPTIONS: ModelOption[] = [
  {
    id: "openai/gpt-5-image-mini",
    label: "GPT-5 Image Mini",
    description: "OpenAI's GPT-5 Image Mini (Default)",
  },
  {
    id: "google/gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    description: "Google's Gemini 2.5 Flash Image (Default)",
  },
];

export const DEFAULT_IMAGE_MODEL_ID = "google/gemini-2.5-flash-image";

export function resolveModelId(candidate?: string): string {
  if (!candidate) return DEFAULT_MODEL_ID;
  return MODEL_OPTIONS.some((option) => option.id === candidate)
    ? candidate
    : DEFAULT_MODEL_ID;
}

export function resolveImageModelId(candidate?: string): string {
  if (!candidate) return DEFAULT_IMAGE_MODEL_ID;
  return IMAGE_MODEL_OPTIONS.some((option) => option.id === candidate)
    ? candidate
    : DEFAULT_IMAGE_MODEL_ID;
}
