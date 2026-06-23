import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
import { formatSQLResult, listTables, getCurrentDbName, switchDatabase } from "@/services/localSQLite";

const HISTORY_KEY = "terminal_code_history_v1";
const MAX_HISTORY = 50;

// ── Exemplos rápidos que realmente funcionam ─────────────────────────────────
const EXEMPLOS = [
  { label: "📐 Matemática", code: `const a = 42;
const b = 8;
console.log("Soma:", a + b);
console.log("Raiz de 144:", Math.sqrt(144));
console.log("PI:", Math.PI.toFixed(4));` },
  { label: "📋 Lista", code: `const frutas = ["manga", "abacaxi", "goiaba"];
frutas.forEach((f, i) => console.log(i+1 + ".", f));
console.log("Total:", frutas.length, "frutas");` },
  { label: "📅 Data/Hora", code: `const agora = new Date();
console.log("Hoje:", agora.toLocaleDateString("pt-BR"));
console.log("Hora:", agora.toLocaleTimeString("pt-BR"));
console.log("Timestamp:", agora.getTime());` },
  { label: "🔁 Loop", code: `for (let i = 1; i <= 5; i++) {
  console.log("Linha", i, "→", "⭐".repeat(i));
}` },
  { label: "📦 Objeto", code: `const pessoa = {
  nome: "Saulo",
  profissao: "Desenvolvedor",
  habilidades: ["JS", "React", "Node"]
};
console.log(JSON.stringify(pessoa, null, 2));` },
  { label: "🌐 Fetch API", code: `fetch("https://httpbin.org/get")
  .then(r => r.json())
  .then(data => {
    console.log("IP:", data.origin);
    console.log("URL:", data.url);
  })
  .catch(e => console.log("Erro:", e.message));` },
  { label: "🗃️ SQL Criar", code: `sql> CREATE TABLE IF NOT EXISTS notas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT,
  conteudo TEXT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)` },
  { label: "🗃️ SQL Inserir", code: `sql> INSERT INTO notas (titulo, conteudo)
VALUES ('Minha nota', 'Conteúdo da nota aqui')` },
  { label: "🗃️ SQL Buscar", code: `sql> SELECT * FROM notas ORDER BY id DESC LIMIT 10` },
];

interface OutputLine {
  id: string;
  type: "input" | "output" | "error" | "info";
  text: string;
}

