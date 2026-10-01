import { db } from "../../db";
import { createAgentStore } from "../store";

async function main() {
  console.log(
    "============================================================",
  );
  console.log(
    "  TEST AGENT STORE — DATABASE",
  );
  console.log(
    "============================================================",
  );

  const store = createAgentStore(db);

  const agent = await store.get(
    "test-agent",
  );

  if (!agent) {
    console.error(
      "❌ Agent introuvable.",
    );

    process.exit(1);
  }

  console.log("");
  console.log(
    "✅ Agent chargé depuis PostgreSQL",
  );

  console.log("");
  console.log("ID           :", agent.id);
  console.log("Nom          :", agent.name);
  console.log(
    "Instructions :",
    agent.instructions,
  );
  console.log("Model        :", agent.model);
  console.log(
    "Tools        :",
    agent.tools.join(", ") || "aucun",
  );
  console.log(
    "Sub-agents   :",
    agent.subAgents.join(", ") || "aucun",
  );

  console.log("");
  console.log(
    "============================================================",
  );
  console.log(
    "TEST AGENT STORE RÉUSSI",
  );
  console.log(
    "============================================================",
  );
}

main().catch((error) => {
  console.error(
    "❌ Test échoué",
  );
  console.error(error);
  process.exit(1);
});