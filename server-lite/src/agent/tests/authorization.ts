import { eq } from "drizzle-orm";

import { db } from "../../db";
import {
  agentProfiles,
  agentTools,
  toolCatalog,
} from "../../db/schema";

import {
  ToolAuthorizationService,
} from "../authorization";

const authorization =
  new ToolAuthorizationService(db);

const primaryAgentId =
  `test-primary-${crypto.randomUUID()}`;

const subAgentId =
  `test-sub-${crypto.randomUUID()}`;

async function cleanup() {
  await db
    .delete(agentTools)
    .where(
      eq(
        agentTools.agentId,
        subAgentId,
      ),
    );

  await db
    .delete(agentProfiles)
    .where(
      eq(
        agentProfiles.id,
        primaryAgentId,
      ),
    );

  await db
    .delete(agentProfiles)
    .where(
      eq(
        agentProfiles.id,
        subAgentId,
      ),
    );
}

async function main() {
  console.log(
    "\n=== TOOL AUTHORIZATION TEST ===\n",
  );

  await cleanup();

  // --------------------------------------------------
  // Test agents
  // --------------------------------------------------

  await db.insert(agentProfiles).values([
    {
      id: primaryAgentId,
      name: "Test Primary Agent",
      title: "Primary test agent",
      roleDescription:
        "Primary authorization test agent",
      model: "gpt-6-luna",
      visibility: "private",
      isPrimary: true,
      ownerUserId: null,
    },
    {
      id: subAgentId,
      name: "Test Sub-Agent",
      title: "Sub-agent test",
      roleDescription:
        "Sub-agent authorization test agent",
      model: "gpt-6-luna",
      visibility: "private",
      isPrimary: false,
      ownerUserId: null,
    },
  ]);

  // --------------------------------------------------
  // Give sub-agent ONLY calculator
  // --------------------------------------------------

  await db.insert(agentTools).values({
    agentId: subAgentId,
    toolId: "calculator",
  });

  // --------------------------------------------------
  // 1. Primary + calculator
  // --------------------------------------------------

  const primaryCalculator =
    await authorization.authorize(
      primaryAgentId,
      "calculator",
    );

  console.log(
    "1. Primary + calculator:",
    primaryCalculator,
  );

  if (!primaryCalculator.allowed) {
    throw new Error(
      "Primary agent should be allowed to use calculator.",
    );
  }

  // --------------------------------------------------
  // 2. Primary + create_sub_agent
  // --------------------------------------------------

  const primarySubAgent =
    await authorization.authorize(
      primaryAgentId,
      "create_sub_agent",
    );

  console.log(
    "2. Primary + create_sub_agent:",
    primarySubAgent,
  );

  if (!primarySubAgent.allowed) {
    throw new Error(
      "Primary agent should be allowed to use create_sub_agent.",
    );
  }

  // --------------------------------------------------
  // 3. Sub-agent + calculator
  // --------------------------------------------------

  const subCalculator =
    await authorization.authorize(
      subAgentId,
      "calculator",
    );

  console.log(
    "3. Sub-agent + calculator:",
    subCalculator,
  );

  if (!subCalculator.allowed) {
    throw new Error(
      "Sub-agent should be allowed to use assigned calculator.",
    );
  }

  // --------------------------------------------------
  // 4. Sub-agent + create_sub_agent
  // --------------------------------------------------

  const subCreateAgent =
    await authorization.authorize(
      subAgentId,
      "create_sub_agent",
    );

  console.log(
    "4. Sub-agent + create_sub_agent:",
    subCreateAgent,
  );

  if (subCreateAgent.allowed) {
    throw new Error(
      "Sub-agent should NOT be allowed to use unassigned create_sub_agent.",
    );
  }

  // --------------------------------------------------
  // 5. Sub-agent + missing tool
  // --------------------------------------------------

  const missingTool =
    await authorization.authorize(
      subAgentId,
      "does_not_exist",
    );

  console.log(
    "5. Sub-agent + missing tool:",
    missingTool,
  );

  if (missingTool.allowed) {
    throw new Error(
      "Missing tool should never be authorized.",
    );
  }

  console.log(
    "\n✅ TOUS LES TESTS AUTHORIZATION PASSENT\n",
  );
}

try {
  await main();
} finally {
  await cleanup();
}