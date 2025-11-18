import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  doublePrecision,
  uniqueIndex,
  index,
  pgEnum,
  vector as pgVector,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const storyRoleEnum = pgEnum("story_role", ["dm", "you"]);
export const memorySourceEnum = pgEnum("memory_source", [
  "player",
  "dm",
  "npc",
  "system",
  "world",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: text("wallet_address").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    walletAddressIdx: uniqueIndex("users_wallet_address_unique").on(
      table.walletAddress
    ),
  })
);

export const authNonces = pgTable(
  "auth_nonces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: text("wallet_address").notNull(),
    nonce: text("nonce").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    walletIdx: index("auth_nonces_wallet_idx").on(table.walletAddress),
    nonceUnique: uniqueIndex("auth_nonces_nonce_unique").on(table.nonce),
  })
);

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    beginningKey: text("beginning_key"),
    worldKey: text("world_key"),
    characterName: text("character_name"),
    characterGender: text("character_gender"),
    characterRace: text("character_race"),
    messageCount: integer("message_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastPlayedAt: timestamp("last_played_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("stories_user_idx").on(table.userId),
  })
);

export const storyMessages = pgTable(
  "story_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    role: storyRoleEnum("role").notNull(),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    sequence: integer("sequence").notNull(),
  },
  (table) => ({
    storyIdx: index("story_messages_story_idx").on(table.storyId),
    storySequenceIdx: uniqueIndex("story_messages_sequence_unique").on(
      table.storyId,
      table.sequence
    ),
  })
);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
    embedding: pgVector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storyIdx: index("cards_story_idx").on(table.storyId),
    storyTypeNameUnique: uniqueIndex("cards_story_type_name_unique").on(
      table.storyId,
      table.type,
      table.name
    ),
  })
);

export const characterMemories = pgTable(
  "character_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    ownerCardId: uuid("owner_card_id").references(() => cards.id, {
      onDelete: "cascade",
    }),
    subjectCardId: uuid("subject_card_id").references(() => cards.id, {
      onDelete: "cascade",
    }),
    sourceMessageId: uuid("source_message_id").references(
      () => storyMessages.id,
      {
        onDelete: "set null",
      }
    ),
    sourceType: memorySourceEnum("source_type").notNull().default("system"),
    summary: text("summary").notNull(),
    context: jsonb("context")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    tags: jsonb("tags")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    importance: integer("importance").notNull().default(1),
    decayFactor: doublePrecision("decay_factor").notNull().default(1),
    embedding: pgVector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastAccessedAt: timestamp("last_accessed_at"),
  },
  (table) => ({
    storyIdx: index("character_memories_story_idx").on(table.storyId),
    ownerIdx: index("character_memories_owner_idx").on(table.ownerCardId),
    subjectIdx: index("character_memories_subject_idx").on(table.subjectCardId),
  })
);

export const characterStats = pgTable(
  "character_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    characterCardId: uuid("character_card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    confidence: doublePrecision("confidence").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storyIdx: index("character_stats_story_idx").on(table.storyId),
    keyUnique: uniqueIndex("character_stats_story_character_key_unique").on(
      table.storyId,
      table.characterCardId,
      table.key
    ),
  })
);

export const characterRelationships = pgTable(
  "character_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    sourceCardId: uuid("source_card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    targetCardId: uuid("target_card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    summary: text("summary"),
    metrics: jsonb("metrics")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    embedding: pgVector("embedding", { dimensions: 1024 }),
    importance: integer("importance").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storyIdx: index("character_relationships_story_idx").on(table.storyId),
    sourceIdx: index("character_relationships_source_idx").on(
      table.sourceCardId
    ),
    targetIdx: index("character_relationships_target_idx").on(
      table.targetCardId
    ),
    edgeUnique: uniqueIndex(
      "character_relationships_story_source_target_unique"
    ).on(table.storyId, table.sourceCardId, table.targetCardId),
  })
);

export const gmSettings = pgTable("gm_settings", {
  storyId: uuid("story_id")
    .primaryKey()
    .references(() => stories.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type StoryMessage = typeof storyMessages.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type CharacterMemory = typeof characterMemories.$inferSelect;
export type CharacterStat = typeof characterStats.$inferSelect;
export type CharacterRelationship = typeof characterRelationships.$inferSelect;
export type GmSettings = typeof gmSettings.$inferSelect;

export const usersRelations = relations(users, ({ many }) => ({
  stories: many(stories),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
  user: one(users, {
    fields: [stories.userId],
    references: [users.id],
  }),
  messages: many(storyMessages),
  cards: many(cards),
  memories: many(characterMemories),
  stats: many(characterStats),
  relationships: many(characterRelationships),
  settings: one(gmSettings),
}));

export const storyMessagesRelations = relations(storyMessages, ({ one }) => ({
  story: one(stories, {
    fields: [storyMessages.storyId],
    references: [stories.id],
  }),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  story: one(stories, {
    fields: [cards.storyId],
    references: [stories.id],
  }),
  ownedMemories: many(characterMemories, { relationName: "memoriesOwner" }),
  subjectMemories: many(characterMemories, {
    relationName: "memoriesSubject",
  }),
  stats: many(characterStats, { relationName: "stats" }),
  relationshipsFrom: many(characterRelationships, {
    relationName: "relationshipsFrom",
  }),
  relationshipsTo: many(characterRelationships, {
    relationName: "relationshipsTo",
  }),
}));

export const characterMemoriesRelations = relations(
  characterMemories,
  ({ one }) => ({
    story: one(stories, {
      fields: [characterMemories.storyId],
      references: [stories.id],
    }),
    owner: one(cards, {
      fields: [characterMemories.ownerCardId],
      references: [cards.id],
      relationName: "memoriesOwner",
    }),
    subject: one(cards, {
      fields: [characterMemories.subjectCardId],
      references: [cards.id],
      relationName: "memoriesSubject",
    }),
    sourceMessage: one(storyMessages, {
      fields: [characterMemories.sourceMessageId],
      references: [storyMessages.id],
    }),
  })
);

export const characterStatsRelations = relations(characterStats, ({ one }) => ({
  story: one(stories, {
    fields: [characterStats.storyId],
    references: [stories.id],
  }),
  character: one(cards, {
    fields: [characterStats.characterCardId],
    references: [cards.id],
    relationName: "stats",
  }),
}));

export const characterRelationshipsRelations = relations(
  characterRelationships,
  ({ one }) => ({
    story: one(stories, {
      fields: [characterRelationships.storyId],
      references: [stories.id],
    }),
    source: one(cards, {
      fields: [characterRelationships.sourceCardId],
      references: [cards.id],
      relationName: "relationshipsFrom",
    }),
    target: one(cards, {
      fields: [characterRelationships.targetCardId],
      references: [cards.id],
      relationName: "relationshipsTo",
    }),
  })
);

export const gmSettingsRelations = relations(gmSettings, ({ one }) => ({
  story: one(stories, {
    fields: [gmSettings.storyId],
    references: [stories.id],
  }),
}));
