ALTER TABLE "tool_catalog" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_catalog" ADD COLUMN "requires_approval" boolean DEFAULT false NOT NULL;