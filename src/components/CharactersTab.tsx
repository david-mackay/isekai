"use client";
import { useEffect, useMemo, useState } from "react";
import { useRef, useEffect as useEffectReact } from "react";

type ChatMessage = { role: "dm" | "you"; content: string };

type Character = {
  id: string;
  name: string;
  description?: string;
};

export default function CharactersTab({ sessionId }: { sessionId: string }) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === selected),
    [characters, selected]
  );

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/characters?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.characters)) setCharacters(d.characters);
      })
      .catch(() => {});
  }, [sessionId]);

  useEffectReact(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, selected]);

  async function send(kind: "say" | "do" | "continue") {
    if (!selectedCharacter) return;
    const textToSend = input.trim();
    if ((kind === "say" || kind === "do") && !textToSend) return;
    setLoading(true);
    if (kind !== "continue") {
      setMessages((m) => [
        ...m,
        {
          role: "you",
          content: textToSend,
        },
      ]);
    }
    try {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          text: textToSend,
          sessionId,
          targetCharacter: selectedCharacter.name,
        }),
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok || !data.content) throw new Error(data.error || "Failed");
      setMessages((m) => [...m, { role: "dm", content: data.content! }]);
      setInput("");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setMessages((m) => [...m, { role: "dm", content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {characters.length === 0 ? (
          <span className="text-sm opacity-70">
            No characters discovered yet.
          </span>
        ) : (
          characters.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelected(c.id);
                setMessages([]);
              }}
              className={`px-3 py-2 text-sm rounded border ${
                selected === c.id ? "bg-white/10" : "bg-transparent"
              }`}
            >
              {c.name}
            </button>
          ))
        )}
      </div>

      {selectedCharacter ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <div
              ref={scrollerRef}
              className="border rounded p-4 h-[70vh] md:h-[60vh] overflow-y-auto bg-white/5"
            >
              {messages.length === 0 ? (
                <p className="opacity-70">
                  Start texting {selectedCharacter.name}…
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        m.role === "you" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`${
                          m.role === "you"
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-700 text-white"
                        } px-3 py-2 rounded-2xl max-w-[75%] whitespace-pre-wrap break-words`}
                        style={{
                          borderTopLeftRadius: m.role === "you" ? 16 : 4,
                          borderTopRightRadius: m.role === "you" ? 4 : 16,
                        }}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-700 text-white px-3 py-2 rounded-2xl">
                        Typing…
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-1 space-y-2">
            <div className="border rounded p-3 text-sm opacity-80 min-h-[120px]">
              <div className="font-semibold mb-1">{selectedCharacter.name}</div>
              <p>{selectedCharacter.description || "An NPC in your story."}</p>
            </div>
            <div className="sticky bottom-0 bg-[var(--color-background)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/60 p-2 border rounded">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 px-2 py-2 bg-transparent border rounded"
                  placeholder={`Message ${selectedCharacter.name}…`}
                />
                <button
                  onClick={() => send("say")}
                  disabled={loading || !input.trim()}
                  className="px-3 py-2 border rounded"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm opacity-70">
          Select a character to start a private chat.
        </div>
      )}
    </div>
  );
}
