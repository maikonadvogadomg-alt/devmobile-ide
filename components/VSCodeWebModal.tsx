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

export default function VSCodeWebModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeProject, gitConfigs } = useApp();

  const [repoName, setRepoName] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [vsCodeUrl, setVsCodeUrl] = useState("");
  const [error, setError] = useState("");

  const ghConfig = gitConfigs.find(g => g.provider === "github");
  const token = ghConfig?.token || "";
  const hasToken = !!token;

  const appName = activeProject?.name || "Meu Projeto";
  const defaultRepo = appName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "meu-projeto";

  const addLog = (msg: string) => setLogs(l => [...l, msg]);

  const handlePushAndOpen = useCallback(async () => {
    if (!activeProject || activeProject.files.length === 0) {
      Linking.openURL("https://vscode.dev");
      onClose();
      return;
    }

    const repo = (repoName.trim() || defaultRepo);
    setStep("pushing");
    setLogs(["🚀 Iniciando envio para o GitHub…"]);
    setError("");

    try {
      const user = await getUser(token);
      const owner = user.login;
      addLog(`👤 Conta: ${owner}`);

      // Criar repositório
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

      // Enviar arquivos
      const fileList = activeProject.files.map(f => ({
        path: f.path || f.name,
        content: f.content || "",
      }));
      addLog(`📤 Enviando ${fileList.length} arquivo(s)…`);
      await pushFiles(token, owner, repo, fileList, `${appName} — enviado pelo DevMobile`);
      addLog("✅ Projeto enviado!");

      const url = `https://vscode.dev/github/${owner}/${repo}`;
      addLog(`💻 Abrindo: ${url}`);
      setVsCodeUrl(url);
      setStep("done");

      // Abre imediatamente
      Linking.openURL(url);
    } catch (e: any) {
      setError(e.message || String(e));
      setStep("error");
    }
  }, [token, activeProject, repoName, defaultRepo, appName, onClose]);

  const handleReset = () => {
    setStep("idle");
    setLogs([]);
    setError("");
    setVsCodeUrl("");
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
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#007acc22", alignItems: "center", justifyContent: "center" }}>
              <Feather name="monitor" size={16} color="#007acc" />
            </View>
            <View>
              <Text style={[s.title, { color: colors.foreground }]}>Abrir no VS Code Web</Text>
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

          {/* O que é */}
          <View style={[s.infoBox, { backgroundColor: "#007acc11", borderColor: "#007acc33" }]}>
            <Text style={[s.infoTitle, { color: "#007acc" }]}>VS Code completo no navegador</Text>
            <Text style={[s.infoText, { color: colors.mutedForeground }]}>
              Seu projeto vai ser enviado para o GitHub e aberto no VS Code Web — com todos os arquivos, extensões, autocomplete e terminal integrado. É o VS Code real, no navegador.
            </Text>
          </View>

          {!hasToken ? (
            /* Sem token — abre vscode.dev vazio */
            <View style={{ gap: 12 }}>
              <View style={[s.infoBox, { backgroundColor: "#f59e0b11", borderColor: "#f59e0b33" }]}>
                <Text style={[s.infoTitle, { color: "#f59e0b" }]}>⚠️ GitHub não configurado</Text>
                <Text style={[s.infoText, { color: colors.mutedForeground }]}>
                  Sem o GitHub, o VS Code Web abre sem seus arquivos. Configure em Menu → GitHub primeiro para abrir com o projeto completo.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => { Linking.openURL("https://vscode.dev"); onClose(); }}
                style={[s.bigBtn, { backgroundColor: "#007acc22", borderColor: "#007acc44" }]}
                activeOpacity={0.8}
              >
                <Feather name="external-link" size={18} color="#007acc" />
                <Text style={{ color: "#007acc", fontWeight: "700", fontSize: 15 }}>Abrir vscode.dev (sem projeto)</Text>
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
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                O projeto será enviado para github.com/{ghConfig ? "..." : "seu-usuario"}/{repoName || defaultRepo}
              </Text>

              {/* Passos */}
              <View style={[s.infoBox, { backgroundColor: colors.card, borderColor: colors.border, gap: 8 }]}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>O QUE VAI ACONTECER:</Text>
                {[
                  "Cria ou usa repositório GitHub",
                  `Envia os ${activeProject?.files.length || 0} arquivo(s) do projeto`,
                  "Abre o VS Code Web com tudo dentro",
                ].map((t, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#007acc22", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#007acc", fontSize: 10, fontWeight: "700" }}>{i + 1}</Text>
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 13, flex: 1 }}>{t}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={handlePushAndOpen}
                style={[s.bigBtn, { backgroundColor: "#007acc", borderColor: "#005a9e" }]}
                activeOpacity={0.8}
              >
                <Feather name="upload-cloud" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Enviar e Abrir no VS Code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { Linking.openURL("https://vscode.dev"); onClose(); }}
                style={{ alignItems: "center", paddingVertical: 8 }}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Abrir vscode.dev sem enviar →</Text>
              </TouchableOpacity>
            </View>
          ) : step === "pushing" ? (
            <View style={{ gap: 10 }}>
              <View style={[s.logBox, { backgroundColor: "#000", borderColor: colors.border }]}>
                <ScrollView>
                  {logs.map((l, i) => (
                    <Text key={i} style={{ color: "#007acc", fontSize: 11, fontFamily: "monospace", lineHeight: 18 }}>{l}</Text>
                  ))}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <ActivityIndicator size="small" color="#007acc" />
                    <Text style={{ color: "#007acc88", fontSize: 11 }}>Enviando…</Text>
                  </View>
                </ScrollView>
              </View>
            </View>
          ) : step === "done" ? (
            <View style={{ gap: 12 }}>
              <View style={[s.infoBox, { backgroundColor: "#22c55e11", borderColor: "#22c55e33" }]}>
                <Text style={[s.infoTitle, { color: "#4ade80" }]}>✅ Projeto enviado e aberto!</Text>
                <Text style={[s.infoText, { color: colors.mutedForeground }]}>
                  O VS Code Web foi aberto com seu projeto completo. Se não abriu, toque no botão abaixo.
                </Text>
              </View>
              <View style={[s.logBox, { backgroundColor: "#000", borderColor: colors.border, maxHeight: 120 }]}>
                <ScrollView>
                  {logs.map((l, i) => (
                    <Text key={i} style={{ color: "#22c55e", fontSize: 11, fontFamily: "monospace", lineHeight: 18 }}>{l}</Text>
                  ))}
                </ScrollView>
              </View>
              {vsCodeUrl ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(vsCodeUrl)}
                  style={[s.bigBtn, { backgroundColor: "#007acc22", borderColor: "#007acc44" }]}
                  activeOpacity={0.8}
                >
                  <Feather name="monitor" size={18} color="#007acc" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#007acc", fontWeight: "700", fontSize: 14 }}>Abrir VS Code Web</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }} numberOfLines={1}>{vsCodeUrl}</Text>
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
                onPress={() => { Linking.openURL("https://vscode.dev"); onClose(); }}
                style={[s.bigBtn, { backgroundColor: "#007acc22", borderColor: "#007acc44" }]}
                activeOpacity={0.8}
              >
                <Feather name="external-link" size={18} color="#007acc" />
                <Text style={{ color: "#007acc", fontWeight: "700", fontSize: 14 }}>Abrir vscode.dev assim mesmo</Text>
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
});
