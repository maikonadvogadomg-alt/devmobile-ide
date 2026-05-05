import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as _FileSystem from "expo-file-system";
const FileSystem = _FileSystem as any;
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  buildAndroidZip,
  DEFAULT_CFG,
  type AppConfig,
} from "@/lib/androidBuilder";
import {
  decodeFileToText,
  extractArchive,
  guessConfig,
  isBinaryPath,
  type ProjectFile,
} from "@/lib/archiveApk";
import {
  ghCreateRepo,
  ghGetUser,
  ghImportRepo,
  ghPushFiles,
} from "@/lib/githubApk";

const BG = "#080c18";
const CARD = "#0f1629";
const CARD2 = "#0a1120";
const BORDER = "#1e293b";
const ACCENT = "#6366f1";
const MUTED = "#64748b";
const WHITE = "#f1f5f9";
const GREEN = "#4ade80";
const RED = "#f87171";
const YELLOW = "#fbbf24";

const FILE_ICONS: Record<string, string> = {
  html: "🌐", css: "🎨", scss: "🎨", js: "⚡", ts: "🔷",
  jsx: "⚛️", tsx: "⚛️", json: "📋", md: "📝", txt: "📄",
  py: "🐍", go: "🐹", rs: "🦀", java: "☕", kt: "🟪",
  swift: "🍎", sh: "⚙️", yaml: "⚙️", yml: "⚙️", toml: "⚙️",
  env: "🔐", lock: "🔒", xml: "📰", sql: "🗄️",
};

function fileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (isBinaryPath(path)) return "🔒";
  return FILE_ICONS[ext] ?? "📄";
}

function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function msgColor(msg: string) {
  if (msg.startsWith("✅")) return GREEN;
  if (msg.startsWith("❌")) return RED;
  return WHITE;
}
function msgBg(msg: string) {
  if (msg.startsWith("✅")) return "#052e16";
  if (msg.startsWith("❌")) return "#1c0505";
  return "#0a1628";
}
function msgBorder(msg: string) {
  if (msg.startsWith("✅")) return "#166534";
  if (msg.startsWith("❌")) return "#7f1d1d";
  return BORDER;
}

function MsgBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <View style={[st.infoBox, { borderColor: msgBorder(msg), backgroundColor: msgBg(msg) }]}>
      <Text style={{ color: msgColor(msg), fontSize: 12, lineHeight: 18 }}>{msg}</Text>
    </View>
  );
}

function SectionToggle({ label, open, onToggle, children }: {
  label: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <View style={st.card}>
      <Pressable onPress={onToggle} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={st.sectionLabel}>{label}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={13} color={MUTED} style={{ marginLeft: "auto" }} />
      </Pressable>
      {open && <View style={{ marginTop: 12 }}>{children}</View>}
    </View>
  );
}

