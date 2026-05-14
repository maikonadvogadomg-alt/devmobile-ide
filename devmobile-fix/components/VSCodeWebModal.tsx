import React, { useState, useCallback } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, Linking, ActivityIndicator, StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { createRepo, pushFiles, getUser, makeRepoPublic } from "@/services/githubService";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = "idle" | "pushing" | "done" | "error";

const EDITORS = [
  {
    id: "github",
    label: "GitHub.dev",
    desc: "github.dev — editor leve, funciona bem no celular",
    icon: "github" as const,
    color: "#58a6ff",
    emptyUrl: "https://github.dev",
    buildUrl: (owner: string, repo: string) => `https://github.dev/${owner}/${repo}`,
  },
  {
    id: "codespaces",
    label: "GitHub Codespaces",
    desc: "Máquina virtual completa com terminal, extensões e IA",
    icon: "cpu" as const,
    color: "#3fb950",
    emptyUrl: "https://codespaces.new",
    buildUrl: (owner: string, repo: string) => `https://codespaces.new/${owner}/${repo}`,
  },
  {
    id: "stackblitz",
    label: "StackBlitz",
    desc: "Node.js no navegador com terminal real",
    icon: "zap" as const,
    color: "#1389fd",
    emptyUrl: "https://stackblitz.com",
    buildUrl: (owner: string, repo: string) => `https://stackblitz.com/github/${owner}/${repo}`,
  },
  {
    id: "vscode",
    label: "VS Code Web",
    desc: "vscode.dev — pode ter limitações no celular",
    icon: "monitor" as const,
    color: "#007acc",
    emptyUrl: "https://vscode.dev",
    buildUrl: (owner: string, repo: string) => `https://vscode.dev/github/${owner}/${repo}`,
  },
];

