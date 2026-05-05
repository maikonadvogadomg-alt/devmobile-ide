import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import {
  getUser,
  listRepos,
  cloneRepo,
  clonePublicUrl,
  createRepo,
  pushFiles,
  enablePages,
  getPagesStatus,
  makeRepoPublic,
  type GHUser,
  type GHRepo,
  type PagesInfo,
} from "@/services/githubService";

type ScreenView = "main" | "import" | "create" | "push-existing" | "token";


export default function GitHubModal({
  visible,
  onClose,
  initialView,
}: {
  visible: boolean;
  onClose: () => void;
  initialView?: ScreenView;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { gitConfigs, addGitConfig, updateGitConfig, activeProject, createFile, createFiles } = useApp();

  const ghConfig = gitConfigs.find((g) => g.provider === "github");
  const savedToken = ghConfig?.token || "";

  const [view, setView] = useState<ScreenView>(savedToken ? "main" : "token");
  const [token, setToken] = useState(savedToken);
  const [tokenInput, setTokenInput] = useState("");
  const [ghUser, setGhUser] = useState<GHUser | null>(null);
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");

  // Create form
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createPrivate, setCreatePrivate] = useState(false);
  const [createMsg, setCreateMsg] = useState(`Enviado pelo DevMobile — ${new Date().toLocaleDateString("pt-BR")}`);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Push existing form
  const [pushOwner, setPushOwner] = useState("");
  const [pushRepo, setPushRepo] = useState("");
  const [pushMsg, setPushMsg] = useState(`DevMobile — ${new Date().toLocaleDateString("pt-BR")}`);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Clone public URL
  const [publicUrl, setPublicUrl] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState<{ pct: number; phase: string } | null>(null);

  // GitHub Pages
  const [pagesInfo, setPagesInfo] = useState<PagesInfo | null>(null);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesLogs, setPagesLogs] = useState<string[]>([]);
  const [lastPushedRepo, setLastPushedRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [showPagesMain, setShowPagesMain] = useState(false);

  // Reset when opened
  useEffect(() => {
    if (visible) {
      const t = gitConfigs.find((g) => g.provider === "github")?.token || "";
      setToken(t);
      // Se recebeu initialView, usa ela; senão comportamento padrão
      if (initialView) {
        setView(initialView === "import" ? "import" : initialView === "push-existing" ? "push-existing" : t ? "main" : "token");
      } else {
        setView(t ? "main" : "token");
      }
      setCreateResult(null);
      setPushResult(null);
      setRepoSearch("");
      if (t) fetchUser(t);
      // Abre GitHub Pages automaticamente se solicitado
      if (initialView === "main") setShowPagesMain(true);
    }
  }, [visible]);

  const fetchUser = useCallback(async (t: string) => {
    setLoadingUser(true);
    try {
      const data = await getUser(t);
      setGhUser(data);
    } catch {
      setGhUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  const fetchRepos = useCallback(async (t: string) => {
    setLoadingRepos(true);
    try {
      const data = await listRepos(t);
      setRepos(data);
    } catch {}
    setLoadingRepos(false);
  }, []);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    setLoadingUser(true);
    try {
      const data = await getUser(tokenInput.trim());
      setGhUser(data);
      setToken(tokenInput.trim());
      addGitConfig({
        provider: "github",
        token: tokenInput.trim(),
        username: data.login,
        email: "",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setView("main");
    } catch (e: any) {
      Alert.alert("❌ Token inválido", e?.message || "Verifique o token e tente novamente.");
    }
    setLoadingUser(false);
  };

  const handleImportOpen = async () => {
    if (!token) { setView("token"); return; }
    setView("import");
    if (repos.length === 0) await fetchRepos(token);
  };

  const handleCloneRepo = async (repo: GHRepo) => {
    if (!activeProject) {
      Alert.alert("Aviso", "Abra ou crie um projeto primeiro.");
      return;
    }
    Alert.alert(
      `Importar ${repo.full_name}?`,
      `Os arquivos serão adicionados ao projeto "${activeProject.name}".`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Importar",
          onPress: async () => {
            setCloning(true);
            setCloneProgress({ pct: 0, phase: "Iniciando..." });
            try {
              const data = await cloneRepo(
                token,
                repo.owner.login,
                repo.name,
                repo.default_branch,
                (cur, _total, phase) => setCloneProgress({ pct: cur, phase })
              );
              createFiles(activeProject.id, data.files.map((f) => ({ path: f.path, content: f.content })));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setCloneProgress(null);
              Alert.alert(
                "✅ Importado!",
                `${data.fetched.toLocaleString()} arquivo(s) de "${repo.full_name}" importados (${data.skipped} ignorados).`
              );
              onClose();
            } catch (e: any) {
              setCloneProgress(null);
              Alert.alert("❌ Erro", e?.message || String(e));
            }
            setCloning(false);
          },
        },
      ]
    );
  };

  const handleClonePublic = async () => {
    if (!publicUrl.trim()) return;
    if (!activeProject) {
      Alert.alert("Aviso", "Abra ou crie um projeto primeiro.");
      return;
    }
    setCloning(true);
    setCloneProgress({ pct: 0, phase: "Iniciando..." });
    try {
      const data = await clonePublicUrl(
        publicUrl.trim(),
        token || undefined,
        (cur, _total, phase) => setCloneProgress({ pct: cur, phase })
      );
      createFiles(activeProject.id, data.files.map((f) => ({ path: f.path, content: f.content })));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCloneProgress(null);
      Alert.alert(
        "✅ Importado!",
        `${data.fetched.toLocaleString()} arquivo(s) de "${data.repoName}" importados (${data.skipped} ignorados).`
      );
      setPublicUrl("");
      onClose();
    } catch (e: any) {
      setCloneProgress(null);
      Alert.alert("❌ Erro", e?.message || String(e));
    }
    setCloning(false);
  };

  const handleCreateAndPush = async () => {
    if (!createName.trim()) {
      Alert.alert("Aviso", "Informe o nome do repositório.");
      return;
    }
    if (!activeProject) {
      Alert.alert("Aviso", "Abra um projeto primeiro.");
      return;
    }
    if (!activeProject.files.length) {
      Alert.alert("Aviso", "O projeto está vazio.");
      return;
    }
    setCreating(true);
    setCreateResult(null);
    try {
      const owner = ghUser?.login || gitConfigs.find(g => g.provider === "github")?.username || "";
      setCreateResult({ ok: false, msg: "⏳ Criando repositório..." });

      const newRepo = await createRepo(token, createName.trim(), createDesc.trim(), createPrivate);

      const files = activeProject.files
        .filter((f) => !f.path?.endsWith(".gitkeep"))
        .map((f) => ({ path: f.path || f.name, content: f.content || "" }));

      const result = await pushFiles(
        token,
        owner,
        createName.trim(),
        files,
        createMsg.trim() || "Enviado pelo DevMobile",
        newRepo.default_branch || "main"
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLastPushedRepo({ owner, repo: createName.trim() });
      setPagesInfo(null);
      setCreateResult({
        ok: true,
        msg: `✅ Enviado! ${result.pushed} arquivo(s) em github.com/${owner}/${createName.trim()}`,
      });
    } catch (e: any) {
      setCreateResult({ ok: false, msg: e?.message || String(e) });
    }
    setCreating(false);
  };

  const handlePushExisting = async () => {
    if (!pushOwner.trim() || !pushRepo.trim()) {
      // Try to auto-fill from user
      if (ghUser && !pushOwner.trim()) {
        setPushOwner(ghUser.login);
        return;
      }
      Alert.alert("Aviso", "Informe o owner e o nome do repositório.");
      return;
    }
    if (!activeProject?.files.length) {
      Alert.alert("Aviso", "O projeto está vazio.");
      return;
    }
    setPushing(true);
    setPushResult(null);
    try {
      const files = activeProject.files
        .filter((f) => !f.path?.endsWith(".gitkeep"))
        .map((f) => ({ path: f.path || f.name, content: f.content || "" }));
      const result = await pushFiles(
        token,
        pushOwner.trim(),
        pushRepo.trim(),
        files,
        pushMsg.trim() || "DevMobile — atualização"
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLastPushedRepo({ owner: pushOwner.trim(), repo: pushRepo.trim() });
      setPagesInfo(null);
      setPushResult({ ok: true, msg: `✅ Enviado! ${result.pushed}/${result.total} arquivo(s) enviados.` });
    } catch (e: any) {
      setPushResult({ ok: false, msg: e?.message || String(e) });
    }
    setPushing(false);
  };

  const log = (msg: string) => setPagesLogs((prev) => [...prev, msg]);

  const handlePublishPages = async (repoOverride?: { owner: string; repo: string }) => {
    const target = repoOverride || lastPushedRepo;
    if (!target) {
      Alert.alert("Aviso", "Envie o projeto para um repositório GitHub primeiro.");
      return;
    }
    const { owner, repo } = target;
    setPagesLoading(true);
    setPagesInfo(null);
    setPagesLogs([]);
    try {
      if (!activeProject) throw new Error("Nenhum projeto ativo.");
      const fileCount = activeProject.files.filter(f => !f.path?.endsWith(".gitkeep")).length;

      log("🔨 Build concluído! Lendo arquivos...");
      await new Promise(r => setTimeout(r, 400));
      log(`📦 ${fileCount} arquivo(s) prontos. Verificando repositório GitHub...`);
      await new Promise(r => setTimeout(r, 500));
      log(`🔍 Repositório ${owner}/${repo} encontrado.`);
      await new Promise(r => setTimeout(r, 300));
      log(`🚀 Enviando para o GitHub...`);

      // Garante repositório público (GitHub Pages grátis exige repo público)
      try { await makeRepoPublic(token, owner, repo); } catch {}

      log("🌐 Habilitando GitHub Pages...");
      const info = await enablePages(token, owner, repo, "main", "/");
      setPagesInfo(info);

      log(`✅ Pronto! GitHub Pages habilitado.`);
      log(`📌 Publicado em ${info.url}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      log(`❌ Erro: ${e?.message || String(e)}`);
      Alert.alert(
        "❌ GitHub Pages",
        `${e?.message || String(e)}\n\nDica: o repositório precisa ser público para usar GitHub Pages gratuito.`
      );
    }
    setPagesLoading(false);
  };

  const disconnect = () => {
    Alert.alert("Desconectar GitHub?", "O token será removido.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desconectar",
        style: "destructive",
        onPress: () => {
          updateGitConfig("github", { token: "", username: "" });
          setToken("");
          setGhUser(null);
          setRepos([]);
          setView("token");
        },
      },
    ]);
  };

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  const topPadding = Platform.OS === "web" ? 40 : insets.top;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border, paddingTop: topPadding + 4 }]}>
          {view !== "main" && view !== "token" ? (
            <TouchableOpacity onPress={() => setView(token ? "main" : "token")} style={s.backBtn}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
          ) : (
            <View style={[s.ghIcon, { backgroundColor: "#22c55e22" }]}>
              <Feather name="github" size={18} color="#22c55e" />
            </View>
          )}
          <Text style={[s.headerTitle, { color: colors.foreground }]}>
            {view === "token" ? "Conectar GitHub" :
             view === "import" ? "Importar Repositório" :
             view === "create" ? "Criar e Enviar" :
             view === "push-existing" ? "Enviar para repo existente" :
             "GitHub"}
          </Text>
          <View style={{ flex: 1 }} />
          {view === "main" && ghUser && (
            <TouchableOpacity onPress={disconnect} style={{ marginRight: 8 }}>
              <Text style={{ color: colors.destructive, fontSize: 12 }}>Desconectar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* ── TOKEN VIEW ── */}
        {view === "token" && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>TOKEN DE ACESSO</Text>
            <Text style={[s.tip, { color: colors.mutedForeground }]}>
              Para acessar repositórios privados e enviar código, você precisa de um token pessoal do GitHub.
            </Text>

            <View style={[s.tipBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.tipBoxTitle, { color: colors.foreground }]}>Como criar seu Token:</Text>
              {[
                "1. Acesse: github.com → Settings",
                "2. Developer settings → Personal access tokens",
                "3. Generate new token (classic)",
                "4. Marque: repo, workflow",
                "5. Copie o token (começa com ghp_)",
              ].map((line) => (
                <Text key={line} style={{ color: colors.mutedForeground, fontSize: 12, marginVertical: 1 }}>{line}</Text>
              ))}
            </View>

            <Text style={[s.label, { color: colors.mutedForeground }]}>SEU TOKEN PESSOAL</Text>

            {/* Botão de colar token do clipboard — fluxo mais rápido */}
            <TouchableOpacity
              onPress={async () => {
                try {
                  const text = await Clipboard.getStringAsync();
                  const tok = (text || "").trim();
                  if (!tok) { Alert.alert("Área de transferência vazia", "Copie seu token do GitHub primeiro e tente novamente."); return; }
                  setTokenInput(tok);
                  if (tok.length >= 20) {
                    setLoadingUser(true);
                    try {
                      const data = await getUser(tok);
                      setGhUser(data);
                      setToken(tok);
                      addGitConfig({ provider: "github", token: tok, username: data.login, email: "" });
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setView("main");
                    } catch (e: any) {
                      Alert.alert("❌ Token inválido", e?.message || "Verifique o token e tente novamente.");
                    }
                    setLoadingUser(false);
                  }
                } catch { Alert.alert("Erro", "Não foi possível acessar a área de transferência."); }
              }}
              style={[s.btn, { backgroundColor: "#1d4ed8", marginBottom: 8 }]}
            >
              {loadingUser ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="clipboard" size={16} color="#fff" />}
              <Text style={[s.btnText, { color: "#fff" }]}>
                {loadingUser ? "Conectando..." : "📋 Colar Token e Conectar"}
              </Text>
            </TouchableOpacity>

            <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "center", marginBottom: 8 }}>— ou digite manualmente —</Text>

            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={tokenInput}
              onChangeText={setTokenInput}
              onSubmitEditing={handleSaveToken}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />

            <TouchableOpacity
              onPress={handleSaveToken}
              disabled={!tokenInput.trim() || loadingUser}
              style={[s.btn, { backgroundColor: tokenInput.trim() && !loadingUser ? "#22c55e" : colors.secondary }]}
            >
              {loadingUser ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="check" size={16} color={tokenInput.trim() ? "#fff" : colors.mutedForeground} />
              )}
              <Text style={[s.btnText, { color: tokenInput.trim() && !loadingUser ? "#fff" : colors.mutedForeground }]}>
                {loadingUser ? "Verificando..." : "✅ Salvar e Conectar"}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 16 }} />
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>REPOSITÓRIO PÚBLICO (SEM TOKEN)</Text>
            <Text style={[s.tip, { color: colors.mutedForeground }]}>
              Para importar qualquer repositório público, cole a URL abaixo:
            </Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={publicUrl}
              onChangeText={setPublicUrl}
              placeholder="https://github.com/usuario/repositorio"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={handleClonePublic}
              disabled={!publicUrl.trim() || cloning}
              style={[s.btn, { backgroundColor: publicUrl.trim() && !cloning ? colors.primary : colors.secondary }]}
            >
              {cloning ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="download" size={16} color="#fff" />}
              <Text style={[s.btnText, { color: "#fff" }]}>{cloning ? "Importando..." : "Importar Repositório Público"}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── MAIN VIEW ── */}
        {view === "main" && (
          <ScrollView contentContainerStyle={s.body}>
            {/* User badge */}
            {loadingUser ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ margin: 16 }} />
            ) : ghUser ? (
              <View style={[s.userBadge, { backgroundColor: "#22c55e14", borderColor: "#22c55e44" }]}>
                <View style={[s.ghDot, { backgroundColor: "#22c55e" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#22c55e", fontWeight: "700", fontSize: 14 }}>@{ghUser.login}</Text>
                  {ghUser.name && <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{ghUser.name}</Text>}
                  <Text style={{ color: "#22c55e", fontSize: 11 }}>conectado</Text>
                </View>
                <Feather name="check-circle" size={18} color="#22c55e" />
              </View>
            ) : null}

            {/* Active project info */}
            {activeProject && (
              <View style={[s.projectBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>PROJETO ATUAL</Text>
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>{activeProject.name}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  {activeProject.files.length} arquivo{activeProject.files.length !== 1 ? "s" : ""}
                </Text>
              </View>
            )}

            {/* Actions: Enviar */}
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>ENVIAR PARA GITHUB</Text>
            <TouchableOpacity
              onPress={() => { setCreateName(activeProject?.name?.toLowerCase().replace(/\s+/g, "-") || ""); setView("create"); }}
              style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[s.actionIcon, { backgroundColor: "#22c55e22" }]}>
                <Feather name="plus-circle" size={18} color="#22c55e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.actionLabel, { color: "#22c55e" }]}>Criar repositório novo e enviar</Text>
                <Text style={[s.actionDesc, { color: colors.mutedForeground }]}>Cria um repo novo e sobe todos os arquivos</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { if (ghUser) setPushOwner(ghUser.login); setView("push-existing"); }}
              style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[s.actionIcon, { backgroundColor: colors.primary + "22" }]}>
                <Feather name="upload" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.actionLabel, { color: colors.foreground }]}>Enviar para repo existente</Text>
                <Text style={[s.actionDesc, { color: colors.mutedForeground }]}>Atualiza um repositório que já existe</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {/* Publicar no GitHub Pages */}
            <Text style={[s.sectionTitle, { color: colors.mutedForeground, marginTop: 8 }]}>PUBLICAR APP GRATUITAMENTE</Text>
            <TouchableOpacity
              onPress={() => setShowPagesMain((v) => !v)}
              style={[s.actionBtn, { backgroundColor: "#1a0d2e", borderColor: "#7c3aed" }]}
            >
              <View style={[s.actionIcon, { backgroundColor: "#7c3aed22" }]}>
                <Feather name="globe" size={18} color="#7c3aed" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.actionLabel, { color: "#a78bfa" }]}>Publicar no GitHub Pages — Grátis</Text>
                <Text style={[s.actionDesc, { color: colors.mutedForeground }]}>Editor de código completo, sem mensalidade, para sempre</Text>
              </View>
              <Feather name={showPagesMain ? "chevron-down" : "chevron-right"} size={16} color="#7c3aed" />
            </TouchableOpacity>
            {showPagesMain && (
              <View style={{ gap: 8, marginBottom: 8 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>
                  Compila este editor e publica ele no GitHub Pages — um endereço tipo{" "}
                  <Text style={{ color: "#a78bfa", fontWeight: "700" }}>{ghUser?.login ?? "seu-usuario"}.github.io/sk-editor</Text>
                  {" "}que funciona para sempre, sem pagar nada.{"\n\n"}
                  Edição de arquivos e integração com GitHub funcionam sem o servidor. Só a IA e o terminal online precisam do servidor.
                </Text>
                <TextInput
                  style={[s.input, { color: colors.foreground, borderColor: "#7c3aed88", backgroundColor: colors.card }]}
                  placeholder="Nome do repositório (ex: sk-editor)"
                  placeholderTextColor={colors.mutedForeground}
                  value={createName}
                  onChangeText={setCreateName}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => {
                    const owner = ghUser?.login || "";
                    const repo = createName.trim() || "sk-editor";
                    handlePublishPages({ owner, repo });
                  }}
                  disabled={pagesLoading || !ghUser}
                  style={[s.btn, { backgroundColor: pagesLoading || !ghUser ? colors.secondary : "#7c3aed" }]}
                >
                  {pagesLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="globe" size={16} color="#fff" />}
                  <Text style={[s.btnText, { color: "#fff" }]}>
                    {pagesLoading ? "Publicando... (pode demorar 2 min)" : "🌐 Publicar no GitHub Pages"}
                  </Text>
                </TouchableOpacity>
                {pagesLogs.length > 0 && (
                  <View style={{ backgroundColor: "#0a0a0a", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#1a1a2e", gap: 4 }}>
                    {pagesLogs.map((l, i) => (
                      <Text key={i} style={{ color: "#86efac", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{l}</Text>
                    ))}
                  </View>
                )}
                {pagesInfo && (
                  <View style={{ borderRadius: 10, padding: 14, backgroundColor: "#22c55e14", borderWidth: 1, borderColor: "#22c55e44", gap: 8 }}>
                    <Text style={{ color: "#22c55e", fontWeight: "800", fontSize: 14 }}>✅ Publicado com sucesso!</Text>
                    <Text style={{ color: "#aaa", fontSize: 12 }}>O GitHub Pages pode demorar 1-2 minutos para ficar online na primeira vez.</Text>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(pagesInfo.url)}
                      style={{ backgroundColor: "#22c55e22", borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}
                    >
                      <Feather name="globe" size={14} color="#22c55e" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#22c55e", fontWeight: "700", fontSize: 13 }}>Abrir app publicado</Text>
                        <Text style={{ color: "#4ade80", fontSize: 11 }}>{pagesInfo.url}</Text>
                      </View>
                      <Feather name="external-link" size={12} color="#22c55e" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Actions: Importar */}
            <Text style={[s.sectionTitle, { color: colors.mutedForeground, marginTop: 8 }]}>BAIXAR DO GITHUB</Text>
            <TouchableOpacity
              onPress={handleImportOpen}
              style={[s.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[s.actionIcon, { backgroundColor: "#a855f722" }]}>
                <Feather name="download" size={18} color="#a855f7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.actionLabel, { color: colors.foreground }]}>Importar repositório</Text>
                <Text style={[s.actionDesc, { color: colors.mutedForeground }]}>Baixa um repositório para editar aqui</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {/* Public URL */}
            <Text style={[s.sectionTitle, { color: colors.mutedForeground, marginTop: 8 }]}>LINK PÚBLICO</Text>
            <Text style={[s.tip, { color: colors.mutedForeground }]}>Importe qualquer repositório público sem precisar selecionar da lista:</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={publicUrl}
              onChangeText={setPublicUrl}
              placeholder="https://github.com/usuario/repositorio"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={handleClonePublic}
              disabled={!publicUrl.trim() || cloning}
              style={[s.btn, { backgroundColor: publicUrl.trim() && !cloning ? colors.primary : colors.secondary, marginTop: 4 }]}
            >
              {cloning ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="link" size={14} color="#fff" />}
              <Text style={[s.btnText, { color: "#fff" }]}>{cloning ? "Importando..." : "Importar Link"}</Text>
            </TouchableOpacity>
            {cloning && cloneProgress && (
              <View style={{ marginTop: 12, gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{cloneProgress.phase}</Text>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>{cloneProgress.pct}%</Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ height: "100%", width: `${cloneProgress.pct}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* ── IMPORT VIEW ── */}
        {view === "import" && (
          <View style={{ flex: 1 }}>
            {/* URL pública rápida no topo */}
            <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>Importar por URL pública</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TextInput
                  style={[{ flex: 1, height: 38, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 13 }, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  value={publicUrl}
                  onChangeText={setPublicUrl}
                  placeholder="https://github.com/usuario/repo"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={handleClonePublic}
                  disabled={!publicUrl.trim() || cloning}
                  style={{ height: 38, paddingHorizontal: 14, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: publicUrl.trim() && !cloning ? colors.primary : colors.secondary }}
                >
                  {cloning ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="download" size={16} color="#fff" />}
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Funciona sem token para repositórios públicos. Ou selecione da sua lista abaixo:</Text>
            </View>

            {/* Search bar */}
            <View style={[s.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <Feather name="search" size={14} color={colors.mutedForeground} />
              <TextInput
                style={[s.searchInput, { color: colors.foreground }]}
                value={repoSearch}
                onChangeText={setRepoSearch}
                placeholder="Buscar nos seus repositórios..."
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
              />
              {loadingRepos && <ActivityIndicator size="small" color={colors.primary} />}
              <TouchableOpacity onPress={() => fetchRepos(token)}>
                <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Repo list */}
            {cloning ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 24 }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>
                  {cloneProgress?.phase || "Conectando..."}
                </Text>
                {cloneProgress && (
                  <View style={{ width: "100%" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Progresso</Text>
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
                        {cloneProgress.pct}%
                      </Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" }}>
                      <View style={{ height: "100%", width: `${cloneProgress.pct}%`, backgroundColor: colors.primary, borderRadius: 4 }} />
                    </View>
                  </View>
                )}
                <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center" }}>
                  {"Repositórios grandes podem levar alguns segundos.\nMantenha o app aberto."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredRepos}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", padding: 32 }}>
                    {loadingRepos ? (
                      <ActivityIndicator size="large" color={colors.primary} />
                    ) : (
                      <>
                        <Feather name="inbox" size={36} color={colors.mutedForeground + "55"} />
                        <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>
                          {repos.length === 0 ? "Nenhum repositório encontrado" : "Sem resultados para a busca"}
                        </Text>
                      </>
                    )}
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleCloneRepo(item)}
                    style={[s.repoItem, { borderBottomColor: colors.border }]}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name={item.private ? "lock" : "unlock"}
                      size={14}
                      color={colors.mutedForeground}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>{item.full_name}</Text>
                      {item.description ? (
                        <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>{item.description}</Text>
                      ) : null}
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}>
                        Branch: {item.default_branch}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleCloneRepo(item)}
                      style={[s.downloadBtn, { backgroundColor: "#22c55e22" }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="download" size={16} color="#22c55e" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}

        {/* ── CREATE VIEW ── */}
        {view === "create" && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>NOME DO REPOSITÓRIO</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={createName}
              onChangeText={setCreateName}
              placeholder="meu-projeto"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {ghUser && createName ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: -8, marginBottom: 8 }}>
                Será criado como: github.com/{ghUser.login}/{createName}
              </Text>
            ) : null}

            <Text style={[s.label, { color: colors.mutedForeground }]}>DESCRIÇÃO (OPCIONAL)</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={createDesc}
              onChangeText={setCreateDesc}
              placeholder="Descrição do projeto..."
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={[s.label, { color: colors.mutedForeground }]}>MENSAGEM DO ENVIO</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={createMsg}
              onChangeText={setCreateMsg}
              placeholderTextColor={colors.mutedForeground}
            />

            <TouchableOpacity
              onPress={() => setCreatePrivate(!createPrivate)}
              style={[s.privacyToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Feather name={createPrivate ? "lock" : "unlock"} size={16} color={createPrivate ? "#f59e0b" : "#22c55e"} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                  Repositório {createPrivate ? "Privado" : "Público"}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  {createPrivate ? "Só você pode ver" : "Qualquer pessoa pode ver"}
                </Text>
              </View>
              <View style={[s.privacyDot, { backgroundColor: createPrivate ? "#f59e0b" : "#22c55e" }]} />
            </TouchableOpacity>

            {activeProject && (
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginVertical: 8 }}>
                {activeProject.files.length} arquivo{activeProject.files.length !== 1 ? "s" : ""} serão enviados
              </Text>
            )}

            {createResult && (
              <View style={{ gap: 8 }}>
                <View style={[s.resultBox, { backgroundColor: createResult.ok ? "#22c55e22" : "#ef444422", borderColor: createResult.ok ? "#22c55e" : "#ef4444" }]}>
                  <Text style={{ color: createResult.ok ? "#22c55e" : "#ef4444", fontWeight: "600" }}>{createResult.msg}</Text>
                </View>
                {createResult.ok && lastPushedRepo && (
                  <View style={{ gap: 8 }}>
                    {/* Abrir no editor externo — VS Code / StackBlitz / Gitpod */}
                    <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Abrir no Editor
                    </Text>
                    {[
                      { label: "VS Code Web", desc: "Editor completo, grátis", url: `https://github.dev/${ghUser?.login || ""}/${createName.trim()}`, color: "#007acc", emoji: "🌐" },
                      { label: "StackBlitz", desc: "VS Code + Node.js + npm, grátis", url: `https://stackblitz.com/github/${ghUser?.login || ""}/${createName.trim()}`, color: "#1389fd", emoji: "⚡" },
                      { label: "Gitpod", desc: "Terminal Linux completo, 50h grátis/mês", url: `https://gitpod.io/#https://github.com/${ghUser?.login || ""}/${createName.trim()}`, color: "#ff8a00", emoji: "🟠" },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.label}
                        onPress={() => Linking.openURL(item.url)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: item.color + "44", backgroundColor: item.color + "11" }}
                      >
                        <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: item.color, fontWeight: "700", fontSize: 13 }}>{item.label}</Text>
                          <Text style={{ color: "#9ca3af", fontSize: 11 }}>{item.desc}</Text>
                        </View>
                        <Feather name="external-link" size={14} color={item.color + "99"} />
                      </TouchableOpacity>
                    ))}
                    <Text style={{ color: "#6b7280", fontSize: 10, paddingHorizontal: 4 }}>
                      Edite lá e use "Importar repositório" para trazer de volta.
                    </Text>
                    <TouchableOpacity
                      onPress={() => handlePublishPages()}
                      disabled={pagesLoading}
                      style={[s.btn, { backgroundColor: "#7c3aed" }]}
                    >
                      {pagesLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="globe" size={16} color="#fff" />}
                      <Text style={[s.btnText, { color: "#fff" }]}>{pagesLoading ? "Publicando... (pode demorar 2 min)" : "🌐 Publicar no GitHub Pages — Grátis"}</Text>
                    </TouchableOpacity>
                    {/* Logs em tempo real */}
                    {pagesLogs.length > 0 && (
                      <View style={{ backgroundColor: "#0a0a0a", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#1a1a2e", gap: 4 }}>
                        {pagesLogs.map((l, i) => (
                          <Text key={i} style={{ color: "#86efac", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{l}</Text>
                        ))}
                      </View>
                    )}
                    {pagesInfo && (
                      <View style={{ borderRadius: 10, padding: 14, backgroundColor: "#22c55e14", borderWidth: 1, borderColor: "#22c55e44", gap: 8 }}>
                        <Text style={{ color: "#22c55e", fontWeight: "800", fontSize: 14 }}>✅ Publicado com sucesso!</Text>
                        <Text style={{ color: "#aaa", fontSize: 12 }}>O GitHub Pages pode demorar 1-2 minutos para ficar online na primeira vez.</Text>
                        <TouchableOpacity
                          onPress={() => Linking.openURL(pagesInfo.url)}
                          style={{ backgroundColor: "#22c55e22", borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}
                        >
                          <Feather name="globe" size={14} color="#22c55e" />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: "#22c55e", fontWeight: "700", fontSize: 13 }}>Abrir app publicado</Text>
                            <Text style={{ color: "#4ade80", fontSize: 11 }}>{pagesInfo.url}</Text>
                          </View>
                          <Feather name="external-link" size={12} color="#22c55e" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              onPress={handleCreateAndPush}
              disabled={!createName.trim() || creating}
              style={[s.btn, { backgroundColor: createName.trim() && !creating ? "#22c55e" : colors.secondary, marginTop: 8 }]}
            >
              {creating ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="upload-cloud" size={16} color="#fff" />}
              <Text style={[s.btnText, { color: "#fff" }]}>{creating ? "Enviando..." : "Criar e Enviar"}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── PUSH EXISTING VIEW ── */}
        {view === "push-existing" && (
          <ScrollView contentContainerStyle={s.body}>
            <Text style={[s.tip, { color: colors.mutedForeground }]}>
              Enviar os arquivos do projeto atual para um repositório já existente no GitHub.
            </Text>

            <Text style={[s.label, { color: colors.mutedForeground }]}>OWNER (usuário ou organização)</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={pushOwner}
              onChangeText={setPushOwner}
              placeholder={ghUser?.login || "usuario"}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[s.label, { color: colors.mutedForeground }]}>NOME DO REPOSITÓRIO</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={pushRepo}
              onChangeText={setPushRepo}
              placeholder="nome-do-repositorio"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[s.label, { color: colors.mutedForeground }]}>MENSAGEM DO COMMIT</Text>
            <TextInput
              style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={pushMsg}
              onChangeText={setPushMsg}
              placeholderTextColor={colors.mutedForeground}
            />

            {activeProject && (
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginVertical: 8 }}>
                {activeProject.files.length} arquivo{activeProject.files.length !== 1 ? "s" : ""} serão enviados
              </Text>
            )}

            {pushResult && (
              <View>
                <View style={[s.resultBox, { backgroundColor: pushResult.ok ? "#22c55e22" : "#ef444422", borderColor: pushResult.ok ? "#22c55e" : "#ef4444" }]}>
                  <Text style={{ color: pushResult.ok ? "#22c55e" : "#ef4444", fontWeight: "600" }}>{pushResult.msg}</Text>
                </View>
                {pushResult.ok && pushOwner.trim() && pushRepo.trim() && (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Abrir no Editor
                    </Text>
                    {[
                      { label: "VS Code Web", desc: "Editor completo, grátis", url: `https://github.dev/${pushOwner.trim()}/${pushRepo.trim()}`, color: "#007acc", emoji: "🌐" },
                      { label: "StackBlitz", desc: "VS Code + Node.js + npm, grátis", url: `https://stackblitz.com/github/${pushOwner.trim()}/${pushRepo.trim()}`, color: "#1389fd", emoji: "⚡" },
                      { label: "Gitpod", desc: "Terminal Linux completo, 50h grátis/mês", url: `https://gitpod.io/#https://github.com/${pushOwner.trim()}/${pushRepo.trim()}`, color: "#ff8a00", emoji: "🟠" },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.label}
                        onPress={() => Linking.openURL(item.url)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          padding: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: item.color + "44",
                          backgroundColor: item.color + "11",
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: item.color, fontWeight: "700", fontSize: 13 }}>{item.label}</Text>
                          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{item.desc}</Text>
                        </View>
                        <Feather name="external-link" size={14} color={item.color + "99"} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* GitHub Pages após push existente */}
            {pushResult?.ok && lastPushedRepo && (
              <View style={{ gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={() => handlePublishPages()}
                  disabled={pagesLoading}
                  style={[s.btn, { backgroundColor: "#7c3aed" }]}
                >
                  {pagesLoading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="globe" size={16} color="#fff" />}
                  <Text style={[s.btnText, { color: "#fff" }]}>{pagesLoading ? "Publicando..." : "🌐 Publicar no GitHub Pages — Grátis"}</Text>
                </TouchableOpacity>
                {pagesLogs.length > 0 && (
                  <View style={{ backgroundColor: "#0a0a0a", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#1a1a2e", gap: 4 }}>
                    {pagesLogs.map((l, i) => (
                      <Text key={i} style={{ color: "#86efac", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>{l}</Text>
                    ))}
                  </View>
                )}
                {pagesInfo && (
                  <View style={{ borderRadius: 10, padding: 14, backgroundColor: "#22c55e14", borderWidth: 1, borderColor: "#22c55e44", gap: 8 }}>
                    <Text style={{ color: "#22c55e", fontWeight: "800", fontSize: 14 }}>✅ Publicado com sucesso!</Text>
                    <Text style={{ color: "#aaa", fontSize: 12 }}>O GitHub Pages pode demorar 1-2 minutos para ficar online na primeira vez.</Text>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(pagesInfo.url)}
                      style={{ backgroundColor: "#22c55e22", borderRadius: 8, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}
                    >
                      <Feather name="globe" size={14} color="#22c55e" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#22c55e", fontWeight: "700", fontSize: 13 }}>Abrir app publicado</Text>
                        <Text style={{ color: "#4ade80", fontSize: 11 }}>{pagesInfo.url}</Text>
                      </View>
                      <Feather name="external-link" size={12} color="#22c55e" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              onPress={handlePushExisting}
              disabled={!pushOwner.trim() || !pushRepo.trim() || pushing}
              style={[s.btn, { backgroundColor: pushOwner.trim() && pushRepo.trim() && !pushing ? colors.primary : colors.secondary, marginTop: 8 }]}
            >
              {pushing ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="upload" size={16} color="#fff" />}
              <Text style={[s.btnText, { color: "#fff" }]}>{pushing ? "Enviando..." : "Enviar para repo existente"}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  ghIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  backBtn: { padding: 2 },
  body: { padding: 16, gap: 10, paddingBottom: 60 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 4, marginTop: 6 },
  tip: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  tipBox: { borderRadius: 10, padding: 12, borderWidth: 1, gap: 2 },
  tipBoxTitle: { fontWeight: "700", fontSize: 13, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  btnText: { fontWeight: "700", fontSize: 15 },
  userBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 4,
  },
  ghDot: { width: 10, height: 10, borderRadius: 5 },
  projectBox: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    gap: 2,
    marginBottom: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 15, fontWeight: "600" },
  actionDesc: { fontSize: 12, marginTop: 1 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  repoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  downloadBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyToggle: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  privacyDot: { width: 10, height: 10, borderRadius: 5 },
  resultBox: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    marginTop: 4,
  },
});
