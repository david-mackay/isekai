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
  isMobile = false,
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
  isMobile?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          className={`w-full sm:flex-1 border rounded bg-transparent ${
            isMobile ? "px-2 py-2 text-sm" : "px-3 py-3 text-base"
          }`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your action or dialogue..."
          disabled={loading}
        />
        <div className={`grid grid-cols-2 w-full sm:w-auto sm:grid-cols-4 ${isMobile ? "gap-1" : "gap-1.5 sm:gap-2"}`}>
          <button
            className={`border rounded w-full ${
              isMobile ? "px-2 py-1.5 text-xs" : "px-4 py-3 text-base"
            }`}
            onClick={onSay}
            disabled={loading}
          >
            {loading ? <LoadingDots /> : "Say"}
          </button>
          <button
            className={`border rounded w-full ${
              isMobile ? "px-2 py-1.5 text-xs" : "px-4 py-3 text-base"
            }`}
            onClick={onDo}
            disabled={loading}
          >
            {loading ? <LoadingDots /> : "Do"}
          </button>
          <button
            className={`border rounded w-full ${
              isMobile ? "px-2 py-1.5 text-xs" : "px-4 py-3 text-base"
            }`}
            onClick={onExamine}
            disabled={loading}
            title="Examine a target (uses the input as target if provided)"
          >
            {isMobile ? "Ex" : "Examine"}
          </button>
          <button
            className={`border rounded w-full ${
              isMobile ? "px-2 py-1.5 text-xs" : "px-4 py-3 text-base"
            }`}
            onClick={onContinue}
            disabled={loading}
          >
            {loading ? <LoadingDots /> : isMobile ? "→" : "Continue"}
          </button>
        </div>
      </div>
      <label className={`flex items-center gap-2 opacity-80 ${isMobile ? "text-xs" : "text-sm"}`}>
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => setAuto(e.target.checked)}
          className={isMobile ? "scale-75" : ""}
        />
        Auto-continue after DM responses
      </label>
    </div>
  );
}
