import { db } from "../../db";

import { OpenAIProvider } from "../llm/openai";

import { AgentRuntime } from "../runtime/runtime";

import { ToolRegistry } from "../tools/tools";

import { createSubAgentTool } from "../tools/internal/create-sub-agent";
import { currentTimeTool } from "../tools/internal/current-time";
import { searchMemoryTool } from "../tools/internal/search-memory";
import { textAnalyzerTool } from "../tools/internal/text-analyzer";

import { createAgentStore } from "../store";

import { createTestGateway } from "./helpers/test-gateway";
import type { RunContext } from "../events/events";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MODEL =
  process.env.TEST_MODEL ??
  "gpt-6-luna";

const AGENT_ID =
  process.env.TEST_AGENT_ID ??
  "test-agent";

const RUNS = Math.max(
  1,
  Number(process.env.RUNS ?? 1),
);

const MAX_TURNS = Math.max(
  1,
  Number(process.env.MAX_TURNS ?? 10),
);

// ---------------------------------------------------------------------------
// Mission
// ---------------------------------------------------------------------------

const MISSION = `
Réalise entièrement la mission suivante.

Analyse cette phrase :

"Le chat dort tranquillement sur le canapé"

À partir du résultat de ton analyse, détermine si cette phrase
contient plus de 5 mots.

Si c'est le cas, cherche ensuite dans ta mémoire si tu disposes
d'informations concernant cette phrase.

Une fois toutes les étapes nécessaires réalisées, donne-moi
un résumé clair des résultats.

Tu dois accomplir la mission entièrement avant de répondre.
Ne me demande pas de réaliser une étape à ta place.
`.trim();

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const INTERNAL_TOOLS = [
  currentTimeTool,
  textAnalyzerTool,
  searchMemoryTool,
  createSubAgentTool,
];

function buildRegistry(): ToolRegistry {
  const registry =
    new ToolRegistry();

  for (
    const tool of INTERNAL_TOOLS
  ) {
    registry.register(tool);
  }

  return registry;
}

// ---------------------------------------------------------------------------
// Outcome
// ---------------------------------------------------------------------------

