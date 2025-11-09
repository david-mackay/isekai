import { NextRequest, NextResponse } from "next/server";
import { readCards } from "@/lib/cards";
import {
  detectTheme,
  pickTrack,
  themeFromBeginningKey,
  type MusicTheme,
} from "@/lib/music";
import { searchYouTube } from "@/lib/youtube";
import { requireAuthenticatedUser } from "@/server/auth/session";
import { assertStoryOwnership } from "@/server/services/stories";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as {
      message: string;
      currentTheme?: MusicTheme;
      sessionId?: string;
    };
    const { message, currentTheme, sessionId } = body;
    if (!message)
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    if (!sessionId)
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    try {
      await assertStoryOwnership(user.id, sessionId);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      if (errMsg === "STORY_NOT_FOUND") {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }
      throw error;
    }

    const cards = await readCards(sessionId);
    const beginning = cards.find((c) => c.type === "beginning");
    const beginningKey = (beginning?.data as { key?: string } | undefined)?.key;
    const beginningTheme = themeFromBeginningKey(beginningKey);

    const detected = detectTheme(message);
    const nextTheme = detected || beginningTheme || "calm";

    const should_change = currentTheme ? currentTheme !== nextTheme : true;
    if (!should_change)
      return NextResponse.json({ should_change: false, theme: nextTheme });

    // Try dynamic YouTube search when API key is configured; fall back to curated
    let track = pickTrack(nextTheme);
    try {
      const keyPresent = Boolean(process.env.YOUTUBE_API_KEY);
      if (keyPresent) {
        const q = `${nextTheme} ambience fantasy music`;
        const results = await searchYouTube(q, 5);
        if (results.length > 0) {
          track = {
            id: results[0].id,
            title: results[0].title,
            theme: nextTheme,
            url: `https://www.youtube.com/embed/${results[0].id}?autoplay=1&loop=1&playlist=${results[0].id}&controls=0&iv_load_policy=3&modestbranding=1`,
          };
        }
      }
    } catch {}
    return NextResponse.json({ should_change: true, theme: nextTheme, track });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
