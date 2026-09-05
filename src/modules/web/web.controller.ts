import { readCookie } from "../../shared/http/cookies.js";
import { SESSION_COOKIE } from "../auth/auth.controller.constants.js";
import type {
  CurrentUserView,
  WebController,
  WebControllerOptions,
} from "./web.controller.types.js";

export function createWebController(
  options: WebControllerOptions,
): WebController {
  const { authService } = options;

  return {
    async home(req, res) {
      const sessionId = readCookie(req, SESSION_COOKIE);
      const user =
        sessionId.length > 0
          ? await authService.getCurrentUser(sessionId)
          : null;

      const currentUser: CurrentUserView | null =
        user === null
          ? null
          : {
              displayName: user.name ?? user.email,
              email: user.email,
              imageUrl: user.imageUrl,
            };

      res.render("home", { title: "Spotifake", currentUser });
    },
  };
}