interface RunOutcome {
  passed: boolean;
  called: string[];
  uniqueTools: string[];
  messages: number;
  turns: number;
  status: string;
  result?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function runOnce(
  runtime: AgentRuntime,
): Promise<RunOutcome> {
  const context: RunContext = {
    runId: crypto.randomUUID(),
    agentId: "test-agent",
    actorId: "test-user",
  };

  const state =
    await runtime.run(
      context,
      [
        {
          role: "user",
          content: MISSION,
        },
      ],
    );

  const called =
    state.toolResults.map(
      (result) =>
        result.toolId,
    );

  const uniqueTools = [
    ...new Set(called),
  ];

  /*
   * La mission impose normalement :
   *
   * 1. analyse de texte
   * 2. recherche mémoire
   *
   * On vérifie donc explicitement ces deux tools.
   *
   * On ne vérifie pas leur ordre : le runtime doit rester
   * indépendant de l'ordre choisi par le modèle.
   */

  const usedTextAnalyzer =
    uniqueTools.includes(
      "text_analyzer",
    );

  const usedMemorySearch =
    uniqueTools.includes(
      "search_memory",
    );

  const completed =
    state.status === "completed";

  const passed =
    completed &&
    usedTextAnalyzer &&
    usedMemorySearch;

  return {
    passed,

    called,

    uniqueTools,

    messages:
      state.messages.length,

    turns:
      state.turn,

    status:
      state.status,

    result:
      state.result,

    error:
      state.error,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let llm: OpenAIProvider;

  try {
    llm =
      new OpenAIProvider();
  } catch (error) {
    console.error(
      `❌ ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );

    console.error(
      "   Vérifie OPENAI_API_KEY.",
    );

    process.exit(1);
  }

  // --------------------------------------------------
  // DB → AgentStore
  // --------------------------------------------------

  const agents =
    createAgentStore(db);

  // --------------------------------------------------
  // Tools
  // --------------------------------------------------

  const registry =
    buildRegistry();

  // --------------------------------------------------
  // Gateway
  // --------------------------------------------------

  const gateway =
    createTestGateway(
      registry,
    );

  // --------------------------------------------------
  // Runtime
  // --------------------------------------------------

  const runtime =
    new AgentRuntime(
      {
        llm,

        tools:
          registry,

        gateway,

        agents,
      },

      MAX_TURNS,
    );

  // --------------------------------------------------
  // Vérification de l'agent DB
  // --------------------------------------------------

  const agent =
    await agents.get(
      AGENT_ID,
    );

  if (!agent) {
    console.error(
      `❌ Agent "${AGENT_ID}" introuvable dans PostgreSQL.`,
    );

    console.error(
      "",
    );

    console.error(
      "Crée d'abord l'agent de test avec :",
    );

    console.error(
      "bun run src/db/seed-test-agent.ts",
    );

    process.exit(1);
  }

  // --------------------------------------------------
  // Vérification des tools
  // --------------------------------------------------

  /*
   * Pour le test, l'agent DB doit disposer des tools
   * utilisés par la mission.
   *
   * Le premier seed ne les stocke pas encore en DB.
   *
   * On construit donc temporairement la configuration
   * des tools du test ici.
   *
   * La persistance des tools de l'agent viendra ensuite.
   */

  const agentForTest = {
    ...agent,

    model:
      process.env.TEST_MODEL ??
      agent.model ??
      MODEL,

    tools:
      INTERNAL_TOOLS.map(
        (tool) =>
          tool.definition.id,
      ),
  };

  console.log(
    "\n============================================================",
  );

  console.log(
    "  TEST AGENT — MULTI-TOOL / MULTI-STEP",
  );

  console.log(
    "============================================================\n",
  );

  console.log(
    `Agent        : ${agentForTest.id}`,
  );

  console.log(
    `Nom          : ${agentForTest.name}`,
  );

  console.log(
    `Modèle       : ${agentForTest.model}`,
  );

  console.log(
    `Runs         : ${RUNS}`,
  );

  console.log(
    `Max turns    : ${MAX_TURNS}`,
  );

  console.log(
    `Outils       : ${agentForTest.tools.join(", ")}`,
  );

  console.log(
    "\nMission :",
  );

  console.log(MISSION);

  console.log(
    "\n------------------------------------------------------------",
  );

  /*
   * Le runtime doit normalement récupérer l'agent lui-même
   * depuis AgentStore.
   *
   * Le test utilise donc runtime.run(AGENT_ID, ...)
   * et non runtime.run(agent, ...).
   *
   * IMPORTANT :
   * Les tools sont actuellement encore définis au niveau
   * du test, car leur persistance DB n'est pas encore implémentée.
   *
   * Pour que le runtime chargé depuis DB connaisse ces tools,
   * on adapte temporairement l'agent retourné par le store
   * ci-dessous.
   */

  const originalGet =
    agents.get.bind(agents);

  const testAgents = {
    async get(
      agentId: string,
    ) {
      const loaded =
        await originalGet(
          agentId,
        );

      if (!loaded) {
        return null;
      }

      return {
        ...loaded,

        model:
          agentForTest.model,

        tools:
          agentForTest.tools,
      };
    },
  };

  const testRuntime =
    new AgentRuntime(
      {
        llm,

        tools:
          registry,

        gateway,

        agents:
          testAgents,

      },

      MAX_TURNS,
    );

  let totalPassed = 0;

  for (
    let i = 1;
    i <= RUNS;
    i++
  ) {
    console.log(
      `\nRun ${i}/${RUNS}`,
    );

    try {
      const outcome =
        await runOnce(
          testRuntime,
        );

      if (
        outcome.passed
      ) {
        totalPassed++;

        console.log(
          "✅ Mission réussie",
        );
      } else {
        console.log(
          "❌ Mission échouée",
        );
      }

      console.log(
        `   Status       : ${outcome.status}`,
      );

      console.log(
        `   Turns        : ${outcome.turns}`,
      );

      console.log(
        `   Messages     : ${outcome.messages}`,
      );

      console.log(
        `   Tool calls   : ${outcome.called.length}`,
      );

      console.log(
        `   Outils utilisés : ${
          outcome.uniqueTools.length
            ? outcome.uniqueTools.join(
                ", ",
              )
            : "aucun"
        }`,
      );

      if (
        outcome.result
      ) {
        console.log(
          `   Résultat     : ${outcome.result}`,
        );
      }

      if (
        outcome.error
      ) {
        console.log(
          `   Erreur       : ${outcome.error}`,
        );
      }
    } catch (error) {
      console.log(
        "❌ Exception pendant le run",
      );

      console.log(
        `   ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }
  }

  console.log(
    "\n============================================================",
  );

  console.log(
    `Résultat : ${totalPassed}/${RUNS} run(s) réussis`,
  );

  console.log(
    "============================================================\n",
  );

  process.exit(
    totalPassed === RUNS
      ? 0
      : 1,
  );
}

main().catch(
  (error) => {
    console.error(
      "\n❌ Erreur inattendue :",
    );

    console.error(error);

    process.exit(1);
  },
);