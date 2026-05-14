import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
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

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { ProjectTask } from "@/context/AppContext";

type Status = ProjectTask["status"];
type Priority = ProjectTask["priority"];

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: string }> = {
  pendente: { label: "Pendente", color: "#f59e0b", icon: "clock" },
  em_progresso: { label: "Em Progresso", color: "#3b82f6", icon: "play-circle" },
  concluido: { label: "Concluído", color: "#10b981", icon: "check-circle" },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  alta: { label: "Alta", color: "#ef4444" },
  media: { label: "Média", color: "#f59e0b" },
  baixa: { label: "Baixa", color: "#6b7280" },
};

const STATUSES: Status[] = ["pendente", "em_progresso", "concluido"];
const PRIORITIES: Priority[] = ["alta", "media", "baixa"];

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeProject, addTask, updateTask, deleteTask } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<Status | "todas">("todas");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [status, setStatus] = useState<Status>("pendente");

  const topPad = Platform.OS === "web" ? 14 : insets.top;
  const bottomPad = Platform.OS === "web" ? 70 : Math.max(insets.bottom, 16) + 70;

  const tasks = activeProject?.tasks || [];

  const filtered =
    filterStatus === "todas" ? tasks : tasks.filter((t) => t.status === filterStatus);

  const counts = {
    pendente: tasks.filter((t) => t.status === "pendente").length,
    em_progresso: tasks.filter((t) => t.status === "em_progresso").length,
    concluido: tasks.filter((t) => t.status === "concluido").length,
  };

  const openNew = () => {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setPriority("media");
    setStatus("pendente");
    setShowModal(true);
  };

  const openEdit = (task: ProjectTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setPriority(task.priority);
    setStatus(task.status);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!title.trim() || !activeProject) return;
    if (editingTask) {
      updateTask(activeProject.id, editingTask.id, { title: title.trim(), description: description.trim() || undefined, priority, status });
    } else {
      addTask(activeProject.id, { title: title.trim(), description: description.trim() || undefined, priority, status });
    }
    setShowModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = (task: ProjectTask) => {
    if (!activeProject) return;
    Alert.alert("Excluir tarefa", `Excluir "${task.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          deleteTask(activeProject.id, task.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    ]);
  };

  const cycleStatus = (task: ProjectTask) => {
    if (!activeProject) return;
    const idx = STATUSES.indexOf(task.status);
    const next = STATUSES[(idx + 1) % STATUSES.length];
    updateTask(activeProject.id, task.id, { status: next });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderTask = (task: ProjectTask) => {
    const sc = STATUS_CONFIG[task.status];
    const pc = PRIORITY_CONFIG[task.priority];
    const done = task.status === "concluido";
    return (
      <TouchableOpacity
        key={task.id}
        onPress={() => openEdit(task)}
        onLongPress={() => handleDelete(task)}
        activeOpacity={0.8}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderLeftColor: sc.color,
            opacity: done ? 0.7 : 1,
          },
        ]}
      >
        {/* Status toggle button */}
        <TouchableOpacity
          onPress={() => cycleStatus(task)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.statusDot, { borderColor: sc.color, backgroundColor: done ? sc.color + "33" : "transparent" }]}
        >
          <Feather name={sc.icon as any} size={14} color={sc.color} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.cardTitle,
              { color: colors.foreground, textDecorationLine: done ? "line-through" : "none" },
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
          {task.description ? (
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
              {task.description}
            </Text>
          ) : null}
          <View style={styles.cardFooter}>
            <View style={[styles.badge, { backgroundColor: pc.color + "22", borderColor: pc.color + "44" }]}>
              <Text style={[styles.badgeText, { color: pc.color }]}>{pc.label}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: sc.color + "22", borderColor: sc.color + "44" }]}>
              <Text style={[styles.badgeText, { color: sc.color }]}>{sc.label}</Text>
            </View>
            {task.completedAt && (
              <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
                ✓ {new Date(task.completedAt).toLocaleDateString("pt-BR")}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity onPress={() => handleDelete(task)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="trash-2" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 6, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Taski</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {activeProject ? activeProject.name : "Nenhum projeto ativo"}
          </Text>
        </View>
        {activeProject && (
          <TouchableOpacity
            onPress={openNew}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={18} color="#000" />
          </TouchableOpacity>
        )}
      </View>

      {!activeProject ? (
        <View style={styles.empty}>
          <Feather name="check-square" size={48} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum projeto ativo</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Abra um projeto na aba Projetos para gerenciar suas tarefas aqui.
          </Text>
        </View>
      ) : (
        <>
          {/* Stats bar */}
          <View style={[styles.statsBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {(["todas", ...STATUSES] as const).map((s) => {
              const sc = s === "todas" ? null : STATUS_CONFIG[s];
              const count = s === "todas" ? tasks.length : counts[s];
              const active = filterStatus === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setFilterStatus(s)}
                  style={[
                    styles.statChip,
                    {
                      backgroundColor: active ? (sc?.color || colors.primary) + "22" : "transparent",
                      borderColor: active ? (sc?.color || colors.primary) : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statCount,
                      { color: active ? (sc?.color || colors.primary) : colors.foreground },
                    ]}
                  >
                    {count}
                  </Text>
                  <Text
                    style={[
                      styles.statLabel,
                      { color: active ? (sc?.color || colors.primary) : colors.mutedForeground },
                    ]}
                  >
                    {s === "todas" ? "Todas" : sc!.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* IA Context hint */}
          {tasks.length > 0 && (
            <View style={[styles.hintBar, { backgroundColor: "#00d4aa12", borderBottomColor: "#00d4aa33" }]}>
              <Feather name="cpu" size={11} color="#00d4aa" />
              <Text style={[styles.hintText, { color: "#00d4aa" }]}>
                A IA conhece suas {tasks.length} tarefas e não vai quebrar o que já foi concluído
              </Text>
            </View>
          )}

          {/* Task list */}
          <ScrollView
            contentContainerStyle={{ padding: 14, paddingBottom: bottomPad + 20, gap: 10 }}
            keyboardShouldPersistTaps="handled"
          >
            {filtered.length === 0 ? (
              <View style={styles.emptySection}>
                <Feather name="inbox" size={32} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
                <Text style={[styles.emptyDesc, { color: colors.mutedForeground, textAlign: "center" }]}>
                  {filterStatus === "todas"
                    ? "Nenhuma tarefa ainda.\nToque em + para adicionar."
                    : `Nenhuma tarefa ${STATUS_CONFIG[filterStatus].label.toLowerCase()}.`}
                </Text>
              </View>
            ) : (
              filtered
                .slice()
                .sort((a, b) => {
                  const po = { alta: 0, media: 1, baixa: 2 };
                  return po[a.priority] - po[b.priority];
                })
                .map(renderTask)
            )}
          </ScrollView>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editingTask ? "Editar Tarefa" : "Nova Tarefa"}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: 40 }}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Título *</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={title}
              onChangeText={setTitle}
              placeholder="O que precisa ser feito?"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição (opcional)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, height: 80, textAlignVertical: "top", paddingTop: 10 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Detalhes, contexto, links..."
              placeholderTextColor={colors.mutedForeground}
              multiline
            />

            <Text style={[styles.label, { color: colors.mutedForeground }]}>Prioridade</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {PRIORITIES.map((p) => {
                const pc = PRIORITY_CONFIG[p];
                const selected = priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPriority(p)}
                    style={[
                      styles.chip,
                      {
                        flex: 1,
                        backgroundColor: selected ? pc.color + "22" : colors.secondary,
                        borderColor: selected ? pc.color : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? pc.color : colors.mutedForeground, fontWeight: selected ? "700" : "400", fontSize: 13 }}>
                      {pc.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>Status</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {STATUSES.map((s) => {
                const sc = STATUS_CONFIG[s];
                const selected = status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setStatus(s)}
                    style={[
                      styles.chip,
                      {
                        flex: 1,
                        backgroundColor: selected ? sc.color + "22" : colors.secondary,
                        borderColor: selected ? sc.color : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? sc.color : colors.mutedForeground, fontWeight: selected ? "700" : "400", fontSize: 11, textAlign: "center" }}>
                      {sc.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* IA tip */}
            <View style={[styles.iaTip, { backgroundColor: "#00d4aa12", borderColor: "#00d4aa33" }]}>
              <Feather name="cpu" size={13} color="#00d4aa" />
              <Text style={{ color: "#00d4aa", fontSize: 12, flex: 1, lineHeight: 18 }}>
                A IA verá todas as tarefas antes de responder. Seja específico no título para que ela entenda o que já foi feito e o que ainda falta.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={!title.trim()}
              style={[styles.saveBtn, { backgroundColor: title.trim() ? colors.primary : colors.muted }]}
            >
              <Feather name={editingTask ? "save" : "plus-circle"} size={16} color="#000" />
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 15 }}>
                {editingTask ? "Salvar alterações" : "Criar tarefa"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  headerSub: { fontSize: 12, marginTop: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statsBar: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 4,
  },
  statChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statCount: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 9, fontWeight: "600", marginTop: 1 },
  hintBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  hintText: { fontSize: 11, fontWeight: "600", flex: 1 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 14,
  },
  statusDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  cardDesc: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  cardFooter: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  cardDate: { fontSize: 10 },
  deleteBtn: { padding: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptySection: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyDesc: { fontSize: 14, lineHeight: 20, maxWidth: 260 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    paddingTop: 24,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "600", marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  iaTip: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    alignItems: "flex-start",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
});
