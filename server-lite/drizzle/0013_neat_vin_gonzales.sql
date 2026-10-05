CREATE TABLE "interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"run_id" text NOT NULL,
	"tool_call_id" text NOT NULL,
	"type" text NOT NULL,
	"question" text NOT NULL,
	"options" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"answer" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"answered_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interactions_channel_idx" ON "interactions" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "interactions_run_idx" ON "interactions" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "interactions_status_idx" ON "interactions" USING btree ("status");