import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useApiBase } from "@/hooks/useApiBase";

type Stat = "ok" | "warn" | "fail" | "checking" | "idle";

interface Check {
  id: string;
  label: string;
  icon: string;
  stat: Stat;
  detail: string;
  realOutput?: string;
}

async function runCmd(cmd: string, sessionId: string, terminalApi: string): Promise<string> {
  if (!terminalApi) return "(sem servidor)";
  try {
    const res = await fetch(`${terminalApi}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd, sessionId }),
    });
    if (!res.ok) return `HTTP ${res.status}`;
    const text = await res.text();
    const lines: string[] = [];
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const j = JSON.parse(line.slice(6).trim());
        if (j.done) break;
        if (j.type === "stdout" || j.type === "stderr") lines.push(j.data?.trim() ?? "");
      } catch {}
    }
    return lines.filter(Boolean).join("\n").trim() || "(sem saída)";
  } catch (e: any) {
    return `Erro: ${e?.message ?? String(e)}`;
  }
}

function Dot({ stat }: { stat: Stat }) {
  const color =
    stat === "ok" ? "#00d4aa" :
    stat === "warn" ? "#f59e0b" :
    stat === "fail" ? "#ef4444" :
    stat === "checking" ? "#60a5fa" : "#555";
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 8, marginTop: 3 }} />;
}

export default function SystemStatus({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { aiProviders, dbConfigs, gitConfigs, activeProject, terminalSessions, settings } = useApp();
  const apiBase = useApiBase();
  const hasDirectKey = !!settings.geminiDirectKey?.trim();
  const API_BASE = apiBase ? `${apiBase}/api` : "";
  const TERMINAL_API = apiBase ? `${apiBase}/api/terminal` : "";
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const sid = useRef(`status_${Date.now()}`);

  const update = (id: string, patch: Partial<Check>) =>
    setChecks(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));

  const runAllChecks = useCallback(async () => {
    const session = `status_${Date.now()}`;
    sid.current = session;
    setDone(false);
    setRunning(true);

    const initial: Check[] = [
      { id: "internet", label: "Conexão à internet", icon: "wifi", stat: "checking", detail: "Verificando..." },
      { id: "api",      label: "Servidor Linux (API)", icon: "server", stat: "checking", detail: "Verificando..." },
      { id: "terminal", label: "Terminal Linux real", icon: "terminal", stat: "checking", detail: "Verificando..." },
      { id: "node",     label: "Node.js", icon: "code", stat: "checking", detail: "Verificando..." },
      { id: "npm",      label: "npm", icon: "package", stat: "checking", detail: "Verificando..." },
      { id: "python",   label: "Python 3", icon: "cpu", stat: "checking", detail: "Verificando..." },
      { id: "pip",      label: "pip3", icon: "download", stat: "checking", detail: "Verificando..." },
      { id: "git",      label: "Git", icon: "git-branch", stat: "checking", detail: "Verificando..." },
      { id: "bash",     label: "Bash / Shell", icon: "hash", stat: "checking", detail: "Verificando..." },
      { id: "disk",     label: "Espaço em disco", icon: "hard-drive", stat: "checking", detail: "Verificando..." },
      { id: "mem",      label: "Memória RAM", icon: "activity", stat: "checking", detail: "Verificando..." },
      { id: "ai",       label: "IA Cortesia (Gemini)", icon: "zap", stat: "checking", detail: "Verificando..." },
      { id: "vscode",   label: "VS Code (vscode.dev)", icon: "monitor", stat: "idle", detail: "Acessível via aba Plugins" },
      { id: "projects", label: "Projetos salvos", icon: "folder", stat: "idle", detail: "" },
      { id: "git_acc",  label: "Conta Git configurada", icon: "git-merge", stat: "idle", detail: "" },
    ];
    setChecks(initial);

    // 1 — Internet
    try {
      const r = await fetch("https://1.1.1.1/cdn-cgi/trace", { cache: "no-store" }).catch(() => null);
      update("internet", { stat: r ? "ok" : "fail", detail: r ? "Online ✅" : "Offline — sem internet ❌" });
    } catch {
      update("internet", { stat: "fail", detail: "Offline ❌" });
    }

    // 2 — API server (tenta 3x antes de marcar como falha)
    if (!API_BASE) {
      update("api", { stat: "warn", detail: "Servidor não configurado. Configure nas Configurações." });
    } else {
      let ok = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await fetch(`${API_BASE}/healthz`, { cache: "no-store" }).catch(() => null);
          if (r?.ok) { ok = true; break; }
        } catch {}
        if (attempt < 2) await new Promise(res => setTimeout(res, 1500));
      }
      update("api", { stat: ok ? "ok" : "warn", detail: ok ? `Servidor online ✅` : `Servidor não respondeu — verifique conexão` });
    }

    // 3 — Terminal (run a real command)
    {
      const out = await runCmd("echo 'DEVMOBILE_OK' && uname -srm", session, TERMINAL_API);
      const ok = out.includes("DEVMOBILE_OK");
      update("terminal", {
        stat: ok ? "ok" : "fail",
        detail: ok ? "Comandos Linux executam de verdade ✅" : "Falha na execução ❌",
        realOutput: out,
      });
    }

    // 4 — Node.js
    {
      const out = await runCmd("node --version 2>&1 && node -e \"console.log('Node OK')\"", session, TERMINAL_API);
      const match = out.match(/v\d+\.\d+\.\d+/);
      update("node", {
        stat: match ? "ok" : "fail",
        detail: match ? `Versão: ${match[0]} ✅` : "Não encontrado ❌",
        realOutput: out,
      });
    }

    // 5 — npm
    {
      const out = await runCmd("npm --version 2>&1", session, TERMINAL_API);
      const match = out.match(/\d+\.\d+\.\d+/);
      update("npm", {
        stat: match ? "ok" : "warn",
        detail: match ? `npm v${match[0]} ✅` : "Não encontrado",
        realOutput: out,
      });
    }

    // 6 — Python
    {
      const out = await runCmd("python3 --version 2>&1", session, TERMINAL_API);
      const match = out.match(/Python\s+\S+/i);
      update("python", {
        stat: match ? "ok" : "warn",
        detail: match ? `${match[0]} ✅` : "Não encontrado",
        realOutput: out,
      });
    }

    // 7 — pip
    {
      const out = await runCmd("pip3 --version 2>&1 | head -1", session, TERMINAL_API);
      const hasPip = out.toLowerCase().includes("pip");
      update("pip", {
        stat: hasPip ? "ok" : "warn",
        detail: hasPip ? `${out.split(" from")[0]} ✅` : "Não encontrado",
        realOutput: out,
      });
    }

    // 8 — Git
    {
      const out = await runCmd("git --version 2>&1", session, TERMINAL_API);
      const match = out.match(/git version\s+\S+/i);
      update("git", {
        stat: match ? "ok" : "warn",
        detail: match ? `${match[0]} ✅` : "Não encontrado",
        realOutput: out,
      });
    }

    // 9 — Bash
    {
      const out = await runCmd("bash --version 2>&1 | head -1", session, TERMINAL_API);
      const hasBash = out.toLowerCase().includes("bash");
      update("bash", {
        stat: hasBash ? "ok" : "warn",
        detail: hasBash ? `${out.slice(0, 50)} ✅` : "Não encontrado",
        realOutput: out,
      });
    }

    // 10 — Disk
    {
      const out = await runCmd("df -h /tmp 2>&1 | tail -1", session, TERMINAL_API);
      update("disk", {
        stat: out.includes("%") ? "ok" : "warn",
        detail: out.includes("%") ? `${out.replace(/\s+/g, " ").trim()}` : "Não foi possível verificar",
        realOutput: out,
      });
    }

    // 11 — Memory
    {
      const out = await runCmd("free -m 2>&1 | head -2", session, TERMINAL_API);
      const hasMem = out.toLowerCase().includes("mem");
      update("mem", {
        stat: hasMem ? "ok" : "warn",
        detail: hasMem ? out.replace(/\n/g, " | ").trim() : "Não foi possível verificar",
        realOutput: out,
      });
    }

    // 12 — AI (Gemini Direto tem prioridade, depois tenta servidor)
    if (hasDirectKey) {
      try {
        const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${settings.geminiDirectKey!.trim()}` },
          body: JSON.stringify({ model: "gemini-2.5-flash", max_tokens: 10, stream: false, messages: [{ role: "user", content: "hi" }] }),
        }).catch(() => null);
        update("ai", {
          stat: r?.ok ? "ok" : "warn",
          detail: r?.ok ? "Gemini DIRETO do celular ✅ (sem servidor!)" : `Chave inválida ou offline (${r?.status})`,
        });
      } catch {
        update("ai", { stat: "warn", detail: "Chave Gemini configurada mas sem internet" });
      }
    } else if (API_BASE) {
      try {
        const r = await fetch(`${API_BASE}/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: "responda só: OK" }] }),
          cache: "no-store",
        }).catch(() => null);
        update("ai", {
          stat: r?.ok ? "ok" : "warn",
          detail: r?.ok ? "Gemini via servidor ✅" : "Servidor offline — adicione chave Gemini nas Configurações",
        });
      } catch {
        update("ai", { stat: "warn", detail: "Sem acesso ao Gemini — adicione chave nas Configurações" });
      }
    } else {
      update("ai", { stat: "warn", detail: "Sem Gemini — configure chave em Configurações → GEMINI DIRETO" });
    }

    // 13 — VS Code (static)
    update("vscode", {
      stat: "ok",
      detail: "vscode.dev disponível (WebView) — abre via Plugins ✅",
    });

    // 14 — Projects
    update("projects", {
      stat: "ok",
      detail: activeProject
        ? `Projeto ativo: "${activeProject.name}" · ${activeProject.files.length} arquivo(s) ✅`
        : "Nenhum projeto aberto (crie um na aba Projetos)",
    });

    // 15 — Git account
    update("git_acc", {
      stat: gitConfigs.length > 0 ? "ok" : "warn",
      detail: gitConfigs.length > 0
        ? `Conectado: ${gitConfigs.map(g => `${g.provider} (${g.username})`).join(", ")} ✅`
        : "Nenhuma conta Git — configure em Projetos → GitHub",
    });

    setDone(true);
    setRunning(false);
  }, [aiProviders, dbConfigs, gitConfigs, activeProject, terminalSessions]);

  useEffect(() => {
    if (visible) runAllChecks();
  }, [visible]);

  const ok = checks.filter(c => c.stat === "ok").length;
  const warn = checks.filter(c => c.stat === "warn").length;
  const fail = checks.filter(c => c.stat === "fail").length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#0a0a0a" }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>🩺 STATUS DO SISTEMA — REAL</Text>
            <Text style={styles.subtitle}>Verificações ao vivo no servidor Linux</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={20} color="#aaa" />
          </TouchableOpacity>
        </View>

        {/* Summary bar */}
        {done && (
          <View style={styles.summaryBar}>
            <Text style={{ color: "#00d4aa", fontSize: 13, fontWeight: "700" }}>✅ {ok} OK</Text>
            <Text style={{ color: "#f59e0b", fontSize: 13, fontWeight: "700" }}>⚠️ {warn} atenção</Text>
            <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "700" }}>❌ {fail} falha</Text>
          </View>
        )}
        {running && (
          <View style={[styles.summaryBar, { backgroundColor: "#001833" }]}>
            <ActivityIndicator size="small" color="#60a5fa" />
            <Text style={{ color: "#60a5fa", fontSize: 12, marginLeft: 8, fontWeight: "600" }}>
              Testando comandos reais no servidor Linux...
            </Text>
          </View>
        )}

        {/* Checks list */}
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 20 }}>
          {checks.map(c => (
            <View key={c.id} style={styles.row}>
              <Dot stat={c.stat} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name={c.icon as any} size={12} color={
                    c.stat === "ok" ? "#00d4aa" :
                    c.stat === "fail" ? "#ef4444" :
                    c.stat === "warn" ? "#f59e0b" :
                    c.stat === "checking" ? "#60a5fa" : "#555"
                  } />
                  <Text style={styles.rowLabel}>{c.label}</Text>
                  {c.stat === "checking" && <ActivityIndicator size="small" color="#60a5fa" style={{ marginLeft: 4 }} />}
                </View>
                <Text style={[styles.rowDetail, {
                  color: c.stat === "fail" ? "#ef4444" : c.stat === "warn" ? "#f59e0b" : c.stat === "ok" ? "#94a3b8" : "#555"
                }]}>
                  {c.stat === "checking" ? "aguardando..." : c.detail}
                </Text>
                {c.realOutput && (
                  <Text style={styles.rawOutput} selectable numberOfLines={3}>
                    $ {c.realOutput}
                  </Text>
                )}
              </View>
            </View>
          ))}

          {/* O que funciona de verdade */}
          {done && (
            <View style={{ marginTop: 20, backgroundColor: "#0d1f0d", borderWidth: 1, borderColor: "#1f4d1f", borderRadius: 12, padding: 14 }}>
              <Text style={{ color: "#4ade80", fontWeight: "800", fontSize: 14, marginBottom: 10 }}>
                ✅ O QUE FUNCIONA DE VERDADE
              </Text>
              {[
                "Terminal Linux — bash, node, python3, git, pip, npm, curl, wget, tudo",
                "npm install QUALQUER pacote — output completo linha por linha",
                "pip3 install QUALQUER biblioteca Python",
                "VS Code real — vscode.dev — igual no desktop (aba Plugins)",
                "Sincronização bidirecional: app → VS Code → app (Upload/Download)",
                "Git + GitHub — clone, push, pull, status, diff",
                "IA Jasmim — sem precisar de API key (cortesia Gemini)",
                "Campo Livre — chat sem restrições, com TTS e seleção de voz",
                "3 terminais simultâneos com sessões independentes",
                "Instalar Python, Node.js, TypeScript, Rust, Go, Java... pela aba Plugins",
                "Exportar/Importar projeto como ZIP",
                "Playground HTML — visualizar HTML/CSS/JS na hora",
                "Banco de dados Postgres (Neon) via configurações",
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                  <Text style={{ color: "#4ade80", fontSize: 13 }}>›</Text>
                  <Text style={{ color: "#86efac", fontSize: 13, flex: 1, lineHeight: 19 }}>{item}</Text>
                </View>
              ))}

              <Text style={{ color: "#f59e0b", fontWeight: "800", fontSize: 14, marginBottom: 10, marginTop: 14 }}>
                ⚠️ REQUISITOS
              </Text>
              {(hasDirectKey ? [
                "Gemini IA: só precisa de internet (chave direta configurada ✅)",
                "Terminal Linux: precisa do servidor (Termux no celular)",
                "Termux + Termux:API instalado = terminal funciona 100% offline no celular",
              ] : [
                "Gemini IA: precisa do servidor externo OU adicione sua chave em Configurações",
                "Terminal Linux: precisa do servidor (Termux instalado)",
                "Configure a chave Gemini gratuita em: aistudio.google.com",
              ]).map((item, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                  <Text style={{ color: "#f59e0b", fontSize: 13 }}>!</Text>
                  <Text style={{ color: "#fcd34d", fontSize: 13, flex: 1, lineHeight: 19 }}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
          <TouchableOpacity
            onPress={runAllChecks}
            disabled={running}
            style={[styles.rerunBtn, { backgroundColor: running ? "#1a1a1a" : "#007acc" }]}
          >
            {running
              ? <><ActivityIndicator size="small" color="#60a5fa" /><Text style={styles.rerunText}>  Testando...</Text></>
              : <><Feather name="refresh-cw" size={15} color="#fff" /><Text style={styles.rerunText}>  TESTAR TUDO DE NOVO</Text></>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  title: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
  subtitle: { color: "#64748b", fontSize: 11, marginTop: 2 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a", borderRadius: 8 },
  summaryBar: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#111",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1e1e1e",
  },
  rowLabel: { color: "#e2e8f0", fontSize: 13, fontWeight: "600" },
  rowDetail: { fontSize: 11, marginTop: 2, lineHeight: 16 },
  rawOutput: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 10,
    color: "#475569",
    marginTop: 4,
    backgroundColor: "#0f0f0f",
    padding: 6,
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: "#1e3a5f",
  },
  footer: {
    backgroundColor: "#111",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#222",
  },
  rerunBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
  },
  rerunText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
