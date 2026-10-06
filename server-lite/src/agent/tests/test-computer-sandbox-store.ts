import { db } from "../../db";

import {
  createAgentStore,
} from "../../agent-profiles/store";

import {
  ComputerSandboxStore,
} from "../computer/sandbox-store";

const agents = createAgentStore(
  db,
  false,
);

const yohan = await agents.get("yohan");
const arkam = await agents.get("arkam");

if (!yohan) {
  throw new Error(
    "Agent yohan not found",
  );
}

if (!arkam) {
  throw new Error(
    "Agent arkam not found",
  );
}

const store =
  new ComputerSandboxStore(
    agents,
  );

const yohanSandbox =
  await store.getOrCreate(
    yohan.id,
  );

console.log(
  "Yohan :",
  yohanSandbox.sandboxId,
);

const storedYohan =
  await agents.get(yohan.id);

console.log(
  "ID sauvegardé en DB :",
  storedYohan?.computerSandboxId,
);

if (
  storedYohan?.computerSandboxId !==
  yohanSandbox.sandboxId
) {
  throw new Error(
    "Sandbox ID was not persisted in database",
  );
}

// On recrée le store pour vérifier
// que la persistance fonctionne réellement.
const newStore =
  new ComputerSandboxStore(
    agents,
  );

const yohanReconnect =
  await newStore.getOrCreate(
    yohan.id,
  );

console.log(
  "Yohan reconnect :",
  yohanReconnect.sandboxId,
);

if (
  yohanReconnect.sandboxId !==
  yohanSandbox.sandboxId
) {
  throw new Error(
    "Reconnection did not use the persisted sandbox",
  );
}

const arkamSandbox =
  await newStore.getOrCreate(
    arkam.id,
  );

console.log(
  "Arkam :",
  arkamSandbox.sandboxId,
);

if (
  arkamSandbox.sandboxId ===
  yohanSandbox.sandboxId
) {
  throw new Error(
    "Agents are sharing the same sandbox",
  );
}

console.log(
  "Yohan même sandbox :",
  yohanSandbox.sandboxId ===
    yohanReconnect.sandboxId,
);

console.log(
  "Agents isolés :",
  yohanSandbox.sandboxId !==
    arkamSandbox.sandboxId,
);

await newStore.remove(yohan.id);
await newStore.remove(arkam.id);

console.log(
  "Sandboxes supprimés.",
);
