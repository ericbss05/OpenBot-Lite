ALTER TABLE "agent_profiles" ADD COLUMN "avatar_palette" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD COLUMN "avatar_reversed" boolean DEFAULT false NOT NULL;