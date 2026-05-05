import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useApiBase } from "@/hooks/useApiBase";
import type { TerminalLine } from "@/context/AppContext";
import { formatSQLResult, switchDatabase, listTables, getCurrentDbName } from "@/services/localSQLite";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;


const QUICK_CMDS_SERVER = [
  { label: "📥 baixar (importar)", cmd: "baixar" },
  { label: "📤 enviar (subir projeto)", cmd: "enviar" },
  { label: "📂 pwd + ls", cmd: "pwd && ls -la" },
  { label: "🚀 node index.js", cmd: "nohup node index.js > server.log 2>&1 & echo '✅ Servidor iniciado! PID='$!" },
  { label: "🚀 python3 main.py", cmd: "nohup python3 main.py > server.log 2>&1 & echo '✅ Servidor iniciado! PID='$!" },
  { label: "🚀 npm run dev", cmd: "nohup npm run dev > server.log 2>&1 & echo '✅ Servidor iniciado! PID='$!" },
  { label: "🚀 npm start", cmd: "nohup npm start > server.log 2>&1 & echo '✅ Servidor iniciado! PID='$!" },
  { label: "📋 logs servidor", cmd: "tail -50 server.log" },
  { label: "⛔ parar servidor", cmd: "pkill -f 'node index.js' || pkill -f 'python3 main.py' || pkill -f 'npm' && echo '✅ Servidor parado'" },
  { label: "npm install", cmd: "npm install" },
  { label: "npm install express", cmd: "npm install express" },
  { label: "npm init -y", cmd: "npm init -y" },
  { label: "ls -la", cmd: "ls -la" },
  { label: "cat package.json", cmd: "cat package.json" },
  { label: "node --version", cmd: "node --version" },
  { label: "git init", cmd: "git init" },
  { label: "git status", cmd: "git status" },
  { label: "limpar", cmd: "limpar" },
];

const QUICK_CMDS_LOCAL = [
  { label: "⚡ js> 1+1", cmd: "js> 1+1" },
  { label: "⚡ js> Math.PI", cmd: "js> Math.PI" },
  { label: "⚡ js> JSON.stringify", cmd: "js> JSON.stringify({nome:'Saulo',ok:true}, null, 2)" },
  { label: "⚡ js> Date", cmd: "js> new Date().toLocaleString('pt-BR')" },
  { label: "⚡ js> Array", cmd: "js> [1,2,3,4,5].map(x => x*x)" },
  { label: "⚡ js> fetch", cmd: "js> fetch('https://httpbin.org/get').then(r=>r.json()).then(d=>console.log(d.origin))" },
  { label: "🗃️ sql> CREATE", cmd: "sql> CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, nome TEXT, email TEXT)" },
  { label: "🗃️ sql> INSERT", cmd: "sql> INSERT INTO usuarios (nome, email) VALUES ('Saulo', 'saulo@email.com')" },
  { label: "🗃️ sql> SELECT *", cmd: "sql> SELECT * FROM usuarios" },
  { label: "🗃️ .tabelas", cmd: ".tabelas" },
  { label: "🗃️ .db nome", cmd: ".db meu_projeto" },
  { label: "ls -la", cmd: "ls -la" },
  { label: "tree", cmd: "tree" },
  { label: "cat package.json", cmd: "cat package.json" },
  { label: "limpar", cmd: "limpar" },
];

interface TerminalProps {
  runCmd?: string | null;
  onCmdRan?: () => void;
}

