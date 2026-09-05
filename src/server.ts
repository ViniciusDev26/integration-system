import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { createAuthController } from "./modules/auth/auth.controller.js";
import { createWebController } from "./modules/web/web.controller.js";
import { env } from "./shared/env.js";

const { authService, sessionService } = createContainer();

const authController = createAuthController({
  authService,
  sessionService,
  secureCookies: env.NODE_ENV === "production",
});

const webController = createWebController({ authService });

const app = createApp({ authController, webController });

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
