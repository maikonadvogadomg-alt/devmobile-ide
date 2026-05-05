export type AppRuntimeMode = "offline" | "local" | "termux" | "remote" | "hybrid";
export type ApiStrategy = "offline" | "local-device" | "termux" | "remote-custom";

function readBool(value: string | undefined, fallback = false) {
  if (typeof value !== "string") return fallback;
  return value.toLowerCase() === "true";
}

export function getAppRuntimeMode(): AppRuntimeMode {
  const mode = process.env.EXPO_PUBLIC_APP_MODE;
  if (mode === "offline" || mode === "local" || mode === "termux" || mode === "remote" || mode === "hybrid") {
    return mode;
  }
  return "local";
}

export function getApiStrategy(): ApiStrategy {
  const strategy = process.env.EXPO_PUBLIC_API_STRATEGY;
  if (strategy === "offline" || strategy === "local-device" || strategy === "termux" || strategy === "remote-custom") {
    return strategy;
  }
  return "offline";
}

export function getLocalApiPort(): number {
  const parsed = Number(process.env.EXPO_PUBLIC_LOCAL_API_PORT);
  // Porta padrão: 8080 — igual à porta do API server (artifacts/api-server)
  // e igual ao TERMUX_URL usado em useApiBase.ts (localhost:8080)
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : 8080;
}

export function getLocalPreviewPort(): number {
  const parsed = Number(process.env.EXPO_PUBLIC_LOCAL_PREVIEW_PORT);
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : 8080;
}

export function isTermuxEnabled(): boolean {
  return readBool(process.env.EXPO_PUBLIC_ENABLE_TERMUX, false);
}

export function isRemoteAIEnabled(): boolean {
  return readBool(process.env.EXPO_PUBLIC_ENABLE_REMOTE_AI, true);
}

export function isGitHubEnabled(): boolean {
  return readBool(process.env.EXPO_PUBLIC_ENABLE_GITHUB, true);
}

export function isRemoteDbEnabled(): boolean {
  return readBool(process.env.EXPO_PUBLIC_ENABLE_REMOTE_DB, true);
}

export function isRemoteTerminalEnabled(): boolean {
  return readBool(process.env.EXPO_PUBLIC_ENABLE_REMOTE_TERMINAL, false);
}
