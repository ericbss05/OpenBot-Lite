ALTER TABLE "interactions" DROP CONSTRAINT "interactions_channel_id_channels_id_fk";
--> statement-breakpoint
DROP INDEX "interactions_channel_idx";--> statement-breakpoint
ALTER TABLE "channel_messages" ADD COLUMN "interaction_id" text;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD COLUMN "approval_id" text;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_interaction_id_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_messages_interaction_idx" ON "channel_messages" USING btree ("interaction_id");--> statement-breakpoint
CREATE INDEX "channel_messages_approval_idx" ON "channel_messages" USING btree ("approval_id");--> statement-breakpoint
ALTER TABLE "interactions" DROP COLUMN "channel_id";