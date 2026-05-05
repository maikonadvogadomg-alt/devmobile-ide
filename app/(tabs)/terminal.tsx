import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PreviewPanel from "@/components/PreviewPanel";
import Terminal from "@/components/Terminal";
import { useColors } from "@/hooks/useColors";
import { useApiBase } from "@/hooks/useApiBase";
import { useApp } from "@/context/AppContext";

export default function TerminalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 14 : insets.top;
  const tabBottom = Platform.OS === "web" ? 70 : Math.max(insets.bottom, 16) + 70;
  const [showPreview, setShowPreview] = useState(false);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);
  const apiBase = useApiBase();
  const hasServer = !!apiBase;
  const { activeProject, pendingTerminalCommand, clearTerminalCommand } = useApp();

  const ghRepo = activeProject?.gitRepo;
  const ghPath = ghRepo
    ? ghRepo.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").trim()
    : null;

  const openStackBlitz = () =>
    Linking.openURL(ghPath ? `https://stackblitz.com/github/${ghPath}` : "https://stackblitz.com");
  const openGitpod = () =>
    Linking.openURL(ghPath ? `https://gitpod.io/#https://github.com/${ghPath}` : "https://gitpod.io");
  const openCodespaces = () =>
    Linking.openURL(ghPath ? `https://github.com/codespaces/new?repo=${ghPath}` : "https://github.com/codespaces");

  return (
    <View style={[styles.container, { backgroundColor: colors.terminalBg, paddingBottom: tabBottom }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding + 6,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>$ Terminal Linux</Text>
          <Text style={[styles.headerSub, { color: hasServer ? "#22c55e" : "#f59e0b" }]}>
            {hasServer ? "🟢 Servidor online — bash, node, python, git, npm" : "🟡 Sem servidor — use os editores na nuvem abaixo"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowPreview(true)}
          style={[styles.previewBtn, { backgroundColor: "#007acc22", borderColor: "#007acc55" }]}
          activeOpacity={0.75}
        >
          <Feather name="monitor" size={14} color="#007acc" />
          <Text style={styles.previewBtnText}>Preview</Text>
        </TouchableOpacity>
      </View>

      {/* Fluxo recomendado — aparece quando não há servidor */}
      {!hasServer && (
        <View style={styles.workflowCard}>
          <TouchableOpacity
            onPress={() => setShowWorkflowGuide((v) => !v)}
            style={styles.workflowHeader}
            activeOpacity={0.8}
          >
            <Text style={styles.workflowTitle}>🚀 Terminal na Nuvem — Sem Instalar Nada</Text>
            <Feather name={showWorkflowGuide ? "chevron-up" : "chevron-down"} size={16} color="#4ade80" />
          </TouchableOpacity>

          {showWorkflowGuide && (
            <View style={styles.workflowBody}>
              <Text style={styles.workflowStep}>
                {"1️⃣  Empurre seu projeto para o GitHub (aba Projetos → GitHub)"}
              </Text>
              <Text style={styles.workflowStep}>
                {"2️⃣  Abra no editor abaixo — tem terminal Linux real, npm install, node, python"}
              </Text>
              <Text style={styles.workflowStep}>
                {"3️⃣  Trabalhe lá: instale pacotes, rode código, edite arquivos"}
              </Text>
              <Text style={styles.workflowStep}>
                {"4️⃣  Faça push/pull e seu projeto fica sincronizado"}
              </Text>
            </View>
          )}

          {/* Botões grandes */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cloudBtns}>
            <TouchableOpacity onPress={openStackBlitz} style={[styles.cloudBtn, { backgroundColor: "#1389fd22", borderColor: "#1389fd66" }]}>
              <Text style={styles.cloudBtnEmoji}>⚡</Text>
              <Text style={[styles.cloudBtnLabel, { color: "#1389fd" }]}>StackBlitz</Text>
              <Text style={[styles.cloudBtnSub, { color: "#1389fd99" }]}>Node + npm</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openGitpod} style={[styles.cloudBtn, { backgroundColor: "#ff8a0022", borderColor: "#ff8a0066" }]}>
              <Text style={styles.cloudBtnEmoji}>🟠</Text>
              <Text style={[styles.cloudBtnLabel, { color: "#ff8a00" }]}>Gitpod</Text>
              <Text style={[styles.cloudBtnSub, { color: "#ff8a0099" }]}>Linux completo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openCodespaces} style={[styles.cloudBtn, { backgroundColor: "#60a5fa22", borderColor: "#60a5fa66" }]}>
              <Text style={styles.cloudBtnEmoji}>🐙</Text>
              <Text style={[styles.cloudBtnLabel, { color: "#60a5fa" }]}>Codespaces</Text>
              <Text style={[styles.cloudBtnSub, { color: "#60a5fa99" }]}>60h grátis/mês</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Linking.openURL("https://vscode.dev")}
              style={[styles.cloudBtn, { backgroundColor: "#007acc22", borderColor: "#007acc66" }]}
            >
              <Text style={styles.cloudBtnEmoji}>💻</Text>
              <Text style={[styles.cloudBtnLabel, { color: "#007acc" }]}>VS Code</Text>
              <Text style={[styles.cloudBtnSub, { color: "#007acc99" }]}>Editor online</Text>
            </TouchableOpacity>
          </ScrollView>

          {!ghPath && (
            <Text style={styles.workflowHint}>
              💡 Dica: Vincule o projeto ao GitHub primeiro para abrir direto no repo
            </Text>
          )}
        </View>
      )}

      <Terminal
        runCmd={pendingTerminalCommand ?? undefined}
        onCmdRan={clearTerminalCommand}
      />

      <PreviewPanel visible={showPreview} onClose={() => setShowPreview(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  headerSub: { fontSize: 11, marginTop: 1 },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewBtnText: { color: "#007acc", fontSize: 12, fontWeight: "700" },

  workflowCard: {
    backgroundColor: "#0a1f0a",
    borderBottomWidth: 1,
    borderBottomColor: "#22c55e33",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  workflowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  workflowTitle: {
    color: "#4ade80",
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  workflowBody: { marginBottom: 8 },
  workflowStep: {
    color: "#86efac",
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 2,
  },
  cloudBtns: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 4,
  },
  cloudBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 90,
  },
  cloudBtnEmoji: { fontSize: 22, marginBottom: 2 },
  cloudBtnLabel: { fontSize: 12, fontWeight: "800" },
  cloudBtnSub: { fontSize: 10, marginTop: 1 },
  workflowHint: {
    color: "#4ade8077",
    fontSize: 11,
    marginTop: 6,
    fontStyle: "italic",
  },
});
