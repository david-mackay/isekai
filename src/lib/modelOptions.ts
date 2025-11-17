export type ModelOption = {
  id: string;
  label: string;
  description?: string;
};

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    description: "Flagship OpenAI model via OpenRouter",
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    description: "Faster, lower-cost GPT-4o variant",
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    description: "Anthropic's balanced reasoning model",
  },
  {
    id: "google/gemini-2.0-pro-exp",
    label: "Gemini 2.0 Pro",
    description: "Google's experimental Gemini 2.0 Pro",
  },
  {
    id: "x-ai/grok-4-fast",
    label: "Grok 4 Fast",
    description: "X.ai's fast Grok 4 model",
  },
];

export const DEFAULT_MODEL_ID = "x-ai/grok-4-fast";

export function resolveModelId(candidate?: string): string {
  if (!candidate) return DEFAULT_MODEL_ID;
  return MODEL_OPTIONS.some((option) => option.id === candidate)
    ? candidate
    : DEFAULT_MODEL_ID;
}
