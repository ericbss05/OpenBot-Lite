CREATE TABLE "channel_agents" (
	"channel_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_agents" ADD CONSTRAINT "channel_agents_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_agents" ADD CONSTRAINT "channel_agents_agent_id_agent_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_agents_channel_agent_idx" ON "channel_agents" USING btree ("channel_id","agent_id");--> statement-breakpoint
CREATE INDEX "channel_agents_channel_idx" ON "channel_agents" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "channel_agents_agent_idx" ON "channel_agents" USING btree ("agent_id");--> statement-breakpoint
ALTER TABLE "channels" DROP COLUMN "agent_ids";