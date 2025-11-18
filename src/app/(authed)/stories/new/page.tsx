"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

import StartPanel from "@/components/StartPanel";
import CharacterCreation, {
  CharacterData,
} from "@/components/CharacterCreation";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import StorySidebar, { StoryListItem } from "@/components/StorySidebar";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { useDevSettings } from "@/contexts/DevSettingsContext";
import { StorySummary } from "@/types/story";

const LAST_STORY_KEY = "isekai:lastStoryId";

export default function NewStoryPage() {
  const router = useRouter();
  const walletAuth = useWalletAuth();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { modelId, imageModelId } = useDevSettings();

  const [stories, setStories] = useState<StorySummary[]>([]);
  const [storyBeginnings, setStoryBeginnings] = useState<
    Record<string, string>
  >({});
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [playerCharacter, setPlayerCharacter] = useState<CharacterData | null>(
    null
  );
  const [pendingBeginning, setPendingBeginning] = useState<{
    key: string;
    title: string;
  } | null>(null);
  const [isLoadingFirstStory, setIsLoadingFirstStory] = useState(false);
  const [worlds, setWorlds] = useState<{ key: string; title: string }[]>([
    { key: "eirath", title: "Eirath" },
  ]);
  const [worldKey, setWorldKey] = useState("eirath");

  const storyItems: StoryListItem[] = useMemo(
    () =>
      stories
        .slice()
        .sort(
          (a, b) =>
            new Date(b.lastPlayedAt).getTime() -
            new Date(a.lastPlayedAt).getTime()
        )
        .map((story) => ({
          id: story.id,
          title: story.title,
          beginningLabel:
            (story.beginningKey && storyBeginnings[story.beginningKey]) ||
            story.beginningKey ||
            "Custom Adventure",
          createdAt: story.createdAt,
          lastPlayedAt: story.lastPlayedAt,
          messageCount: story.messageCount,
        })),
    [stories, storyBeginnings]
  );

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
    if (walletAuth.status === "authenticated") {
      void fetchStories();
    }
  }, [walletAuth.status, fetchStories]);

  useEffect(() => {
    fetch("/api/init")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.worlds) && data.worlds.length > 0) {
          setWorlds(data.worlds);
          setWorldKey((prev) => prev || data.worlds[0].key);
        }
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

  const handleOpenStory = useCallback(
    (storyId: string) => {
      localStorage.setItem(LAST_STORY_KEY, storyId);
      router.push(`/stories/${storyId}`);
    },
    [router]
  );

  const handleDeleteStory = useCallback(async (storyId: string) => {
    if (!confirm("Delete this story? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Failed to delete story (${res.status})`);
      }
      setStories((prev) => prev.filter((story) => story.id !== storyId));
      const lastStored = localStorage.getItem(LAST_STORY_KEY);
      if (lastStored === storyId) {
        localStorage.removeItem(LAST_STORY_KEY);
      }
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to delete the story. Please try again."
      );
    }
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
          body: JSON.stringify({
            kind: "continue",
            sessionId: story.id,
            model: modelId,
            imageModelId: imageModelId,
          }),
        });
        
        // Check if response has content before parsing JSON
        const contentType = dmRes.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await dmRes.text();
          throw new Error(
            dmRes.ok
              ? `Unexpected response format: ${text.slice(0, 100)}`
              : `Request failed with status ${dmRes.status}: ${text.slice(0, 100)}`
          );
        }
        
        const text = await dmRes.text();
        if (!text) {
          throw new Error(
            dmRes.ok
              ? "Empty response from server"
              : `Request failed with status ${dmRes.status}`
          );
        }
        
        let dmData: {
          content?: string;
          imageUrl?: string | null;
          error?: string;
        };
        try {
          dmData = JSON.parse(text);
        } catch (parseError) {
          throw new Error(
            `Invalid JSON response: ${text.slice(0, 100)}`
          );
        }
        
        if (!dmRes.ok || !dmData.content) {
          throw new Error(dmData.error || "Failed to generate opening scene");
        }

        await fetchStories();
        router.push(`/stories/${story.id}`);
      } catch (error) {
        if (createdStory) {
          setStories((prev) =>
            prev.filter((story) => story.id !== createdStory!.id)
          );
          localStorage.removeItem(LAST_STORY_KEY);
          try {
            await fetch(`/api/stories/${createdStory.id}`, {
              method: "DELETE",
            });
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
    [playerCharacter, worldKey, fetchStories, router, modelId]
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
            Link your Solana wallet to start a new adventure.
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
          onStorySelect={handleOpenStory}
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
        onStorySelect={handleOpenStory}
        onDeleteStory={handleDeleteStory}
      />

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between p-4 md:p-6 border-b">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">
              Start a New Story
            </h1>
            <p className="text-sm text-gray-400">
              Define your hero, then jump into a fresh beginning.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {address && (
              <button
                onClick={() => open()}
                className="hidden md:inline px-2 py-1 text-xs text-gray-400 font-mono hover:text-gray-300 border border-gray-700 rounded hover:border-gray-600"
              >
                {address.slice(0, 4)}…{address.slice(-4)}
              </button>
            )}
            <ThemeSwitcher />
            <button
              onClick={async () => {
                await walletAuth.logout();
                router.push("/auth");
              }}
              className="px-4 py-2 border rounded text-sm hover:bg-red-500/10 hover:border-red-500/50"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-start justify-center px-3 md:px-0">
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
        </main>
      </div>
    </div>
  );
}
