import { createApp } from "./app.js";
import { env } from "./shared/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
