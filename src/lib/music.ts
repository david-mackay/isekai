export type MusicTheme =
  | "forest"
  | "heist"
  | "mystery"
  | "tension"
  | "romance"
  | "tavern"
  | "magic"
  | "ocean"
  | "desert"
  | "dungeon"
  | "calm";

export interface Track {
  id: string; // YouTube video id
  title: string;
  theme: MusicTheme;
  url: string; // embed url
}

function embedUrl(id: string): string {
  // loop single video; modest branding
  return `https://www.youtube.com/embed/${id}?autoplay=1&loop=1&playlist=${id}&controls=0&iv_load_policy=3&modestbranding=1`;
}

// Curated baseline tracks (public soundtrack/ambience videos)
export const TRACKS: Track[] = [
  {
    id: "3TNK916Pjto",
    title: "Forest Night Ambience",
    theme: "forest",
    url: embedUrl("3TNK916Pjto"),
  },
  {
    id: "bXT96SVp0jg",
    title: "Calm Fantasy Tavern",
    theme: "tavern",
    url: embedUrl("bXT96SVp0jg"),
  },
  {
    id: "qYaKzpMdBaM",
    title: "Heist Jazz Noir",
    theme: "heist",
    url: embedUrl("qYaKzpMdBaM"),
  },
  {
    id: "ZkcnW1ZzHJI",
    title: "Investigation / Mystery",
    theme: "mystery",
    url: embedUrl("ZkcnW1ZzHJI"),
  },
  {
    id: "fq8OSrIUST4",
    title: "Tension / Chase",
    theme: "tension",
    url: embedUrl("fq8OSrIUST4"),
  },
  {
    id: "x2fpkwsTF7g",
    title: "Arcane Magic",
    theme: "magic",
    url: embedUrl("x2fpkwsTF7g"),
  },
  {
    id: "LnD-XEQ2hzQ",
    title: "Ocean Waves Night",
    theme: "ocean",
    url: embedUrl("LnD-XEQ2hzQ"),
  },
  {
    id: "uKkJ0etAO5s",
    title: "Desert Winds",
    theme: "desert",
    url: embedUrl("uKkJ0etAO5s"),
  },
  {
    id: "bxoRRobHtGM",
    title: "Dungeon Ambience",
    theme: "dungeon",
    url: embedUrl("bxoRRobHtGM"),
  },
  {
    id: "amwA16ye148",
    title: "Calm Fantasy Background",
    theme: "calm",
    url: embedUrl("amwA16ye148"),
  },
  {
    id: "3-aOhdkuXXU",
    title: "Romantic / Soothing",
    theme: "romance",
    url: embedUrl("3-aOhdkuXXU"),
  },
];

const KEYWORDS: Record<MusicTheme, RegExp[]> = {
  forest: [/forest|woods|thicket|blackthorn|glade|wolf|wilds/i],
  heist: [
    /heist|vault|robbery|thieves|sneak|slink|caper|city guard|inspector/i,
  ],
  mystery: [/mystery|investigate|clue|secret|whisper|shadow|riddle/i],
  tension: [/combat|fight|chase|pursue|alarm|danger|tense|threat/i],
  romance: [/romance|kiss|blush|caress|tender|intimate|affection/i],
  tavern: [/tavern|inn|bar|ale|music|lute|pub/i],
  magic: [/magic|arcane|runes|spell|portal|threshold|mana/i],
  ocean: [/ocean|sea|harbor|ship|waves|coast/i],
  desert: [/desert|dune|sand|sun-baked|oasis/i],
  dungeon: [/dungeon|crypt|catacomb|underground|ruin/i],
  calm: [/calm|rest|camp|peace|safe|quiet/i],
};

export function themeFromBeginningKey(key?: string): MusicTheme | undefined {
  if (!key) return undefined;
  if (key === "combat") return "tension";
  if (key === "romance") return "romance";
  if (key === "politics") return "mystery";
  if (key === "exploration") return "ocean";
  return undefined;
}

export function detectTheme(text: string): MusicTheme | undefined {
  for (const [theme, regs] of Object.entries(KEYWORDS) as [
    MusicTheme,
    RegExp[]
  ][]) {
    if (regs.some((r) => r.test(text))) return theme;
  }
  return undefined;
}

export function pickTrack(preferred: MusicTheme | undefined): Track {
  if (preferred) {
    const c = TRACKS.find((t) => t.theme === preferred);
    if (c) return c;
  }
  return TRACKS.find((t) => t.theme === "calm") || TRACKS[0];
}

export function shouldSwitch(
  currentTheme?: MusicTheme,
  nextTheme?: MusicTheme
): boolean {
  if (!nextTheme) return false;
  if (!currentTheme) return true;
  return nextTheme !== currentTheme;
}

export function queryForTheme(theme: MusicTheme): string {
  switch (theme) {
    case "heist":
      return "heist jazz noir ambience";
    case "mystery":
      return "investigation mystery ambient music";
    case "forest":
      return "forest ambience fantasy music";
    case "tension":
      return "tense chase cinematic percussion";
    case "tavern":
      return "fantasy tavern music ambience";
    case "magic":
      return "arcane magic ambient";
    case "ocean":
      return "ocean waves fantasy ambience";
    case "desert":
      return "desert wind ambience music";
    case "dungeon":
      return "dungeon ambience dark fantasy";
    case "romance":
      return "romantic fantasy music";
    case "calm":
    default:
      return "calm fantasy ambience";
  }
}
