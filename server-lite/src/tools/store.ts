import { eq } from "drizzle-orm";

import type { Db } from "../db";
import {
  toolCatalog,
} from "../db/schema";

export type ToolStore = {
  list(): Promise<ToolCatalogItem[]>;
  get(id: string): Promise<ToolCatalogItem | null>;
};

export type ToolCatalogItem = {
  id: string;
  name: string;
  description: string;
  source: "internal" | "composio";
  provider: string | null;
  requiresApproval: boolean;
  createdAt: Date;
};

export function createToolStore(
  db: Db,
) {
  async function list(): Promise<
    ToolCatalogItem[]
  > {
    const rows =
      await db
        .select()
        .from(toolCatalog);

    return rows.map(mapRow);
  }

  async function get(
    id: string,
  ): Promise<ToolCatalogItem | null> {
    const rows =
      await db
        .select()
        .from(toolCatalog)
        .where(
          eq(
            toolCatalog.id,
            id,
          ),
        )
        .limit(1);

    return rows[0]
      ? mapRow(rows[0])
      : null;
  }

  return {
    list,
    get,
  };
}

function mapRow(
  row: typeof toolCatalog.$inferSelect,
): ToolCatalogItem {
  return {
    id: row.id,

    name: row.name,

    description:
      row.description,

    source:
      row.source as
        | "internal"
        | "composio",

    provider:
      row.provider,

    requiresApproval:
      row.requiresApproval,

    createdAt:
      row.createdAt,
  };
}