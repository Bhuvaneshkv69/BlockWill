import { createApp } from "./app";
import { env } from "./config/env";
import { startEventListeners } from "./blockchain/eventListener";

const app = createApp();

app.listen(env.port, () => {
  console.log(`BlockWill backend listening on http://localhost:${env.port}`);
  console.log(`Environment: ${env.nodeEnv}`);
  startEventListeners().catch((err) => console.error("Failed to start event listeners", err));
});
