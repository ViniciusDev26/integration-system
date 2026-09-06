import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { createAuthController } from "./modules/auth/http/auth.controller.js";
import { env } from "./shared/env.js";
import { createContextFactory } from "./trpc/context.js";
import { createAppRouter } from "./trpc/router.js";

const { authService, sessionService, musicService, playlistService } =
  createContainer();

const secureCookies = env.NODE_ENV === "production";

const authController = createAuthController({ authService, secureCookies });

const trpcRouter = createAppRouter({
  authService,
  sessionService,
  musicService,
  playlistService,
  secureCookies,
});
const createContext = createContextFactory(authService);

const app = createApp({ authController, trpcRouter, createContext });

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
