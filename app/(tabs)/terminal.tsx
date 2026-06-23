import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
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
import { WebView } from "react-native-webview";

import { useApp } from "@/context/AppContext";
import { formatSQLResult, listTables, getCurrentDbName, switchDatabase } from "@/services/localSQLite";

const HISTORY_KEY = "terminal_code_history_v1";
const MAX_HISTORY = 50;

const EXEMPLOS_JS = [
  { label: "📐 Matemática", code: `const a = 42, b = 8;\nconsole.log("Soma:", a + b);\nconsole.log("Raiz de 144:", Math.sqrt(144));\nconsole.log("PI:", Math.PI.toFixed(4));` },
  { label: "📋 Lista", code: `const frutas = ["manga", "abacaxi", "goiaba"];\nfrutas.forEach((f, i) => console.log(i+1 + ".", f));\nconsole.log("Total:", frutas.length, "frutas");` },
  { label: "📅 Data/Hora", code: `const agora = new Date();\nconsole.log("Hoje:", agora.toLocaleDateString("pt-BR"));\nconsole.log("Hora:", agora.toLocaleTimeString("pt-BR"));` },
  { label: "🔁 Loop", code: `for (let i = 1; i <= 5; i++) {\n  console.log("Linha", i, "→", "⭐".repeat(i));\n}` },
  { label: "📦 Objeto", code: `const pessoa = { nome: "Dev", skills: ["JS", "React"] };\nconsole.log(JSON.stringify(pessoa, null, 2));` },
  { label: "🌐 Fetch", code: `fetch("https://httpbin.org/get")\n  .then(r => r.json())\n  .then(d => console.log("IP:", d.origin))\n  .catch(e => console.log("Erro:", e.message));` },
];

const EXEMPLOS_SQL = [
  { label: "🗃️ Criar tabela", code: `CREATE TABLE IF NOT EXISTS notas (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  titulo TEXT,\n  conteudo TEXT,\n  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP\n)` },
  { label: "📥 Inserir", code: `INSERT INTO notas (titulo, conteudo)\nVALUES ('Minha nota', 'Conteúdo aqui')` },
  { label: "🔍 Buscar", code: `SELECT * FROM notas ORDER BY id DESC LIMIT 10` },
  { label: "📊 Contar", code: `SELECT COUNT(*) as total FROM notas` },
  { label: "🗑️ Deletar", code: `DELETE FROM notas WHERE id = 1` },
];

// Comandos npm para o WebContainer
const NPM_CMDS = [
  { label: "📦 install + dev", cmd: "npm install && npm run dev", color: "#00d4aa" },
  { label: "▶ npm run dev", cmd: "npm run dev", color: "#00d4aa" },
  { label: "🚀 npm start", cmd: "npm start", color: "#10b981" },
  { label: "🌐 npx serve", cmd: "npx serve .", color: "#60a5fa" },
  { label: "🖥️ node index.js", cmd: "node index.js", color: "#a78bfa" },
  { label: "📥 npm install", cmd: "npm install", color: "#f59e0b" },
  { label: "🔨 npm run build", cmd: "npm run build", color: "#f59e0b" },
  { label: "🧪 npm test", cmd: "npm test", color: "#fb923c" },
  { label: "🧹 npx prettier", cmd: "npx prettier --write .", color: "#e879f9" },
  { label: "📡 npx json-server", cmd: "npx json-server db.json --port 3000", color: "#60a5fa" },
  { label: "⚡ npx vite", cmd: "npx vite", color: "#646cff" },
  { label: "🔄 nodemon", cmd: "npx nodemon index.js", color: "#10b981" },
];

// Templates StackBlitz
const SB_TEMPLATES = [
  { label: "Node.js em branco", url: "https://stackblitz.com/fork/node?embed=1&terminalHeight=40&hideNavigation=0" },
  { label: "Express + API", url: "https://stackblitz.com/fork/node-express?embed=1&terminalHeight=40" },
  { label: "React + Vite", url: "https://stackblitz.com/fork/react-vite?embed=1&terminalHeight=30" },
  { label: "Next.js", url: "https://stackblitz.com/fork/nextjs?embed=1&terminalHeight=30" },
];

