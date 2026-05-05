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
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { useColors } from "@/hooks/useColors";

type Mode = "html" | "react" | "js";
type Layout = "stacked" | "split" | "preview";

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

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function HtmlPlayground({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const screenW = Dimensions.get("window").width;

  const [mode, setMode] = useState<Mode>("html");
  const [code, setCode] = useState(DEFAULTS.html);
  const [rendered, setRendered] = useState("");
  const [autoRender, setAutoRender] = useState(true);
  const [layout, setLayout] = useState<Layout>("stacked");
  const [showToolbar, setShowToolbar] = useState(true);

  const [saves, setSaves] = useState<SavedSnippet[]>([]);
  const [showSaves, setShowSaves] = useState(false);
  const [saveSearch, setSaveSearch] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");

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
    const t = setTimeout(() => setRendered(buildHtml(mode, code)), 600);
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
    setShowSaveInput(false);
    setSaveNameInput("");
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
  const lineCount = code.split("\n").length;

  const MODES: { key: Mode; label: string }[] = [
    { key: "html", label: "🌐 HTML" },
    { key: "react", label: "⚛️ React" },
    { key: "js", label: "⚡ JS" },
  ];

  const LAYOUTS: { key: Layout; icon: string; tip: string }[] = [
    { key: "stacked", icon: "layers", tip: "Empilhado" },
    { key: "split", icon: "columns", tip: "Lado a lado" },
    { key: "preview", icon: "maximize-2", tip: "Só preview" },
  ];

  const EditorPanel = (
    <View style={{ flex: 1 }}>
      {/* Line numbers + editor */}
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#0d1117" }}>
        {/* Line numbers */}
        <ScrollView
          scrollEnabled={false}
          style={{ width: 36, backgroundColor: "#161b22", borderRightWidth: 1, borderRightColor: "#30363d" }}
          contentContainerStyle={{ paddingTop: 12 }}
        >
          {Array.from({ length: Math.max(lineCount, 1) }, (_, i) => (
            <Text
              key={i}
              style={{
                color: "#484f58",
                fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                fontSize: 12,
                lineHeight: 20,
                textAlign: "right",
                paddingRight: 6,
                paddingLeft: 2,
              }}
            >
              {i + 1}
            </Text>
          ))}
        </ScrollView>
        {/* Editor */}
        <TextInput
          multiline
          style={{
            flex: 1,
            color: "#e6edf3",
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            padding: 12,
            paddingLeft: 8,
            fontSize: 13,
            lineHeight: 20,
            backgroundColor: "#0d1117",
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
          placeholderTextColor="#484f58"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          scrollEnabled
        />
      </View>
      {/* stats bar */}
      <View style={{ flexDirection: "row", backgroundColor: "#161b22", paddingHorizontal: 10, paddingVertical: 3, gap: 12 }}>
        <Text style={{ color: "#484f58", fontSize: 10, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
          {lineCount} linhas · {code.length} chars · {mode.toUpperCase()}
        </Text>
        {!autoRender && (
          <TouchableOpacity onPress={renderNow} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name="play" size={10} color="#22c55e" />
            <Text style={{ color: "#22c55e", fontSize: 10, fontWeight: "700" }}>Rodar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const PreviewPanel = (
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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#0d1117" }}>
          <Text style={{ fontSize: 36 }}>🎮</Text>
          <Text style={{ color: "#484f58", textAlign: "center", fontSize: 13 }}>
            {autoRender
              ? "Escreva código\na prévia aparece automaticamente"
              : 'Toque em "Rodar" para visualizar'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#0d1117" }}>

        {/* ── Cabeçalho ── */}
        <View style={[s.header, { paddingTop: insets.top + 4 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 4 }}>
            <Feather name="x" size={20} color="#8b949e" />
          </TouchableOpacity>

          <Text style={s.headerTitle}>🎮 Playground</Text>

          {/* Modo */}
          {MODES.map(m => (
            <TouchableOpacity
              key={m.key}
              onPress={() => switchMode(m.key)}
              style={[s.modeChip, {
                backgroundColor: mode === m.key ? "#7c3aed33" : "#161b22",
                borderColor: mode === m.key ? "#7c3aed" : "#30363d",
              }]}
            >
              <Text style={[s.modeChipText, { color: mode === m.key ? "#a78bfa" : "#8b949e" }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}

          <View style={{ flex: 1 }} />

          {/* AUTO/MANUAL */}
          <TouchableOpacity
            onPress={() => setAutoRender(v => !v)}
            style={[s.autoBtn, { backgroundColor: autoRender ? "#22c55e22" : "#161b22", borderColor: autoRender ? "#22c55e55" : "#30363d" }]}
          >
            <View style={[s.autoDot, { backgroundColor: autoRender ? "#22c55e" : "#484f58" }]} />
            <Text style={[s.autoBtnText, { color: autoRender ? "#22c55e" : "#8b949e" }]}>AUTO</Text>
          </TouchableOpacity>

          {/* Layout */}
          {LAYOUTS.map(l => (
            <TouchableOpacity
              key={l.key}
              onPress={() => setLayout(l.key)}
              style={[s.layoutBtn, { backgroundColor: layout === l.key ? "#7c3aed44" : "transparent" }]}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Feather name={l.icon as any} size={15} color={layout === l.key ? "#a78bfa" : "#8b949e"} />
            </TouchableOpacity>
          ))}

          {/* Toolbar toggle */}
          <TouchableOpacity
            onPress={() => setShowToolbar(v => !v)}
            style={[s.layoutBtn, { backgroundColor: showToolbar ? "#ffffff11" : "transparent" }]}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Feather name="sliders" size={15} color={showToolbar ? "#e6edf3" : "#8b949e"} />
          </TouchableOpacity>
        </View>

        {/* ── Toolbar colapsável ── */}
        {showToolbar && (
          <View style={s.toolbar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" }}>
              <TouchableOpacity onPress={pasteCode} style={[s.toolBtn, { borderColor: "#7c3aed44", backgroundColor: "#7c3aed11" }]}>
                <Feather name="clipboard" size={13} color="#a78bfa" />
                <Text style={[s.toolBtnText, { color: "#a78bfa" }]}>Colar</Text>
              </TouchableOpacity>

              {!autoRender && (
                <TouchableOpacity onPress={renderNow} style={[s.toolBtn, { borderColor: "#22c55e44", backgroundColor: "#22c55e11" }]}>
                  <Feather name="play" size={13} color="#22c55e" />
                  <Text style={[s.toolBtnText, { color: "#22c55e" }]}>Rodar</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => {
                  const defaultName = `${mode.toUpperCase()} - ${new Date().toLocaleDateString("pt-BR")}`;
                  setSaveNameInput(defaultName);
                  setShowSaveInput(true);
                }}
                style={[s.toolBtn, { borderColor: "#f59e0b44", backgroundColor: "#f59e0b11" }]}
              >
                <Feather name="save" size={13} color="#f59e0b" />
                <Text style={[s.toolBtnText, { color: "#f59e0b" }]}>Salvar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { loadSaves(); setShowSaves(true); }}
                style={[s.toolBtn, { borderColor: "#30363d", backgroundColor: "#161b22" }]}
              >
                <Feather name="folder" size={13} color="#8b949e" />
                <Text style={[s.toolBtnText, { color: "#8b949e" }]}>
                  Salvos{saves.length > 0 ? ` (${saves.length})` : ""}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  await Clipboard.setStringAsync(code);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert("✅ Copiado!");
                }}
                style={[s.toolBtn, { borderColor: "#30363d", backgroundColor: "#161b22" }]}
              >
                <Feather name="copy" size={13} color="#8b949e" />
                <Text style={[s.toolBtnText, { color: "#8b949e" }]}>Copiar</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={exportCode} style={[s.toolBtn, { borderColor: "#0ea5e944", backgroundColor: "#0ea5e911" }]}>
                <Feather name="download" size={13} color="#38bdf8" />
                <Text style={[s.toolBtnText, { color: "#38bdf8" }]}>Baixar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => Alert.alert("Limpar?", "Isso apaga o código atual.", [
                  { text: "Cancelar", style: "cancel" },
                  { text: "Limpar", style: "destructive", onPress: () => { setCode(""); setRendered(""); } },
                ])}
                style={[s.toolBtn, { borderColor: "#ef444433", backgroundColor: "#ef444411" }]}
              >
                <Feather name="trash-2" size={13} color="#ef4444" />
                <Text style={[s.toolBtnText, { color: "#ef4444" }]}>Limpar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* ── Save name input inline ── */}
        {showSaveInput && (
          <View style={s.saveInputRow}>
            <Feather name="save" size={14} color="#f59e0b" />
            <TextInput
              style={s.saveInput}
              value={saveNameInput}
              onChangeText={setSaveNameInput}
              placeholder="Nome do código..."
              placeholderTextColor="#484f58"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => saveNamed(saveNameInput)}
            />
            <TouchableOpacity
              onPress={() => saveNamed(saveNameInput)}
              style={[s.saveConfirm, { opacity: saveNameInput.trim() ? 1 : 0.4 }]}
              disabled={!saveNameInput.trim()}
            >
              <Feather name="check" size={16} color="#22c55e" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSaveInput(false)} style={{ padding: 6 }}>
              <Feather name="x" size={16} color="#8b949e" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Corpo principal ── */}
        {layout === "stacked" ? (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: "#30363d" }}>
              {EditorPanel}
            </View>
            <View style={{ flex: 1 }}>
              {PreviewPanel}
            </View>
          </View>
        ) : layout === "split" ? (
          <View style={{ flex: 1, flexDirection: "row" }}>
            <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: "#30363d" }}>
              {EditorPanel}
            </View>
            <View style={{ flex: 1 }}>
              {PreviewPanel}
            </View>
          </View>
        ) : (
          /* preview only */
          <View style={{ flex: 1 }}>
            {PreviewPanel}
            {/* Mini botão para voltar ao editor */}
            <TouchableOpacity
              onPress={() => setLayout("stacked")}
              style={s.backToEditor}
            >
              <Feather name="code" size={14} color="#a78bfa" />
              <Text style={{ color: "#a78bfa", fontSize: 11, fontWeight: "700" }}>Editor</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>

      {/* ── Modal: Meus Códigos Salvos ── */}
      <Modal visible={showSaves} transparent animationType="fade" onRequestClose={() => setShowSaves(false)}>
        <View style={s.savesOverlay}>
          <View style={[s.savesPanel, { backgroundColor: "#161b22", borderColor: "#30363d" }]}>

            <View style={[s.savesHeader, { borderBottomColor: "#30363d" }]}>
              <Text style={[s.savesTitle, { color: "#e6edf3" }]}>💾 Meus Códigos Salvos</Text>
              <TouchableOpacity onPress={() => setShowSaves(false)}>
                <Feather name="x" size={20} color="#8b949e" />
              </TouchableOpacity>
            </View>

            <View style={[s.searchBox, { backgroundColor: "#0d1117", borderColor: "#30363d" }]}>
              <Feather name="search" size={14} color="#8b949e" />
              <TextInput
                style={[s.searchInput, { color: "#e6edf3" }]}
                placeholder="Buscar por nome..."
                placeholderTextColor="#484f58"
                value={saveSearch}
                onChangeText={setSaveSearch}
                autoCapitalize="none"
              />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 24 }}>
              {filteredSaves.length === 0 ? (
                <View style={{ alignItems: "center", paddingTop: 40, gap: 10 }}>
                  <Text style={{ fontSize: 32 }}>📂</Text>
                  <Text style={{ color: "#8b949e", textAlign: "center" }}>
                    {saves.length === 0
                      ? "Nenhum código salvo ainda.\nUse o botão Salvar para guardar."
                      : "Nenhum resultado para essa busca."}
                  </Text>
                </View>
              ) : (
                filteredSaves.map(snippet => {
                  const isRenaming = renameId === snippet.id;
                  return (
                    <View key={snippet.id} style={[s.snippetCard, { backgroundColor: "#0d1117", borderColor: "#30363d" }]}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => loadSnippet(snippet)}>
                        {isRenaming ? (
                          <TextInput
                            style={[s.renameInput, { color: "#e6edf3", borderColor: "#7c3aed" }]}
                            value={renameName}
                            onChangeText={setRenameName}
                            onSubmitEditing={applyRename}
                            autoFocus
                            returnKeyType="done"
                          />
                        ) : (
                          <Text style={[s.snippetName, { color: "#e6edf3" }]} numberOfLines={1}>{snippet.name}</Text>
                        )}
                        <Text style={[s.snippetMeta, { color: "#484f58" }]}>
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
                            style={[s.iconBtn, { backgroundColor: "#ffffff0a" }]}
                          >
                            <Feather name="edit-2" size={14} color="#8b949e" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onPress={() => {
                            Clipboard.setStringAsync(snippet.code);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            Alert.alert("✅ Código copiado!");
                          }}
                          style={[s.iconBtn, { backgroundColor: "#7c3aed11" }]}
                        >
                          <Feather name="copy" size={14} color="#a78bfa" />
                        </TouchableOpacity>
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
    paddingHorizontal: 10, paddingBottom: 8,
    backgroundColor: "#161b22",
    borderBottomWidth: 1, borderBottomColor: "#30363d",
    gap: 6,
  },
  headerTitle: { fontSize: 14, fontWeight: "700", color: "#e6edf3" },
  modeChip: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1,
  },
  modeChipText: { fontSize: 11, fontWeight: "700" },
  autoBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1,
  },
  autoDot: { width: 6, height: 6, borderRadius: 3 },
  autoBtnText: { fontSize: 10, fontWeight: "700" },
  layoutBtn: { padding: 6, borderRadius: 6 },
  toolbar: {
    backgroundColor: "#161b22",
    borderBottomWidth: 1, borderBottomColor: "#30363d",
  },
  toolBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  toolBtnText: { fontSize: 12, fontWeight: "600" },
  saveInputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1c2128", borderBottomWidth: 1, borderBottomColor: "#f59e0b44",
    paddingHorizontal: 12, paddingVertical: 8,
  },
  saveInput: {
    flex: 1, color: "#e6edf3", fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    padding: 0,
  },
  saveConfirm: { padding: 6 },
  backToEditor: {
    position: "absolute", bottom: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#161b22ee", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: "#7c3aed55",
  },
  savesOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center", alignItems: "center",
  },
  savesPanel: {
    width: "92%", maxWidth: 460, maxHeight: "85%",
    borderRadius: 16, borderWidth: 1, overflow: "hidden",
  },
  savesHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1,
  },
  savesTitle: { fontSize: 16, fontWeight: "700" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 12, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  snippetCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  snippetName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  snippetMeta: { fontSize: 11 },
  snippetActions: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  renameInput: {
    fontSize: 14, borderBottomWidth: 1, paddingVertical: 2,
  },
});
