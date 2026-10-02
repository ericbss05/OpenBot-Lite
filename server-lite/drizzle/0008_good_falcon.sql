CREATE TABLE "agent_tools" (
	"agent_id" text NOT NULL,
	"tool_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"provider" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_agent_id_agent_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_tool_id_tool_catalog_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tool_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_tools_agent_tool_idx" ON "agent_tools" USING btree ("agent_id","tool_id");--> statement-breakpoint
CREATE INDEX "agent_tools_agent_idx" ON "agent_tools" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_tools_tool_idx" ON "agent_tools" USING btree ("tool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_catalog_name_idx" ON "tool_catalog" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tool_catalog_source_idx" ON "tool_catalog" USING btree ("source");