export default function TerminalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeProject } = useApp();

  const [code, setCode] = useState(`// ⚡ JavaScript rodando no seu celular Android!
// Aperte RODAR ou escolha um exemplo abaixo.

const msg = "Olá, " + (new Date().getHours() < 12 ? "bom dia" : "boa tarde") + "!";
console.log(msg);
console.log("Motor:", "Hermes Engine — 100% local, sem internet");
console.log("Projeto ativo:", "${activeProject?.name || 'nenhum'}");`);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"js" | "sql">("js");
  const [sqlInput, setSqlInput] = useState("SELECT sqlite_version();");
  const scrollRef = useRef<ScrollView>(null);
  const idRef = useRef(0);

  // ── Histórico de código executado ─────────────────────────────────────────
  const [history, setHistory] = useState<Array<{ code: string; type: "js" | "sql"; ts: number }>>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);

  // Carrega histórico salvo
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

  // ── Roda JavaScript local via Hermes Engine ───────────────────────────────
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
      const result = fn(
        fake, Math, JSON, Date, Array, Object, String, Number, Boolean,
        RegExp, Error, Promise, setTimeout, clearTimeout, fetch,
        encodeURIComponent, decodeURIComponent
      );

      Promise.resolve(result)
        .then(val => {
          const ms = Date.now() - t0;
          const all = [...lines];
          if (val !== undefined && val !== null) {
            all.push("→ " + (typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)));
          }
          all.push(`\n⚡ OK em ${ms}ms — Hermes Engine`);
          addLine("output", all.join("\n") || "(sem saída)");
        })
        .catch(e => {
          addLine("error", `❌ ${e?.message || String(e)}\n⚡ ${Date.now() - t0}ms`);
        })
        .finally(() => setRunning(false));
    } catch (e: unknown) {
      const ms = Date.now() - t0;
      addLine("error", `❌ ${(e as Error)?.message || String(e)}\n\n💡 Verifique a sintaxe do código.\n⚡ ${ms}ms`);
      setRunning(false);
    }
  }, [code, addLine]);

  // ── Roda SQL local ─────────────────────────────────────────────────────────
  const runSQL = useCallback(async () => {
    const q = sqlInput.replace(/^sql>\s*/i, "").trim();
    if (!q) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveToHistory(q, "sql");
    addLine("input", `🗃️ SQL: ${q}`);

    if (q.startsWith(".tabelas") || q.startsWith(".tables")) {
      try {
        const tabs = await listTables();
        addLine("output", tabs.length
          ? `Tabelas em "${getCurrentDbName()}":\n${tabs.map(t => "  • " + t).join("\n")}`
          : `Banco "${getCurrentDbName()}" vazio — crie tabelas com CREATE TABLE`);
      } catch (e: unknown) {
        addLine("error", `❌ ${(e as Error)?.message}`);
      }
      return;
    }

    if (q.startsWith(".db ")) {
      const name = q.slice(4).trim();
      try {
        await switchDatabase(name);
        addLine("output", `✅ Banco "${getCurrentDbName()}" aberto/criado no celular!`);
      } catch (e: unknown) {
        addLine("error", `❌ ${(e as Error)?.message}`);
      }
      return;
    }

    try {
      const result = await formatSQLResult(q);
      addLine("output", result + `\n\n🗃️ Banco: ${getCurrentDbName()}`);
    } catch (e: unknown) {
      addLine("error", `❌ SQLite: ${(e as Error)?.message}`);
    }
  }, [sqlInput, addLine]);

  const clearOutput = () => {
    setOutput([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const copyOutput = async () => {
    const text = output.map(l => l.text).join("\n---\n");
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const loadExample = (ex: typeof EXEMPLOS[0]) => {
    if (ex.code.startsWith("sql>")) {
      setTab("sql");
      setSqlInput(ex.code.replace(/^sql>\s*/, "").trim());
    } else {
      setTab("js");
      setCode(ex.code);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const tabBottom = Platform.OS === "web" ? 80 : Math.max(insets.bottom, 16) + 70;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0d1117" }}
      behavior="padding"
      keyboardVerticalOffset={tabBottom}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={{
        paddingTop: Platform.OS === "web" ? 14 : insets.top + 6,
        paddingHorizontal: 14,
        paddingBottom: 10,
        backgroundColor: "#161b22",
        borderBottomWidth: 1,
        borderBottomColor: "#30363d",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#00d4aa", fontSize: 15, fontWeight: "800", fontFamily: "monospace" }}>
            ⚡ Terminal Local
          </Text>
          <Text style={{ color: "#8b949e", fontSize: 11, marginTop: 1 }}>
            JS e SQLite rodam no seu celular • sem internet
          </Text>
        </View>
        {/* Abas JS / SQL + botões histórico */}
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => setTab("js")}
            style={{
              paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
              backgroundColor: tab === "js" ? "#00d4aa22" : "#21262d",
              borderWidth: 1, borderColor: tab === "js" ? "#00d4aa66" : "#30363d",
            }}
          >
            <Text style={{ color: tab === "js" ? "#00d4aa" : "#8b949e", fontSize: 12, fontWeight: "700" }}>JS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("sql")}
            style={{
              paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
              backgroundColor: tab === "sql" ? "#10b98122" : "#21262d",
              borderWidth: 1, borderColor: tab === "sql" ? "#10b98166" : "#30363d",
            }}
          >
            <Text style={{ color: tab === "sql" ? "#10b981" : "#8b949e", fontSize: 12, fontWeight: "700" }}>SQL</Text>
          </TouchableOpacity>
          {/* Navegação histórico */}
          <TouchableOpacity onPress={() => navHistory("up")} style={{ padding: 6, backgroundColor: "#21262d", borderRadius: 6, borderWidth: 1, borderColor: "#30363d" }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <Feather name="chevron-up" size={14} color={history.filter(h=>h.type===tab).length ? "#8b949e" : "#30363d"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navHistory("down")} style={{ padding: 6, backgroundColor: "#21262d", borderRadius: 6, borderWidth: 1, borderColor: "#30363d" }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <Feather name="chevron-down" size={14} color={histIdx > 0 ? "#8b949e" : "#30363d"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowHistory(true)} style={{ padding: 6, backgroundColor: "#21262d", borderRadius: 6, borderWidth: 1, borderColor: "#30363d" }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <Feather name="clock" size={14} color={history.length ? "#8b949e" : "#30363d"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Modal Histórico ──────────────────────────────────────────────────── */}
      <Modal visible={showHistory} animationType="slide" transparent onRequestClose={() => setShowHistory(false)}>
        <View style={{ flex: 1, backgroundColor: "#000000cc" }}>
          <View style={{ flex: 1, marginTop: 60, backgroundColor: "#161b22", borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            {/* Cabeçalho */}
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#30363d" }}>
              <Feather name="clock" size={16} color="#00d4aa" />
              <Text style={{ color: "#e6edf3", fontSize: 15, fontWeight: "800", marginLeft: 8, flex: 1 }}>Histórico de Códigos</Text>
              <TouchableOpacity onPress={() => { setHistory([]); AsyncStorage.removeItem(HISTORY_KEY); }} style={{ marginRight: 12 }}>
                <Text style={{ color: "#f85149", fontSize: 12 }}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Feather name="x" size={20} color="#8b949e" />
              </TouchableOpacity>
            </View>
            {/* Lista */}
            <ScrollView contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }}>
              {history.length === 0 ? (
                <Text style={{ color: "#484f58", textAlign: "center", marginTop: 40, fontSize: 14 }}>
                  Nenhum código executado ainda.{"\n"}Aperte RODAR para salvar no histórico!
                </Text>
              ) : (
                history.map((entry, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      if (entry.type === "js") { setTab("js"); setCode(entry.code); }
                      else { setTab("sql"); setSqlInput(entry.code); }
                      setShowHistory(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                    style={{
                      backgroundColor: entry.type === "js" ? "#7c3aed18" : "#10b98118",
                      borderWidth: 1,
                      borderColor: entry.type === "js" ? "#7c3aed44" : "#10b98144",
                      borderRadius: 10,
                      padding: 12,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ backgroundColor: entry.type === "js" ? "#7c3aed33" : "#10b98133", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: entry.type === "js" ? "#a78bfa" : "#34d399", fontSize: 10, fontWeight: "700" }}>{entry.type.toUpperCase()}</Text>
                      </View>
                      <Text style={{ color: "#484f58", fontSize: 10, flex: 1 }}>
                        {new Date(entry.ts).toLocaleString("pt-BR")}
                      </Text>
                      <Feather name="corner-down-left" size={12} color="#484f58" />
                    </View>
                    <Text
                      numberOfLines={3}
                      style={{ color: "#8b949e", fontSize: 12, fontFamily: "monospace", lineHeight: 18 }}
                    >
                      {entry.code}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Exemplos rápidos ────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: "#161b22", borderBottomWidth: 1, borderBottomColor: "#30363d", flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6, gap: 6, alignItems: "center" }}
      >
        {EXEMPLOS.filter(e => tab === "sql" ? e.code.startsWith("sql>") : !e.code.startsWith("sql>")).map(ex => (
          <TouchableOpacity
            key={ex.label}
            onPress={() => loadExample(ex)}
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

      {/* ── Entrada de código ───────────────────────────────────────────────── */}
      <View style={{ backgroundColor: "#0d1117", flexShrink: 0 }}>
        {tab === "js" ? (
          <TextInput
            style={{
              color: "#e6edf3",
              fontFamily: "monospace",
              fontSize: 13,
              lineHeight: 20,
              padding: 12,
              minHeight: 130,
              maxHeight: 200,
              textAlignVertical: "top",
              backgroundColor: "#0d1117",
              borderBottomWidth: 1,
              borderBottomColor: "#30363d",
            }}
            value={code}
            onChangeText={setCode}
            multiline
            placeholder="// Digite seu código JavaScript aqui..."
            placeholderTextColor="#484f58"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        ) : (
          <TextInput
            style={{
              color: "#34d399",
              fontFamily: "monospace",
              fontSize: 13,
              lineHeight: 20,
              padding: 12,
              minHeight: 90,
              maxHeight: 140,
              textAlignVertical: "top",
              backgroundColor: "#021a0e",
              borderBottomWidth: 1,
              borderBottomColor: "#10b98133",
            }}
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
            marginHorizontal: 12,
            marginVertical: 8,
            backgroundColor: running ? "#21262d" : (tab === "js" ? "#00d4aa" : "#10b981"),
            borderRadius: 12,
            paddingVertical: 13,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          activeOpacity={0.8}
        >
          <Feather name={running ? "loader" : "play"} size={18} color={running ? "#8b949e" : "#0d1117"} />
          <Text style={{
            color: running ? "#8b949e" : "#0d1117",
            fontSize: 16,
            fontWeight: "900",
            letterSpacing: 1,
          }}>
            {running ? "RODANDO..." : tab === "js" ? "▶  RODAR  (JS Local)" : "▶  EXECUTAR  (SQLite)"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Saída ───────────────────────────────────────────────────────────── */}
      <View style={{ flex: 1, backgroundColor: "#010409" }}>
        {/* Barra de controle da saída */}
        <View style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 12, paddingVertical: 5,
          borderBottomWidth: 1, borderBottomColor: "#21262d",
          backgroundColor: "#0d1117",
        }}>
          <Text style={{ color: "#484f58", fontSize: 11, flex: 1, fontFamily: "monospace" }}>
            SAÍDA — {output.length} linha(s)
          </Text>
          <TouchableOpacity onPress={copyOutput} style={{ padding: 6 }} hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}>
            <Feather name="copy" size={13} color="#484f58" />
          </TouchableOpacity>
          <TouchableOpacity onPress={clearOutput} style={{ padding: 6 }} hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}>
            <Feather name="trash-2" size={13} color="#484f58" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12, paddingBottom: tabBottom + 20, gap: 2 }}
        >
          {output.length === 0 ? (
            <View style={{ paddingTop: 24, alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 32 }}>⚡</Text>
              <Text style={{ color: "#484f58", fontSize: 14, textAlign: "center", fontFamily: "monospace" }}>
                {"Aperte RODAR para executar\no código no seu celular"}
              </Text>
              <Text style={{ color: "#30363d", fontSize: 11, textAlign: "center", marginTop: 8, lineHeight: 18 }}>
                {"100% local • motor Hermes do Android\nsem internet • sem servidor"}
              </Text>
            </View>
          ) : (
            output.map(line => (
              <Text
                key={line.id}
                selectable
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  lineHeight: 20,
                  color: line.type === "error" ? "#f85149"
                    : line.type === "input" ? "#00d4aa"
                    : line.type === "info" ? "#8b949e"
                    : "#e6edf3",
                  backgroundColor: line.type === "error" ? "#5c050522"
                    : line.type === "input" ? "#00d4aa08"
                    : "transparent",
                  paddingHorizontal: line.type === "input" ? 8 : 0,
                  borderLeftWidth: line.type === "input" ? 2 : 0,
                  borderLeftColor: "#00d4aa",
                  marginBottom: 4,
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                {line.text}
              </Text>
            ))
          )}
        </ScrollView>
      </View>

      {/* ── Rodapé: links cloud (opcionais) ────────────────────────────────── */}
      <View style={{
        backgroundColor: "#0d1117",
        borderTopWidth: 1,
        borderTopColor: "#21262d",
        paddingHorizontal: 12,
        paddingVertical: 6,
        paddingBottom: Math.max(insets.bottom, 8) + 70,
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
      }}>
        <Text style={{ color: "#30363d", fontSize: 10, fontFamily: "monospace", width: "100%", marginBottom: 2 }}>
          Terminal Linux real (precisa de internet):
        </Text>
        {[
          { label: "⚡ StackBlitz", url: "https://stackblitz.com", color: "#1389fd" },
          { label: "🟠 Gitpod", url: "https://gitpod.io", color: "#ff8a00" },
          { label: "🐙 Codespaces", url: "https://github.com/codespaces", color: "#60a5fa" },
          { label: "💻 VS Code", url: "https://vscode.dev", color: "#007acc" },
        ].map(({ label, url, color }) => (
          <TouchableOpacity
            key={label}
            onPress={() => Linking.openURL(url)}
            style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
              backgroundColor: color + "18", borderWidth: 1, borderColor: color + "44",
            }}
          >
            <Text style={{ color, fontSize: 10, fontWeight: "700" }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({});
