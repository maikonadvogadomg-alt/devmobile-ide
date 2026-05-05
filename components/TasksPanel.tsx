import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  PanResponder,
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
  em_progresso: { label: "Andamento", color: "#3b82f6", icon: "play-circle" },
  concluido: { label: "Feito", color: "#10b981", icon: "check-circle" },
};
const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  alta: { label: "Alta", color: "#ef4444" },
  media: { label: "Média", color: "#f59e0b" },
  baixa: { label: "Baixa", color: "#6b7280" },
};
const STATUSES: Status[] = ["pendente", "em_progresso", "concluido"];
const PRIORITIES: Priority[] = ["alta", "media", "baixa"];

const PANEL_SNAP_FULL = 0;
const PANEL_SNAP_MINI = 52;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function TasksPanel({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeProject, addTask, updateTask, deleteTask } = useApp();

  const translateY = useRef(new Animated.Value(600)).current;
  const [minimized, setMinimized] = useState(false);
  const panelBaseY = useRef(0);

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<Status | "todas">("todas");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("media");
  const [status, setStatus] = useState<Status>("pendente");

  const tasks = activeProject?.tasks || [];
  const counts = {
    pendente: tasks.filter(t => t.status === "pendente").length,
    em_progresso: tasks.filter(t => t.status === "em_progresso").length,
    concluido: tasks.filter(t => t.status === "concluido").length,
  };
  const filtered = filterStatus === "todas" ? tasks : tasks.filter(t => t.status === filterStatus);
  const pending = counts.pendente + counts.em_progresso;

  useEffect(() => {
    if (visible) {
      setMinimized(false);
      Animated.spring(translateY, { toValue: PANEL_SNAP_FULL, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(translateY, { toValue: 800, duration: 280, useNativeDriver: true }).start();
    }
  }, [visible]);

  const snapToMini = () => {
    setMinimized(true);
    Animated.spring(translateY, { toValue: PANEL_SNAP_MINI, useNativeDriver: false, tension: 70, friction: 12 }).start();
  };
  const snapToFull = () => {
    setMinimized(false);
    Animated.spring(translateY, { toValue: PANEL_SNAP_FULL, useNativeDriver: false, tension: 65, friction: 11 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { panelBaseY.current = 0; },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 60 || vy > 0.8) {
          if (!minimized) { snapToMini(); } else { onClose(); }
        } else if (dy < -40) {
          snapToFull();
        }
      },
    })
  ).current;

  const openNew = () => {
    setEditingTask(null);
    setTitle(""); setDescription(""); setPriority("media"); setStatus("pendente");
    setShowForm(true);
  };
  const openEdit = (task: ProjectTask) => {
    setEditingTask(task);
    setTitle(task.title); setDescription(task.description || "");
    setPriority(task.priority); setStatus(task.status);
    setShowForm(true);
  };
  const handleSave = () => {
    if (!title.trim() || !activeProject) return;
    if (editingTask) {
      updateTask(activeProject.id, editingTask.id, { title: title.trim(), description: description.trim() || undefined, priority, status });
    } else {
      addTask(activeProject.id, { title: title.trim(), description: description.trim() || undefined, priority, status });
    }
    setShowForm(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const handleDelete = (task: ProjectTask) => {
    if (!activeProject) return;
    Alert.alert("Excluir tarefa", `Excluir "${task.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => { deleteTask(activeProject.id, task.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } },
    ]);
  };
  const cycleStatus = (task: ProjectTask) => {
    if (!activeProject) return;
    const idx = STATUSES.indexOf(task.status);
    updateTask(activeProject.id, task.id, { status: STATUSES[(idx + 1) % STATUSES.length] });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      {/* Backdrop — opaco só quando expandido */}
      {!minimized && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={snapToMini}
        />
      )}

      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 8,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Handle + header */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          <View style={styles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Feather name="check-square" size={15} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                Tarefas
              </Text>
              {pending > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>{pending} abertas</Text>
                </View>
              )}
              {activeProject && (
                <Text style={[styles.projName, { color: colors.mutedForeground }]} numberOfLines={1}>
                  — {activeProject.name}
                </Text>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 4 }}>
              {activeProject && (
                <TouchableOpacity onPress={openNew} style={[styles.hdrBtn, { backgroundColor: colors.primary }]}>
                  <Feather name="plus" size={14} color="#000" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={minimized ? snapToFull : snapToMini}
                style={[styles.hdrBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name={minimized ? "chevron-up" : "minus"} size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.hdrBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Corpo — escondido quando minimizado */}
        {!minimized && (
          <>
            {/* Stats bar */}
            {activeProject && (
              <View style={[styles.statsBar, { borderBottomColor: colors.border }]}>
                {(["todas", ...STATUSES] as const).map((s) => {
                  const sc = s === "todas" ? null : STATUS_CONFIG[s];
                  const count = s === "todas" ? tasks.length : counts[s];
                  const active = filterStatus === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setFilterStatus(s)}
                      style={[styles.statChip, {
                        backgroundColor: active ? (sc?.color || colors.primary) + "22" : "transparent",
                        borderColor: active ? (sc?.color || colors.primary) : "transparent",
                      }]}
                    >
                      <Text style={[styles.statCount, { color: active ? (sc?.color || colors.primary) : colors.foreground }]}>
                        {count}
                      </Text>
                      <Text style={[styles.statLabel, { color: active ? (sc?.color || colors.primary) : colors.mutedForeground }]}>
                        {s === "todas" ? "Todas" : sc!.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {!activeProject ? (
              <View style={styles.empty}>
                <Feather name="check-square" size={32} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum projeto ativo</Text>
                <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                  Abra um projeto no Editor para gerenciar tarefas aqui.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 20, gap: 8 }} keyboardShouldPersistTaps="handled">
                {filtered.length === 0 ? (
                  <View style={styles.emptySection}>
                    <Feather name="inbox" size={28} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
                    <Text style={[styles.emptyDesc, { color: colors.mutedForeground, textAlign: "center" }]}>
                      {filterStatus === "todas" ? "Nenhuma tarefa.\nToque em + para adicionar." : `Nenhuma tarefa ${STATUS_CONFIG[filterStatus].label.toLowerCase()}.`}
                    </Text>
                  </View>
                ) : (
                  filtered
                    .slice()
                    .sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.priority] - { alta: 0, media: 1, baixa: 2 }[b.priority]))
                    .map((task) => {
                      const sc = STATUS_CONFIG[task.status];
                      const pc = PRIORITY_CONFIG[task.priority];
                      const done = task.status === "concluido";
                      return (
                        <TouchableOpacity
                          key={task.id}
                          onPress={() => openEdit(task)}
                          onLongPress={() => handleDelete(task)}
                          activeOpacity={0.8}
                          style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border, borderLeftColor: sc.color, opacity: done ? 0.7 : 1 }]}
                        >
                          <TouchableOpacity
                            onPress={() => cycleStatus(task)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={[styles.statusDot, { borderColor: sc.color, backgroundColor: done ? sc.color + "33" : "transparent" }]}
                          >
                            <Feather name={sc.icon as any} size={13} color={sc.color} />
                          </TouchableOpacity>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cardTitle, { color: colors.foreground, textDecorationLine: done ? "line-through" : "none" }]} numberOfLines={2}>
                              {task.title}
                            </Text>
                            {task.description ? (
                              <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{task.description}</Text>
                            ) : null}
                            <View style={styles.cardFooter}>
                              <View style={[styles.pill, { backgroundColor: pc.color + "22", borderColor: pc.color + "44" }]}>
                                <Text style={[styles.pillText, { color: pc.color }]}>{pc.label}</Text>
                              </View>
                              <View style={[styles.pill, { backgroundColor: sc.color + "22", borderColor: sc.color + "44" }]}>
                                <Text style={[styles.pillText, { color: sc.color }]}>{sc.label}</Text>
                              </View>
                            </View>
                          </View>
                          <TouchableOpacity onPress={() => handleDelete(task)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Feather name="trash-2" size={12} color={colors.mutedForeground} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })
                )}
              </ScrollView>
            )}
          </>
        )}
      </Animated.View>

      {/* Formulário de criação/edição */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={[styles.formModal, { backgroundColor: colors.background }]}>
          <View style={[styles.formHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>
              {editingTask ? "Editar Tarefa" : "Nova Tarefa"}
            </Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: 40 }}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Título *</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              value={title} onChangeText={setTitle}
              placeholder="O que precisa ser feito?"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição (opcional)</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, height: 72, textAlignVertical: "top", paddingTop: 10 }]}
              value={description} onChangeText={setDescription}
              placeholder="Detalhes, contexto..."
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Prioridade</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {PRIORITIES.map(p => {
                const pc = PRIORITY_CONFIG[p];
                const sel = priority === p;
                return (
                  <TouchableOpacity key={p} onPress={() => setPriority(p)}
                    style={[styles.chip, { flex: 1, backgroundColor: sel ? pc.color + "22" : colors.secondary, borderColor: sel ? pc.color : colors.border }]}>
                    <Text style={{ color: sel ? pc.color : colors.mutedForeground, fontWeight: sel ? "700" : "400", fontSize: 13 }}>{pc.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Status</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {STATUSES.map(s => {
                const sc = STATUS_CONFIG[s];
                const sel = status === s;
                return (
                  <TouchableOpacity key={s} onPress={() => setStatus(s)}
                    style={[styles.chip, { flex: 1, backgroundColor: sel ? sc.color + "22" : colors.secondary, borderColor: sel ? sc.color : colors.border }]}>
                    <Text style={{ color: sel ? sc.color : colors.mutedForeground, fontWeight: sel ? "700" : "400", fontSize: 11, textAlign: "center" }}>{sc.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!title.trim()}
              style={[styles.saveBtn, { backgroundColor: title.trim() ? colors.primary : colors.muted }]}
            >
              <Feather name={editingTask ? "save" : "plus-circle"} size={16} color="#000" />
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 15 }}>
                {editingTask ? "Salvar" : "Criar tarefa"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  panel: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    maxHeight: "85%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
    overflow: "hidden",
  },
  handleArea: { paddingTop: 10, paddingBottom: 6, paddingHorizontal: 14 },
  handleBar: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 15, fontWeight: "800" },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  projName: { fontSize: 11, flex: 1 },
  hdrBtn: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  statsBar: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  statChip: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  statCount: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 9, fontWeight: "600", marginTop: 1 },
  empty: { alignItems: "center", paddingVertical: 28, gap: 10, paddingHorizontal: 24 },
  emptySection: { alignItems: "center", paddingVertical: 28, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  emptyDesc: { fontSize: 13, lineHeight: 19, color: "#666" },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 10, borderWidth: 1, borderLeftWidth: 3, padding: 12 },
  statusDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  cardTitle: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  cardDesc: { fontSize: 11, marginTop: 3, lineHeight: 16 },
  cardFooter: { flexDirection: "row", gap: 5, marginTop: 6, flexWrap: "wrap", alignItems: "center" },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: "700" },
  formModal: { flex: 1 },
  formHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, paddingTop: 24, borderBottomWidth: 1 },
  formTitle: { fontSize: 17, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "600", marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  chip: { paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 16 },
});
