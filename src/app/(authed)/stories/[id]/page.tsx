"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

import ChatWindow from "@/components/ChatWindow";
import ControlBar from "@/components/ControlBar";
import StorySidebar, { StoryListItem } from "@/components/StorySidebar";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import CharacterSheet from "@/components/CharacterSheet";
import SocialFeed from "@/components/SocialFeed";
import CharactersTab from "@/components/CharactersTab";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { useDevSettings } from "@/contexts/DevSettingsContext";
import { StorySummary } from "@/types/story";

const LAST_STORY_KEY = "isekai:lastStoryId";
const CONTEXT_WARNING_CHARS = 8000;
const CONTEXT_CRITICAL_CHARS = 14000;
const MAX_VISIBLE_MESSAGES = 10;

type ChatMessage = { id?: string; role: "dm" | "you"; content: string };

const clampMessages = (list: ChatMessage[]): ChatMessage[] =>
  list.length > MAX_VISIBLE_MESSAGES
    ? list.slice(list.length - MAX_VISIBLE_MESSAGES)
    : list;

function mapStoriesToListItems(
  stories: StorySummary[],
  beginnings: Record<string, string>
): StoryListItem[] {
  return stories
    .slice()
    .sort(
      (a, b) =>
        new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime()
    )
    .map((story) => ({
      id: story.id,
      title: story.title,
      beginningLabel:
        (story.beginningKey && beginnings[story.beginningKey]) ||
        story.beginningKey ||
        "Custom Adventure",
      createdAt: story.createdAt,
      lastPlayedAt: story.lastPlayedAt,
      messageCount: story.messageCount,
    }));
}

