import type { BaseCard } from "./cards";

export const DEFAULT_WORLD_CARD: Omit<BaseCard, "id" | "updatedAt"> = {
  type: "world",
  name: "Eirath Core Lore",
  description: "Immutable world foundations: races, cultures, cosmology.",
  data: {
    races: {
      Human: {
        lifespan: "~80 years",
        traits: ["adaptable", "ambitious"],
        culture: "Diverse city-states; festivals mark trade seasons.",
      },
      Elf: {
        lifespan: "immortal until crowned monarchs",
        traits: ["attuned to magic", "patient"],
        culture:
          "Art bound to memory; monarchs age rapidly, shaping succession myths.",
      },
      Dwarf: {
        lifespan: "~200 years",
        traits: ["stubborn", "craft-bound"],
        culture: "Guild clans; oaths carry legal weight across holds.",
      },
      Halfling: {
        lifespan: "~100 years",
        traits: ["cheerful", "resourceful"],
        culture: "Market-faring caravans; hospitality is sacred.",
      },
      Dragonborn: {
        lifespan: "~70 years",
        traits: ["proud", "oathbound"],
        culture: "Clan creeds; ancestral breathlines honored in rites.",
      },
      Gnome: {
        lifespan: "~350 years",
        traits: ["inquisitive", "tinkerers"],
        culture: "Workshops under willows; inventions double as folk art.",
      },
      "Half-Elf": {
        lifespan: "~120 years",
        traits: ["bridge-born", "adaptable"],
        culture: "Go-betweens in courts; multilingual diplomacy traditions.",
      },
      "Half-Orc": {
        lifespan: "~75 years",
        traits: ["resilient", "honor-bound"],
        culture: "Warband codes turned civic charters in frontier towns.",
      },
      Tiefling: {
        lifespan: "humanlike",
        traits: ["fiend-touched", "resilient"],
        culture: "Diasporic enclaves; reputations negotiated via favor-debts.",
      },
      Other: {
        lifespan: "varies",
        traits: ["mysterious"],
        culture: "To be defined per story.",
      },
    },
    calendars: {
      major_holidays: [
        "Last Ember (year's turning)",
        "First Sowing (spring pledge)",
        "Veil Night (ancestral remembrance)",
      ],
    },
    religions: [
      "The Octave (eight domains of virtue)",
      "The Tide (sea pact cults)",
    ],
    magic: {
      sources: ["ley-lines", "oaths", "bloodline relics"],
      taboos: ["binding true names"],
    },
    politics_template: {
      blocs: ["Guild Compact", "Wardens' League", "Night Veil"],
      notes: "Templates only; actual alliances are generated per session.",
    },
  },
};

export const WORLDS: Record<string, Omit<BaseCard, "id" | "updatedAt">> = {
  eirath: DEFAULT_WORLD_CARD,
};
