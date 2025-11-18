"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import LoadingDots from "./LoadingDots";

type ChatMessage = {
  id?: string;
  role: "dm" | "you";
  content: string;
  imageUrl?: string | null;
};

export default function ChatWindow({
  messages,
  loading,
  onSuggest,
}: {
  messages: ChatMessage[];
  loading: boolean;
  onSuggest?: (text: string) => void;
}) {
  const [animatedText, setAnimatedText] = useState("");
  const [animating, setAnimating] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const last = messages[messages.length - 1];
  const shouldAnimate = last && last.role === "dm";

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      shouldAutoScrollRef.current = nearBottom;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!shouldAnimate || !last) {
      setAnimating(false);
      setAnimatedText("");
      return;
    }
    const content = last.content;
    setAnimating(true);
    setAnimatedText("");
    let i = 0;
    const stride = Math.max(1, Math.floor(content.length / 120));
    let raf = 0;
    const step = () => {
      i += stride;
      setAnimatedText(content.slice(0, i));
      if (i < content.length) raf = requestAnimationFrame(step);
      else setAnimating(false);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [shouldAnimate, last]);

  const rendered = useMemo(() => {
    if (!shouldAnimate) return messages;
    const clone = messages.slice(0, -1);
    const lastMessage = messages[messages.length - 1];
    clone.push({
      role: "dm",
      content: animatedText,
      imageUrl: lastMessage?.imageUrl,
    });
    return clone;
  }, [messages, shouldAnimate, animatedText]);

  useEffect(() => {
    if (!scrollerRef.current) return;
    const el = scrollerRef.current;
    if (!shouldAutoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [rendered, loading, animating]);

  return (
    <div
      ref={scrollerRef}
      className="border rounded p-4 overflow-y-auto bg-white/5"
      style={{ height: "calc(100vh - 280px)" }}
    >
      {rendered.length === 0 ? (
        <p className="opacity-70">Press Continue to begin, or Say/Do to act.</p>
      ) : (
        <div className="space-y-3">
          {rendered.map((m, i) => {
            const isPlayer = m.role === "you";
            const isSystemLike =
              m.role === "dm" &&
              /^\s*(?:【\s*SYSTEM\s*】|\[\s*SYSTEM\s*]|SYSTEM:)/i.test(
                m.content
              );

            const containerClass = isSystemLike
              ? "flex justify-center"
              : isPlayer
              ? "flex justify-end"
              : "flex justify-start";

            const bubbleBase =
              "inline-block rounded-2xl px-3 py-2 max-w-[min(40rem,90%)] shadow-sm";

            const bubbleClass = isSystemLike
              ? `${bubbleBase} bg-indigo-950/80 border border-indigo-500/60 text-indigo-100 font-mono text-xs tracking-wide`
              : isPlayer
              ? `${bubbleBase} bg-emerald-500/10 border border-emerald-400/60 text-emerald-50`
              : `${bubbleBase} bg-slate-900/70 border border-slate-600/70 text-slate-50`;

            const label =
              m.role === "you" ? "You" : isSystemLike ? "SYSTEM" : "DM";

            const labelClass = isSystemLike
              ? "text-indigo-300"
              : isPlayer
              ? "text-emerald-300"
              : "text-slate-400";

            return (
              <div key={m.id || `msg-${i}`} className={containerClass}>
                <div className={bubbleClass}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className={`font-mono text-xs opacity-70 ${labelClass}`}
                    >
                      {label}
                    </span>
                  </div>
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt="Story scene"
                      className="mb-2 w-full max-w-md h-auto object-contain rounded-lg"
                      loading="lazy"
                    />
                  )}
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <span>{children}</span>,
                        img: () => null, // Disable image rendering in markdown since we render images separately
                        strong: ({ children }) => {
                          const text = Array.isArray(children)
                            ? children.join("")
                            : String(children ?? "");
                          const clickable =
                            m.role === "dm" &&
                            !isSystemLike &&
                            onSuggest &&
                            text.length > 0 &&
                            text.length <= 80;
                          return clickable ? (
                            <button
                              type="button"
                              onClick={() => onSuggest?.(text)}
                              className="font-bold text-yellow-300 underline decoration-dotted hover:decoration-solid cursor-pointer"
                              title="Click to use this as your action"
                            >
                              {children}
                            </button>
                          ) : (
                            <strong className="font-bold text-yellow-300">
                              {children}
                            </strong>
                          );
                        },
                        em: ({ children }) => (
                          <em className="italic text-blue-300">{children}</em>
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}
          {(loading || animating) && (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <span className="font-mono text-xs">DM</span>
              <div className="flex items-center gap-1">
                <LoadingDots />
                <span className="text-xs italic">
                  {loading ? "thinking..." : "typing..."}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
