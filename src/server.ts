import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { createAuthController } from "./modules/auth/auth.controller.js";
import { createRequireAuth } from "./modules/auth/require-auth.js";
import { createMusicController } from "./modules/music/music.controller.js";
import { createWebController } from "./modules/web/web.controller.js";
import { env } from "./shared/env.js";

const { authService, sessionService, musicService } = createContainer();

const authController = createAuthController({
  authService,
  sessionService,
  secureCookies: env.NODE_ENV === "production",
});

const webController = createWebController({ authService });
const musicController = createMusicController({ musicService });
const requireAuth = createRequireAuth({ authService });

const app = createApp({
  authController,
  webController,
  musicController,
  requireAuth,
});

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