export default function StoryChatPage() {
  const params = useParams<{ id: string }>();
  const storyId = params?.id;
  const router = useRouter();

  const walletAuth = useWalletAuth();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { modelId } = useDevSettings();

  const [stories, setStories] = useState<StorySummary[]>([]);
  const [storyBeginnings, setStoryBeginnings] = useState<
    Record<string, string>
  >({});
  const [storiesLoading, setStoriesLoading] = useState(false);

  const [currentStory, setCurrentStory] = useState<StorySummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "social" | "characters">(
    "chat"
  );
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(false);

  const storyItems = useMemo(
    () => mapStoriesToListItems(stories, storyBeginnings),
    [stories, storyBeginnings]
  );

  const contextChars = useMemo(
    () =>
      messages.reduce(
        (total, message) => total + (message.content?.length ?? 0),
        0
      ),
    [messages]
  );
  const contextIndicatorClass =
    contextChars >= CONTEXT_CRITICAL_CHARS
      ? "text-red-400"
      : contextChars >= CONTEXT_WARNING_CHARS
      ? "text-amber-400"
      : "opacity-60";
  const contextLabel =
    contextChars >= 1000
      ? `${(contextChars / 1000).toFixed(1)}k`
      : `${contextChars}`;

  useEffect(() => {
    const detect = () =>
      setIsMobile(typeof window !== "undefined" && window.innerWidth <= 480);
    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem("isekai:devAuth");
      setIsDevAuthenticated(stored === "true");
    }
  }, []);

  useEffect(() => {
    if (!optionsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-options-menu]')) {
        setOptionsMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [optionsMenuOpen]);

  const handleOptionsClick = async () => {
    if (!isDevAuthenticated) {
      const password = prompt("Enter dev password to access options:");
      if (!password) return;
      try {
        const res = await fetch("/api/dev/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = (await res.json()) as { success?: boolean };
        if (res.ok && data.success) {
          setIsDevAuthenticated(true);
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem("isekai:devAuth", "true");
          }
          setOptionsMenuOpen(true);
        } else {
          alert("Invalid password");
        }
      } catch {
        alert("Failed to verify password");
      }
    } else {
      setOptionsMenuOpen(!optionsMenuOpen);
    }
  };

  const fetchStories = useCallback(async () => {
    if (walletAuth.status !== "authenticated") {
      setStories([]);
      return;
    }
    setStoriesLoading(true);
    try {
      const res = await fetch("/api/stories", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load stories (${res.status})`);
      }
      const data = (await res.json()) as { stories: StorySummary[] };
      setStories(Array.isArray(data.stories) ? data.stories : []);
    } catch (err) {
      console.error("Unable to load stories", err);
      setStories([]);
    } finally {
      setStoriesLoading(false);
    }
  }, [walletAuth.status]);

  useEffect(() => {
    fetch("/api/init")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.beginnings)) {
          const mapped = Object.fromEntries(
            data.beginnings.map((b: { key: string; title: string }) => [
              b.key,
              b.title,
            ])
          );
          setStoryBeginnings(mapped);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  useEffect(() => {
    if (walletAuth.status === "authenticated") {
      void fetchStories();
    }
  }, [walletAuth.status, fetchStories]);

  const loadStoryMessages = useCallback(async (id: string, limit = 10) => {
    try {
      const query = limit && Number.isFinite(limit) ? `?limit=${limit}` : "";
      const res = await fetch(`/api/stories/${id}/messages${query}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load messages (${res.status})`);
      }
      const data = (await res.json()) as {
        messages: { id: string; role: "dm" | "you"; content: string }[];
      };
      const formatted = data.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
      }));
      setMessages(clampMessages(formatted));
    } catch (error) {
      console.error("Unable to load story messages", error);
      setMessages([]);
    }
  }, []);

  const loadStoryDetails = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/stories/${id}`, { cache: "no-store" });
        if (res.status === 404) {
          router.replace("/stories");
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to load story (${res.status})`);
        }
        const data = (await res.json()) as { story: StorySummary };
        setCurrentStory(data.story);
        localStorage.setItem(LAST_STORY_KEY, data.story.id);
        await loadStoryMessages(data.story.id);
      } catch (error) {
        console.error("Failed to load story details", error);
        router.replace("/stories");
      }
    },
    [loadStoryMessages, router]
  );

  useEffect(() => {
    if (walletAuth.status !== "authenticated") {
      return;
    }
    if (!storyId) {
      router.replace("/stories");
      return;
    }
    setActiveTab("chat");
    void loadStoryDetails(storyId);
  }, [walletAuth.status, storyId, loadStoryDetails, router]);

  const handleStorySelect = useCallback(
    (id: string) => {
      router.push(`/stories/${id}`);
    },
    [router]
  );

  const handleDeleteStory = useCallback(
    async (id: string) => {
      if (!confirm("Delete this story? This cannot be undone.")) return;
      try {
        const res = await fetch(`/api/stories/${id}`, { method: "DELETE" });
        if (!res.ok) {
          throw new Error(`Failed to delete story (${res.status})`);
        }
        if (id === storyId) {
          router.push("/stories");
        } else {
          setStories((prev) => prev.filter((story) => story.id !== id));
        }
        const lastStored = localStorage.getItem(LAST_STORY_KEY);
        if (lastStored === id) {
          localStorage.removeItem(LAST_STORY_KEY);
        }
      } catch (err) {
        alert(
          err instanceof Error
            ? err.message
            : "Failed to delete the story. Please try again."
        );
      }
    },
    [storyId, router]
  );

  const handleNewStory = useCallback(() => {
    router.push("/stories/new");
  }, [router]);

  const handleSummarizeNow = useCallback(async () => {
    if (!storyId) return;
    setSummarizing(true);
    try {
      const res = await fetch("/api/story/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: storyId, model: modelId }),
      });
      const data = (await res.json()) as { summary?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to summarize story");
      }
      await loadStoryMessages(storyId);
      await fetchStories();
    } catch (error) {
      console.error("Failed to summarize story", error);
    } finally {
      setSummarizing(false);
    }
  }, [storyId, modelId, loadStoryMessages, fetchStories]);

  const send = useCallback(
    async (kind: "do" | "say" | "continue", overrideText?: string) => {
      if (!storyId) return;
      const textToSend = overrideText ?? input;
      if ((kind === "do" || kind === "say") && !textToSend.trim()) return;

      setLoading(true);
      if (kind !== "continue") {
        setMessages((prev) =>
          clampMessages([
            ...prev,
            {
              role: "you",
              content:
                kind === "say"
                  ? `You say: "${textToSend}` + `"`
                  : `You do: ${textToSend}`,
            },
          ])
        );
      }
      try {
        const res = await fetch("/api/dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            text: textToSend,
            sessionId: storyId,
            model: modelId,
          }),
        });
        const data = (await res.json()) as {
          content?: string;
          error?: string;
        };
        if (!res.ok || !data.content) {
          throw new Error(data.error || "Request failed");
        }
        setMessages((prev) =>
          clampMessages([...prev, { role: "dm", content: data.content! }])
        );
        setInput("");
        setStories((prev) =>
          prev.map((story) =>
            story.id === storyId
              ? {
                  ...story,
                  lastPlayedAt: new Date().toISOString(),
                  messageCount:
                    story.messageCount + (kind === "continue" ? 1 : 2),
                }
              : story
          )
        );
      } catch (error) {
        console.error("Failed to send action", error);
        setMessages((prev) =>
          clampMessages([
            ...prev,
            {
              role: "dm",
              content: `Error: ${
                error instanceof Error ? error.message : "Unknown"
              }`,
            },
          ])
        );
      } finally {
        setLoading(false);
      }
    },
    [storyId, input, modelId]
  );

  const sendExamine = useCallback(() => {
    if (!storyId) return;
    const target = input.trim() || "the current scene";
    setInput("");
    void send("do", `examine ${target}`);
  }, [send, input, storyId]);

  useEffect(() => {
    if (!storyId) return;
    if (!loading && auto && messages[messages.length - 1]?.role === "dm") {
      const timer = setTimeout(() => {
        void send("continue");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [messages, loading, auto, send, storyId]);

  if (
    walletAuth.status === "checking" ||
    walletAuth.status === "authenticating"
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center text-sm text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin"></div>
          <p>Preparing your gateway to Eirath…</p>
        </div>
      </div>
    );
  }

  if (walletAuth.status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full border border-gray-700 bg-gray-900/60 p-8 rounded-lg text-center space-y-4">
          <h1 className="text-xl font-semibold">Connect Your Wallet</h1>
          <p className="text-sm text-gray-400">
            Link your Solana wallet to continue your adventure.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => open()}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
            >
              {isConnected ? "Select a different wallet" : "Connect Wallet"}
            </button>
            {isConnected && (
              <button
                onClick={() => walletAuth.authenticate()}
                className="w-full px-4 py-2 border border-blue-500 rounded text-sm font-medium"
              >
                Sign In with Wallet
              </button>
            )}
          </div>
          {walletAuth.error && (
            <p className="text-xs text-red-400">{walletAuth.error}</p>
          )}
        </div>
      </div>
    );
  }

  if (!storyId || !currentStory) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-gray-400">
          We couldn’t find that story. It may have been deleted or you may not
          have access to it.
        </p>
        <button
          onClick={() => router.push("/stories")}
          className="px-4 py-2 border rounded text-sm"
        >
          Return to Stories
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex"
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-text)",
      }}
    >
      <div className="hidden md:block">
        <StorySidebar
          stories={storyItems}
          loading={storiesLoading}
          currentStoryId={storyId}
          onStorySelect={handleStorySelect}
          onDeleteStory={handleDeleteStory}
        />
      </div>
      <button
        className="md:hidden fixed top-3 left-3 z-40 px-3 py-2 border rounded"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Open stories"
      >
        Stories
      </button>
      <StorySidebar
        isOverlay
        visible={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        stories={storyItems}
        loading={storiesLoading}
        currentStoryId={storyId}
        onStorySelect={handleStorySelect}
        onDeleteStory={handleDeleteStory}
      />

      <div className="flex-1 flex flex-col">
        <header className="p-4 md:p-6 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold truncate">
              {currentStory.title}
            </h1>
            {currentStory.characterName && (
              <p className="text-xs md:text-sm text-gray-400">
                Playing as {currentStory.characterName}
              </p>
            )}
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <span
              className={`text-xs md:text-sm font-mono ${contextIndicatorClass}`}
            >
              Context {contextLabel} chars
            </span>
            <button
              onClick={handleSummarizeNow}
              disabled={summarizing}
              className="px-2 md:px-3 py-2 border rounded text-xs md:text-sm"
            >
              {summarizing ? "Summarizing..." : "Summarize Now"}
            </button>
            <button
              onClick={handleNewStory}
              className="px-2 md:px-3 py-2 border rounded text-xs md:text-sm"
            >
              New Story
            </button>
            {address && (
              <span className="hidden md:inline text-xs text-gray-400 font-mono">
                {address.slice(0, 4)}…{address.slice(-4)}
              </span>
            )}
            <ThemeSwitcher />
          </div>
        </header>

        <div className="px-2 md:px-6 pt-2 border-b flex items-center justify-between relative">
          <div className="flex gap-2">
            <button
              className={`px-3 py-2 text-sm rounded border ${
                activeTab === "chat" ? "bg-white/10" : "bg-transparent"
              }`}
              onClick={() => setActiveTab("chat")}
            >
              Chat
            </button>
            {isDevAuthenticated && (
              <>
                <button
                  className={`px-3 py-2 text-sm rounded border ${
                    activeTab === "social" ? "bg-white/10" : "bg-transparent"
                  }`}
                  onClick={() => setActiveTab("social")}
                >
                  Social
                </button>
                <button
                  className={`px-3 py-2 text-sm rounded border ${
                    activeTab === "characters" ? "bg-white/10" : "bg-transparent"
                  }`}
                  onClick={() => setActiveTab("characters")}
                >
                  Characters
                </button>
              </>
            )}
          </div>
          <div className="relative" data-options-menu>
            {!isDevAuthenticated && (
              <button
                className="px-2 py-1.5 text-xs rounded border opacity-60 hover:opacity-100"
                onClick={handleOptionsClick}
                title="Dev options"
              >
                ⋯
              </button>
            )}
            {isDevAuthenticated && (
              <button
                className="px-2 py-1.5 text-xs rounded border opacity-60 hover:opacity-100"
                onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
                title="Options"
              >
                ⋯
              </button>
            )}
            {isDevAuthenticated && optionsMenuOpen && (
              <div className="absolute right-0 top-8 bg-[var(--color-surface)] border rounded shadow-lg p-2 z-50 min-w-[120px]">
                <button
                  className={`w-full px-3 py-2 text-sm rounded border mb-1 ${
                    activeTab === "social" ? "bg-white/10" : "bg-transparent"
                  }`}
                  onClick={() => {
                    setActiveTab("social");
                    setOptionsMenuOpen(false);
                  }}
                >
                  Social
                </button>
                <button
                  className={`w-full px-3 py-2 text-sm rounded border ${
                    activeTab === "characters" ? "bg-white/10" : "bg-transparent"
                  }`}
                  onClick={() => {
                    setActiveTab("characters");
                    setOptionsMenuOpen(false);
                  }}
                >
                  Characters
                </button>
              </div>
            )}
          </div>
        </div>

        <main className="flex-1 p-2 md:p-6 flex flex-col">
          {activeTab === "chat" ? (
            <>
              <div className={`grid grid-cols-1 ${isMobile ? "" : "lg:grid-cols-4"} gap-4 flex-1`}>
                <div
                  className={`${
                    isMobile ? "order-1" : "order-2 lg:order-1"
                  } ${isMobile ? "" : "lg:col-span-3"} w-full`}
                >
                  <ChatWindow
                    messages={messages}
                    loading={loading}
                    onSuggest={(text) => setInput(text)}
                  />
                </div>
                {!isMobile && (
                  <div
                    className="order-1 lg:order-2 lg:col-span-1 w-full"
                  >
                    <CharacterSheet sessionId={storyId} />
                  </div>
                )}
              </div>
              <div className="mt-2 sticky bottom-0 bg-[var(--color-background)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/60 p-2">
                <ControlBar
                  input={input}
                  setInput={setInput}
                  loading={loading}
                  onSay={() => send("say")}
                  onDo={() => send("do")}
                  onContinue={() => send("continue")}
                  onExamine={sendExamine}
                  auto={auto}
                  setAuto={setAuto}
                  isMobile={isMobile}
                />
              </div>
            </>
          ) : activeTab === "social" ? (
            <div className="py-4">
              <SocialFeed sessionId={storyId} />
            </div>
          ) : (
            <div className="py-4">
              <CharactersTab sessionId={storyId} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
