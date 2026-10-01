ALTER TABLE "audit_events"
ADD COLUMN "actor_type" text;

UPDATE "audit_events"
SET "actor_type" = 'user'
WHERE "actor_type" IS NULL;

ALTER TABLE "audit_events"
ALTER COLUMN "actor_type" SET NOT NULL;

ALTER TABLE "audit_events"
ALTER COLUMN "actor_id" DROP NOT NULL;

ALTER TABLE "audit_events"
DROP CONSTRAINT IF EXISTS "audit_events_actor_id_user_id_fk";

ALTER TABLE "audit_events"
ADD CONSTRAINT "audit_events_actor_id_user_id_fk"
FOREIGN KEY ("actor_id")
REFERENCES "public"."user"("id")
ON DELETE SET NULL
ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "audit_actor_type_idx"
ON "audit_events" USING btree ("actor_type");