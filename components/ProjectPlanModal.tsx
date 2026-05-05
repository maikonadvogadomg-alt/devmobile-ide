import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { generateProjectPlan } from "@/utils/projectPlan";

export default function ProjectPlanModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const { activeProject, createFile } = useApp();
  const [tab, setTab] = useState<"overview" | "tree" | "routes" | "suggestions">("overview");

  if (!activeProject) return null;

  const plan = generateProjectPlan(activeProject);

  const saveToProject = () => {
    createFile(activeProject.id, "PLANO.md", plan.markdown);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const TABS = [
    { key: "overview", label: "Visão Geral", icon: "bar-chart-2" },
    { key: "tree", label: "Árvore", icon: "git-branch" },
    { key: "routes", label: "Rotas", icon: "globe" },
    { key: "suggestions", label: "Sugestões", icon: "zap" },
  ] as const;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Plano do Projeto
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {activeProject.name}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={saveToProject}
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="save" size={14} color={colors.primaryForeground} />
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                Salvar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        >
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[
                styles.tab,
                {
                  backgroundColor: tab === t.key ? colors.primary : "transparent",
                  borderColor: tab === t.key ? colors.primary : colors.border,
                },
              ]}
            >
              <Feather
                name={t.icon as never}
                size={12}
                color={tab === t.key ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: tab === t.key ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
          {tab === "overview" && (
            <View style={{ gap: 12 }}>
              <View style={styles.statsRow}>
                {[
                  { label: "Arquivos", value: String(plan.totalFiles), icon: "file" },
                  { label: "Linhas", value: plan.totalLines.toLocaleString(), icon: "list" },
                  { label: "Linguagens", value: String(Object.keys(plan.languages).length), icon: "code" },
                  { label: "Rotas API", value: String(plan.apiRoutes.length), icon: "globe" },
                ].map((stat) => (
                  <View
                    key={stat.label}
                    style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Feather name={stat.icon as never} size={16} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
                    <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Linguagens</Text>
              {Object.entries(plan.languages)
                .sort((a, b) => b[1] - a[1])
                .map(([lang, count]) => (
                  <View key={lang} style={[styles.langRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.langName, { color: colors.foreground }]}>{lang}</Text>
                    <View style={[styles.langBar, { backgroundColor: colors.secondary }]}>
                      <View
                        style={[
                          styles.langBarFill,
                          {
                            backgroundColor: colors.primary,
                            width: `${Math.round((count / plan.totalFiles) * 100)}%` as unknown as number,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.langCount, { color: colors.mutedForeground }]}>
                      {count}
                    </Text>
                  </View>
                ))}

              {plan.entryPoints.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Pontos de Entrada
                  </Text>
                  {plan.entryPoints.map((e) => (
                    <Text
                      key={e}
                      style={[
                        styles.entryPoint,
                        {
                          color: colors.primary,
                          backgroundColor: colors.secondary,
                          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                        },
                      ]}
                    >
                      ▶ {e}
                    </Text>
                  ))}
                </>
              )}
            </View>
          )}

          {tab === "tree" && (
            <View style={[styles.codeBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text
                style={[
                  styles.codeText,
                  {
                    color: colors.foreground,
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  },
                ]}
                selectable
              >
                {activeProject.name}/
                {"\n"}
                {plan.tree
                  .split("\n")
                  .map((l) => "  " + l)
                  .join("\n")}
              </Text>
            </View>
          )}

          {tab === "routes" && (
            <View style={{ gap: 8 }}>
              {plan.apiRoutes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="globe" size={32} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Nenhuma rota de API detectada
                  </Text>
                  <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                    Rotas express, fetch e decorators são detectados automaticamente
                  </Text>
                </View>
              ) : (
                plan.apiRoutes.map((r, i) => (
                  <View
                    key={i}
                    style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View
                      style={[
                        styles.methodBadge,
                        {
                          backgroundColor:
                            r.method === "GET" ? colors.success :
                            r.method === "POST" ? colors.primary :
                            r.method === "PUT" ? colors.warning :
                            r.method === "DELETE" ? colors.destructive :
                            colors.accent,
                        },
                      ]}
                    >
                      <Text style={styles.methodText}>{r.method}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.routePath,
                          {
                            color: colors.foreground,
                            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                          },
                        ]}
                      >
                        {r.path}
                      </Text>
                      <Text style={[styles.routeFile, { color: colors.mutedForeground }]}>
                        {r.file}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {tab === "suggestions" && (
            <View style={{ gap: 10 }}>
              {plan.suggestions.map((s, i) => (
                <View
                  key={i}
                  style={[styles.suggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.suggestionText, { color: colors.foreground }]}>{s}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveBtnText: { fontSize: 13, fontWeight: "600" },
  tabBar: {
    maxHeight: 46,
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: { fontSize: 12, fontWeight: "600" },
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600" },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginTop: 8 },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  langName: { width: 90, fontSize: 12 },
  langBar: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  langBarFill: { height: 6, borderRadius: 3 },
  langCount: { width: 24, fontSize: 12, textAlign: "right" },
  entryPoint: { padding: 8, borderRadius: 6, fontSize: 13, marginBottom: 4 },
  codeBlock: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
  },
  codeText: { fontSize: 13, lineHeight: 20 },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  methodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 60,
    alignItems: "center",
  },
  methodText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  routePath: { fontSize: 14 },
  routeFile: { fontSize: 11, marginTop: 2 },
  suggestionCard: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
  },
  suggestionText: { fontSize: 14, lineHeight: 20 },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: "600" },
  emptyHint: { fontSize: 12, textAlign: "center", maxWidth: 220 },
});
