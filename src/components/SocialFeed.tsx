"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FeedPost = {
  id: string;
  author: { name: string };
  content: string;
  hoursAgo: number;
  likes?: number;
  comments?: number;
  postType?: "status" | "photo" | "story";
};

export default function SocialFeed({ sessionId }: { sessionId?: string }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(0);

  const fetchMore = useCallback(
    async (initial = false) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        console.log("🛰️ SocialFeed fetchMore", { initial, sessionId });
        const res = await fetch("/api/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, count: 6 }),
        });
        const data = (await res.json()) as { posts?: FeedPost[]; error?: string };
        console.log("📥 SocialFeed response", res.status, data);
        if (!res.ok) throw new Error(data.error || "Request failed");
        const newPosts = data.posts;
        if (!newPosts) throw new Error("No posts returned");
        setPosts((prev) => (initial ? newPosts : [...prev, ...newPosts]));
        pageRef.current += 1;
      } catch (e) {
        console.error("❌ SocialFeed fetch error", e);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [loading, sessionId]
  );

  useEffect(() => {
    setPosts([]);
    pageRef.current = 0;
    console.log("🔄 SocialFeed reset for session", sessionId);
    void fetchMore(true);
  }, [sessionId, fetchMore]);

  const skeletons = useMemo(() => new Array(3).fill(0), []);

  return (
    <div className="w-full mx-auto" style={{ maxWidth: 720 }}>
      <div className="border rounded md:rounded-lg overflow-hidden bg-white/5">
        <div
          className="p-4 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h2 className="text-lg font-semibold">Social Feed</h2>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            In-world posts from characters you know
          </p>
        </div>

        <div
          className="divide-y"
          style={{ borderColor: "var(--color-border)" }}
        >
          {posts.map((p) => (
            <article key={p.id} className="p-4">
              <header className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold">
                  {p.author.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium leading-tight">
                    {p.author.name}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {p.hoursAgo}h ago · {p.postType || "status"}
                  </div>
                </div>
              </header>
              <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
                {p.content}
              </div>
              <footer className="mt-3 flex items-center gap-4 text-sm opacity-80">
                <span>❤️ {p.likes ?? 0}</span>
                <span>💬 {p.comments ?? 0}</span>
              </footer>
            </article>
          ))}

          {loading && posts.length === 0 && (
            <div className="p-4">
              {skeletons.map((_, i) => (
                <div key={i} className="mb-4 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-11/12 mb-1" />
                  <div className="h-3 bg-white/10 rounded w-10/12" />
                </div>
              ))}
            </div>
          )}

          {error && <div className="p-4 text-sm text-red-300">{error}</div>}

          <div className="p-4">
              <button
                className="w-full border rounded px-4 py-3"
                onClick={() => fetchMore(false)}
                disabled={loading}
              >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
