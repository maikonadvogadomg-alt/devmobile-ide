import { Feather } from "@expo/vector-icons";
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

import { useApp } from "@/context/AppContext";
import type { AIMemoryEntry } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const CATEGORIES: { key: AIMemoryEntry["category"]; label: string; color: string }[] = [
  { key: "usuario", label: "👤 Usuário", color: "#6366f1" },
  { key: "projeto", label: "📁 Projeto", color: "#00d4aa" },
  { key: "preferencia", label: "⚙️ Preferência", color: "#f59e0b" },
  { key: "geral", label: "💡 Geral", color: "#888" },
];

export default function AIMemoryModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const { aiMemory, addMemoryEntry, removeMemoryEntry, clearMemory, activeProject } = useApp();
  const [newEntry, setNewEntry] = useState("");
  const [category, setCategory] = useState<AIMemoryEntry["category"]>("geral");
  const [filter, setFilter] = useState<AIMemoryEntry["category"] | "all">("all");

  const filtered = filter === "all" ? aiMemory : aiMemory.filter((e) => e.category === filter);

  const handleAdd = () => {
    if (!newEntry.trim()) return;
    addMemoryEntry({ content: newEntry.trim(), category });
    setNewEntry("");
  };

  const handleRemove = (id: string) => {
    if (Platform.OS === "web") {
      removeMemoryEntry(id);
    } else {
      Alert.alert("Remover memória", "Apagar este registro?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Apagar", style: "destructive", onPress: () => removeMemoryEntry(id) },
      ]);
    }
  };

  const handleClearAll = () => {
    if (Platform.OS === "web") {
      clearMemory();
    } else {
      Alert.alert("Limpar memória", "Apagar TODA a memória da IA?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Limpar tudo", style: "destructive", onPress: clearMemory },
      ]);
    }
  };

  const catColor = (cat: AIMemoryEntry["category"]) =>
    CATEGORIES.find((c) => c.key === cat)?.color ?? "#888";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>🧠 Memória da IA</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              {aiMemory.length > 0 && (
                <TouchableOpacity onPress={handleClearAll}>
                  <Feather name="trash-2" size={16} color="#ef4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
              A IA usa esses registros como contexto em todas as conversas. Projeto atual:{" "}
              <Text style={{ color: colors.primary }}>{activeProject?.name ?? "(nenhum)"}</Text>
              {" · "}{aiMemory.length}/50 registros
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterBar]}>
            <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
              {[{ key: "all" as const, label: "Todos", color: colors.primary }, ...CATEGORIES].map((c) => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setFilter(c.key as typeof filter)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: filter === c.key ? c.color + "33" : colors.secondary,
                      borderColor: filter === c.key ? c.color : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: filter === c.key ? c.color : colors.mutedForeground, fontSize: 11 }}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
            {filtered.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                  {aiMemory.length === 0 ? "Nenhuma memória ainda.\nAdicione registros abaixo." : "Nenhum registro nesta categoria."}
                </Text>
              </View>
            )}
            {filtered.map((entry) => (
              <View
                key={entry.id}
                style={[styles.entry, { backgroundColor: colors.card, borderLeftColor: catColor(entry.category) }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13 }}>{entry.content}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 4 }}>
                    {CATEGORIES.find((c) => c.key === entry.category)?.label} · {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                  </Text>
                </View>
                <TouchableOpacity style={{ padding: 6 }} onPress={() => handleRemove(entry.id)}>
                  <Feather name="trash-2" size={14} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.addBar, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }}>
              <View style={{ flexDirection: "row", gap: 4, paddingRight: 8 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={[
                      styles.catChip,
                      { backgroundColor: category === c.key ? c.color + "33" : "transparent", borderColor: category === c.key ? c.color : colors.border },
                    ]}
                  >
                    <Text style={{ fontSize: 10, color: category === c.key ? c.color : colors.mutedForeground }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
                value={newEntry}
                onChangeText={setNewEntry}
                placeholder="Adicionar memória... (ex: Prefiro TypeScript)"
                placeholderTextColor={colors.mutedForeground}
                onSubmitEditing={handleAdd}
                returnKeyType="done"
                multiline
              />
              <TouchableOpacity
                onPress={handleAdd}
                disabled={!newEntry.trim()}
                style={[styles.addBtn, { backgroundColor: newEntry.trim() ? colors.primary : colors.muted }]}
              >
                <Feather name="plus" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { height: "88%", borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: "700" },
  infoBox: { marginHorizontal: 12, marginTop: 10, padding: 10, borderRadius: 8, borderWidth: 1 },
  filterBar: { maxHeight: 52 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  entry: { borderLeftWidth: 3, borderRadius: 8, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  addBar: { borderTopWidth: 1, padding: 12, gap: 4 },
  catChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  input: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 10, fontSize: 13, maxHeight: 80 },
  addBtn: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
