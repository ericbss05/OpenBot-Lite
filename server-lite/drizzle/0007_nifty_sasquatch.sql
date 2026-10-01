ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_events" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "actor_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_type_idx" ON "audit_events" USING btree ("actor_type");