import { buildApiUrl, hasActiveApi } from "./apiBase";
import { getApiStrategy, isRemoteTerminalEnabled, isTermuxEnabled } from "./runtimeMode";

export type TerminalMode = "simulado" | "local" | "termux" | "remoto" | "indisponivel";

export function getTerminalMode(): TerminalMode {
  const strategy = getApiStrategy();

  if (strategy === "offline") return "simulado";
  if (strategy === "termux" && isTermuxEnabled()) return "termux";
  if (strategy === "local-device" && hasActiveApi()) return "local";
  if (strategy === "remote-custom" && isRemoteTerminalEnabled()) return "remoto";

  return "indisponivel";
}

export function canUseRealTerminal(): boolean {
  const mode = getTerminalMode();
  return mode === "local" || mode === "termux" || mode === "remoto";
}

export function getTerminalExecuteUrl(): string | null {
  return buildApiUrl("/terminal/execute");
}

export function getTerminalInstallUrl(): string | null {
  return buildApiUrl("/terminal/install");
}
