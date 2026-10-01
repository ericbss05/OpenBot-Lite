/**
 * Test : l'agent sait-il accomplir une tâche nécessitant plusieurs outils ?
 *
 * Lancer :
 *   bun run src/agent/tests/multi-tool.ts
 *
 * Variables d'environnement :
 *   OPENAI_API_KEY  clé OpenAI (obligatoire)
 *   TEST_MODEL      modèle à tester (défaut : gpt-6-luna)
 *   RUNS            nombre d'essais (défaut : 1)
 *   MAX_TURNS       nombre maximum de tours agent (défaut : 10)
 *
 * Le prompt ne mentionne volontairement aucun nom de tool.
 * L'agent doit déterminer lui-même comment accomplir la mission.
 */

import type { Agent } from "../agent";
import { OpenAIProvider } from "../llm/openai";
import { AgentRuntime } from "../runtime/runtime";
import { ToolRegistry } from "../tools/tools";

import { createSubAgentTool } from "../tools/internal/create-sub-agent";
import { currentTimeTool } from "../tools/internal/current-time";
import { searchMemoryTool } from "../tools/internal/search-memory";
import { textAnalyzerTool } from "../tools/internal/text-analyzer";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MODEL = process.env.TEST_MODEL ?? "gpt-6-luna";
const RUNS = Math.max(1, Number(process.env.RUNS ?? 1));
const MAX_TURNS = Math.max(
  1,
  Number(process.env.MAX_TURNS ?? 10),
);

const MISSION = `
Réalise entièrement la mission suivante :

Analyse la phrase :
"Le chat dort tranquillement sur le canapé"

À partir du résultat de ton analyse, détermine si cette phrase
contient plus de 5 mots.

Si c'est le cas, cherche ensuite dans ta mémoire si tu disposes
d'informations concernant cette phrase.

Une fois toutes les étapes nécessaires réalisées, donne-moi un
résumé clair de tes résultats.

Ne me demande pas de réaliser une étape à ta place.
Tu dois accomplir la mission entièrement avant de répondre.
`.trim();

// ---------------------------------------------------------------------------
// Tools disponibles
//
// IMPORTANT :
// Le test expose les tools à l'agent mais ne lui indique jamais
// lesquels utiliser pour résoudre la mission.
//
// Les tools utilisent directement le contrat Tool.
// Aucune adaptation n'est nécessaire.
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
// Résultat d'un run
// ---------------------------------------------------------------------------

interface RunOutcome {
  passed: boolean;
  called: string[];
  uniqueTools: string[];
  turns: number;
  status: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Exécution d'un run
// ---------------------------------------------------------------------------

async function runOnce(
  runtime: AgentRuntime,
  agent: Agent,
): Promise<RunOutcome> {
  const state = await runtime.run(agent, MISSION);

  const called = state.toolResults.map(
    (result) => result.toolId,
  );

  const uniqueTools = [...new Set(called)];

  const turns = Array.isArray(state.messages)
    ? state.messages.length
    : 0;

  const failed = state.status === "failed";

  /*
   * Pour ce test, on veut réellement vérifier que l'agent
   * sait enchaîner plusieurs actions.
   *
   * On ne vérifie volontairement PAS l'ordre exact des tools.
   *
   * Le modèle doit décider lui-même comment accomplir
   * la mission à partir des descriptions des tools.
   */

  const usedMultipleTools =
    uniqueTools.length >= 2;

  const completedWithoutFailure = !failed;

  const passed =
    completedWithoutFailure &&
    usedMultipleTools;

  return {
    passed,
    called,
    uniqueTools,
    turns,
    status: state.status,
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
          : error
      }\n` +
        "   Ajoute OPENAI_API_KEY dans ton .env ou ton environnement.",
    );

    process.exit(1);
  }

  const registry = buildRegistry();

  const agent: Agent = {
    id: "multi-tool-test-agent",
    name: "Multi Tool Test Agent",

    instructions:
      "Tu es un agent capable d'accomplir des tâches en plusieurs étapes. " +
      "Analyse la demande de l'utilisateur, détermine les actions nécessaires " +
      "et utilise les outils disponibles lorsque cela est nécessaire. " +
      "Après chaque résultat d'outil, réévalue la situation et poursuis la mission " +
      "jusqu'à ce que la tâche soit terminée. " +
      "Ne demande pas à l'utilisateur de réaliser une action que tu peux réaliser toi-même.",

    model: MODEL,

    tools: INTERNAL_TOOLS.map(
      (tool) => tool.definition.id,
    ),

    subAgents: [],
  };

  const runtime = new AgentRuntime(
    {
      llm,
      tools: registry,
    },
    MAX_TURNS,
  );

  console.log(
    "\n" +
      "============================================================\n" +
      "  TEST AGENT — MULTI-TOOL / MULTI-STEP\n" +
      "============================================================\n",
  );

  console.log(`Modèle       : ${MODEL}`);
  console.log(`Runs         : ${RUNS}`);
  console.log(`Max turns    : ${MAX_TURNS}`);
  console.log(
    `Outils       : ${agent.tools.join(", ")}`,
  );

  console.log("\nMission :");
  console.log(MISSION);

  console.log(
    "\n------------------------------------------------------------\n",
  );

  let totalPassed = 0;

  for (let i = 1; i <= RUNS; i++) {
    console.log(`\nRun ${i}/${RUNS}`);

    try {
      const outcome = await runOnce(
        runtime,
        agent,
      );

      if (outcome.passed) {
        totalPassed++;

        console.log("✅ Mission réussie");
      } else {
        console.log("❌ Mission échouée");
      }

      console.log(
        `   Status       : ${outcome.status}`,
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

      console.log(
        `   Messages     : ${outcome.turns}`,
      );

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
    totalPassed === RUNS ? 0 : 1,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});