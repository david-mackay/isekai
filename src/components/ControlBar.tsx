"use client";
import LoadingDots from "./LoadingDots";

export default function ControlBar({
  input,
  setInput,
  loading,
  onSay,
  onDo,
  onContinue,
  onExamine,
  auto,
  setAuto,
}: {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  onSay: () => void;
  onDo: () => void;
  onContinue: () => void;
  onExamine: () => void;
  auto: boolean;
  setAuto: (v: boolean) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          className="w-full sm:flex-1 border rounded px-3 py-3 bg-transparent text-base"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your action or dialogue..."
          disabled={loading}
        />
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:grid-cols-4 sm:gap-2">
          <button
            className="border rounded px-4 py-3 text-base w-full"
            onClick={onSay}
            disabled={loading}
          >
            {loading ? <LoadingDots /> : "Say"}
          </button>
          <button
            className="border rounded px-4 py-3 text-base w-full"
            onClick={onDo}
            disabled={loading}
          >
            {loading ? <LoadingDots /> : "Do"}
          </button>
          <button
            className="border rounded px-4 py-3 text-base w-full"
            onClick={onExamine}
            disabled={loading}
            title="Examine a target (uses the input as target if provided)"
          >
            Examine
          </button>
          <button
            className="border rounded px-4 py-3 text-base w-full"
            onClick={onContinue}
            disabled={loading}
          >
            {loading ? <LoadingDots /> : "Continue"}
          </button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm opacity-80">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => setAuto(e.target.checked)}
        />
        Auto-continue after DM responses
      </label>
    </div>
  );
}
