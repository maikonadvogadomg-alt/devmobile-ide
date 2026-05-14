import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { Paths, File as FSFile } from "expo-file-system/next";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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

import { useColors } from "@/hooks/useColors";

type Mode = "html" | "react" | "js";

interface SavedSnippet {
  id: string;
  name: string;
  mode: Mode;
  code: string;
  savedAt: number;
}

const SAVES_KEY = "html_playground_saves_v1";

const DEFAULTS: Record<Mode, string> = {
  html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Playground HTML</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; padding: 24px; background: #fff; color: #1a1a1a; }
    h1 { color: #7c3aed; margin-bottom: 12px; }
    button {
      padding: 10px 22px; font-size: 16px; background: #7c3aed;
      color: #fff; border: none; border-radius: 8px; cursor: pointer; margin-top: 12px;
    }
    button:active { opacity: 0.75; }
  </style>
</head>
<body>
  <h1>🎮 Playground HTML</h1>
  <p>Cole seu código aqui e veja ao vivo!</p>
  <button onclick="alert('Funcionou! ✅')">Clique aqui</button>
</body>
</html>`,
  react: `function App() {
  const [count, setCount] = React.useState(0);
  const [cor, setCor] = React.useState('#7c3aed');
  const cores = ['#7c3aed', '#059669', '#dc2626', '#d97706'];

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ color: cor, marginBottom: 16 }}>⚛️ React Playground</h1>
      <p style={{ fontSize: 56, textAlign: 'center', margin: '16px 0' }}>{count}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
        <button onClick={() => setCount(c => c - 1)}
          style={{ padding: '10px 28px', fontSize: 22, background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>−</button>
        <button onClick={() => setCount(c => c + 1)}
          style={{ padding: '10px 28px', fontSize: 22, background: cor, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>+</button>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {cores.map(c => (
          <div key={c} onClick={() => setCor(c)}
            style={{ width: 36, height: 36, borderRadius: '50%', background: c, cursor: 'pointer',
                     border: cor === c ? '3px solid #000' : '3px solid transparent' }} />
        ))}
      </div>
    </div>
  );
}`,
  js: `// JavaScript puro — resultado aparece como console abaixo

const dados = [1, 2, 3, 4, 5];
console.log("Soma:", dados.reduce((a, b) => a + b, 0));
console.log("Quadrados:", dados.map(n => n * n));
console.log("Pares:", dados.filter(n => n % 2 === 0));

const saudar = nome => \`Olá, \${nome}! 👋\`;
console.log(saudar("Mundo"));

const fatorial = n => n <= 1 ? 1 : n * fatorial(n - 1);
[5, 7, 10].forEach(n => console.log(\`\${n}! = \${fatorial(n)}\`));`,
};

function buildHtml(mode: Mode, code: string): string {
  if (mode === "html") return code;
  if (mode === "react") {
    return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}.pg-err{padding:20px;color:#ef4444;font-family:monospace;white-space:pre-wrap;font-size:13px}</style>
</head><body><div id="root"></div>
<script type="text/babel">
const { useState, useEffect, useCallback, useMemo, useRef, useContext, createContext } = React;
${code}
try { ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App)); }
catch(e) { document.getElementById('root').innerHTML='<div class="pg-err">❌ Erro: '+e.message+'</div>'; }
</script></body></html>`;
  }
  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<style>
*{box-sizing:border-box}body{margin:0;background:#0d1117;color:#e6edf3;font-family:monospace;font-size:13px;padding:12px}
.log{padding:4px 0 4px 10px;border-left:3px solid #22c55e;margin:2px 0;word-break:break-all;white-space:pre-wrap}
.error{padding:4px 0 4px 10px;border-left:3px solid #ef4444;color:#f87171;margin:2px 0}
.warn{padding:4px 0 4px 10px;border-left:3px solid #f59e0b;color:#fcd34d;margin:2px 0}
.info{padding:4px 0 4px 10px;border-left:3px solid #60a5fa;color:#93c5fd;margin:2px 0}
</style></head><body>
<div id="out"></div>
<script>
const out=document.getElementById('out');
const fmt=(...a)=>a.map(x=>typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' ');
const add=(cls,msg)=>{const d=document.createElement('div');d.className=cls;d.textContent=msg;out.appendChild(d);window.scrollTo(0,document.body.scrollHeight);};
console.log=(...a)=>add('log',fmt(...a));
console.error=(...a)=>add('error','❌ '+fmt(...a));
console.warn=(...a)=>add('warn','⚠️ '+fmt(...a));
console.info=(...a)=>add('info','ℹ️ '+fmt(...a));
try{${code}}catch(e){add('error','❌ '+e.message);}
</script></body></html>`;
}

function countLines(code: string) {
  const lines = code.split("\n");
  const htmlLines = (code.match(/<[^/][^>]*>/g) || []).length;
  const cssLines = (code.match(/\{[^}]*\}/g) || []).length;
  const jsLines = lines.filter(l => /function|const|let|var|=>|if |for |while /.test(l)).length;
  return { html: htmlLines, css: cssLines, js: jsLines };
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function HtmlPlayground({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("html");
  const [code, setCode] = useState(DEFAULTS.html);
  const [rendered, setRendered] = useState("");
  const [autoRender, setAutoRender] = useState(true);

  const [saves, setSaves] = useState<SavedSnippet[]>([]);
  const [showSaves, setShowSaves] = useState(false);
  const [saveSearch, setSaveSearch] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const webViewRef = useRef<WebView>(null);

  const loadSaves = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVES_KEY);
      if (raw) setSaves(JSON.parse(raw));
    } catch {}
  }, []);

  const persistSaves = useCallback(async (list: SavedSnippet[]) => {
    try {
      await AsyncStorage.setItem(SAVES_KEY, JSON.stringify(list));
      setSaves(list);
    } catch {}
  }, []);

  useEffect(() => {
    if (visible) loadSaves();
  }, [visible, loadSaves]);

  useEffect(() => {
    if (!autoRender || !visible) return;
    const t = setTimeout(() => setRendered(buildHtml(mode, code)), 800);
    return () => clearTimeout(t);
  }, [code, autoRender, mode, visible]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setCode(DEFAULTS[m]);
    setRendered("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderNow = () => {
    setRendered(buildHtml(mode, code));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const pasteCode = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim()) {
        setCode(text);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (autoRender) setRendered(buildHtml(mode, text));
      } else {
        Alert.alert("Área de transferência vazia");
      }
    } catch {
      Alert.alert("Erro ao colar", "Não foi possível acessar a área de transferência.");
    }
  };

  const exportCode = async () => {
    const ext = mode === "html" ? "html" : mode === "react" ? "jsx" : "js";
    const filename = `playground_${Date.now()}.${ext}`;
    const content = mode === "html" ? code : buildHtml(mode, code);
    try {
      if (Platform.OS === "web") {
        const blob = new Blob([content], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const htmlFile = new FSFile(Paths.cache, filename);
        htmlFile.write(new TextEncoder().encode(content));
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(htmlFile.uri, { mimeType: "text/html", dialogTitle: "Exportar código" });
        } else {
          Alert.alert("Compartilhamento não disponível neste dispositivo.");
        }
      }
    } catch (e: any) {
      Alert.alert("Erro ao exportar", e.message);
    }
  };

  const saveWithName = () => {
    Alert.prompt(
      "Salvar código",
      "Nome para este código:",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salvar",
          onPress: async (name) => {
            if (!name || !name.trim()) return;
            const snippet: SavedSnippet = {
              id: Date.now().toString(),
              name: name.trim(),
              mode,
              code,
              savedAt: Date.now(),
            };
            await persistSaves([snippet, ...saves]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("✅ Salvo!", `"${name.trim()}" salvo com sucesso.`);
          },
        },
      ],
      "plain-text",
      `Código ${mode.toUpperCase()} — ${new Date().toLocaleDateString("pt-BR")}`
    );
  };

  const saveWithNameAndroid = () => {
    const defaultName = `Código ${mode.toUpperCase()} — ${new Date().toLocaleDateString("pt-BR")}`;
    Alert.alert(
      "💾 Salvar código",
      "Digite um nome para salvar este código:",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salvar",
          onPress: async () => {
            const snippet: SavedSnippet = {
              id: Date.now().toString(),
              name: defaultName,
              mode,
              code,
              savedAt: Date.now(),
            };
            await persistSaves([snippet, ...saves]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const saveNamed = async (name: string) => {
    const snippet: SavedSnippet = {
      id: Date.now().toString(),
      name: name.trim(),
      mode,
      code,
      savedAt: Date.now(),
    };
    await persistSaves([snippet, ...saves]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("✅ Salvo!", `"${name.trim()}" salvo com sucesso.`);
  };

  const deleteSnippet = (id: string) => {
    Alert.alert("Excluir", "Remover este código salvo?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => persistSaves(saves.filter(s => s.id !== id)) },
    ]);
  };

  const loadSnippet = (s: SavedSnippet) => {
    setMode(s.mode);
    setCode(s.code);
    setRendered("");
    setShowSaves(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (autoRender) setTimeout(() => setRendered(buildHtml(s.mode, s.code)), 300);
  };

  const applyRename = async () => {
    if (!renameId || !renameName.trim()) return;
    await persistSaves(saves.map(s => s.id === renameId ? { ...s, name: renameName.trim() } : s));
    setRenameId(null);
    setRenameName("");
  };

  const filteredSaves = saves.filter(s => s.name.toLowerCase().includes(saveSearch.toLowerCase()));

  const MODES: { key: Mode; label: string }[] = [
    { key: "html", label: "🌐 HTML" },
    { key: "react", label: "⚛️ React" },
    { key: "js", label: "⚡ JS" },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        {/* ── Cabeçalho ── */}
        <View style={[s.header, { paddingTop: insets.top + 6, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>🎮 Playground</Text>

          <TouchableOpacity
            onPress={() => setAutoRender(v => !v)}
            style={[s.autoBtn, { backgroundColor: autoRender ? "#7c3aed22" : colors.secondary, borderColor: autoRender ? "#7c3aed" : colors.border }]}
          >
            <View style={[s.autoDot, { backgroundColor: autoRender ? "#22c55e" : colors.mutedForeground }]} />
            <Text style={[s.autoBtnText, { color: autoRender ? "#7c3aed" : colors.mutedForeground }]}>
              {autoRender ? "AUTO" : "MANUAL"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* ── Tabs de modo ── */}
        <View style={[s.modeBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {MODES.map(m => (
            <TouchableOpacity
              key={m.key}
              onPress={() => switchMode(m.key)}
              style={[s.modeTab, { borderBottomColor: mode === m.key ? "#7c3aed" : "transparent" }]}
            >
              <Text style={[s.modeLabel, { color: mode === m.key ? "#7c3aed" : colors.mutedForeground }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Toolbar de ações ── */}
        <View style={[s.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {/* Colar */}
          <TouchableOpacity onPress={pasteCode} style={[s.toolBtn, { borderColor: "#7c3aed44", backgroundColor: "#7c3aed11" }]}>
            <Feather name="clipboard" size={14} color="#7c3aed" />
            <Text style={[s.toolBtnText, { color: "#7c3aed" }]}>Colar</Text>
          </TouchableOpacity>

          {/* Renderizar */}
          <TouchableOpacity onPress={renderNow} style={[s.toolBtn, { borderColor: "#22c55e44", backgroundColor: "#22c55e11" }]}>
            <Feather name="play" size={14} color="#22c55e" />
            <Text style={[s.toolBtnText, { color: "#22c55e" }]}>Rodar</Text>
          </TouchableOpacity>

          {/* Exportar/Baixar */}
          <TouchableOpacity onPress={exportCode} style={[s.toolBtn, { borderColor: "#0ea5e944", backgroundColor: "#0ea5e911" }]}>
            <Feather name="download" size={14} color="#0ea5e9" />
            <Text style={[s.toolBtnText, { color: "#0ea5e9" }]}>Baixar</Text>
          </TouchableOpacity>

          {/* Salvar */}
          <TouchableOpacity
            onPress={() => {
              const defaultName = `${mode.toUpperCase()} - ${new Date().toLocaleDateString("pt-BR")}`;
              if (Platform.OS === "ios") {
                saveWithName();
              } else {
                Alert.alert(
                  "💾 Salvar código",
                  `Salvar como "${defaultName}"?\n(Acesse Meus Salvos para renomear)`,
                  [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Salvar", onPress: () => saveNamed(defaultName) },
                  ]
                );
              }
            }}
            style={[s.toolBtn, { borderColor: "#f59e0b44", backgroundColor: "#f59e0b11" }]}
          >
            <Feather name="save" size={14} color="#f59e0b" />
            <Text style={[s.toolBtnText, { color: "#f59e0b" }]}>Salvar</Text>
          </TouchableOpacity>

          {/* Meus salvos */}
          <TouchableOpacity
            onPress={() => { loadSaves(); setShowSaves(true); }}
            style={[s.toolBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
          >
            <Feather name="folder" size={14} color={colors.foreground} />
            <Text style={[s.toolBtnText, { color: colors.foreground }]}>Salvos{saves.length > 0 ? ` (${saves.length})` : ""}</Text>
          </TouchableOpacity>

          {/* Copiar */}
          <TouchableOpacity
            onPress={async () => {
              await Clipboard.setStringAsync(code);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert("✅ Copiado!");
            }}
            style={[s.toolBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
          >
            <Feather name="copy" size={14} color={colors.mutedForeground} />
            <Text style={[s.toolBtnText, { color: colors.mutedForeground }]}>Copiar</Text>
          </TouchableOpacity>

          {/* Limpar */}
          <TouchableOpacity
            onPress={() => Alert.alert("Limpar?", "Isso apaga o código atual.", [
              { text: "Cancelar", style: "cancel" },
              { text: "Limpar", style: "destructive", onPress: () => { setCode(""); setRendered(""); } },
            ])}
            style={[s.toolBtn, { borderColor: "#ef444444", backgroundColor: "#ef444411" }]}
          >
            <Feather name="trash-2" size={14} color="#ef4444" />
            <Text style={[s.toolBtnText, { color: "#ef4444" }]}>Limpar</Text>
          </TouchableOpacity>
        </View>

        {/* ── Área do editor ── */}
        <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TextInput
            multiline
            style={{
              flex: 1,
              color: colors.foreground,
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              padding: 12,
              fontSize: 13,
              lineHeight: 20,
              backgroundColor: colors.background,
              textAlignVertical: "top",
            }}
            value={code}
            onChangeText={setCode}
            placeholder={
              mode === "html"
                ? "Cole seu HTML aqui ou escreva do zero..."
                : mode === "react"
                ? "function App() {\n  return <h1>Olá!</h1>;\n}"
                : "console.log('Olá Mundo!');"
            }
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            scrollEnabled
          />
        </View>

        {/* ── Divisor + Botão Renderizar (modo manual) ── */}
        {!autoRender && (
          <View style={[s.divider, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.dividerLabel, { color: colors.mutedForeground }]}>PRÉVIA</Text>
            <TouchableOpacity onPress={renderNow} style={s.renderBtn}>
              <Feather name="play" size={13} color="#fff" />
              <Text style={s.renderBtnText}>▶ Renderizar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Área de preview ── */}
        <View style={{ flex: 1 }}>
          {rendered ? (
            <WebView
              ref={webViewRef}
              source={{ html: rendered, baseUrl: "about:blank" }}
              style={{ flex: 1, backgroundColor: "#ffffff" }}
              originWhitelist={["*"]}
              javaScriptEnabled
              scrollEnabled
              allowFileAccess={false}
              mixedContentMode="always"
              onError={(e) => console.warn("WebView error:", e.nativeEvent)}
            />
          ) : (
            <View style={[s.emptyPreview, { backgroundColor: colors.background }]}>
              <Text style={{ fontSize: 40 }}>🎮</Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                {autoRender
                  ? "Escreva ou cole código acima\na prévia aparece automaticamente"
                  : 'Toque em "▶ Rodar" para visualizar\nou ative AUTO na barra do topo'}
              </Text>
            </View>
          )}
        </View>

      </View>

      {/* ── Modal: Meus Códigos Salvos ── */}
      <Modal visible={showSaves} transparent animationType="fade" onRequestClose={() => setShowSaves(false)}>
        <View style={s.savesOverlay}>
          <View style={[s.savesPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>

            <View style={[s.savesHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.savesTitle, { color: colors.foreground }]}>Meus Códigos Salvos</Text>
              <TouchableOpacity onPress={() => setShowSaves(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={[s.searchBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput
                style={[s.searchInput, { color: colors.foreground }]}
                placeholder="Buscar por nome..."
                placeholderTextColor={colors.mutedForeground}
                value={saveSearch}
                onChangeText={setSaveSearch}
                autoCapitalize="none"
              />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 }}>
              {filteredSaves.length === 0 ? (
                <View style={{ alignItems: "center", paddingTop: 40, gap: 10 }}>
                  <Text style={{ fontSize: 32 }}>📂</Text>
                  <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
                    {saves.length === 0 ? "Nenhum código salvo ainda.\nUse o botão Salvar para guardar um código." : "Nenhum resultado para essa busca."}
                  </Text>
                </View>
              ) : (
                filteredSaves.map(snippet => {
                  const counts = countLines(snippet.code);
                  const isRenaming = renameId === snippet.id;
                  return (
                    <View key={snippet.id} style={[s.snippetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => loadSnippet(snippet)}>
                        {isRenaming ? (
                          <TextInput
                            style={[s.renameInput, { color: colors.foreground, borderColor: colors.primary }]}
                            value={renameName}
                            onChangeText={setRenameName}
                            onSubmitEditing={applyRename}
                            autoFocus
                            returnKeyType="done"
                          />
                        ) : (
                          <Text style={[s.snippetName, { color: colors.foreground }]} numberOfLines={1}>{snippet.name}</Text>
                        )}
                        <Text style={[s.snippetMeta, { color: colors.mutedForeground }]}>
                          {snippet.mode.toUpperCase()} · {snippet.code.split("\n").length} linhas · {new Date(snippet.savedAt).toLocaleDateString("pt-BR")}
                        </Text>
                      </TouchableOpacity>
                      <View style={s.snippetActions}>
                        {isRenaming ? (
                          <TouchableOpacity onPress={applyRename} style={[s.iconBtn, { backgroundColor: "#22c55e22" }]}>
                            <Feather name="check" size={14} color="#22c55e" />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => { setRenameId(snippet.id); setRenameName(snippet.name); }}
                            style={[s.iconBtn, { backgroundColor: colors.secondary }]}
                          >
                            <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => deleteSnippet(snippet.id)}
                          style={[s.iconBtn, { backgroundColor: "#ef444411" }]}
                        >
                          <Feather name="trash-2" size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingBottom: 10,
    borderBottomWidth: 1, gap: 10,
  },
  headerTitle: { flex: 1, fontWeight: "700", fontSize: 16 },
  autoBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  autoDot: { width: 8, height: 8, borderRadius: 4 },
  autoBtnText: { fontSize: 11, fontWeight: "700" },

  modeBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  modeTab: {
    flex: 1, paddingVertical: 10, alignItems: "center",
    borderBottomWidth: 2,
  },
  modeLabel: { fontSize: 13, fontWeight: "600" },

  toolbar: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderBottomWidth: 1,
  },
  toolBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  toolBtnText: { fontSize: 12, fontWeight: "600" },

  divider: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 7,
    borderTopWidth: 1, borderBottomWidth: 1, gap: 10,
  },
  dividerLabel: { fontSize: 11, fontWeight: "700", flex: 1 },
  renderBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
  },
  renderBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  emptyPreview: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },

  savesOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  savesPanel: {
    width: "100%", maxHeight: "85%",
    borderRadius: 16, borderWidth: 1, overflow: "hidden",
  },
  savesHeader: {
    flexDirection: "row", alignItems: "center",
    padding: 16, borderBottomWidth: 1, gap: 12,
  },
  savesTitle: { flex: 1, fontWeight: "700", fontSize: 16 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },

  snippetCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 10, padding: 12, borderWidth: 1, gap: 8,
  },
  snippetName: { fontWeight: "600", fontSize: 14, marginBottom: 3 },
  snippetMeta: { fontSize: 11 },
  snippetActions: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  renameInput: {
    fontSize: 14, fontWeight: "600", borderBottomWidth: 1,
    paddingVertical: 2, marginBottom: 4,
  },
});
