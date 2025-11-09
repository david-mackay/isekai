CREATE INDEX IF NOT EXISTS cards_embedding_ivfflat_idx
    ON cards USING ivfflat (embedding vector_l2_ops)
    WITH (lists = 100);
CREATE INDEX IF NOT EXISTS character_memories_embedding_ivfflat_idx
    ON character_memories USING ivfflat (embedding vector_l2_ops)
    WITH (lists = 100);
CREATE INDEX IF NOT EXISTS character_relationships_embedding_ivfflat_idx
    ON character_relationships USING ivfflat (embedding vector_l2_ops)
    WITH (lists = 100);
CREATE TYPE "public"."memory_source" AS ENUM('player', 'dm', 'npc', 'system', 'world');--> statement-breakpoint
CREATE TABLE "character_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"owner_card_id" uuid,
	"subject_card_id" uuid,
	"source_message_id" uuid,
	"source_type" "memory_source" DEFAULT 'system' NOT NULL,
	"summary" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"importance" integer DEFAULT 1 NOT NULL,
	"decay_factor" double precision DEFAULT 1 NOT NULL,
	"embedding" vector(1024),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "character_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"source_card_id" uuid NOT NULL,
	"target_card_id" uuid NOT NULL,
	"summary" text,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" vector(1024),
	"importance" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"character_card_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" double precision DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character_memories" ADD CONSTRAINT "character_memories_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_memories" ADD CONSTRAINT "character_memories_owner_card_id_cards_id_fk" FOREIGN KEY ("owner_card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_memories" ADD CONSTRAINT "character_memories_subject_card_id_cards_id_fk" FOREIGN KEY ("subject_card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_memories" ADD CONSTRAINT "character_memories_source_message_id_story_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."story_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_source_card_id_cards_id_fk" FOREIGN KEY ("source_card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_target_card_id_cards_id_fk" FOREIGN KEY ("target_card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_stats" ADD CONSTRAINT "character_stats_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_stats" ADD CONSTRAINT "character_stats_character_card_id_cards_id_fk" FOREIGN KEY ("character_card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_memories_story_idx" ON "character_memories" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "character_memories_owner_idx" ON "character_memories" USING btree ("owner_card_id");--> statement-breakpoint
CREATE INDEX "character_memories_subject_idx" ON "character_memories" USING btree ("subject_card_id");--> statement-breakpoint
CREATE INDEX "character_relationships_story_idx" ON "character_relationships" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "character_relationships_source_idx" ON "character_relationships" USING btree ("source_card_id");--> statement-breakpoint
CREATE INDEX "character_relationships_target_idx" ON "character_relationships" USING btree ("target_card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "character_relationships_story_source_target_unique" ON "character_relationships" USING btree ("story_id","source_card_id","target_card_id");--> statement-breakpoint
CREATE INDEX "character_stats_story_idx" ON "character_stats" USING btree ("story_id");--> statement-breakpoint
CREATE UNIQUE INDEX "character_stats_story_character_key_unique" ON "character_stats" USING btree ("story_id","character_card_id","key");