interface OutputLine {
  id: string;
  type: "input" | "output" | "error" | "info";
  text: string;
}

export default function TerminalScreen() {
  const insets = useSafeAreaInsets();
  const { activeProject } = useApp();

  const [tab, setTab] = useState<"js" | "sql" | "node">("js");
  const [code, setCode] = useState(`// ⚡ JavaScript rodando no seu celular!\nconst msg = "Olá! Motor Hermes — 100% local";\nconsole.log(msg);\nconsole.log("Projeto:", "${activeProject?.name || 'nenhum'}");`);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [running, setRunning] = useState(false);
  const [sqlInput, setSqlInput] = useState("SELECT sqlite_version();");
  const scrollRef = useRef<ScrollView>(null);
  const idRef = useRef(0);

  // WebView refs
  const webViewRef = useRef<WebView>(null);
  const [sbUrl, setSbUrl] = useState(SB_TEMPLATES[0].url);
  const [webLoading, setWebLoading] = useState(true);

  // Histórico
  const [history, setHistory] = useState<Array<{ code: string; type: "js" | "sql"; ts: number }>>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(raw => {
      if (raw) { try { setHistory(JSON.parse(raw)); } catch {} }
    });
  }, []);

  const saveToHistory = useCallback((src: string, type: "js" | "sql") => {
    setHistory(prev => {
      const deduped = prev.filter(h => h.code !== src);
      const next = [{ code: src, type, ts: Date.now() }, ...deduped].slice(0, MAX_HISTORY);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    setHistIdx(-1);
  }, []);

  const navHistory = useCallback((dir: "up" | "down") => {
    const filtered = history.filter(h => h.type === tab);
    if (!filtered.length) return;
    const newIdx = dir === "up"
      ? Math.min(histIdx + 1, filtered.length - 1)
      : Math.max(histIdx - 1, -1);
    setHistIdx(newIdx);
    if (newIdx === -1) return;
    const entry = filtered[newIdx];
    if (tab === "js") setCode(entry.code);
    else setSqlInput(entry.code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [history, histIdx, tab]);

  const mkId = () => String(++idRef.current);

  const addLine = useCallback((type: OutputLine["type"], text: string) => {
    setOutput(prev => [...prev, { id: mkId(), type, text }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  // Roda JS local via Hermes
  const runJS = useCallback(() => {
    const src = code.trim();
    if (!src) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunning(true);
    const lines: string[] = [];
    const fake = {
      log: (...a: unknown[]) => lines.push(a.map(x => typeof x === "object" ? JSON.stringify(x, null, 2) : String(x)).join(" ")),
      error: (...a: unknown[]) => lines.push("❌ " + a.map(String).join(" ")),
      warn: (...a: unknown[]) => lines.push("⚠️ " + a.map(String).join(" ")),
      info: (...a: unknown[]) => lines.push("ℹ️ " + a.map(String).join(" ")),
    };
    saveToHistory(src, "js");
    addLine("input", `▶ RODANDO (${new Date().toLocaleTimeString("pt-BR")})\n${src}`);
    const t0 = Date.now();
    try {
      const fn = new Function(
        "console", "Math", "JSON", "Date", "Array", "Object", "String",
        "Number", "Boolean", "RegExp", "Error", "Promise", "setTimeout",
        "clearTimeout", "fetch", "encodeURIComponent", "decodeURIComponent",
        `"use strict";\nreturn (async function(){\n${src}\n})();`
      );
      const result = fn(fake, Math, JSON, Date, Array, Object, String, Number, Boolean, RegExp, Error, Promise, setTimeout, clearTimeout, fetch, encodeURIComponent, decodeURIComponent);
      Promise.resolve(result)
        .then(val => {
          const ms = Date.now() - t0;
          const all = [...lines];
          if (val !== undefined && val !== null) all.push("→ " + (typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)));
          all.push(`\n⚡ OK em ${ms}ms — Hermes Engine`);
          addLine("output", all.join("\n") || "(sem saída)");
        })
        .catch(e => addLine("error", `❌ ${e?.message || String(e)}\n⚡ ${Date.now() - t0}ms`))
        .finally(() => setRunning(false));
    } catch (e: unknown) {
      addLine("error", `❌ ${(e as Error)?.message || String(e)}\n\n💡 Verifique a sintaxe.\n⚡ ${Date.now() - t0}ms`);
      setRunning(false);
    }
  }, [code, addLine]);

  // Roda SQL local
  const runSQL = useCallback(async () => {
    const q = sqlInput.replace(/^sql>\s*/i, "").trim();
    if (!q) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveToHistory(q, "sql");
    addLine("input", `🗃️ SQL: ${q}`);
    if (q.startsWith(".tabelas") || q.startsWith(".tables")) {
      try {
        const tabs = await listTables();
        addLine("output", tabs.length ? `Tabelas:\n${tabs.map(t => "  • " + t).join("\n")}` : `Banco vazio — crie com CREATE TABLE`);
      } catch (e: unknown) { addLine("error", `❌ ${(e as Error)?.message}`); }
      return;
    }
    if (q.startsWith(".db ")) {
      const name = q.slice(4).trim();
      try { await switchDatabase(name); addLine("output", `✅ Banco "${getCurrentDbName()}" aberto!`); }
      catch (e: unknown) { addLine("error", `❌ ${(e as Error)?.message}`); }
      return;
    }
    try {
      const result = await formatSQLResult(q);
      addLine("output", result + `\n\n🗃️ Banco: ${getCurrentDbName()}`);
    } catch (e: unknown) { addLine("error", `❌ SQLite: ${(e as Error)?.message}`); }
  }, [sqlInput, addLine]);

  // Injeta comando no terminal do StackBlitz via JavaScript
  const injectCommand = useCallback((cmd: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!webViewRef.current) return;
    // Script que digita o comando no terminal xterm.js do StackBlitz
    const js = `
(function() {
  try {
    var ta = document.querySelector('.xterm-helper-textarea');
    if (!ta) {
      // Tenta dentro de iframes
      var frames = document.querySelectorAll('iframe');
      for (var i = 0; i < frames.length; i++) {
        try {
          ta = frames[i].contentDocument.querySelector('.xterm-helper-textarea');
          if (ta) break;
        } catch(e) {}
      }
    }
    if (ta) {
      ta.focus();
      // Limpa a linha atual (Ctrl+U)
      ta.dispatchEvent(new KeyboardEvent('keydown', {key:'u', ctrlKey:true, bubbles:true}));
      // Digita cada caractere
      var cmd = ${JSON.stringify(cmd)};
      for (var j = 0; j < cmd.length; j++) {
        var ch = cmd[j];
        ta.dispatchEvent(new KeyboardEvent('keydown', {key: ch, bubbles: true}));
        ta.dispatchEvent(new KeyboardEvent('keypress', {key: ch, bubbles: true}));
        var ev = new InputEvent('textInput', {data: ch, bubbles: true});
        ta.dispatchEvent(ev);
        ta.dispatchEvent(new KeyboardEvent('keyup', {key: ch, bubbles: true}));
      }
      // Enter
      setTimeout(function() {
        ta.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', keyCode:13, which:13, bubbles:true}));
        ta.dispatchEvent(new KeyboardEvent('keyup', {key:'Enter', bubbles:true}));
      }, 80);
    } else {
      // Fallback: tenta clicar no terminal para focar
      var terminal = document.querySelector('.terminal') || document.querySelector('[data-testid="terminal"]');
      if (terminal) terminal.click();
    }
  } catch(e) { console.error(e); }
})();
true;
`;
    webViewRef.current.injectJavaScript(js);
    // Copia para clipboard como fallback
    Clipboard.setStringAsync(cmd);
  }, []);

  const clearOutput = () => { setOutput([]); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  const copyOutput = async () => {
    await Clipboard.setStringAsync(output.map(l => l.text).join("\n---\n"));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const tabBottom = Platform.OS === "web" ? 80 : Math.max(insets.bottom, 16) + 70;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#0d1117" }} behavior="padding" keyboardVerticalOffset={tabBottom}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={{
        paddingTop: Platform.OS === "web" ? 14 : insets.top + 6,
        paddingHorizontal: 14, paddingBottom: 10,
        backgroundColor: "#161b22", borderBottomWidth: 1, borderBottomColor: "#30363d",
        flexDirection: "row", alignItems: "center", gap: 10,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#00d4aa", fontSize: 15, fontWeight: "800", fontFamily: "monospace" }}>⚡ Terminal</Text>
          <Text style={{ color: "#8b949e", fontSize: 11, marginTop: 1 }}>
            {tab === "node" ? "Node.js na nuvem (StackBlitz) • precisa de internet" : "JS e SQLite no celular • sem internet"}
          </Text>
        </View>
        {/* Abas */}
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
          {(["js", "sql", "node"] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                backgroundColor: tab === t
                  ? (t === "js" ? "#00d4aa22" : t === "sql" ? "#10b98122" : "#1389fd22")
                  : "#21262d",
                borderWidth: 1,
                borderColor: tab === t
                  ? (t === "js" ? "#00d4aa66" : t === "sql" ? "#10b98166" : "#1389fd66")
                  : "#30363d",
              }}
            >
              <Text style={{
                fontSize: 11, fontWeight: "700",
                color: tab === t
                  ? (t === "js" ? "#00d4aa" : t === "sql" ? "#10b981" : "#60a5fa")
                  : "#8b949e",
              }}>
                {t === "js" ? "JS" : t === "sql" ? "SQL" : "Node"}
              </Text>
            </TouchableOpacity>
          ))}
          {tab !== "node" && (
            <>
              <TouchableOpacity onPress={() => navHistory("up")} style={styles.histBtn} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <Feather name="chevron-up" size={14} color="#8b949e" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navHistory("down")} style={styles.histBtn} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <Feather name="chevron-down" size={14} color="#8b949e" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.histBtn} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <Feather name="clock" size={14} color={history.length ? "#8b949e" : "#30363d"} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* ── Modal Histórico ──────────────────────────────────────── */}
      <Modal visible={showHistory} animationType="slide" transparent onRequestClose={() => setShowHistory(false)}>
        <View style={{ flex: 1, backgroundColor: "#000000cc" }}>
          <View style={{ flex: 1, marginTop: 60, backgroundColor: "#161b22", borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#30363d" }}>
              <Feather name="clock" size={16} color="#00d4aa" />
              <Text style={{ color: "#e6edf3", fontSize: 15, fontWeight: "800", marginLeft: 8, flex: 1 }}>Histórico</Text>
              <TouchableOpacity onPress={() => { setHistory([]); AsyncStorage.removeItem(HISTORY_KEY); }} style={{ marginRight: 12 }}>
                <Text style={{ color: "#f85149", fontSize: 12 }}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Feather name="x" size={20} color="#8b949e" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }}>
              {history.length === 0 ? (
                <Text style={{ color: "#484f58", textAlign: "center", marginTop: 40, fontSize: 14 }}>Nenhum código ainda.</Text>
              ) : history.map((entry, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    if (entry.type === "js") { setTab("js"); setCode(entry.code); }
                    else { setTab("sql"); setSqlInput(entry.code); }
                    setShowHistory(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                  style={{ backgroundColor: entry.type === "js" ? "#7c3aed18" : "#10b98118", borderWidth: 1, borderColor: entry.type === "js" ? "#7c3aed44" : "#10b98144", borderRadius: 10, padding: 12, gap: 4 }}
                >
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <View style={{ backgroundColor: entry.type === "js" ? "#7c3aed33" : "#10b98133", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: entry.type === "js" ? "#a78bfa" : "#34d399", fontSize: 10, fontWeight: "700" }}>{entry.type.toUpperCase()}</Text>
                    </View>
                    <Text style={{ color: "#484f58", fontSize: 10, flex: 1 }}>{new Date(entry.ts).toLocaleString("pt-BR")}</Text>
                    <Feather name="corner-down-left" size={12} color="#484f58" />
                  </View>
                  <Text numberOfLines={3} style={{ color: "#8b949e", fontSize: 12, fontFamily: "monospace", lineHeight: 18 }}>{entry.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ABA NODE.JS — WebContainer StackBlitz                       */}
      {/* ════════════════════════════════════════════════════════════ */}
      {tab === "node" && (
        <View style={{ flex: 1, backgroundColor: "#0d1117" }}>

          {/* Botões de comando npm */}
          <View style={{ backgroundColor: "#161b22", borderBottomWidth: 1, borderBottomColor: "#30363d" }}>
            <Text style={{ color: "#484f58", fontSize: 10, fontFamily: "monospace", paddingTop: 6, paddingHorizontal: 12, marginBottom: 4 }}>
              COMANDOS — toque para rodar no terminal abaixo (e copia no clipboard):
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 8, gap: 6, alignItems: "center" }}>
              {NPM_CMDS.map(({ label, cmd, color }) => (
                <TouchableOpacity
                  key={label}
                  onPress={() => injectCommand(cmd)}
                  style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8, backgroundColor: color + "18", borderWidth: 1, borderColor: color + "55", gap: 2 }}
                >
                  <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{label}</Text>
                  <Text style={{ color: color + "99", fontSize: 9, fontFamily: "monospace" }}>{cmd.length > 28 ? cmd.slice(0, 27) + "…" : cmd}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Templates StackBlitz */}
          <View style={{ backgroundColor: "#0d1117", borderBottomWidth: 1, borderBottomColor: "#21262d" }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6, gap: 6 }}>
              <Text style={{ color: "#484f58", fontSize: 10, fontFamily: "monospace", alignSelf: "center", marginRight: 4 }}>Template:</Text>
              {SB_TEMPLATES.map(({ label, url }) => (
                <TouchableOpacity
                  key={label}
                  onPress={() => { setSbUrl(url); setWebLoading(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
                    backgroundColor: sbUrl === url ? "#1389fd22" : "#21262d",
                    borderWidth: 1, borderColor: sbUrl === url ? "#1389fd66" : "#30363d",
                  }}
                >
                  <Text style={{ color: sbUrl === url ? "#60a5fa" : "#8b949e", fontSize: 11, fontWeight: "600" }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Aviso + indicador de loading */}
          {webLoading && (
            <View style={{ backgroundColor: "#0d1117", padding: 12, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#21262d" }}>
              <Text style={{ color: "#8b949e", fontSize: 12, textAlign: "center" }}>
                ⏳ Carregando StackBlitz... (precisa de internet){"\n"}
                <Text style={{ color: "#484f58", fontSize: 10 }}>Quando o terminal aparecer, use os botões acima para rodar comandos.</Text>
              </Text>
            </View>
          )}

          {/* WebView com StackBlitz */}
          <WebView
            ref={webViewRef}
            source={{ uri: sbUrl }}
            style={{ flex: 1, backgroundColor: "#0d1117" }}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={["*"]}
            onLoadStart={() => setWebLoading(true)}
            onLoadEnd={() => setWebLoading(false)}
            onError={() => setWebLoading(false)}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            mixedContentMode="always"
          />

          {/* Dica de uso */}
          <View style={{ backgroundColor: "#0d1117", paddingHorizontal: 12, paddingVertical: 6, paddingBottom: Math.max(insets.bottom, 8) + 60, borderTopWidth: 1, borderTopColor: "#21262d" }}>
            <Text style={{ color: "#484f58", fontSize: 10, textAlign: "center", fontFamily: "monospace" }}>
              💡 Toque um botão acima → o comando vai para o terminal do StackBlitz{"\n"}
              Se não funcionar: o comando foi copiado no clipboard — cole manualmente
            </Text>
          </View>
        </View>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ABAS JS e SQL                                               */}
      {/* ════════════════════════════════════════════════════════════ */}
      {tab !== "node" && (
        <>
          {/* Exemplos rápidos */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={{ backgroundColor: "#161b22", borderBottomWidth: 1, borderBottomColor: "#30363d", flexShrink: 0 }}
            contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6, gap: 6, alignItems: "center" }}
          >
            {(tab === "js" ? EXEMPLOS_JS : EXEMPLOS_SQL).map(ex => (
              <TouchableOpacity
                key={ex.label}
                onPress={() => {
                  if (tab === "js") setCode(ex.code);
                  else setSqlInput(ex.code);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8,
                  backgroundColor: tab === "js" ? "#7c3aed22" : "#10b98122",
                  borderWidth: 1, borderColor: tab === "js" ? "#7c3aed55" : "#10b98155",
                }}
              >
                <Text style={{ color: tab === "js" ? "#a78bfa" : "#34d399", fontSize: 11, fontWeight: "600" }}>{ex.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Entrada de código */}
          <View style={{ backgroundColor: "#0d1117", flexShrink: 0 }}>
            {tab === "js" ? (
              <TextInput
                style={{ color: "#e6edf3", fontFamily: "monospace", fontSize: 13, lineHeight: 20, padding: 12, minHeight: 130, maxHeight: 200, textAlignVertical: "top", backgroundColor: "#0d1117", borderBottomWidth: 1, borderBottomColor: "#30363d" }}
                value={code}
                onChangeText={setCode}
                multiline
                placeholder="// Digite seu JavaScript aqui..."
                placeholderTextColor="#484f58"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
            ) : (
              <TextInput
                style={{ color: "#34d399", fontFamily: "monospace", fontSize: 13, lineHeight: 20, padding: 12, minHeight: 90, maxHeight: 140, textAlignVertical: "top", backgroundColor: "#021a0e", borderBottomWidth: 1, borderBottomColor: "#10b98133" }}
                value={sqlInput}
                onChangeText={setSqlInput}
                multiline
                placeholder="SELECT * FROM sua_tabela;"
                placeholderTextColor="#1a4a35"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />
            )}

            {/* Botão RODAR */}
            <TouchableOpacity
              onPress={tab === "js" ? runJS : runSQL}
              disabled={running}
              style={{
                marginHorizontal: 12, marginVertical: 8,
                backgroundColor: running ? "#21262d" : (tab === "js" ? "#00d4aa" : "#10b981"),
                borderRadius: 12, paddingVertical: 13,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              }}
              activeOpacity={0.8}
            >
              <Feather name={running ? "loader" : "play"} size={18} color={running ? "#8b949e" : "#0d1117"} />
              <Text style={{ color: running ? "#8b949e" : "#0d1117", fontSize: 16, fontWeight: "900", letterSpacing: 1 }}>
                {running ? "RODANDO..." : tab === "js" ? "▶  RODAR  (JS Local)" : "▶  EXECUTAR  (SQLite)"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Saída */}
          <View style={{ flex: 1, backgroundColor: "#010409" }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#21262d", backgroundColor: "#0d1117" }}>
              <Text style={{ color: "#484f58", fontSize: 11, flex: 1, fontFamily: "monospace" }}>SAÍDA — {output.length} linha(s)</Text>
              <TouchableOpacity onPress={copyOutput} style={{ padding: 6 }} hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}>
                <Feather name="copy" size={13} color="#484f58" />
              </TouchableOpacity>
              <TouchableOpacity onPress={clearOutput} style={{ padding: 6 }} hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}>
                <Feather name="trash-2" size={13} color="#484f58" />
              </TouchableOpacity>
            </View>
            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: tabBottom + 20, gap: 2 }}>
              {output.length === 0 ? (
                <View style={{ paddingTop: 24, alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 32 }}>⚡</Text>
                  <Text style={{ color: "#484f58", fontSize: 14, textAlign: "center", fontFamily: "monospace" }}>Aperte RODAR para executar{"\n"}o código no seu celular</Text>
                  <Text style={{ color: "#30363d", fontSize: 11, textAlign: "center", marginTop: 8, lineHeight: 18 }}>100% local • motor Hermes do Android{"\n"}sem internet • sem servidor</Text>
                </View>
              ) : output.map(line => (
                <Text
                  key={line.id}
                  selectable
                  style={{
                    fontFamily: "monospace", fontSize: 13, lineHeight: 20,
                    color: line.type === "error" ? "#f85149" : line.type === "input" ? "#00d4aa" : line.type === "info" ? "#8b949e" : "#e6edf3",
                    backgroundColor: line.type === "error" ? "#5c050522" : line.type === "input" ? "#00d4aa08" : "transparent",
                    paddingHorizontal: line.type === "input" ? 8 : 0,
                    borderLeftWidth: line.type === "input" ? 2 : 0,
                    borderLeftColor: "#00d4aa",
                    marginBottom: 4, padding: 4, borderRadius: 4,
                  }}
                >
                  {line.text}
                </Text>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  histBtn: {
    padding: 6, backgroundColor: "#21262d", borderRadius: 6,
    borderWidth: 1, borderColor: "#30363d",
  },
});
