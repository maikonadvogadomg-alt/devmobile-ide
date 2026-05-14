import { getApiStrategy, getLocalApiPort } from "./runtimeMode";

export function getApiBaseUrl(): string | null {
  const fixedBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const remoteBase = process.env.EXPO_PUBLIC_REMOTE_API_URL?.trim();
  const strategy = getApiStrategy();
  const localPort = getLocalApiPort();

  if (fixedBase) return fixedBase;
  if (strategy === "offline") return null;
  if (strategy === "local-device") return `http://127.0.0.1:${localPort}/api`;
  if (strategy === "termux") return `http://127.0.0.1:${localPort}/api`;
  if (strategy === "remote-custom") return remoteBase || null;

  return null;
}

export function buildApiUrl(path: string): string | null {
  const base = getApiBaseUrl();
  if (!base) return null;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function hasActiveApi(): boolean {
  return Boolean(getApiBaseUrl());
}
