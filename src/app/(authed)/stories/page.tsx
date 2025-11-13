"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

import ThemeSwitcher from "@/components/ThemeSwitcher";
import StorySidebar, { StoryListItem } from "@/components/StorySidebar";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { StorySummary } from "@/types/story";

const LAST_STORY_KEY = "isekai:lastStoryId";

function mapToListItems(
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

export default function StoriesPage() {
  const router = useRouter();
  const walletAuth = useWalletAuth();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  const [stories, setStories] = useState<StorySummary[]>([]);
  const [storyBeginnings, setStoryBeginnings] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storyItems = useMemo(
    () => mapToListItems(stories, storyBeginnings),
    [stories, storyBeginnings]
  );

  const fetchStories = useCallback(async () => {
    if (walletAuth.status !== "authenticated") {
      setStories([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stories", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load stories (${res.status})`);
      }
      const data = (await res.json()) as { stories: StorySummary[] };
      setStories(Array.isArray(data.stories) ? data.stories : []);
    } catch (err) {
      console.error("Unable to fetch stories", err);
      setError(
        err instanceof Error ? err.message : "Unable to load stories right now."
      );
      setStories([]);
    } finally {
      setLoading(false);
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
    async (storyId: string) => {
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

  const handleNewStory = useCallback(() => {
    router.push("/stories/new");
  }, [router]);

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
            Link your Solana wallet to browse and resume your adventures.
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
          loading={loading}
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
        loading={loading}
        onStorySelect={handleOpenStory}
        onDeleteStory={handleDeleteStory}
      />

      <main className="flex-1 px-4 py-8 md:px-12 lg:px-16">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Your Adventures</h1>
            <p className="text-sm text-gray-400">
              Resume a story or begin a fresh journey.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {address && (
              <span className="hidden sm:inline text-xs text-gray-500 font-mono">
                {address.slice(0, 4)}…{address.slice(-4)}
              </span>
            )}
            <ThemeSwitcher />
            <button
              onClick={handleNewStory}
              className="px-4 py-2 border rounded text-sm"
            >
              New Story
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="border border-dashed rounded px-6 py-10 text-center text-gray-400">
            Loading stories…
          </div>
        ) : storyItems.length === 0 ? (
          <div className="border border-dashed rounded px-6 py-10 text-center space-y-3 text-gray-400">
            <p>No stories yet. Start a new adventure to begin playing.</p>
            <button
              onClick={handleNewStory}
              className="px-4 py-2 border rounded text-sm"
            >
              Start a New Story
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {storyItems.map((story) => (
              <article
                key={story.id}
                className="border rounded-lg p-4 bg-white/5 border-white/10 hover:border-white/20 transition-colors flex flex-col gap-3"
              >
                <div>
                  <h2 className="text-lg font-semibold truncate">
                    {story.title}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {story.beginningLabel}
                  </p>
                </div>
                <dl className="text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                  <div>
                    <dt className="uppercase tracking-[0.16em] opacity-60">
                      Last Played
                    </dt>
                    <dd>{new Date(story.lastPlayedAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.16em] opacity-60">
                      Messages
                    </dt>
                    <dd>{story.messageCount}</dd>
                  </div>
                </dl>
                <div className="flex gap-2 mt-auto">
                  <button
                    className="flex-1 px-3 py-2 border rounded text-sm"
                    onClick={() => handleOpenStory(story.id)}
                  >
                    Continue
                  </button>
                  <Link
                    href={`/stories/${story.id}`}
                    className="px-3 py-2 border rounded text-sm hidden md:inline"
                  >
                    Open
                  </Link>
                  <button
                    className="px-3 py-2 border rounded text-sm text-red-300 border-red-400/40 hover:border-red-400"
                    onClick={() => handleDeleteStory(story.id)}
                    title="Delete story"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
