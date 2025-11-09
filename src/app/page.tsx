"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

import ChatWindow from "@/components/ChatWindow";
import ControlBar from "@/components/ControlBar";
import StorySidebar, { StoryListItem } from "@/components/StorySidebar";
import CharacterCreation, {
  CharacterData,
} from "@/components/CharacterCreation";
import StartPanel from "@/components/StartPanel";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import MusicPlayer from "@/components/MusicPlayer";
import SocialFeed from "@/components/SocialFeed";
import CharactersTab from "@/components/CharactersTab";
import { useWalletAuth } from "@/hooks/useWalletAuth";

type ChatMessage = { id?: string; role: "dm" | "you"; content: string };

type StorySummary = {
  id: string;
  title: string;
  beginningKey: string | null;
  worldKey: string | null;
  characterName: string | null;
  characterGender: string | null;
  characterRace: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastPlayedAt: string;
};

type BeginningOption = { key: string; title: string; description: string };

const LAST_STORY_KEY = "isekai:lastStoryId";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(false);
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [isSeeded, setIsSeeded] = useState(false);
  const [isLoadingFirstStory, setIsLoadingFirstStory] = useState(false);
  const [playerCharacter, setPlayerCharacter] = useState<CharacterData | null>(
    null
  );
  const [pendingBeginning, setPendingBeginning] = useState<
    { key: string; title: string } | null
  >(null);
  const [musicTheme, setMusicTheme] = useState<
    import("@/lib/music").MusicTheme | undefined
  >(undefined);
  const [track, setTrack] = useState<import("@/lib/music").Track | undefined>();
  const [musicLogs, setMusicLogs] = useState<string[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [worlds, setWorlds] = useState<{ key: string; title: string }[]>([
    { key: "eirath", title: "Eirath" },
  ]);
  const [worldKey, setWorldKey] = useState("eirath");
  const [beginnings, setBeginnings] = useState<BeginningOption[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "social" | "characters">(
    "chat"
  );

  const walletAuth = useWalletAuth();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  const activeStory = useMemo(
    () => stories.find((story) => story.id === activeStoryId) ?? null,
    [stories, activeStoryId]
  );

  const storyListItems = useMemo<StoryListItem[]>(
    () =>
      stories.map((story) => ({
        id: story.id,
        title: story.title,
        beginningLabel:
          beginnings.find((b) => b.key === story.beginningKey)?.title ||
          story.beginningKey ||
          "Custom Adventure",
        createdAt: story.createdAt,
        lastPlayedAt: story.lastPlayedAt,
        messageCount: story.messageCount,
      })),
    [stories, beginnings]
  );

  useEffect(() => {
    const detect = () =>
      setIsMobile(typeof window !== "undefined" && window.innerWidth <= 480);
    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);

  useEffect(() => {
    fetch("/api/init")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.worlds) && data.worlds.length > 0) {
          setWorlds(data.worlds);
          setWorldKey((prev) => prev || data.worlds[0].key);
        }
        if (Array.isArray(data.beginnings)) {
          setBeginnings(data.beginnings);
        }
      })
      .catch((err) => {
        console.warn("Failed to load worlds/beginnings", err);
      });
  }, []);

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
      setStories(data.stories || []);
    } catch (error) {
      console.error("Unable to fetch stories", error);
      setStories([]);
    } finally {
      setStoriesLoading(false);
    }
  }, [walletAuth.status]);

  useEffect(() => {
    if (walletAuth.status === "authenticated") {
      void fetchStories();
    }
  }, [walletAuth.status, fetchStories]);

  const loadStoryMessages = useCallback(async (storyId: string) => {
    try {
      const res = await fetch(`/api/stories/${storyId}/messages`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load messages (${res.status})`);
      }
      const data = (await res.json()) as {
        messages: { id: string; role: "dm" | "you"; content: string }[];
      };
      const formatted: ChatMessage[] = data.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
      }));
      setMessages(formatted);
    } catch (error) {
      console.error("Unable to load story messages", error);
      setMessages([]);
    }
  }, []);

  const selectStory = useCallback(
    async (storyId: string) => {
      if (!storyId) return;
      try {
        const res = await fetch(`/api/stories/${storyId}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load story (${res.status})`);
        }
        const data = (await res.json()) as { story: StorySummary };
        const story = data.story;
        setActiveStoryId(story.id);
        setIsSeeded(true);
        setPlayerCharacter((prev) =>
          story.characterName
            ? {
                name: story.characterName,
                gender: story.characterGender || prev?.gender || "",
                race: story.characterRace || prev?.race || "",
              }
            : prev
        );
        setActiveTab("chat");
        setMusicLogs([]);
        setMusicTheme(undefined);
        setTrack(undefined);
        localStorage?.setItem(LAST_STORY_KEY, story.id);
        await loadStoryMessages(story.id);
      } catch (error) {
        console.error("Failed to select story", error);
      }
    },
    [loadStoryMessages]
  );

  useEffect(() => {
    if (walletAuth.status !== "authenticated" || stories.length === 0) {
      return;
    }
    if (activeStoryId) return;

    const lastId = localStorage.getItem(LAST_STORY_KEY);
    const candidate = stories.find((story) => story.id === lastId)?.id || stories[0].id;
    if (candidate) {
      void selectStory(candidate);
    }
  }, [walletAuth.status, stories, activeStoryId, selectStory]);

  const handleStorySelect = useCallback(
    async (storyId: string) => {
      await selectStory(storyId);
    },
    [selectStory]
  );

  const handleDeleteStory = useCallback(
    async (storyId: string) => {
      try {
        const res = await fetch(`/api/stories/${storyId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Failed to delete story (${res.status})`);
        setStories((prev) => prev.filter((story) => story.id !== storyId));
        if (activeStoryId === storyId) {
          setActiveStoryId(null);
          setIsSeeded(false);
          setMessages([]);
          setPlayerCharacter(null);
          localStorage.removeItem(LAST_STORY_KEY);
        }
      } catch (error) {
        console.error("Failed to delete story", error);
      }
    },
    [activeStoryId]
  );

  const handleNewStory = useCallback(() => {
    setActiveStoryId(null);
    setIsSeeded(false);
    setMessages([]);
    setPlayerCharacter(null);
    setPendingBeginning(null);
    setActiveTab("chat");
    setMusicLogs([]);
    setMusicTheme(undefined);
    setTrack(undefined);
    localStorage.removeItem(LAST_STORY_KEY);
  }, []);

  const seedStory = useCallback(
    async (beginningKey: string, beginningTitle: string) => {
      if (!playerCharacter) {
        setPendingBeginning({ key: beginningKey, title: beginningTitle });
        throw new Error("Player character not defined");
      }

      setIsLoadingFirstStory(true);
      let createdStory: StorySummary | null = null;

      try {
        const createRes = await fetch("/api/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: playerCharacter.name
              ? `${beginningTitle} - ${playerCharacter.name}`
              : beginningTitle,
            beginningKey,
            worldKey,
            characterName: playerCharacter.name,
            characterGender: playerCharacter.gender,
            characterRace: playerCharacter.race,
          }),
        });

        if (!createRes.ok) {
          const errorBody = await createRes.json().catch(() => ({}));
          throw new Error(errorBody.error || "Failed to create story");
        }

        const { story } = (await createRes.json()) as { story: StorySummary };
        createdStory = story;

        setStories((prev) => [story, ...prev.filter((s) => s.id !== story.id)]);
        setActiveStoryId(story.id);
        setIsSeeded(false);
        setActiveTab("chat");
        localStorage.setItem(LAST_STORY_KEY, story.id);

        const initRes = await fetch("/api/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: beginningKey,
            sessionId: story.id,
            playerCharacter,
            worldKey,
          }),
        });
        if (!initRes.ok) {
          const initErr = await initRes.json().catch(() => ({}));
          throw new Error(initErr.error || "Failed to seed beginning");
        }

        const dmRes = await fetch("/api/dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "continue", sessionId: story.id }),
        });
        const dmData = (await dmRes.json()) as { content?: string; error?: string };
        if (!dmRes.ok || !dmData.content) {
          throw new Error(dmData.error || "Failed to generate opening scene");
        }

        setMessages([{ role: "dm", content: dmData.content }]);
        setIsSeeded(true);
        setMusicLogs([]);
        setMusicTheme(undefined);
        setTrack(undefined);
        await fetchStories();

        try {
          setMusicLogs((logs) => [
            ...logs,
            `fetching /api/music (currentTheme=${musicTheme ?? "none"})`,
          ]);
          const musicRes = await fetch("/api/music", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: dmData.content,
              currentTheme: musicTheme,
              sessionId: story.id,
            }),
          });
          const musicData = (await musicRes.json()) as {
            should_change?: boolean;
            theme?: import("@/lib/music").MusicTheme;
            track?: import("@/lib/music").Track;
          };
          if (
            musicRes.ok &&
            musicData.should_change &&
            musicData.theme &&
            musicData.track
          ) {
            setMusicTheme(musicData.theme);
            setTrack(musicData.track);
            setMusicLogs((logs) => [
              ...logs,
              `switch ? theme=${musicData.theme} | track=${
                musicData.track?.title ?? "unknown"
              }`,
            ]);
          } else if (musicRes.ok) {
            setMusicLogs((logs) => [
              ...logs,
              `no switch (theme=${musicData.theme ?? musicTheme ?? "unknown"})`,
            ]);
          } else {
            setMusicLogs((logs) => [
              ...logs,
              `error: ${musicRes.status} ${musicRes.statusText}`,
            ]);
          }
        } catch (error) {
          console.warn("Music suggestion failed", error);
        }
      } catch (error) {
        if (createdStory) {
          setStories((prev) =>
            prev.filter((story) => story.id !== createdStory!.id)
          );
          setActiveStoryId(null);
          setIsSeeded(false);
          setMessages([]);
          setMusicLogs([]);
          setMusicTheme(undefined);
          setTrack(undefined);
          localStorage.removeItem(LAST_STORY_KEY);
          try {
            await fetch(`/api/stories/${createdStory.id}`, { method: "DELETE" });
          } catch (cleanupError) {
            console.warn(
              "Failed to rollback story after seeding error",
              cleanupError
            );
          }
        }
        throw error;
      } finally {
        setIsLoadingFirstStory(false);
        setPendingBeginning(null);
      }
    },
    [playerCharacter, worldKey, fetchStories, musicTheme]
  );

  const handleCharacterComplete = useCallback(
    (characterData: CharacterData) => {
      setPlayerCharacter(characterData);
      if (pendingBeginning) {
        void seedStory(pendingBeginning.key, pendingBeginning.title);
      }
    },
    [pendingBeginning, seedStory]
  );

  const handleSeedRequest = useCallback(
    async (beginningKey: string, beginningTitle: string) => {
      await seedStory(beginningKey, beginningTitle);
    },
    [seedStory]
  );

  const send = useCallback(
    async (kind: "do" | "say" | "continue", overrideText?: string) => {
      const storyId = activeStoryId;
      if (!storyId) return;
      const textToSend = overrideText ?? input;
      if ((kind === "do" || kind === "say") && !textToSend.trim()) return;

      setLoading(true);
      if (kind !== "continue") {
        setMessages((messages) => [
          ...messages,
          {
            role: "you",
            content:
              kind === "say"
                ? `You say: "${textToSend}` + `"`
                : `You do: ${textToSend}`,
          },
        ]);
      }

      try {
        const dmRes = await fetch("/api/dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, text: textToSend, sessionId: storyId }),
        });
        const dmData = (await dmRes.json()) as {
          content?: string;
          error?: string;
        };
        if (!dmRes.ok || !dmData.content) {
          throw new Error(dmData.error || "Request failed");
        }
        setMessages((messages) => [...messages, { role: "dm", content: dmData.content! }]);
        setInput("");
        setStories((prev) =>
          prev.map((story) =>
            story.id === storyId
              ? {
                  ...story,
                  lastPlayedAt: new Date().toISOString(),
                  messageCount: story.messageCount + (kind === "continue" ? 1 : 2),
                }
              : story
          )
        );

        try {
          setMusicLogs((logs) => [
            ...logs,
            `fetching /api/music (currentTheme=${musicTheme ?? "none"})`,
          ]);
          const musicRes = await fetch("/api/music", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: dmData.content,
              currentTheme: musicTheme,
              sessionId: storyId,
            }),
          });
          const musicData = (await musicRes.json()) as {
            should_change?: boolean;
            theme?: import("@/lib/music").MusicTheme;
            track?: import("@/lib/music").Track;
          };
          if (
            musicRes.ok &&
            musicData.should_change &&
            musicData.theme &&
            musicData.track
          ) {
            setMusicTheme(musicData.theme);
            setTrack(musicData.track);
            setMusicLogs((logs) => [
              ...logs,
              `switch ? theme=${musicData.theme} | track=${
                musicData.track?.title ?? "unknown"
              }`,
            ]);
          } else if (musicRes.ok) {
            setMusicLogs((logs) => [
              ...logs,
              `no switch (theme=${
                musicData.theme ?? musicTheme ?? "unknown"
              })`,
            ]);
          } else {
            setMusicLogs((logs) => [
              ...logs,
              `error: ${musicRes.status} ${musicRes.statusText}`,
            ]);
          }
        } catch (error) {
          console.warn("Music suggestion failed", error);
        }
      } catch (error) {
        console.error("Failed to send action", error);
        setMessages((messages) => [
          ...messages,
          { role: "dm", content: `Error: ${error instanceof Error ? error.message : "Unknown"}` },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [activeStoryId, input, musicTheme]
  );

  const sendExamine = useCallback(() => {
    const storyId = activeStoryId;
    if (!storyId) return;
    const target = input.trim() || "the current scene";
    setInput("");
    void send("do", `examine ${target}`);
  }, [send, input, activeStoryId]);

  useEffect(() => {
    if (!activeStoryId) return;
    if (!loading && auto && messages[messages.length - 1]?.role === "dm") {
      const timer = setTimeout(() => {
        void send("continue");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [messages, loading, auto, send, activeStoryId]);

  const isCreatingStory = !isSeeded;

  if (walletAuth.status === "checking" || walletAuth.status === "authenticating") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center text-sm text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin"></div>
          <p>Preparing your gateway to Eirath?</p>
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
            Link your Solana wallet to continue your adventure and unlock persistent stories across devices.
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

  if (isCreatingStory) {
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
            stories={storyListItems}
            loading={storiesLoading}
            currentStoryId={activeStoryId || undefined}
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
          stories={storyListItems}
          loading={storiesLoading}
          currentStoryId={activeStoryId || undefined}
          onStorySelect={handleStorySelect}
          onDeleteStory={handleDeleteStory}
        />
        <div className="flex-1 flex items-start justify-center px-3 md:px-0">
          <div className="w-full max-w-xl space-y-6 py-10">
            {!playerCharacter ? (
              <CharacterCreation onComplete={handleCharacterComplete} />
            ) : (
              <StartPanel
                character={playerCharacter}
                onCharacterRequest={() => setPlayerCharacter(null)}
                onCharacterComplete={handleCharacterComplete}
                onSeeded={handleSeedRequest}
                isLoadingStory={isLoadingFirstStory}
                availableWorlds={worlds}
                worldKey={worldKey}
                onWorldChange={setWorldKey}
              />
            )}
          </div>
        </div>
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
          stories={storyListItems}
          loading={storiesLoading}
          currentStoryId={activeStoryId || undefined}
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
        stories={storyListItems}
        loading={storiesLoading}
        currentStoryId={activeStoryId || undefined}
        onStorySelect={handleStorySelect}
        onDeleteStory={handleDeleteStory}
      />

      <div className="flex-1 flex flex-col">
        <div
          className="p-4 md:p-6 border-b flex items-center justify-between"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-4 ml-16 md:ml-0">
            <h1 className="hidden md:block text-xl md:text-2xl font-semibold">
              AI Dungeon Master
            </h1>
            {activeStory && playerCharacter?.name && (
              <p
                className="text-xs md:text-sm mt-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                Playing as {playerCharacter.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={handleNewStory}
              className="px-2 md:px-3 py-2 border rounded text-xs md:text-sm"
            >
              New Story
            </button>
            {address && (
              <span className="hidden md:inline text-xs text-gray-400">
                {address.slice(0, 4)}?{address.slice(-4)}
              </span>
            )}
            <ThemeSwitcher />
          </div>
        </div>

        <div
          className="px-2 md:px-6 pt-2 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex gap-2">
            <button
              className={`px-3 py-2 text-sm rounded border ${
                activeTab === "chat" ? "bg-white/10" : "bg-transparent"
              }`}
              onClick={() => setActiveTab("chat")}
            >
              Chat
            </button>
            <button
              className={`px-3 py-2 text-sm rounded border ${
                activeTab === "social" ? "bg-white/10" : "bg-transparent"
              }`}
              onClick={() => setActiveTab("social")}
              disabled={!activeStoryId}
            >
              Social
            </button>
            <button
              className={`px-3 py-2 text-sm rounded border ${
                activeTab === "characters" ? "bg-white/10" : "bg-transparent"
              }`}
              onClick={() => setActiveTab("characters")}
              disabled={!activeStoryId}
            >
              Characters
            </button>
          </div>
        </div>

        <div className="flex-1 p-2 md:p-6 flex flex-col">
          {activeTab === "chat" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-4 gap-4">
                <div
                  className={`${
                    isMobile ? "order-1" : "order-2 lg:order-1"
                  } lg:col-span-3 w-full mx-auto`}
                  style={{ maxWidth: isMobile ? 360 : undefined }}
                >
                  <ChatWindow
                    messages={messages}
                    loading={loading}
                    onSuggest={(text) => setInput(text)}
                  />
                </div>
                <div
                  className={`${
                    isMobile ? "order-2" : "order-1 lg:order-2"
                  } lg:col-span-1 w-full mx-auto`}
                  style={{ maxWidth: isMobile ? 360 : undefined }}
                >
                  <MusicPlayer
                    track={track}
                    theme={musicTheme}
                    onThemeChange={setMusicTheme}
                    logs={musicLogs}
                  />
                </div>
              </div>
              <div className="mt-4 sticky bottom-0 bg-[var(--color-background)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/60 p-2">
                <div
                  className="w-full mx-auto"
                  style={{ maxWidth: isMobile ? 360 : undefined }}
                >
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
                  />
                </div>
              </div>
            </>
          ) : activeTab === "social" && activeStoryId ? (
            <div className="py-4">
              <SocialFeed sessionId={activeStoryId} />
            </div>
          ) : activeTab === "characters" && activeStoryId ? (
            <div className="py-4">
              <CharactersTab sessionId={activeStoryId} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
              Select a story to view this tab.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
