import { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { getApiBaseUrl } from "@/services/apiBase";

const CLOUD_URL  = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";
const CHECK_MS = 8000;

async function ping(base: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(`${base}/api/healthz`, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Hook central de URL da API.
 * Prioridade: EXPO_PUBLIC_API_BASE_URL > customServerUrl (settings) > auto-detect (Termux → Cloud)
 * A porta do Termux é configurável em Configurações > Porta Termux (padrão: 8080).
 * Retorna string vazia quando não há API disponível (modo offline) OU quando serverEnabled=false.
 * Verifica a cada 8s — se o Termux for iniciado depois, detecta automaticamente.
 */
export function useApiBase(): string {
  const { settings } = useApp();

  // Se o servidor estiver desabilitado nas configurações, retorna vazio imediatamente.
  // O app funciona 100% com chaves diretas de IA sem precisar de servidor.
  const serverEnabled = settings.serverEnabled ?? false;

  const fixedServiceUrl = getApiBaseUrl() ?? "";
  const custom = settings.customServerUrl?.trim();
  const termuxPort = settings.termuxPort ?? 8080;
  const termuxUrl = `http://127.0.0.1:${termuxPort}`;

  const [active, setActive] = useState<string>(() => {
    if (!serverEnabled) return "";
    if (fixedServiceUrl) return fixedServiceUrl;
    if (custom) {
      const url = custom.replace(/\/$/, "");
      return url.startsWith("http") ? url : `http://${url}`;
    }
    return CLOUD_URL || "";
  });

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Servidor desligado pelo usuário — funciona só com chaves diretas de IA
    if (!serverEnabled) {
      setActive("");
      if (timer.current) clearInterval(timer.current);
      return;
    }

    if (fixedServiceUrl) {
      setActive(fixedServiceUrl);
      if (timer.current) clearInterval(timer.current);
      return;
    }

    if (custom) {
      const url = custom.replace(/\/$/, "");
      setActive(url.startsWith("http") ? url : `http://${url}`);
      if (timer.current) clearInterval(timer.current);
      return;
    }

    let cancelled = false;

    async function detect() {
      if (await ping(termuxUrl)) {
        if (!cancelled) setActive(termuxUrl);
      } else if (CLOUD_URL && await ping(CLOUD_URL)) {
        if (!cancelled) setActive(CLOUD_URL);
      } else {
        if (!cancelled) setActive("");
      }
    }

    detect();
    timer.current = setInterval(detect, CHECK_MS);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [serverEnabled, fixedServiceUrl, custom, termuxUrl]);

  return active;
}

export function getDefaultDomain(): string {
  return process.env.EXPO_PUBLIC_DOMAIN ?? "";
}