export default function VSCodeWebModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeProject, gitConfigs } = useApp();

  const [repoName, setRepoName] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [openedUrl, setOpenedUrl] = useState("");
  const [error, setError] = useState("");
  const [selectedEditor, setSelectedEditor] = useState<string>("github");

  const ghConfig = gitConfigs.find(g => g.provider === "github");
  const token = ghConfig?.token || "";
  const hasToken = !!token;

  const appName = activeProject?.name || "Meu Projeto";
  const defaultRepo = appName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "meu-projeto";

  const addLog = (msg: string) => setLogs(l => [...l, msg]);

  const editor = EDITORS.find(e => e.id === selectedEditor) || EDITORS[1];

  const handlePushAndOpen = useCallback(async () => {
    if (!activeProject || activeProject.files.length === 0) {
      Linking.openURL(editor.emptyUrl);
      onClose();
      return;
    }

    const repo = (repoName.trim() || defaultRepo);
    setStep("pushing");
    setLogs(["🚀 Iniciando envio para o GitHub…"]);
    setError("");
    setOpenedUrl("");

    try {
      const user = await getUser(token);
      const owner = user.login;
      addLog(`👤 Conta: ${owner}`);

      addLog(`📁 Criando repositório "${repo}"…`);
      try {
        await createRepo(token, repo, `${appName} — DevMobile`, false);
        addLog("✅ Repositório criado.");
      } catch (e: any) {
        if (e.message?.includes("422") || e.message?.includes("already exists") || e.message?.includes("name already exists")) {
          addLog("ℹ️ Repositório já existe — usando existente.");
        } else throw e;
      }

      await makeRepoPublic(token, owner, repo);

      const fileList = activeProject.files.map(f => ({
        path: f.path || f.name,
        content: f.content || "",
      }));
      addLog(`📤 Enviando ${fileList.length} arquivo(s)…`);
      await pushFiles(token, owner, repo, fileList, `${appName} — enviado pelo DevMobile`);
      addLog("✅ Projeto enviado!");

      const url = editor.buildUrl(owner, repo);
      addLog(`💻 Abrindo: ${url}`);
      setOpenedUrl(url);
      setStep("done");
      Linking.openURL(url);
    } catch (e: any) {
      setError(e.message || String(e));
      setStep("error");
    }
  }, [token, activeProject, repoName, defaultRepo, appName, onClose, selectedEditor, editor]);

  const handleReset = () => {
    setStep("idle");
    setLogs([]);
    setError("");
    setOpenedUrl("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[s.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#58a6ff22", alignItems: "center", justifyContent: "center" }}>
              <Feather name="code" size={16} color="#58a6ff" />
            </View>
            <View>
              <Text style={[s.title, { color: colors.foreground }]}>Editar no Navegador</Text>
              {activeProject && (
                <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{activeProject.name}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}>

          {/* Aviso mobile */}
          <View style={[s.infoBox, { backgroundColor: "#f59e0b11", borderColor: "#f59e0b33" }]}>
            <Text style={[s.infoTitle, { color: "#f59e0b" }]}>💡 Dica para celular</Text>
            <Text style={[s.infoText, { color: colors.mutedForeground }]}>
              O vscode.dev mudou recentemente e pode não funcionar bem no celular.{"\n"}
              Recomendamos o <Text style={{ color: "#58a6ff", fontWeight: "700" }}>GitHub.dev</Text> ou o <Text style={{ color: "#1389fd", fontWeight: "700" }}>StackBlitz</Text> — ambos funcionam direto no navegador do celular.
            </Text>
          </View>

          {/* Escolha de editor */}
          <View style={{ gap: 8 }}>
            <Text style={[s.label, { color: colors.mutedForeground }]}>ESCOLHA O EDITOR</Text>
            {EDITORS.map(ed => (
              <TouchableOpacity
                key={ed.id}
                onPress={() => setSelectedEditor(ed.id)}
                style={[
                  s.editorOption,
                  {
                    backgroundColor: selectedEditor === ed.id ? ed.color + "22" : colors.card,
                    borderColor: selectedEditor === ed.id ? ed.color + "88" : colors.border,
                  }
                ]}
                activeOpacity={0.7}
              >
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: ed.color + "22", alignItems: "center", justifyContent: "center" }}>
                  <Feather name={ed.icon} size={15} color={ed.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: selectedEditor === ed.id ? ed.color : colors.foreground, fontWeight: "700", fontSize: 14 }}>{ed.label}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{ed.desc}</Text>
                </View>
                {selectedEditor === ed.id && (
                  <Feather name="check-circle" size={16} color={ed.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {!hasToken ? (
            <View style={{ gap: 12 }}>
              <View style={[s.infoBox, { backgroundColor: "#ef444411", borderColor: "#ef444433" }]}>
                <Text style={[s.infoTitle, { color: "#f87171" }]}>⚠️ GitHub não configurado</Text>
                <Text style={[s.infoText, { color: colors.mutedForeground }]}>
                  Sem o GitHub, o editor abre sem seus arquivos. Configure em Menu → GitHub primeiro para abrir com o projeto completo.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Linking.openURL(editor.emptyUrl);
                  onClose();
                }}
                style={[s.bigBtn, { backgroundColor: editor.color + "22", borderColor: editor.color + "44" }]}
                activeOpacity={0.8}
              >
                <Feather name={editor.icon} size={18} color={editor.color} />
                <Text style={{ color: editor.color, fontWeight: "700", fontSize: 15 }}>Abrir {editor.label} (sem projeto)</Text>
              </TouchableOpacity>
            </View>
          ) : step === "idle" ? (
            <View style={{ gap: 12 }}>
              <Text style={[s.label, { color: colors.mutedForeground }]}>NOME DO REPOSITÓRIO</Text>
              <TextInput
                value={repoName || defaultRepo}
                onChangeText={t => setRepoName(t.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                placeholder={defaultRepo}
                placeholderTextColor={colors.mutedForeground + "88"}
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={[s.infoBox, { backgroundColor: colors.card, borderColor: colors.border, gap: 8 }]}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>O QUE VAI ACONTECER:</Text>
                {[
                  "Cria ou usa repositório GitHub",
                  `Envia os ${activeProject?.files.length || 0} arquivo(s) do projeto`,
                  `Abre o ${editor.label} com tudo dentro`,
                ].map((t, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: editor.color + "22", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: editor.color, fontSize: 10, fontWeight: "700" }}>{i + 1}</Text>
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 13, flex: 1 }}>{t}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={handlePushAndOpen}
                style={[s.bigBtn, { backgroundColor: editor.color, borderColor: editor.color }]}
                activeOpacity={0.8}
              >
                <Feather name="upload-cloud" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Enviar e Abrir no {editor.label}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const url = editor.buildUrl(ghConfig?.username || "usuario", repoName || defaultRepo);
                  Linking.openURL(url);
                  onClose();
                }}
                style={{ alignItems: "center", paddingVertical: 8 }}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Abrir {editor.label} sem enviar →</Text>
              </TouchableOpacity>
            </View>
          ) : step === "pushing" ? (
            <View style={{ gap: 10 }}>
              <View style={[s.logBox, { backgroundColor: "#000", borderColor: colors.border }]}>
                <ScrollView>
                  {logs.map((l, i) => (
                    <Text key={i} style={{ color: editor.color, fontSize: 11, fontFamily: "monospace", lineHeight: 18 }}>{l}</Text>
                  ))}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <ActivityIndicator size="small" color={editor.color} />
                    <Text style={{ color: editor.color + "88", fontSize: 11 }}>Enviando…</Text>
                  </View>
                </ScrollView>
              </View>
            </View>
          ) : step === "done" ? (
            <View style={{ gap: 12 }}>
              <View style={[s.infoBox, { backgroundColor: "#22c55e11", borderColor: "#22c55e33" }]}>
                <Text style={[s.infoTitle, { color: "#4ade80" }]}>✅ Projeto enviado e aberto!</Text>
                <Text style={[s.infoText, { color: colors.mutedForeground }]}>
                  O {editor.label} foi aberto com seu projeto. Se não abriu, toque no botão abaixo.
                </Text>
              </View>
              <View style={[s.logBox, { backgroundColor: "#000", borderColor: colors.border, maxHeight: 120 }]}>
                <ScrollView>
                  {logs.map((l, i) => (
                    <Text key={i} style={{ color: "#22c55e", fontSize: 11, fontFamily: "monospace", lineHeight: 18 }}>{l}</Text>
                  ))}
                </ScrollView>
              </View>
              {openedUrl ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(openedUrl)}
                  style={[s.bigBtn, { backgroundColor: editor.color + "22", borderColor: editor.color + "44" }]}
                  activeOpacity={0.8}
                >
                  <Feather name={editor.icon} size={18} color={editor.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: editor.color, fontWeight: "700", fontSize: 14 }}>Abrir {editor.label}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }} numberOfLines={1}>{openedUrl}</Text>
                  </View>
                  <Feather name="external-link" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={handleReset} style={{ alignItems: "center", paddingVertical: 8 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>↩ Usar outro repositório</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={[s.infoBox, { backgroundColor: "#ef444411", borderColor: "#ef444433" }]}>
                <Text style={[s.infoTitle, { color: "#f87171" }]}>❌ Erro ao enviar</Text>
                <Text style={[s.infoText, { color: colors.mutedForeground }]}>{error}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Linking.openURL(editor.emptyUrl);
                  onClose();
                }}
                style={[s.bigBtn, { backgroundColor: editor.color + "22", borderColor: editor.color + "44" }]}
                activeOpacity={0.8}
              >
                <Feather name="external-link" size={18} color={editor.color} />
                <Text style={{ color: editor.color, fontWeight: "700", fontSize: 14 }}>Abrir {editor.label} assim mesmo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleReset} style={{ alignItems: "center", paddingVertical: 8 }}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 12, marginTop: 1 },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  infoBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  infoTitle: { fontSize: 12, fontWeight: "700" },
  infoText: { fontSize: 12, lineHeight: 18 },
  bigBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  logBox: { borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 80, maxHeight: 200 },
  editorOption: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
});