export default function Terminal({ runCmd, onCmdRan }: TerminalProps = {}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const apiBase = useApiBase();
  const TERMINAL_API = apiBase ? `${apiBase}/api/terminal` : "";
  const {
    terminalSessions,
    activeTerminal,
    addTerminalLine,
    clearTerminal,
    addTerminalSession,
    setActiveTerminal,
    removeTerminalSession,
    activeProject,
    createFile,
    createFiles,
  } = useApp();

  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showQuick, setShowQuick] = useState(false);
  const [serverBusy, setServerBusy] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showEditors, setShowEditors] = useState(false);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Verifica se o servidor está acessível
  useEffect(() => {
    if (!TERMINAL_API) { setServerOnline(false); return; }
    const check = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        const r = await fetch(TERMINAL_API.replace("/terminal", "/healthz"), { signal: ctrl.signal });
        clearTimeout(t);
        setServerOnline(r.ok);
      } catch { setServerOnline(false); }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, [TERMINAL_API]);


  const activeSession = terminalSessions.find((s) => s.id === activeTerminal);

  useEffect(() => {
    if (!runCmd) return;
    const timer = setTimeout(() => {
      runCommand(runCmd);
      onCmdRan?.();
    }, 150);
    return () => clearTimeout(timer);
  }, [runCmd]);

  const bottomPad = insets.bottom + TAB_BAR_HEIGHT;

  useEffect(() => {
    if (terminalSessions.length === 0) {
      const welcome = (n: number) => `╔══════════════════════════════════════════╗
║        DevMobile Terminal ${n}             ║
║   100% Local — Sem Servidor Necessário   ║
╚══════════════════════════════════════════╝

⚡ JAVASCRIPT LOCAL (Hermes Engine — sem internet):
   js> 1 + 1                    → 2
   js> Math.sqrt(144)           → 12
   js> [1,2,3].map(x => x*x)   → [1,4,9]
   js> JSON.stringify({a:1})    → '{"a":1}'
   js> new Date().toLocaleString('pt-BR')
   js> fetch('url').then(r=>r.json()).then(console.log)

🗃️  SQLITE LOCAL (banco no próprio celular):
   sql> CREATE TABLE tarefas (id INTEGER PRIMARY KEY, nome TEXT)
   sql> INSERT INTO tarefas (nome) VALUES ('Minha tarefa')
   sql> SELECT * FROM tarefas
   .tabelas          → lista todas as tabelas
   .db nome          → cria/troca banco de dados

📂 MODO OFFLINE (sem servidor):
   ls, pwd, cat, tree, grep, find, echo, cd

🌐 EDITORES ONLINE (terminal Linux real):
   StackBlitz, Gitpod, Codespaces — veja botões acima

Projeto ativo: ${activeProject?.name || "(nenhum)"}
$ `;
      const s1 = addTerminalSession("Terminal 1");
      addTerminalLine(s1.id, { type: "info", content: welcome(1) });
      const s2 = addTerminalSession("Terminal 2");
      addTerminalLine(s2.id, { type: "info", content: welcome(2) });
      const s3 = addTerminalSession("Terminal 3");
      addTerminalLine(s3.id, { type: "info", content: welcome(3) });
    }
  }, []);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  const execOnServer = useCallback(
    async (sessionId: string, command: string) => {
      if (!TERMINAL_API) {
        addTerminalLine(sessionId, {
          type: "error",
          content: "Servidor não configurado (EXPO_PUBLIC_DOMAIN ausente).",
        });
        return;
      }
      setServerBusy(true);
      try {
        const res = await fetch(`${TERMINAL_API}/exec`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, sessionId }),
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => `HTTP ${res.status}`);
          addTerminalLine(sessionId, { type: "error", content: `Erro do servidor: ${msg}` });
          return;
        }
        const processSSELine = (line: string) => {
          if (line.startsWith(": ")) return; // ignora heartbeat e comentários SSE
          if (!line.startsWith("data: ")) return;
          const raw = line.slice(6).trim();
          try {
            const parsed = JSON.parse(raw);
            if (parsed.done) return true;
            if (parsed.type === "stdout") addTerminalLine(sessionId, { type: "output", content: parsed.data });
            else if (parsed.type === "stderr") addTerminalLine(sessionId, { type: "output", content: parsed.data });
            else if (parsed.type === "error") addTerminalLine(sessionId, { type: "error", content: parsed.data });
            else if (parsed.type === "exit" && parsed.data !== "0")
              addTerminalLine(sessionId, { type: "info", content: `[exit ${parsed.data}]\n` });
          } catch {}
          return false;
        };

        if (Platform.OS === "web" || !res.body) {
          const text = await res.text();
          for (const line of text.split("\n")) {
            if (processSSELine(line)) break;
          }
        } else {
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              if (processSSELine(line)) { reader.cancel(); return; }
            }
            scrollToEnd();
          }
        }
      } catch (e) {
        addTerminalLine(sessionId, {
          type: "error",
          content: `Erro de conexão: ${e instanceof Error ? e.message : String(e)}`,
        });
      } finally {
        setServerBusy(false);
        scrollToEnd();
      }
    },
    [TERMINAL_API, addTerminalLine, scrollToEnd]
  );

  const uploadProjectToServer = useCallback(
    async (sessionId: string) => {
      if (!activeProject) {
        addTerminalLine(sessionId, { type: "error", content: "Nenhum projeto ativo. Abra um projeto primeiro." });
        return;
      }
      if (!TERMINAL_API) {
        addTerminalLine(sessionId, { type: "error", content: "Servidor não configurado." });
        return;
      }
      addTerminalLine(sessionId, { type: "info", content: `📤 Enviando "${activeProject.name}" para o servidor...` });
      setServerBusy(true);
      try {
        const res = await fetch(`${TERMINAL_API}/write`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            files: activeProject.files
              .filter((f) => !f.path?.endsWith(".gitkeep"))
              .map((f) => ({
                path: f.path || f.name,
                content: f.content || "",
              })),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        addTerminalLine(sessionId, {
          type: "output",
          content: `✅ ${data.count} arquivo(s) enviados!\n📁 Diretório: ${data.cwd}\n\nUse "pwd && ls -la" para confirmar.\nAgora rode: npm install && node index.js`,
        });
      } catch (e) {
        addTerminalLine(sessionId, {
          type: "error",
          content: `Erro ao enviar: ${e instanceof Error ? e.message : String(e)}`,
        });
      } finally {
        setServerBusy(false);
        scrollToEnd();
      }
    },
    [activeProject, TERMINAL_API, addTerminalLine, scrollToEnd]
  );

  const downloadFromServer = useCallback(
    async (sessionId: string) => {
      if (!activeProject) {
        Alert.alert("Aviso", "Abra ou crie um projeto antes de importar do servidor.");
        return;
      }
      if (!TERMINAL_API) {
        addTerminalLine(sessionId, { type: "error", content: "Servidor não configurado." });
        return;
      }
      setServerBusy(true);
      addTerminalLine(sessionId, { type: "info", content: "📥 Lendo arquivos do servidor... aguarde." });
      try {
        const res = await fetch(`${TERMINAL_API}/read?sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { ok: boolean; cwd: string; files: Array<{ path: string; content: string }> } = await res.json();
        if (!data.files?.length) {
          addTerminalLine(sessionId, { type: "info", content: `📂 Workspace vazio: ${data.cwd}\n\nUse "enviar" para subir o projeto ou crie arquivos pelo terminal primeiro.` });
          setServerBusy(false);
          return;
        }

        const tree = data.files.map((f) => `  📄 ${f.path}`).join("\n");
        addTerminalLine(sessionId, {
          type: "output",
          content: `📁 Servidor: ${data.cwd}\n${tree}\n\n${data.files.length} arquivo(s) — importando TODOS para "${activeProject.name}"...`,
        });

        // Importa TODOS de uma só vez (uma única setState)
        createFiles(activeProject.id, data.files);

        addTerminalLine(sessionId, {
          type: "output",
          content: `✅ ${data.files.length} arquivo(s) importados com árvore completa para "${activeProject.name}"!\n\nAbra o explorador de arquivos para ver a estrutura.`,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        addTerminalLine(sessionId, {
          type: "error",
          content: `Erro ao ler servidor: ${e instanceof Error ? e.message : String(e)}`,
        });
      } finally {
        setServerBusy(false);
        scrollToEnd();
      }
    },
    [activeProject, TERMINAL_API, addTerminalLine, createFiles, scrollToEnd]
  );

  // ── JavaScript local — roda no Hermes Engine do Android, sem servidor ───────
  const runJSLocally = useCallback(
    (code: string): string => {
      const output: string[] = [];
      const start = Date.now();

      const captureConsole = {
        log: (...args: unknown[]) => {
          output.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" "));
        },
        error: (...args: unknown[]) => {
          output.push("❌ " + args.map((a) => String(a)).join(" "));
        },
        warn: (...args: unknown[]) => {
          output.push("⚠️ " + args.map((a) => String(a)).join(" "));
        },
        dir: (obj: unknown) => {
          output.push(JSON.stringify(obj, null, 2));
        },
        table: (obj: unknown) => {
          try { output.push(JSON.stringify(obj, null, 2)); } catch { output.push(String(obj)); }
        },
      };

      const vfs: Record<string, string> = {};
      for (const f of activeProject?.files ?? []) {
        vfs[f.path || f.name] = f.content || "";
      }

      try {
        const fn = new Function(
          "console", "Math", "JSON", "Date", "Array", "Object", "String", "Number", "Boolean", "RegExp", "Error", "Promise", "setTimeout", "clearTimeout",
          `"use strict";\nreturn (function(){\n${code}\n})();`
        );
        const result = fn(
          captureConsole, Math, JSON, Date, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
          setTimeout, clearTimeout
        );
        const ms = Date.now() - start;
        const lines = [...output];
        if (result !== undefined && result !== null) {
          try {
            const resultStr = typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);
            if (result && typeof result.then === "function") {
              result.then((v: unknown) => {
                const str = typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
                lines.push(`→ (Promise) ${str}`);
              }).catch((e: unknown) => {
                lines.push(`→ (Promise rejected) ${e instanceof Error ? e.message : String(e)}`);
              });
              lines.push(`→ Promise<pending> (resultado aparecerá em breve)`);
            } else {
              lines.push(`→ ${resultStr}`);
            }
          } catch { lines.push("→ [object]"); }
        }
        lines.push(`\n⚡ ${ms}ms — Hermes Engine (100% local, sem servidor)`);
        return lines.join("\n");
      } catch (e: unknown) {
        const ms = Date.now() - start;
        const errMsg = e instanceof Error ? e.message : String(e);
        return `${output.join("\n")}${output.length ? "\n" : ""}❌ ${errMsg}\n⚡ ${ms}ms`;
      }
    },
    [activeProject]
  );

  // ── Terminal offline — simula comandos básicos sem servidor ─────────────────
  const [offlineCwd, setOfflineCwd] = useState("/projeto");

  const execOffline = useCallback(
    (_sessionId: string, trimmed: string, cwd: string): string | null => {
      const files = activeProject?.files || [];
      const parts = trimmed.trim().split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      const fileMap: Record<string, string> = {};
      for (const f of files) {
        const p = (f.path || f.name).replace(/^\//, "");
        fileMap[p] = f.content || "";
      }

      const normCwd = cwd.replace(/^\//, "") || "";

      if (cmd === "pwd") return cwd;

      if (cmd === "ls") {
        const target = args[0]
          ? (args[0].startsWith("/") ? args[0].replace(/^\//, "") : (normCwd ? normCwd + "/" + args[0] : args[0]))
          : normCwd;
        const prefix = target ? target + "/" : "";
        const seen = new Set<string>();
        for (const p of Object.keys(fileMap)) {
          if (p.startsWith(prefix) || (!prefix && !p.includes("/"))) {
            const rest = p.slice(prefix.length);
            const first = rest.split("/")[0];
            if (first) seen.add(first + (rest.includes("/") ? "/" : ""));
          }
        }
        if (seen.size === 0) return `ls: ${args[0] || "."}: pasta vazia ou não encontrada`;
        return Array.from(seen).sort().join("  ");
      }

      if (cmd === "cat") {
        if (!args[0]) return "cat: faltou o nome do arquivo";
        const rel = args[0].startsWith("/") ? args[0].replace(/^\//, "") : (normCwd ? normCwd + "/" + args[0] : args[0]);
        if (fileMap[rel] !== undefined) return fileMap[rel] || "(arquivo vazio)";
        if (fileMap[args[0]] !== undefined) return fileMap[args[0]] || "(arquivo vazio)";
        return `cat: ${args[0]}: arquivo não encontrado`;
      }

      if (cmd === "echo") return args.join(" ");

      if (cmd === "head") {
        const n = args.indexOf("-n") !== -1 ? parseInt(args[args.indexOf("-n") + 1]) || 10 : 10;
        const file = args.find(a => !a.startsWith("-") && a !== String(n));
        if (!file) return "head: faltou o nome do arquivo";
        const rel = file.startsWith("/") ? file.replace(/^\//, "") : (normCwd ? normCwd + "/" + file : file);
        const content = fileMap[rel] ?? fileMap[file];
        if (content === undefined) return `head: ${file}: arquivo não encontrado`;
        return content.split("\n").slice(0, n).join("\n");
      }

      if (cmd === "wc") {
        const file = args.find(a => !a.startsWith("-"));
        if (!file) return "wc: faltou o nome do arquivo";
        const rel = file.startsWith("/") ? file.replace(/^\//, "") : (normCwd ? normCwd + "/" + file : file);
        const content = fileMap[rel] ?? fileMap[file];
        if (content === undefined) return `wc: ${file}: arquivo não encontrado`;
        const lines = content.split("\n").length;
        const words = content.split(/\s+/).filter(Boolean).length;
        const bytes = content.length;
        return `  ${lines}  ${words}  ${bytes} ${file}`;
      }

      if (cmd === "grep") {
        const pattern = args[0];
        const file = args[1];
        if (!pattern || !file) return "uso: grep <padrão> <arquivo>";
        const rel = file.startsWith("/") ? file.replace(/^\//, "") : (normCwd ? normCwd + "/" + file : file);
        const content = fileMap[rel] ?? fileMap[file];
        if (content === undefined) return `grep: ${file}: arquivo não encontrado`;
        try {
          const re = new RegExp(pattern, "g");
          const matches = content.split("\n").filter(l => re.test(l));
          return matches.length ? matches.join("\n") : `(nenhuma linha contém "${pattern}")`;
        } catch { return `grep: padrão inválido: ${pattern}`; }
      }

      if (cmd === "find") {
        const keys = Object.keys(fileMap);
        const name = args.find((a, i) => args[i-1] === "-name");
        if (name) {
          const pattern = name.replace(/\*/g, ".*");
          const re = new RegExp(pattern);
          return keys.filter(k => re.test(k.split("/").pop() || "")).map(k => "./" + k).join("\n") || "(nenhum arquivo encontrado)";
        }
        return keys.map(k => "./" + k).join("\n");
      }

      if (cmd === "cd") {
        if (!args[0] || args[0] === "~") { setOfflineCwd("/projeto"); return null; }
        if (args[0] === "..") {
          const parts2 = cwd.replace(/\/$/, "").split("/");
          parts2.pop();
          setOfflineCwd(parts2.join("/") || "/");
          return null;
        }
        const next = args[0].startsWith("/") ? args[0] : cwd.replace(/\/$/, "") + "/" + args[0];
        setOfflineCwd(next);
        return null;
      }

      if (cmd === "tree") {
        const keys = Object.keys(fileMap).sort();
        const lines: string[] = ["."];
        for (const k of keys) lines.push("├── " + k);
        return lines.join("\n");
      }

      if (cmd === "node" || cmd === "python" || cmd === "python3" || cmd === "npm" || cmd === "npx") {
        return `⚠️  Modo offline — comandos de execução precisam de servidor.\nUse "enviar" para subir o projeto ao servidor e rodar lá.`;
      }

      if (cmd === "help" || cmd === "ajuda") {
        return `╔══════════════════════════════════════════════════╗
║          DevMobile — Todos os Comandos           ║
╚══════════════════════════════════════════════════╝

⚡ JAVASCRIPT LOCAL (Hermes Engine, sem servidor):
  js> <código>       Roda JavaScript direto no Android
  js> 1+1            → 2
  js> Math.sqrt(9)   → 3
  js> [1,2,3].map(x=>x*2)  → [2,4,6]
  js> new Date().toLocaleString('pt-BR')
  js> fetch('url').then(r=>r.json()).then(console.log)
  node -e "<código>" Alias para js>

🗃️  SQLITE LOCAL (banco no próprio celular):
  sql> <query>       Executa SQL no banco local
  sql> CREATE TABLE tarefas (id INTEGER PRIMARY KEY, nome TEXT)
  sql> INSERT INTO tarefas (nome) VALUES ('Minha tarefa')
  sql> SELECT * FROM tarefas WHERE nome LIKE '%tarefa%'
  sql> UPDATE tarefas SET nome='Novo' WHERE id=1
  sql> DROP TABLE IF EXISTS tarefas
  .tabelas           Lista todas as tabelas
  .db <nome>         Cria/abre banco de dados local

📂 MODO OFFLINE (sem servidor):
  ls [pasta]         Lista arquivos e pastas
  pwd                Diretório atual
  cat <arquivo>      Mostra conteúdo do arquivo
  cd <pasta>         Muda diretório
  echo <texto>       Imprime texto
  head [-n N] <arq>  Primeiras N linhas (padrão: 10)
  wc <arquivo>       Conta linhas, palavras, bytes
  grep <p> <arq>     Busca padrão no arquivo
  find [-name <p>]   Lista/busca arquivos do projeto
  tree               Árvore de arquivos
  clear / limpar     Limpa o terminal

🌐 COM SERVIDOR CONFIGURADO:
  enviar             Sobe projeto para o servidor
  baixar             Importa arquivos do servidor
  npm, node, python, pip, git — tudo funciona`;
      }

      return null; // comando não reconhecido offline
    },
    [activeProject, setOfflineCwd]
  );

  const runCommand = useCallback(
    async (cmd: string) => {
      if (!activeSession) return;
      const trimmed = cmd.trim();
      if (!trimmed) return;

      setCommandHistory((prev) => [trimmed, ...prev.slice(0, 99)]);
      setHistoryIndex(-1);

      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const parts = trimmed.split(/\s+/);
      const command = parts[0].toLowerCase();

      if (command === "limpar" || command === "clear") {
        clearTerminal(activeSession.id);
        return;
      }

      if (command === "baixar" || trimmed === "sync" || trimmed === "sync down") {
        await downloadFromServer(activeSession.id);
        return;
      }

      if (command === "enviar" || trimmed === "sync up") {
        await uploadProjectToServer(activeSession.id);
        return;
      }

      // ── js> — JavaScript local via Hermes Engine ──────────────────────────────
      const isJsCmd =
        trimmed.startsWith("js>") ||
        trimmed.startsWith("js> ") ||
        (command === "js" && parts.length > 1) ||
        trimmed.startsWith("node -e ") ||
        trimmed.startsWith("node -p ");
      if (isJsCmd) {
        const code = trimmed
          .replace(/^js>\s*/, "")
          .replace(/^js\s+/, "")
          .replace(/^node -p\s+"?/, "return ")
          .replace(/^node -e\s+"?/, "")
          .replace(/"$/, "");
        addTerminalLine(activeSession.id, { type: "input", content: `⚡ ${trimmed}` });
        const result = runJSLocally(code);
        addTerminalLine(activeSession.id, { type: "output", content: result });
        scrollToEnd();
        return;
      }

      // ── sql> — SQLite local no celular ────────────────────────────────────────
      const isSqlCmd =
        trimmed.startsWith("sql>") ||
        trimmed.startsWith("sql> ") ||
        (command === "sql" && parts.length > 1);
      if (isSqlCmd) {
        const query = trimmed.replace(/^sql>\s*/, "").replace(/^sql\s+/, "");
        addTerminalLine(activeSession.id, { type: "input", content: `🗃️ ${trimmed}` });
        try {
          const result = await formatSQLResult(query);
          addTerminalLine(activeSession.id, { type: "output", content: `${result}\n\n🗃️ SQLite local: ${getCurrentDbName()}` });
        } catch (e: unknown) {
          addTerminalLine(activeSession.id, { type: "error", content: `❌ SQLite: ${e instanceof Error ? e.message : String(e)}` });
        }
        scrollToEnd();
        return;
      }

      // ── .tabelas — lista tabelas do banco local ───────────────────────────────
      if (trimmed === ".tabelas" || trimmed === ".tables" || trimmed === "sqlite .tables") {
        addTerminalLine(activeSession.id, { type: "input", content: `$ ${trimmed}` });
        try {
          const tables = await listTables();
          addTerminalLine(activeSession.id, {
            type: "output",
            content: tables.length
              ? `🗃️ Banco: ${getCurrentDbName()}\n${tables.map((t) => `  • ${t}`).join("\n")}\n\n${tables.length} tabela(s)`
              : `🗃️ Banco: ${getCurrentDbName()}\n(nenhuma tabela — crie com: sql> CREATE TABLE nome (...))`
          });
        } catch (e: unknown) {
          addTerminalLine(activeSession.id, { type: "error", content: `❌ SQLite: ${e instanceof Error ? e.message : String(e)}` });
        }
        scrollToEnd();
        return;
      }

      // ── .db <nome> — cria/troca banco de dados local ──────────────────────────
      if (trimmed.startsWith(".db ")) {
        const dbName = trimmed.replace(/^\.db\s+/, "").trim();
        addTerminalLine(activeSession.id, { type: "input", content: `$ ${trimmed}` });
        try {
          await switchDatabase(dbName);
          addTerminalLine(activeSession.id, { type: "output", content: `🗃️ Banco criado/aberto: ${getCurrentDbName()}\nArmazenado no celular em: DocumentDirectory/${getCurrentDbName()}\n\nUse: sql> CREATE TABLE para criar tabelas` });
        } catch (e: unknown) {
          addTerminalLine(activeSession.id, { type: "error", content: `❌ ${e instanceof Error ? e.message : String(e)}` });
        }
        scrollToEnd();
        return;
      }

      addTerminalLine(activeSession.id, { type: "input", content: `$ ${trimmed}` });
      scrollToEnd();

      // ── Modo offline: executa localmente quando não há servidor ──────────────
      if (!serverOnline) {
        const result = execOffline(activeSession.id, trimmed, offlineCwd);
        if (result !== null) {
          addTerminalLine(activeSession.id, { type: "output", content: result });
        } else if (command !== "cd") {
          addTerminalLine(activeSession.id, {
            type: "error",
            content: `${command}: não disponível no modo offline.\nUse: js> <código> para JavaScript local\n     sql> <query> para SQLite local\n     .tabelas para ver o banco\nDigite "ajuda" para ver os comandos disponíveis.`,
          });
        }
        scrollToEnd();
        return;
      }

      // ── Modo online: usa servidor real ────────────────────────────────────────
      const args = parts.slice(1);
      const isRunFile =
        (["node", "python", "python3", "bash", "ruby", "php", "go"].includes(command) &&
          args.length > 0 && !args[0].startsWith("-")) ||
        (command === "npx" && args.length > 1);
      if (isRunFile && activeProject && TERMINAL_API) {
        await uploadProjectToServer(activeSession.id);
      }
      await execOnServer(activeSession.id, trimmed);
    },
    [activeSession, activeProject, addTerminalLine, clearTerminal, scrollToEnd, execOnServer, uploadProjectToServer, downloadFromServer, createFiles, serverOnline, execOffline, offlineCwd, runJSLocally]
  );


  const handleCtrlC = useCallback(async () => {
    if (!activeSession || !TERMINAL_API) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    addTerminalLine(activeSession.id, { type: "info", content: "^C" });
    try {
      await fetch(`${TERMINAL_API}/interrupt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSession.id }),
      });
    } catch {}
    setServerBusy(false);
  }, [activeSession, TERMINAL_API, addTerminalLine]);

  const handleSubmit = () => {
    if (input.trim()) {
      runCommand(input);
      setInput("");
    }
  };

  const handleHistoryUp = () => {
    const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
    setHistoryIndex(newIndex);
    if (commandHistory[newIndex]) setInput(commandHistory[newIndex]);
  };

  const handleHistoryDown = () => {
    const newIndex = Math.max(historyIndex - 1, -1);
    setHistoryIndex(newIndex);
    setInput(newIndex === -1 ? "" : commandHistory[newIndex]);
  };

  const renderLine = ({ item }: { item: TerminalLine }) => {
    const color =
      item.type === "input"
        ? colors.primary
        : item.type === "error"
          ? colors.destructive
          : item.type === "info"
            ? colors.info
            : colors.foreground;
    return (
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <Text
          style={[
            styles.line,
            {
              color,
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              fontSize: 14,
              flex: 1,
              backgroundColor: item.type === "error" ? colors.destructive + "18" : undefined,
              borderLeftWidth: item.type === "input" ? 2 : 0,
              borderLeftColor: colors.primary,
              paddingLeft: item.type === "input" ? 6 : 2,
            },
          ]}
          selectable
        >
          {item.content}
        </Text>
        {item.type !== "input" && (
          <TouchableOpacity
            onPress={() => {
              Clipboard.setStringAsync(item.content);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}
            style={{ padding: 4, marginTop: 2, opacity: 0.45 }}
          >
            <Feather name="copy" size={10} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const terminalBody = (isFullscreen: boolean) => (
    <>
      {/* Session Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", gap: 4, paddingHorizontal: 4 }}>
            {terminalSessions.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setActiveTerminal(s.id)}
                style={[styles.tab, { backgroundColor: s.id === activeTerminal ? colors.secondary : "transparent", borderColor: s.id === activeTerminal ? colors.primary : colors.border }]}
              >
                <Feather name="terminal" size={11} color={s.id === activeTerminal ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.tabText, { color: s.id === activeTerminal ? colors.primary : colors.mutedForeground }]}>{s.name}</Text>
                {terminalSessions.length > 1 && (
                  <TouchableOpacity onPress={() => removeTerminalSession(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={10} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <TouchableOpacity onPress={() => { const s = addTerminalSession(`Terminal ${terminalSessions.length + 1}`); addTerminalLine(s.id, { type: "info", content: `DevMobile Terminal — ${new Date().toLocaleString("pt-BR")}\n` }); }} style={styles.addTab}>
          <Feather name="plus" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => activeSession && clearTerminal(activeSession.id)} style={styles.addTab}>
          <Feather name="trash-2" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={scrollToEnd} style={styles.addTab}>
          <Feather name="chevrons-down" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFullscreen(!isFullscreen)}
          style={styles.addTab}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <Feather name={isFullscreen ? "minimize-2" : "maximize-2"} size={13} color={isFullscreen ? colors.primary : colors.mutedForeground} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: serverBusy ? "#f59e0b" : "#00d4aa" }} />
          <Text style={{ fontSize: 9, color: "#00d4aa", fontWeight: "700" }}>{serverBusy ? "EXEC" : "LIVE"}</Text>
        </View>
      </View>

      {/* Banner servidor */}
      {serverOnline === false ? (
        <View style={{ backgroundColor: "#0d1a0d", borderBottomWidth: 1, borderBottomColor: "#22c55e44", paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "700", marginBottom: 2 }}>✅ Modo offline ativo — ls, cat, grep, find, tree, echo funcionam</Text>
          <Text style={{ color: "#86efac", fontSize: 11, marginBottom: 6 }}>Para rodar código (node, npm, python): configure um servidor abaixo</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <TouchableOpacity onPress={() => { const setupUrl = apiBase ? `${apiBase}/api/termux/setup.sh` : "https://SEU_SERVIDOR/api/termux/setup.sh"; Alert.alert("📱 Termux — Terminal no Celular", `curl -fsSL "${setupUrl}" | bash`, [{ text: "Fechar" }]); }} style={{ backgroundColor: "#22c55e22", borderWidth: 1, borderColor: "#22c55e55", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={{ fontSize: 13 }}>📱</Text><Text style={{ color: "#22c55e", fontSize: 11, fontWeight: "700" }}>Termux (offline)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL("https://github.com/codespaces")} style={{ backgroundColor: "#60a5fa22", borderWidth: 1, borderColor: "#60a5fa55", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={{ fontSize: 13 }}>🐙</Text><Text style={{ color: "#60a5fa", fontSize: 11, fontWeight: "700" }}>Codespaces</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { const repo = activeProject?.gitRepo; const ghPath = repo ? repo.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").trim() : null; Linking.openURL(ghPath ? `https://vscode.dev/github/${ghPath}` : "https://vscode.dev"); }} style={{ backgroundColor: "#007acc33", borderWidth: 1, borderColor: "#007acc88", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={{ fontSize: 13 }}>💻</Text><Text style={{ color: "#007acc", fontSize: 11, fontWeight: "700" }}>VS Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.serverBanner, { backgroundColor: serverOnline ? "#00d4aa12" : "#007acc12", borderColor: serverOnline ? "#00d4aa44" : "#007acc44" }]}>
          <Text style={{ color: serverOnline ? "#00d4aa" : "#007acc", fontSize: 10, fontWeight: "600", flex: 1 }}>
            {serverBusy ? "⏳ Executando comando..." : serverOnline ? "🐧 Servidor Linux online — bash, python3, node, git, npm, pip" : "🔄 Conectando ao servidor..."}
          </Text>
          {serverBusy && <ActivityIndicator size="small" color="#00d4aa" />}
          {!serverBusy && serverOnline && (
            <View style={{ flexDirection: "row", gap: 6 }}>
              {activeProject && (<TouchableOpacity onPress={() => activeSession && uploadProjectToServer(activeSession.id)} style={{ backgroundColor: "#00d4aa33", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}><Text style={{ color: "#00d4aa", fontSize: 10, fontWeight: "700" }}>📤 Enviar</Text></TouchableOpacity>)}
              <TouchableOpacity onPress={() => activeSession && downloadFromServer(activeSession.id)} style={{ backgroundColor: "#a855f733", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}><Text style={{ color: "#a855f7", fontSize: 10, fontWeight: "700" }}>📥 Importar</Text></TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Editores web — colapsável */}
      <TouchableOpacity onPress={() => setShowEditors(v => !v)} style={{ backgroundColor: "#0d111788", borderBottomWidth: 1, borderBottomColor: "#ffffff11", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 5, gap: 6 }} activeOpacity={0.7}>
        <Text style={{ color: "#ffffff55", fontSize: 10, flex: 1 }}>💻 Abrir no editor online</Text>
        <Feather name={showEditors ? "chevron-up" : "chevron-down"} size={12} color="#ffffff44" />
      </TouchableOpacity>
      {showEditors && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: "#0d111788", borderBottomWidth: 1, borderBottomColor: "#ffffff11", flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6, gap: 6, alignItems: "center" }}>
          {[
            { label: "💻 VS Code", color: "#007acc", buildUrl: (p: string | null) => p ? `https://vscode.dev/github/${p}` : "https://vscode.dev" },
            { label: "⚡ StackBlitz", color: "#1389fd", buildUrl: (p: string | null) => p ? `https://stackblitz.com/github/${p}` : "https://stackblitz.com" },
            { label: "🟠 Gitpod", color: "#ff8a00", buildUrl: (p: string | null) => p ? `https://gitpod.io/#https://github.com/${p}` : "https://gitpod.io" },
            { label: "🐙 Codespaces", color: "#60a5fa", buildUrl: (p: string | null) => p ? `https://github.com/codespaces/new?repo=${p}` : "https://github.com/codespaces" },
          ].map(({ label, color, buildUrl }) => {
            const repo = activeProject?.gitRepo ?? null;
            const ghPath = repo ? repo.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").trim() : null;
            return (
              <TouchableOpacity key={label} onPress={() => Linking.openURL(buildUrl(ghPath))} style={{ backgroundColor: color + "22", borderWidth: 1, borderColor: color + "66", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Saída */}
      <FlatList
        ref={listRef}
        data={activeSession?.history ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderLine}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
        onContentSizeChange={scrollToEnd}
        onLayout={scrollToEnd}
        ListEmptyComponent={
          <Text style={[styles.line, { color: colors.mutedForeground, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}>
            Terminal vazio. Execute um comando abaixo.{"\n"}Digite 'ajuda' para ver os comandos disponíveis.
          </Text>
        }
      />

      {/* Comandos rápidos */}
      {showQuick && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.quickBar, { backgroundColor: colors.card, borderColor: colors.border }]} contentContainerStyle={{ paddingHorizontal: 8, gap: 6, alignItems: "center" }}>
          {(serverOnline ? QUICK_CMDS_SERVER : QUICK_CMDS_LOCAL).map(({ label, cmd }) => (
            <TouchableOpacity key={cmd} onPress={() => { setInput(cmd); setShowQuick(false); inputRef.current?.focus(); }} style={[styles.quickBtn, { backgroundColor: cmd.startsWith("js>") || cmd.startsWith("js ") ? "#7c3aed22" : cmd.startsWith("sql>") || cmd.startsWith(".tab") || cmd.startsWith(".db") ? "#065f4622" : colors.secondary, borderColor: cmd.startsWith("js>") || cmd.startsWith("js ") ? "#7c3aed66" : cmd.startsWith("sql>") || cmd.startsWith(".tab") || cmd.startsWith(".db") ? "#10b98166" : colors.border }]}>
              <Text style={[styles.quickText, { color: colors.foreground, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Campo de entrada fixo */}
      <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: isFullscreen ? Math.max(insets.bottom, 12) : Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity onPress={() => setShowQuick((v) => !v)} style={[styles.histBtn, { backgroundColor: showQuick ? colors.primary + "33" : colors.secondary }]}>
          <Feather name="zap" size={13} color={showQuick ? colors.primary : colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); inputRef.current?.focus(); }} style={[styles.histBtn, { backgroundColor: "#7c3aed22" }]}>
          <Feather name="mic" size={14} color="#7c3aed" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleHistoryUp} style={[styles.histBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="chevron-up" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[styles.prompt, { color: colors.primary, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}>$</Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.foreground, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13 }]}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Digite um comando..."
          placeholderTextColor={colors.mutedForeground}
        />
        <TouchableOpacity onPress={handleHistoryDown} style={[styles.histBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
        {serverBusy && (<TouchableOpacity onPress={handleCtrlC} style={[styles.ctrlCBtn]} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>^C</Text></TouchableOpacity>)}
        <TouchableOpacity onPress={handleSubmit} disabled={serverBusy && !input.trim()} style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.secondary }]}>
          <Feather name="corner-down-left" size={16} color={input.trim() ? colors.primaryForeground : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </>
  );

  if (fullscreen) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setFullscreen(false)}>
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: colors.terminalBg }]}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          keyboardVerticalOffset={0}
        >
          {terminalBody(true)}
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.terminalBg }]}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={TAB_BAR_HEIGHT}
    >
      {terminalBody(false)}
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 4,
    minHeight: 36,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  tabText: { fontSize: 11, fontWeight: "500" },
  addTab: { paddingHorizontal: 10, paddingVertical: 4 },
  line: { lineHeight: 20, paddingHorizontal: 2, marginBottom: 2 },
  serverBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 8,
  },
  quickBar: {
    maxHeight: 40,
    borderTopWidth: 1,
    paddingVertical: 4,
  },
  quickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
  },
  quickText: { fontSize: 11 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  prompt: { fontSize: 16, fontWeight: "bold" },
  input: { flex: 1, height: 44, fontSize: 14 },
  histBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlCBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 34,
  },
});
