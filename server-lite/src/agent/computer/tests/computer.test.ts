import { db } from "../../../db";
import {
  createAgentStore,
} from "../../../agent-profiles/store";

import {
  ComputerSandboxStore,
} from "../sandbox-store";

import { E2BDesktopComputer } from "../desktop-computer";

const agents = createAgentStore(
  db,
  false,
);

const agent = await agents.get("da2b3a8a-5224-44f4-9c6e-84e3b9b583c1");

if (!agent) {
  throw new Error(
    "Agent Mauvais djo not found",
  );
}

console.log(
  "Agent :",
  agent.id,
);

console.log(
  "Sandbox DB avant :",
  agent.computerSandboxId,
);

const store =
  new ComputerSandboxStore(
    agents,
  );

// 1. Création ou reconnexion
const sandbox =
  await store.getOrCreate(
    agent.id,
  );

console.log(
  "Sandbox E2B :",
  sandbox.sandboxId,
);

// 2. Vérifier la persistance DB
const updatedAgent =
  await agents.get(agent.id);

console.log(
  "Sandbox DB après :",
  updatedAgent?.computerSandboxId,
);

if (
  updatedAgent?.computerSandboxId !==
  sandbox.sandboxId
) {
  throw new Error(
    "Sandbox ID was not persisted",
  );
}

// 3. Créer le contrôleur Computer
const computer =
  new E2BDesktopComputer(
    sandbox,
  );

// 4. Lancer Chrome
console.log(
  "Lancement de Chrome...",
);

await computer.launchBrowser();

console.log(
  "Chrome lancé.",
);

// 5. Faire un screenshot
console.log(
  "Screenshot...",
);

const screenshot =
  await computer.screenshot();

console.log(
  "Screenshot reçu.",
);

console.log(
  "Taille Base64 :",
  screenshot.length,
);

// 6. Vérification minimale
if (!screenshot.length) {
  throw new Error(
    "Screenshot is empty",
  );
}

console.log(
  "✅ Computer E2E OK",
);