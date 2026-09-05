export const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_API_USER_URL = "https://api.github.com/user";
export const GITHUB_API_EMAILS_URL = "https://api.github.com/user/emails";

/** Default OAuth scopes: read the profile and access the primary email. */
export const DEFAULT_GITHUB_SCOPES = ["read:user", "user:email"] as const;
