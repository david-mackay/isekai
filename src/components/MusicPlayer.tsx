"use client";
import { useEffect, useRef, useState } from "react";
import type { MusicTheme, Track } from "@/lib/music";

export default function MusicPlayer({
  track,
  theme,
  onThemeChange,
  logs,
}: {
  track?: Track;
  theme?: MusicTheme;
  onThemeChange?: (theme: MusicTheme) => void;
  logs?: string[];
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (theme && onThemeChange) onThemeChange(theme);
  }, [theme, onThemeChange]);

  const [showHud, setShowHud] = useState(true);
  return (
    <div
      className="border rounded overflow-hidden sticky top-3"
      style={{ borderColor: "var(--color-border)" }}
    >
      {track ? (
        <iframe
          ref={iframeRef}
          src={track.url}
          title={track.title}
          className="w-full h-28 md:h-24"
          allow="autoplay"
          allowFullScreen
        />
      ) : (
        <div
          className="h-28 md:h-24 flex items-center justify-center text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          Music is off
        </div>
      )}
      <div
        className="p-2 border-t text-xs"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <div style={{ color: "var(--color-text)" }}>
            <strong>Music HUD</strong> {theme ? `(theme: ${theme})` : ""}
          </div>
          <button
            className="px-2 py-1 border rounded"
            onClick={() => setShowHud((v: boolean) => !v)}
          >
            {showHud ? "Hide" : "Show"}
          </button>
        </div>
        {showHud && (
          <div
            className="mt-2 max-h-28 overflow-auto"
            style={{ color: "var(--color-text-muted)" }}
          >
            {logs && logs.length > 0 ? (
              logs.slice(-10).map((l, i) => (
                <div key={i} className="whitespace-pre-wrap">
                  {l}
                </div>
              ))
            ) : (
              <div>No logs</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
