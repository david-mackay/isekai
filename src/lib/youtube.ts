export interface YouTubeSearchResult {
  id: string; // videoId
  title: string;
}

function embedUrl(id: string): string {
  return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1&playlist=${id}&controls=0&iv_load_policy=3&modestbranding=1`;
}

export function toTrack(id: string, title: string) {
  return { id, title, url: embedUrl(id) };
}

export async function searchYouTube(
  query: string,
  maxResults = 5
): Promise<YouTubeSearchResult[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: String(maxResults),
    q: query,
    key,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: { id?: { videoId?: string }; snippet?: { title?: string } }[];
  };
  const items = data.items || [];
  return items
    .map((i) => ({ id: i.id?.videoId || "", title: i.snippet?.title || "" }))
    .filter((i) => i.id);
}
