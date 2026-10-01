/**
 * Test : l'agent sait-il accomplir une tâche nécessitant plusieurs outils ?
 *
 * Lancer :
 *   bun run src/agent/tests/multi-tool.ts
 *
 * Variables :
 *   OPENAI_API_KEY  clé OpenAI
 *   TEST_MODEL      modèle (défaut : gpt-6-luna)
 *   RUNS            nombre d'essais (défaut : 1)
 *   MAX_TURNS       nombre maximum de tours (défaut : 10)
 *
 * Le prompt ne donne volontairement pas les noms des tools.
 */

import type { Agent } from "../agent";
import { OpenAIProvider } from "../llm/openai";
import { AgentRuntime } from "../runtime/runtime";
import { ToolRegistry } from "../tools/tools";

import { createSubAgentTool } from "../tools/internal/create-sub-agent";
import { currentTimeTool } from "../tools/internal/current-time";
import { searchMemoryTool } from "../tools/internal/search-memory";
import { textAnalyzerTool } from "../tools/internal/text-analyzer";

import { createTestGateway } from "./helpers/test-gateway";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MODEL =
  process.env.TEST_MODEL ??
  "gpt-6-luna";

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
  const registry = new ToolRegistry();

  for (const tool of INTERNAL_TOOLS) {
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
  agent: Agent,
): Promise<RunOutcome> {
  const state = await runtime.run(
    agent,
    MISSION,
  );

  const called =
    state.toolResults.map(
      (result) => result.toolId,
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
    messages: state.messages.length,
    turns: state.turn,
    status: state.status,
    result: state.result,
    error: state.error,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let llm: OpenAIProvider;

  try {
    llm = new OpenAIProvider();
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

  const registry =
    buildRegistry();

  const gateway =
    createTestGateway(registry);

  const agent: Agent = {
    id: "multi-tool-test-agent",

    name:
      "Multi Tool Test Agent",

    instructions: `
Tu es un agent capable d'accomplir des tâches
en plusieurs étapes.

Analyse toujours la demande de l'utilisateur.

Lorsque plusieurs actions sont nécessaires,
utilise les outils disponibles.

Après chaque résultat d'outil :
- analyse le résultat ;
- détermine si une autre action est nécessaire ;
- continue la mission si nécessaire.

Tu dois terminer la tâche avant de répondre.

Ne demande jamais à l'utilisateur de réaliser
une action que tu peux réaliser toi-même.
    `.trim(),

    model: MODEL,

    tools: INTERNAL_TOOLS.map(
      (tool) =>
        tool.definition.id,
    ),

    subAgents: [],
  };

  const runtime =
    new AgentRuntime(
      {
        llm,
        tools: registry,
        gateway,
      },
      MAX_TURNS,
    );

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
    `Modèle       : ${MODEL}`,
  );

  console.log(
    `Runs         : ${RUNS}`,
  );

  console.log(
    `Max turns    : ${MAX_TURNS}`,
  );

  console.log(
    `Outils       : ${agent.tools.join(", ")}`,
  );

  console.log(
    "\nMission :",
  );

  console.log(MISSION);

  console.log(
    "\n------------------------------------------------------------",
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
          runtime,
          agent,
        );

      if (outcome.passed) {
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
            ? outcome.uniqueTools.join(", ")
            : "aucun"
        }`,
      );

      if (outcome.result) {
        console.log(
          `   Résultat     : ${outcome.result}`,
        );
      }

      if (outcome.error) {
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