function FileViewerModal({
  visible, file, onClose, onSaveText,
}: {
  visible: boolean; file: ProjectFile | null; onClose: () => void;
  onSaveText: (path: string, newText: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const content = file ? decodeFileToText(file) : "";
  const isBin = file ? isBinaryPath(file.path) : false;

  useEffect(() => {
    if (visible) { setEditing(false); setDraftText(""); }
  }, [visible, file?.path]);

  function startEdit() { setDraftText(content); setEditing(true); }
  function saveEdit() {
    if (file) { onSaveText(file.path, draftText); }
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[st.sheetRoot, { paddingTop: insets.top + 8, backgroundColor: "#060e1c" }]}>
        <View style={st.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={st.sheetTitle} numberOfLines={1}>
              {file ? fileIcon(file.path) : "📄"} {file?.path.split("/").pop()}
            </Text>
            <Text style={[st.hint, { color: MUTED }]} numberOfLines={1}>{file?.path}</Text>
            {file?.size ? <Text style={[st.hint, { color: MUTED }]}>{fmtSize(file.size)}</Text> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {!isBin && !editing && (
              <Pressable onPress={startEdit} style={st.smallBtn}>
                <Feather name="edit-2" size={13} color={YELLOW} />
                <Text style={[st.smallBtnTxt, { color: YELLOW }]}>Editar</Text>
              </Pressable>
            )}
            {editing && (
              <Pressable onPress={saveEdit} style={[st.smallBtn, { backgroundColor: "#052e16" }]}>
                <Feather name="save" size={13} color={GREEN} />
                <Text style={[st.smallBtnTxt, { color: GREEN }]}>Salvar</Text>
              </Pressable>
            )}
            {!isBin && !editing && (
              <Pressable
                onPress={() => { Clipboard.setString(content); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={st.smallBtn}
              >
                <Feather name={copied ? "check" : "copy"} size={13} color={copied ? GREEN : WHITE} />
                <Text style={[st.smallBtnTxt, copied && { color: GREEN }]}>{copied ? "Copiado!" : "Copiar"}</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} style={[st.smallBtn, { backgroundColor: "#1a2540" }]}>
              <Feather name="x" size={18} color={WHITE} />
            </Pressable>
          </View>
        </View>
        {editing ? (
          <TextInput
            style={{ flex: 1, color: "#a5b4fc", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", padding: 14, backgroundColor: "#040810", lineHeight: 18 }}
            value={draftText}
            onChangeText={setDraftText}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text selectable style={st.codeText}>{content || "(arquivo vazio)"}</Text>
            </ScrollView>
          </ScrollView>
        )}
        <View style={[st.sheetFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={[st.hint, { color: MUTED }]}>{content.length.toLocaleString()} chars · {editing ? "modo edição" : "somente leitura"}</Text>
        </View>
      </View>
    </Modal>
  );
}

function PushModal({
  visible, onClose, mode, ghToken, files, source,
}: {
  visible: boolean; onClose: () => void;
  mode: "vscode" | "push";
  ghToken: string; files: ProjectFile[]; source: string;
}) {
  const insets = useSafeAreaInsets();
  const [repoName, setRepoName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [pages, setPages] = useState(false);
  const [msg, setMsg] = useState("");
  const [pushing, setPushing] = useState(false);
  const [done, setDone] = useState(false);
  const [pushedOwner, setPushedOwner] = useState("");
  const [pushedRepo, setPushedRepo] = useState("");

  const title = mode === "vscode" ? "VS Code Web + GitHub" : "Enviar ao GitHub";
  const btnTxt = mode === "vscode" ? "Subir e abrir VS Code" : "Criar repositório e enviar";

  async function doPush() {
    if (!repoName.trim()) { Alert.alert("Nome obrigatório"); return; }
    if (!ghToken) { Alert.alert("Token GitHub necessário", "Configure na aba Importar."); return; }
    if (!files.length) { Alert.alert("Sem arquivos", "Importe um projeto primeiro."); return; }
    setPushing(true); setMsg("Criando repositório..."); setDone(false);
    try {
      const repo = await ghCreateRepo(ghToken, repoName.trim(), `DevMobile APK Builder · ${source}`, isPrivate);
      const [owner, rname] = repo.full_name.split("/");
      setMsg(`Enviando ${files.length} arquivos...`);
      await ghPushFiles(ghToken, owner, rname, files, `DevMobile: ${source}`, (p) => setMsg(p));
      if (pages) {
        setMsg("Ativando GitHub Pages...");
        try {
          await fetch(`https://api.github.com/repos/${owner}/${rname}/pages`, {
            method: "POST",
            headers: { Authorization: `token ${ghToken}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
            body: JSON.stringify({ source: { branch: "main", path: "/" } }),
          });
        } catch {}
      }
      setPushedOwner(owner); setPushedRepo(rname);
      setMsg(
        `✅ ${files.length} arquivos enviados!\n` +
        (pages ? `🌐 GitHub Pages: https://${owner}.github.io/${rname}/\n💡 Para converter em APK: pwabuilder.com` : "")
      );
      setDone(true);
      if (mode === "vscode") setTimeout(() => Linking.openURL(`https://vscode.dev/github/${owner}/${rname}`), 800);
    } catch (e) {
      setMsg("❌ " + String(e));
    } finally {
      setPushing(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[st.sheetRoot, { paddingTop: insets.top + 8, backgroundColor: CARD2 }]}>
        <View style={st.sheetHeader}>
          <Text style={st.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} style={[st.smallBtn, { backgroundColor: "#1a2540" }]}>
            <Feather name="x" size={18} color={WHITE} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={st.sectionLabel}>NOME DO REPOSITÓRIO</Text>
          <TextInput
            style={st.input} value={repoName} onChangeText={setRepoName}
            placeholder="meu-projeto" placeholderTextColor={MUTED}
            autoCapitalize="none" autoCorrect={false}
          />
          <Pressable onPress={() => setIsPrivate(v => !v)} style={st.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.sectionLabel}>REPOSITÓRIO PRIVADO</Text>
              <Text style={[st.hint, { color: MUTED }]}>Apenas você poderá ver</Text>
            </View>
            <View style={[st.toggle, isPrivate && st.toggleOn]}>
              <View style={[st.toggleKnob, isPrivate && st.toggleKnobOn]} />
            </View>
          </Pressable>
          <Pressable onPress={() => setPages(v => !v)} style={st.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.sectionLabel}>ATIVAR GITHUB PAGES</Text>
              <Text style={[st.hint, { color: MUTED }]}>Gera link HTTPS → vira PWA → APK via pwabuilder.com</Text>
            </View>
            <View style={[st.toggle, pages && st.toggleOn]}>
              <View style={[st.toggleKnob, pages && st.toggleKnobOn]} />
            </View>
          </Pressable>
          <View style={st.infoBox}>
            <Text style={[st.hint, { color: "#60a5fa" }]}>📦 {files.length.toLocaleString()} arquivos — todos, sem limite</Text>
          </View>
          <MsgBox msg={msg} />
          {done && pushedOwner ? (
            <View style={{ gap: 8 }}>
              <Pressable onPress={() => Linking.openURL(`https://github.com/${pushedOwner}/${pushedRepo}`)}
                style={[st.actionBtn, { borderColor: WHITE + "33", backgroundColor: "#111827" }]}>
                <Feather name="github" size={15} color={WHITE} />
                <Text style={[st.actionBtnTxt, { color: WHITE }]}>Abrir no GitHub</Text>
              </Pressable>
              <Pressable onPress={() => Linking.openURL(`https://vscode.dev/github/${pushedOwner}/${pushedRepo}`)}
                style={[st.actionBtn, { borderColor: "#60a5fa44", backgroundColor: "#1e3a5f" }]}>
                <Feather name="code" size={15} color="#60a5fa" />
                <Text style={[st.actionBtnTxt, { color: "#60a5fa" }]}>Abrir no VS Code Web</Text>
              </Pressable>
              <Pressable onPress={() => Linking.openURL(`https://github.com/${pushedOwner}/${pushedRepo}/actions`)}
                style={[st.actionBtn, { borderColor: ACCENT + "44", backgroundColor: ACCENT + "11" }]}>
                <Feather name="cpu" size={15} color={ACCENT} />
                <Text style={[st.actionBtnTxt, { color: ACCENT }]}>GitHub Actions — build APK</Text>
              </Pressable>
              {pages && (
                <>
                  <Pressable onPress={() => Linking.openURL(`https://${pushedOwner}.github.io/${pushedRepo}/`)}
                    style={[st.actionBtn, { borderColor: GREEN + "44", backgroundColor: "#052e16" }]}>
                    <Feather name="globe" size={15} color={GREEN} />
                    <Text style={[st.actionBtnTxt, { color: GREEN }]}>Abrir App (GitHub Pages)</Text>
                  </Pressable>
                  <Pressable onPress={() => Linking.openURL("https://www.pwabuilder.com/")}
                    style={[st.actionBtn, { borderColor: YELLOW + "44", backgroundColor: "#1a1000" }]}>
                    <Feather name="smartphone" size={15} color={YELLOW} />
                    <Text style={[st.actionBtnTxt, { color: YELLOW }]}>Converter em APK — pwabuilder.com</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : (
            <Pressable onPress={doPush} disabled={pushing}
              style={[st.bigBtn, { backgroundColor: pushing ? BORDER : (mode === "vscode" ? "#1e3a5f" : ACCENT) }]}>
              {pushing ? <ActivityIndicator size="small" color="#fff" /> : (
                <Feather name={mode === "vscode" ? "code" : "upload-cloud"} size={16} color="#fff" />
              )}
              <Text style={st.bigBtnTxt}>{pushing ? "Enviando..." : btnTxt}</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface Props { visible: boolean; onClose: () => void; }
type PGTab = "import" | "editor" | "config" | "build";

export function APKBuilderModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [pgTab, setPgTab] = useState<PGTab>("import");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [source, setSource] = useState("");
  const [projectReady, setProjectReady] = useState(false);
  const [cfg, setCfgState] = useState<AppConfig>(DEFAULT_CFG);
  const [ghToken, setGhToken] = useState("");
  const [ghUser, setGhUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [ghLoading, setGhLoading] = useState(false);
  const [ghMsg, setGhMsg] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildMsg, setBuildMsg] = useState("");
  const [resultB64, setResultB64] = useState("");
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [treeSearch, setTreeSearch] = useState("");
  const [pushMode, setPushMode] = useState<"vscode" | "push">("push");
  const [pushVisible, setPushVisible] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [neonDb, setNeonDb] = useState("");
  const [easToken, setEasToken] = useState("");
  const [easBuilding, setEasBuilding] = useState(false);
  const [easBuildMsg, setEasBuildMsg] = useState("");
  const [brainCopied, setBrainCopied] = useState(false);

  const [secToken, setSecToken] = useState(true);
  const [secImport, setSecImport] = useState(true);
  const [secGh, setSecGh] = useState(true);
  const [secBuildLog, setSecBuildLog] = useState(true);

  useEffect(() => {
    AsyncStorage.multiGet(["apk_gh_token", "apk_cfg", "apk_neon", "apk_eas_token"]).then(pairs => {
      const m = Object.fromEntries(pairs.map(([k, v]) => [k, v ?? ""]));
      if (m["apk_gh_token"]) { setGhToken(m["apk_gh_token"]); setTokenInput(m["apk_gh_token"]); setGhUser("✓ salvo"); }
      if (m["apk_cfg"]) { try { setCfgState(JSON.parse(m["apk_cfg"])); } catch {} }
      if (m["apk_neon"]) setNeonDb(m["apk_neon"]);
      if (m["apk_eas_token"]) setEasToken(m["apk_eas_token"]);
    });
  }, []);

  function saveCfg(patch: Partial<AppConfig>) {
    const next = { ...cfg, ...patch };
    setCfgState(next);
    AsyncStorage.setItem("apk_cfg", JSON.stringify(next));
  }

  async function verifyAndSaveToken(t: string) {
    if (!t.trim()) return;
    setVerifyingToken(true);
    try {
      const user = await ghGetUser(t.trim());
      setGhToken(t.trim()); setGhUser(user.login);
      await AsyncStorage.setItem("apk_gh_token", t.trim());
    } catch (e) {
      Alert.alert("Token inválido", String(e));
    } finally { setVerifyingToken(false); }
  }

  const flatFiles = useMemo(() => {
    const q = treeSearch.toLowerCase().trim();
    const list = q ? files.filter(f => f.path.toLowerCase().includes(q)) : files;
    return list;
  }, [files, treeSearch]);

  function openFile(file: ProjectFile) {
    setSelectedFile(file);
    setViewerVisible(true);
  }

  function selectAndEdit(file: ProjectFile) {
    setSelectedFile(file);
    setPgTab("editor");
    setTreeOpen(false);
  }

  function deleteFile(path: string) {
    Alert.alert("Excluir arquivo", `Excluir ${path.split("/").pop()}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive",
        onPress: () => {
          setFiles(prev => prev.filter(f => f.path !== path));
          if (selectedFile?.path === path) setSelectedFile(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      }
    ]);
  }

  function onSaveText(path: string, newText: string) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(newText);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const newData = btoa(binary);
    setFiles(prev => prev.map(f => f.path === path ? { ...f, data: newData, isBinary: false } : f));
    if (selectedFile?.path === path) setSelectedFile(prev => prev ? { ...prev, data: newData } : null);
  }

  function brainCopy() {
    if (!files.length) { Alert.alert("Sem projeto", "Importe um projeto primeiro."); return; }
    const exts: Record<string, number> = {};
    const topDirs = new Set<string>();
    for (const f of files) {
      const ext = f.path.split(".").pop()?.toLowerCase() ?? "?";
      exts[ext] = (exts[ext] || 0) + 1;
      const parts = f.path.split("/");
      if (parts.length > 1) topDirs.add(parts[0]);
    }
    const extSummary = Object.entries(exts)
      .sort((a, b) => b[1] - a[1])
      .map(([e, n]) => `${e}(${n})`)
      .join(", ");
    const context =
      `🧠 CONTEXTO DO PROJETO — ${cfg.appName || source}\n` +
      `📦 ${files.length.toLocaleString()} arquivos · ${source}\n` +
      `📁 Pastas: ${[...topDirs].join(", ") || "raiz"}\n` +
      `📄 Tipos: ${extSummary}\n` +
      `📋 Package: ${cfg.appId || "não definido"} · v${cfg.versionName}\n` +
      (neonDb ? `🗄️ Neon DB: configurado\n` : "") +
      `\n[Cole isso no início da conversa com a IA para ela saber o projeto]`;
    Clipboard.setString(context);
    setBrainCopied(true);
    setTimeout(() => setBrainCopied(false), 3000);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handlePickZip() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/zip", "application/x-tar", "application/gzip", "application/x-gzip", "application/octet-stream", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setLoading(true); setLoadMsg(`📦 Lendo ${asset.name}...`);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      setLoadMsg("🔍 Extraindo arquivos...");
      const extracted = await extractArchive(base64, asset.name);
      const { name, id } = guessConfig(extracted, asset.name);
      saveCfg({ appName: name, appId: id });
      setFiles(extracted); setSource(`Arquivo: ${asset.name}`);
      setProjectReady(true); setResultB64("");
      setLoadMsg(`✅ ${extracted.length.toLocaleString()} arquivos carregados — sem limite!`);
      setPgTab("editor"); setTreeOpen(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setLoadMsg("❌ " + String(e));
    } finally { setLoading(false); }
  }

  async function handleGhImport() {
    const raw = ghRepo.trim();
    if (!raw) { Alert.alert("Digite o repositório", "Formato: usuario/repo ou URL do GitHub"); return; }
    if (!ghToken) { Alert.alert("Token necessário", "Configure o token GitHub acima."); return; }
    let owner = "", repo = "";
    const match = raw.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) { owner = match[1]; repo = match[2].replace(/\.git$/, ""); }
    else {
      const parts = raw.split("/");
      if (parts.length >= 2) { owner = parts[0]; repo = parts[1].replace(/\.git$/, ""); }
      else { Alert.alert("Formato inválido", "Use: usuario/repositorio"); return; }
    }
    setGhLoading(true); setGhMsg(`📥 Baixando ${owner}/${repo}...`);
    try {
      const repoFiles = await ghImportRepo(ghToken, owner, repo, "main", (p) => setGhMsg(`📥 ${p}`));
      const { name, id } = guessConfig(repoFiles, repo);
      saveCfg({ appName: name, appId: id });
      setFiles(repoFiles); setSource(`GitHub: ${owner}/${repo}`);
      setProjectReady(true); setResultB64("");
      setGhMsg(`✅ ${repoFiles.length.toLocaleString()} arquivos baixados — todos incluídos!`);
      setPgTab("editor"); setTreeOpen(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setGhMsg("❌ " + String(e));
    } finally { setGhLoading(false); }
  }

  async function handleBuild() {
    if (!files.length) { Alert.alert("Sem arquivos", "Importe um projeto primeiro."); return; }
    if (!cfg.appName.trim()) { Alert.alert("Nome obrigatório", "Preencha o nome do app na aba Config."); return; }
    if (!cfg.appId.trim() || !cfg.appId.includes(".")) {
      Alert.alert("Package ID inválido", "Use o formato: com.empresa.app"); return;
    }
    setBuilding(true); setBuildMsg("🔨 Gerando projeto Android..."); setResultB64("");
    try {
      const b64 = await buildAndroidZip(cfg, files, source);
      setResultB64(b64);
      setBuildMsg(
        `✅ Projeto Android gerado! ${files.length.toLocaleString()} arquivos web incluídos.\n\n` +
        `📋 Próximos passos:\n` +
        `1. Baixe o ZIP ou envie ao GitHub\n` +
        `2. GitHub Actions compila o APK automaticamente (grátis)\n` +
        `3. Baixe em: Actions → último build → Artifacts`
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setBuildMsg("❌ " + String(e));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setBuilding(false); }
  }

  async function downloadResult() {
    if (!resultB64) return;
    const appName = cfg.appName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase() || "android-project";
    try {
      if (Platform.OS === "web") {
        const binary = atob(resultB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${appName}-android.zip`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else {
        const dir = FileSystem.cacheDirectory;
        if (!dir) throw new Error("Cache directory não disponível");
        const outPath = dir + `${appName}-android.zip`;
        await FileSystem.writeAsStringAsync(outPath, resultB64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(outPath, { mimeType: "application/zip", dialogTitle: "Baixar projeto Android" });
      }
    } catch (e) { Alert.alert("Erro ao baixar", String(e)); }
  }

  async function downloadEasJson() {
    const slug = (cfg.appName || "meuapp").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    const easJson = JSON.stringify({
      cli: { version: ">= 16.0.0" },
      build: {
        preview: { android: { buildType: "apk" } },
        production: { android: { buildType: "apk" } },
      },
      submit: { production: {} },
    }, null, 2);
    const appJson = JSON.stringify({
      expo: {
        name: cfg.appName || "Meu App",
        slug,
        version: cfg.versionName || "1.0.0",
        android: {
          package: cfg.appId || `com.meuapp.${slug}`,
          versionCode: cfg.versionCode || 1,
        },
      },
    }, null, 2);
    try {
      if (Platform.OS === "web") {
        const download = (name: string, content: string) => {
          const blob = new Blob([content], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = name;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        };
        download("eas.json", easJson);
        setTimeout(() => download("app.json", appJson), 500);
      } else {
        const dir = FileSystem.cacheDirectory ?? "";
        const easPath = dir + "eas.json";
        const appPath = dir + "app.json";
        await FileSystem.writeAsStringAsync(easPath, easJson, { encoding: FileSystem.EncodingType.UTF8 });
        await FileSystem.writeAsStringAsync(appPath, appJson, { encoding: FileSystem.EncodingType.UTF8 });
        const zip = new JSZip();
        zip.file("eas.json", easJson);
        zip.file("app.json", appJson);
        const b64 = await zip.generateAsync({ type: "base64" });
        const zipPath = dir + "eas-config.zip";
        await FileSystem.writeAsStringAsync(zipPath, b64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(zipPath, { mimeType: "application/zip", dialogTitle: "eas.json + app.json" });
      }
    } catch (e) { Alert.alert("Erro ao exportar", String(e)); }
  }

  async function triggerEasBuild() {
    if (!easToken.trim()) {
      Alert.alert(
        "🔑 Token EAS necessário",
        "Vá para a aba Config e cole seu token EAS Build.\n\nexpo.dev → Account Settings → Access Tokens",
        [{ text: "Ir para Config", onPress: () => setPgTab("config") }, { text: "Cancelar", style: "cancel" }]
      );
      return;
    }
    setEasBuilding(true);
    setEasBuildMsg("🔄 Disparando build EAS...");
    try {
      const slug = (cfg.appName || "meuapp").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const resp = await fetch("https://api.expo.dev/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${easToken.trim()}`,
          "expo-platform": "android",
        },
        body: JSON.stringify({
          query: `mutation CreateBuild($appIdentifier: String!, $platform: AppPlatform!, $profile: String!) {
            build {
              createBuild(
                appIdentifier: $appIdentifier
                platform: $platform
                profile: $profile
              ) {
                id status createdAt
              }
            }
          }`,
          variables: {
            appIdentifier: cfg.appId || `com.meuapp.${slug}`,
            platform: "ANDROID",
            profile: "preview",
          },
        }),
      });
      const json = await resp.json();
      if (json?.errors?.length) {
        setEasBuildMsg(`❌ Erro EAS: ${json.errors[0].message}`);
      } else if (json?.data?.build?.createBuild?.id) {
        const buildId = json.data.build.createBuild.id;
        setEasBuildMsg(`✅ Build disparado!\nID: ${buildId}\n\nAcompanhe em: expo.dev/accounts/me/projects/${slug}/builds`);
      } else {
        setEasBuildMsg("⚠️ Resposta inesperada da API EAS. Verifique seu token e package ID.");
      }
    } catch (e) {
      setEasBuildMsg(`❌ Falha na conexão: ${String(e)}`);
    } finally {
      setEasBuilding(false);
    }
  }

  async function exportSourceZip() {
    if (!files.length) return;
    const appName = cfg.appName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase() || "projeto";
    try {
      const zip = new JSZip();
      for (const f of files) {
        const p = f.path.replace(/^\//, "");
        if (p) zip.file(p, f.data, { base64: true });
      }
      if (Platform.OS === "web") {
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${appName}-fonte.zip`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else {
        const b64 = await zip.generateAsync({ type: "base64" });
        const dir = FileSystem.cacheDirectory;
        if (!dir) throw new Error("Diretório não disponível");
        const outPath = dir + `${appName}-fonte.zip`;
        await FileSystem.writeAsStringAsync(outPath, b64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(outPath, { mimeType: "application/zip", dialogTitle: "Exportar fonte ZIP" });
      }
    } catch (e) { Alert.alert("Erro ao exportar ZIP", String(e)); }
  }

  function openPush(mode: "vscode" | "push") {
    if (!files.length) { Alert.alert("Sem projeto", "Importe um projeto primeiro."); return; }
    setPushMode(mode); setPushVisible(true);
  }

  const TABS: [PGTab, string, string][] = [
    ["import", "package", "Importar"],
    ["editor", "file-text", `Editor${selectedFile ? "" : ""}`],
    ["config", "settings", "Config"],
    ["build", "cpu", "Build APK"],
  ];

  const renderFileItem = useCallback(({ item }: { item: ProjectFile }) => {
    const name = item.path.split("/").pop() ?? item.path;
    const dir = item.path.split("/").slice(0, -1).join("/");
    const bin = item.isBinary || isBinaryPath(item.path);
    const isSel = selectedFile?.path === item.path;
    return (
      <Pressable
        onPress={() => selectAndEdit(item)}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert(name, item.path, [
            {
              text: "📋 Copiar caminho",
              onPress: () => { Clipboard.setString(item.path); }
            },
            {
              text: "👁 Visualizar",
              onPress: () => openFile(item),
            },
            {
              text: "🗑 Excluir",
              style: "destructive",
              onPress: () => deleteFile(item.path),
            },
            { text: "Cancelar", style: "cancel" },
          ]);
        }}
        style={[st.fileItem, isSel && { backgroundColor: ACCENT + "22" }]}
      >
        <Text style={{ fontSize: 14, width: 20 }}>{fileIcon(item.path)}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[st.fileName, isSel && { color: ACCENT }, bin && { color: MUTED }]} numberOfLines={1}>{name}</Text>
          {dir ? <Text style={[st.filePath, { color: MUTED }]} numberOfLines={1}>{dir}</Text> : null}
        </View>
        {item.size ? <Text style={[st.hint, { color: MUTED }]}>{fmtSize(item.size)}</Text> : null}
        <Pressable onPress={() => deleteFile(item.path)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
          <Feather name="trash-2" size={12} color={MUTED + "88"} />
        </Pressable>
      </Pressable>
    );
  }, [selectedFile, files]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[st.root, { backgroundColor: BG }]}>
        <FileViewerModal
          visible={viewerVisible}
          file={selectedFile}
          onClose={() => setViewerVisible(false)}
          onSaveText={onSaveText}
        />
        <PushModal
          visible={pushVisible} onClose={() => setPushVisible(false)}
          mode={pushMode} ghToken={ghToken} files={files} source={source}
        />

        {/* Header */}
        <View style={[st.header, { paddingTop: insets.top + 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>🤖 APK Builder</Text>
            <Text style={[st.hint, { color: MUTED }]} numberOfLines={1}>
              {projectReady ? `${files.length.toLocaleString()} arquivos · ${source}` : "Importe um projeto para começar"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {projectReady && (
              <>
                <Pressable onPress={exportSourceZip} style={st.iconBtn}>
                  <Feather name="download" size={15} color={WHITE} />
                </Pressable>
                <Pressable onPress={brainCopy} style={[st.iconBtn, { backgroundColor: brainCopied ? "#052e16" : "#1a0a2e" }]}>
                  <Text style={{ fontSize: 15 }}>{brainCopied ? "✅" : "🧠"}</Text>
                </Pressable>
              </>
            )}
            <Pressable onPress={onClose} style={[st.iconBtn, { backgroundColor: "#1a2540" }]}>
              <Feather name="x" size={20} color={WHITE} />
            </Pressable>
          </View>
        </View>

        {/* Tab bar */}
        <View style={st.tabBar}>
          {TABS.map(([id, icon, label]) => (
            <Pressable key={id} onPress={() => setPgTab(id)} style={[st.tab, pgTab === id && st.tabActive]}>
              <Feather name={icon as any} size={13} color={pgTab === id ? ACCENT : MUTED} />
              <Text style={[st.tabTxt, pgTab === id && { color: ACCENT }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── IMPORTAR ── */}
        {pgTab === "import" && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[st.content, { paddingBottom: 20 }]} keyboardShouldPersistTaps="handled">

            <SectionToggle label="🔑 TOKEN GITHUB" open={secToken} onToggle={() => setSecToken(v => !v)}>
              {ghUser ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <View style={st.badge}><Text style={st.badgeTxt}>✅ {ghUser}</Text></View>
                  <Pressable onPress={() => { setGhToken(""); setGhUser(""); setTokenInput(""); AsyncStorage.removeItem("apk_gh_token"); }}>
                    <Text style={[st.hint, { color: RED }]}>Trocar</Text>
                  </Pressable>
                </View>
              ) : null}
              <TextInput
                style={st.input} value={tokenInput} onChangeText={setTokenInput}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxx" placeholderTextColor={MUTED}
                autoCapitalize="none" autoCorrect={false} secureTextEntry
              />
              <Pressable
                onPress={() => verifyAndSaveToken(tokenInput)}
                disabled={verifyingToken || !tokenInput.trim()}
                style={[st.btn, { backgroundColor: verifyingToken ? BORDER : ACCENT }]}
              >
                {verifyingToken ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="check" size={14} color="#fff" />}
                <Text style={st.btnTxt}>{verifyingToken ? "Verificando..." : "Salvar Token"}</Text>
              </Pressable>
              <Text style={[st.hint, { color: MUTED, marginTop: 6 }]}>
                GitHub → Settings → Developer settings → Personal access tokens → repo, workflow
              </Text>
            </SectionToggle>

            <SectionToggle label="📦 IMPORTAR ZIP / TAR.GZ" open={secImport} onToggle={() => setSecImport(v => !v)}>
              <Pressable
                onPress={handlePickZip} disabled={loading}
                style={({ pressed }) => [st.dropZone, projectReady && st.dropLoaded, pressed && { opacity: 0.8 }]}
              >
                {loading ? <ActivityIndicator color={ACCENT} /> : (
                  <>
                    <Text style={{ fontSize: 28 }}>{projectReady ? "✅" : "📦"}</Text>
                    <Text style={[st.dropTitle, projectReady && { color: GREEN }]}>
                      {projectReady ? `${files.length.toLocaleString()} arquivos carregados` : "Toque para escolher arquivo"}
                    </Text>
                    <Text style={[st.hint, { color: MUTED }]}>
                      {projectReady ? source : "ZIP, TAR.GZ, TGZ — qualquer projeto web"}
                    </Text>
                  </>
                )}
              </Pressable>
              <MsgBox msg={loadMsg} />
            </SectionToggle>

            <SectionToggle label="🐙 CLONAR REPOSITÓRIO GITHUB" open={secGh} onToggle={() => setSecGh(v => !v)}>
              <TextInput
                style={st.input} value={ghRepo} onChangeText={setGhRepo}
                placeholder="usuario/repositorio ou URL do GitHub"
                placeholderTextColor={MUTED} autoCapitalize="none" autoCorrect={false}
                returnKeyType="go" onSubmitEditing={handleGhImport}
              />
              <Pressable
                onPress={handleGhImport} disabled={ghLoading || !ghRepo.trim()}
                style={[st.btn, { backgroundColor: ghLoading ? BORDER : "#1e3a5f", marginTop: 8 }]}
              >
                {ghLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="download-cloud" size={14} color="#fff" />}
                <Text style={st.btnTxt}>{ghLoading ? "Baixando..." : "Clonar repositório"}</Text>
              </Pressable>
              <MsgBox msg={ghMsg} />
            </SectionToggle>

            {projectReady && (
              <View style={st.card}>
                <Text style={[st.sectionLabel, { marginBottom: 10 }]}>AÇÕES RÁPIDAS</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {([
                    { icon: "code", label: "VS Code", color: "#60a5fa", action: () => openPush("vscode") },
                    { icon: "upload-cloud", label: "GitHub", color: ACCENT, action: () => openPush("push") },
                    { icon: "download", label: "ZIP fontes", color: YELLOW, action: exportSourceZip },
                  ] as const).map(item => (
                    <Pressable key={item.label} onPress={item.action}
                      style={[st.compactBtn, { borderColor: item.color + "44", backgroundColor: item.color + "11" }]}>
                      <Feather name={item.icon} size={13} color={item.color} />
                      <Text style={[st.compactBtnTxt, { color: item.color }]}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* ── EDITOR ── */}
        {pgTab === "editor" && (
          <View style={{ flex: 1 }}>
            {!selectedFile ? (
              <View style={st.emptyState}>
                <Text style={{ fontSize: 36 }}>📂</Text>
                <Text style={[st.hint, { color: MUTED, textAlign: "center", marginTop: 8 }]}>
                  Selecione um arquivo na árvore abaixo{"\n"}para visualizar e editar aqui
                </Text>
                <Pressable onPress={() => setTreeOpen(true)} style={[st.btn, { backgroundColor: ACCENT, marginTop: 16 }]}>
                  <Feather name="folder" size={14} color="#fff" />
                  <Text style={st.btnTxt}>Abrir árvore de arquivos</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER, gap: 8 }}>
                  <Text style={{ fontSize: 16 }}>{fileIcon(selectedFile.path)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.sectionLabel, { color: WHITE }]} numberOfLines={1}>{selectedFile.path.split("/").pop()}</Text>
                    <Text style={[st.hint, { color: MUTED }]} numberOfLines={1}>{selectedFile.path}</Text>
                  </View>
                  <Pressable onPress={() => openFile(selectedFile)} style={st.smallBtn}>
                    <Feather name="maximize-2" size={13} color={ACCENT} />
                    <Text style={[st.smallBtnTxt, { color: ACCENT }]}>Expandir</Text>
                  </Pressable>
                </View>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text selectable style={st.codeText}>
                      {decodeFileToText(selectedFile)}
                    </Text>
                  </ScrollView>
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* ── CONFIG ── */}
        {pgTab === "config" && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[st.content, { paddingBottom: 20 }]} keyboardShouldPersistTaps="handled">
            <View style={st.card}>
              <Text style={[st.sectionLabel, { marginBottom: 10 }]}>APP</Text>
              <Text style={st.fieldLabel}>NOME DO APP</Text>
              <TextInput style={st.input} value={cfg.appName} onChangeText={v => saveCfg({ appName: v })}
                placeholder="Meu App" placeholderTextColor={MUTED} />
              <Text style={[st.fieldLabel, { marginTop: 10 }]}>PACKAGE ID</Text>
              <TextInput style={st.input} value={cfg.appId} onChangeText={v => saveCfg({ appId: v })}
                placeholder="com.empresa.app" placeholderTextColor={MUTED} autoCapitalize="none" autoCorrect={false} />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>VERSÃO</Text>
                  <TextInput style={st.input} value={cfg.versionName} onChangeText={v => saveCfg({ versionName: v })}
                    placeholder="1.0.0" placeholderTextColor={MUTED} autoCapitalize="none" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>BUILD #</Text>
                  <TextInput style={st.input} value={String(cfg.versionCode)}
                    onChangeText={v => saveCfg({ versionCode: parseInt(v) || 1 })}
                    placeholder="1" placeholderTextColor={MUTED} keyboardType="number-pad" />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>COR TEMA</Text>
                  <TextInput style={st.input} value={cfg.themeColor} onChangeText={v => saveCfg({ themeColor: v })}
                    placeholder="#6366f1" placeholderTextColor={MUTED} autoCapitalize="none" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>COR FUNDO</Text>
                  <TextInput style={st.input} value={cfg.bgColor} onChangeText={v => saveCfg({ bgColor: v })}
                    placeholder="#0f172a" placeholderTextColor={MUTED} autoCapitalize="none" />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>MIN SDK</Text>
                  <TextInput style={st.input} value={String(cfg.minSdk)}
                    onChangeText={v => saveCfg({ minSdk: parseInt(v) || 22 })}
                    placeholder="22" placeholderTextColor={MUTED} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.fieldLabel, { marginBottom: 6 }]}>ORIENTAÇÃO</Text>
                  <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
                    {(["portrait", "landscape", "any"] as const).map(o => (
                      <Pressable key={o} onPress={() => saveCfg({ orientation: o })}
                        style={[st.chip, cfg.orientation === o && st.chipActive]}>
                        <Text style={[st.chipTxt, cfg.orientation === o && { color: "#fff" }]}>{o}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            <View style={st.card}>
              <Text style={[st.sectionLabel, { marginBottom: 10 }]}>🗄️ BANCO NEON (POSTGRESQL)</Text>
              <Text style={[st.hint, { color: MUTED, marginBottom: 8 }]}>
                Connection string do banco Neon para usar no projeto
              </Text>
              <TextInput
                style={[st.input, { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 11 }]}
                value={neonDb}
                onChangeText={v => { setNeonDb(v); AsyncStorage.setItem("apk_neon", v); }}
                placeholder="postgresql://usuario:senha@host/db?sslmode=require"
                placeholderTextColor={MUTED} autoCapitalize="none" autoCorrect={false}
                secureTextEntry multiline
              />
              {neonDb.trim() ? (
                <View style={[st.infoBox, { marginTop: 8, borderColor: GREEN + "44", backgroundColor: "#052e16" }]}>
                  <Text style={[st.hint, { color: GREEN }]}>✅ Neon DB configurado e salvo localmente</Text>
                </View>
              ) : null}
            </View>

            <View style={st.card}>
              <Text style={[st.sectionLabel, { marginBottom: 10 }]}>🔑 TOKEN EAS BUILD (EXPO)</Text>
              <Text style={[st.hint, { color: MUTED, marginBottom: 8 }]}>
                Token EAS para compilar APK via Expo — expo.dev → Access Tokens
              </Text>
              <TextInput
                style={st.input} value={easToken} secureTextEntry
                onChangeText={v => { setEasToken(v); AsyncStorage.setItem("apk_eas_token", v); }}
                placeholder="eas_xxxxxxxxxxxxxxxxxxxxxxxx" placeholderTextColor={MUTED}
                autoCapitalize="none" autoCorrect={false}
              />
              {easToken.trim() ? (
                <View style={[st.infoBox, { marginTop: 8, borderColor: ACCENT + "44", backgroundColor: ACCENT + "11" }]}>
                  <Text style={[st.hint, { color: ACCENT }]}>✅ EAS token salvo localmente</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        )}

        {/* ── BUILD APK ── */}
        {pgTab === "build" && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[st.content, { paddingBottom: 20 }]}>
            <View style={st.card}>
              <Text style={[st.sectionLabel, { marginBottom: 8 }]}>RESUMO</Text>
              {([
                ["Nome", cfg.appName || "(não definido)"],
                ["Package", cfg.appId || "(não definido)"],
                ["Versão", `${cfg.versionName} (build ${cfg.versionCode})`],
                ["Min SDK", `API ${cfg.minSdk}+`],
                ["Orientação", cfg.orientation],
                ["Arquivos", `${files.length.toLocaleString()} arquivos importados`],
              ] as const).map(([k, v]) => (
                <View key={k} style={st.cfgRow}>
                  <Text style={[st.hint, { color: MUTED, width: 90 }]}>{k}</Text>
                  <Text style={[st.hint, { color: WHITE, flex: 1 }]}>{v}</Text>
                </View>
              ))}
            </View>

            <View style={st.card}>
              <Text style={[st.sectionLabel, { marginBottom: 8 }]}>GERAR PROJETO ANDROID + CI</Text>
              <Text style={[st.hint, { color: MUTED, marginBottom: 12, lineHeight: 18 }]}>
                Gera projeto Android Studio com WebView nativo + GitHub Actions. Faça push → APK gerado automaticamente (grátis).
              </Text>
              <Pressable
                onPress={handleBuild} disabled={building || !files.length}
                style={[st.bigBtn, (building || !files.length) && { opacity: 0.5 }]}
              >
                {building ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 20 }}>🤖</Text>}
                <Text style={st.bigBtnTxt}>{building ? "Gerando..." : "Gerar Projeto Android"}</Text>
              </Pressable>
              <SectionToggle label="📋 LOG DO BUILD" open={secBuildLog} onToggle={() => setSecBuildLog(v => !v)}>
                <MsgBox msg={buildMsg} />
              </SectionToggle>
              {resultB64 ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    <Pressable onPress={downloadResult}
                      style={[st.compactBtn, { borderColor: GREEN + "44", backgroundColor: "#052e16" }]}>
                      <Feather name="download" size={13} color={GREEN} />
                      <Text style={[st.compactBtnTxt, { color: GREEN }]}>Baixar ZIP</Text>
                    </Pressable>
                    <Pressable onPress={() => openPush("push")}
                      style={[st.compactBtn, { borderColor: ACCENT + "44", backgroundColor: ACCENT + "11" }]}>
                      <Feather name="upload-cloud" size={13} color={ACCENT} />
                      <Text style={[st.compactBtnTxt, { color: ACCENT }]}>Push GitHub</Text>
                    </Pressable>
                    <Pressable onPress={() => openPush("vscode")}
                      style={[st.compactBtn, { borderColor: "#60a5fa44", backgroundColor: "#1e3a5f" }]}>
                      <Feather name="code" size={13} color="#60a5fa" />
                      <Text style={[st.compactBtnTxt, { color: "#60a5fa" }]}>VS Code</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={st.card}>
              <Text style={[st.sectionLabel, { marginBottom: 4 }]}>🚀 EAS BUILD (EXPO)</Text>
              {/* Status do token */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: easToken.trim() ? "#22c55e" : "#f59e0b" }} />
                <Text style={[st.hint, { color: easToken.trim() ? "#22c55e" : "#f59e0b" }]}>
                  {easToken.trim() ? "Token EAS configurado — pronto para disparar" : "Token EAS não configurado — vá em Config"}
                </Text>
                {!easToken.trim() && (
                  <Pressable onPress={() => setPgTab("config")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={{ color: "#7c3aed", fontSize: 11, fontWeight: "700" }}>→ Config</Text>
                  </Pressable>
                )}
              </View>
              {/* Botão DISPARAR */}
              <Pressable
                onPress={triggerEasBuild}
                disabled={easBuilding}
                style={[st.bigBtn, {
                  backgroundColor: easToken.trim() ? "#7c3aed" : "#3d2070",
                  opacity: easBuilding ? 0.7 : 1,
                  marginBottom: 8,
                }]}
              >
                {easBuilding
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontSize: 18 }}>🚀</Text>}
                <Text style={st.bigBtnTxt}>{easBuilding ? "Disparando..." : "DISPARAR BUILD APK"}</Text>
              </Pressable>
              {easBuildMsg ? (
                <View style={[st.infoBox, {
                  marginBottom: 8,
                  borderColor: easBuildMsg.startsWith("✅") ? "#22c55e44" : easBuildMsg.startsWith("❌") ? "#ef444444" : "#7c3aed44",
                  backgroundColor: easBuildMsg.startsWith("✅") ? "#052e16" : easBuildMsg.startsWith("❌") ? "#1a0000" : "#1a0a2e",
                }]}>
                  <Text style={[st.hint, {
                    color: easBuildMsg.startsWith("✅") ? "#22c55e" : easBuildMsg.startsWith("❌") ? "#f87171" : "#c4b5fd",
                    lineHeight: 18,
                  }]}>{easBuildMsg}</Text>
                </View>
              ) : null}
              {/* Exportar configs */}
              <Pressable onPress={downloadEasJson}
                style={[st.compactBtn, { borderColor: "#7c3aed44", backgroundColor: "#1a0a2e", marginTop: 4 }]}>
                <Feather name="download" size={13} color="#c4b5fd" />
                <Text style={[st.compactBtnTxt, { color: "#c4b5fd" }]}>Exportar eas.json + app.json</Text>
              </Pressable>
            </View>

            <View style={st.card}>
              <Text style={[st.sectionLabel, { marginBottom: 8 }]}>PWA → APK VIA GITHUB PAGES</Text>
              <Text style={[st.hint, { color: MUTED, marginBottom: 10, lineHeight: 18 }]}>
                Publique como PWA e converta em APK sem Android Studio:
              </Text>
              {([
                ["1", "Push GitHub + Pages", "Envie para GitHub com Pages ativado"],
                ["2", "URL HTTPS gerada", "https://usuario.github.io/repo"],
                ["3", "pwabuilder.com", "Cole a URL e gere APK/AAB gratuito"],
                ["4", "Bubblewrap (Google)", "TWA nativo — chrome WebView otimizado"],
              ] as const).map(([n, t, d]) => (
                <View key={n} style={{ flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                  <View style={st.stepBadge}><Text style={st.stepN}>{n}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: WHITE, fontSize: 12, fontWeight: "700" }}>{t}</Text>
                    <Text style={[st.hint, { color: MUTED }]}>{d}</Text>
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <Pressable onPress={() => openPush("push")}
                  style={[st.compactBtn, { borderColor: GREEN + "44", backgroundColor: "#052e16" }]}>
                  <Feather name="upload-cloud" size={13} color={GREEN} />
                  <Text style={[st.compactBtnTxt, { color: GREEN }]}>Push + Pages</Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL("https://www.pwabuilder.com/")}
                  style={[st.compactBtn, { borderColor: YELLOW + "44", backgroundColor: "#1a1000" }]}>
                  <Feather name="external-link" size={13} color={YELLOW} />
                  <Text style={[st.compactBtnTxt, { color: YELLOW }]}>pwabuilder.com</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        {/* ── ÁRVORE DE ARQUIVOS (painel inferior persistente) ── */}
        <View style={[st.treePanel, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Pressable onPress={() => setTreeOpen(v => !v)} style={st.treePanelBar}>
            <Feather name="folder" size={14} color={treeOpen ? ACCENT : MUTED} />
            <Text style={[st.sectionLabel, { color: treeOpen ? ACCENT : MUTED }]}>
              {files.length > 0 ? `ÁRVORE — ${files.length.toLocaleString()} ARQUIVOS` : "ÁRVORE DE ARQUIVOS"}
            </Text>
            {files.length > 0 && (
              <Text style={[st.hint, { color: MUTED, marginLeft: 4 }]}>
                {treeSearch ? `(${flatFiles.length} filtrados)` : ""}
              </Text>
            )}
            <View style={{ flex: 1 }} />
            {projectReady && (
              <Pressable onPress={brainCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginRight: 8, opacity: brainCopied ? 1 : 0.7 }}>
                <Text style={{ fontSize: 16 }}>{brainCopied ? "✅" : "🧠"}</Text>
              </Pressable>
            )}
            <Feather name={treeOpen ? "chevron-down" : "chevron-up"} size={16} color={MUTED} />
          </Pressable>

          {treeOpen && (
            <View style={{ height: 300 }}>
              <View style={[st.searchRow]}>
                <Feather name="search" size={13} color={MUTED} />
                <TextInput
                  style={[st.searchInput, { flex: 1 }]}
                  value={treeSearch} onChangeText={setTreeSearch}
                  placeholder={`Buscar em ${files.length.toLocaleString()} arquivos...`}
                  placeholderTextColor={MUTED} autoCapitalize="none"
                />
                {treeSearch.length > 0 && (
                  <Pressable onPress={() => setTreeSearch("")}>
                    <Feather name="x" size={13} color={MUTED} />
                  </Pressable>
                )}
              </View>
              {files.length === 0 ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Text style={{ fontSize: 28 }}>📭</Text>
                  <Text style={[st.hint, { color: MUTED }]}>Importe um projeto para ver os arquivos</Text>
                </View>
              ) : (
                <FlatList
                  data={flatFiles}
                  keyExtractor={item => item.path}
                  renderItem={renderFileItem}
                  style={{ flex: 1 }}
                  removeClippedSubviews
                  maxToRenderPerBatch={30}
                  windowSize={10}
                  initialNumToRender={20}
                  getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
                />
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: "row", alignItems: "center" },
  headerTitle: { color: WHITE, fontSize: 18, fontWeight: "800" },
  hint: { fontSize: 11, lineHeight: 16 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: CARD },
  tab: { flex: 1, flexDirection: "column", alignItems: "center", paddingVertical: 8, gap: 2 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: ACCENT },
  tabTxt: { fontSize: 10, color: MUTED },
  content: { padding: 14, gap: 12 },
  card: { backgroundColor: CARD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER },
  sectionLabel: { color: MUTED, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  fieldLabel: { color: MUTED, fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginTop: 2 },
  input: { backgroundColor: BG, borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: WHITE, fontSize: 13, marginTop: 6 },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, marginTop: 10, justifyContent: "center" },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  dropZone: { borderWidth: 2, borderColor: BORDER, borderStyle: "dashed", borderRadius: 12, padding: 24, alignItems: "center", gap: 6, backgroundColor: CARD2 },
  dropLoaded: { borderColor: GREEN + "60", backgroundColor: "#052e16" },
  dropTitle: { color: WHITE, fontSize: 15, fontWeight: "700" },
  infoBox: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10, backgroundColor: CARD2 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: BORDER },
  actionBtnTxt: { color: WHITE, fontWeight: "700", fontSize: 13, flex: 1 },
  compactBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  compactBtnTxt: { fontSize: 12, fontWeight: "700" },
  bigBtn: { flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "center", backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14 },
  bigBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER, gap: 8, backgroundColor: CARD2 },
  searchInput: { color: WHITE, fontSize: 13 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: CARD, alignItems: "center", justifyContent: "center" },
  badge: { backgroundColor: GREEN + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { color: GREEN, fontSize: 10, fontWeight: "700" },
  cfgRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: BORDER },
  chip: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: CARD2, borderWidth: 1, borderColor: BORDER },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipTxt: { color: MUTED, fontSize: 10, fontWeight: "700" },
  stepBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" },
  stepN: { color: "#fff", fontSize: 10, fontWeight: "800" },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  toggle: { width: 40, height: 22, borderRadius: 11, backgroundColor: BORDER, padding: 2 },
  toggleOn: { backgroundColor: ACCENT },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: WHITE },
  toggleKnobOn: { transform: [{ translateX: 18 }] },
  sheetRoot: { flex: 1, backgroundColor: "#060e1c" },
  sheetHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  sheetTitle: { flex: 1, color: WHITE, fontSize: 16, fontWeight: "800" },
  sheetFooter: { padding: 12, borderTopWidth: 1, borderTopColor: BORDER },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: CARD },
  smallBtnTxt: { color: WHITE, fontSize: 12, fontWeight: "700" },
  codeText: { color: "#a5b4fc", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 18 },
  treePanel: { borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: CARD2 },
  treePanelBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  fileItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: BORDER + "40", height: 52 },
  fileName: { color: WHITE, fontSize: 13, fontWeight: "500" },
  filePath: { fontSize: 10, marginTop: 1 },
});
