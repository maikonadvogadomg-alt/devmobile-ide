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

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function CheckpointsModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const { activeProject, saveCheckpoint, restoreCheckpoint, deleteCheckpoint } = useApp();
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const checkpoints = activeProject?.checkpoints ?? [];

  const handleSave = () => {
    if (!activeProject) return;
    setSaving(true);
    try {
      saveCheckpoint(activeProject.id, label.trim() || undefined);
      setLabel("");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = (checkpointId: string, checkpointLabel: string) => {
    if (!activeProject) return;
    const doRestore = () => {
      restoreCheckpoint(activeProject.id, checkpointId);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };
    if (Platform.OS === "web") {
      doRestore();
    } else {
      Alert.alert("Restaurar?", `Restaurar "${checkpointLabel}"?\n\nOs arquivos atuais serão substituídos.`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Restaurar", onPress: doRestore },
      ]);
    }
  };

  const handleDelete = (checkpointId: string) => {
    if (!activeProject) return;
    const doDelete = () => deleteCheckpoint(activeProject.id, checkpointId);
    if (Platform.OS === "web") {
      doDelete();
    } else {
      Alert.alert("Apagar?", "Apagar este checkpoint?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Apagar", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>📸 Checkpoints do Projeto</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {!activeProject ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.mutedForeground }}>Abra um projeto para usar checkpoints.</Text>
            </View>
          ) : (
            <>
              <View style={[styles.saveBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                  📌 Salvar ponto atual — {activeProject.name}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 10 }}>
                  {activeProject.files.length} arquivo(s) · {checkpoints.length}/10 checkpoints salvos
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
                    value={label}
                    onChangeText={setLabel}
                    placeholder="Descrição (ex: Antes de refatorar)"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving || checkpoints.length >= 10}
                    style={[styles.saveBtn, { backgroundColor: checkpoints.length >= 10 ? colors.muted : colors.primary }]}
                  >
                    <Feather name="camera" size={16} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>Salvar</Text>
                  </TouchableOpacity>
                </View>
                {checkpoints.length >= 10 && (
                  <Text style={{ color: "#f59e0b", fontSize: 11, marginTop: 6 }}>
                    ⚠️ Máximo de 10 checkpoints. Apague algum para criar novo.
                  </Text>
                )}
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }}>
                {checkpoints.length === 0 && (
                  <View style={{ alignItems: "center", paddingVertical: 32 }}>
                    <Text style={{ color: colors.mutedForeground }}>Nenhum checkpoint salvo ainda.</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                      Salve antes de fazer grandes alterações.
                    </Text>
                  </View>
                )}
                {[...checkpoints].reverse().map((cp) => (
                  <View key={cp.id} style={[styles.cpRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>{cp.label}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                        {cp.files.length} arquivo(s) · {new Date(cp.createdAt).toLocaleString("pt-BR")}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <TouchableOpacity
                        onPress={() => handleRestore(cp.id, cp.label)}
                        style={[styles.actionBtn, { backgroundColor: "#00d4aa22", borderColor: "#00d4aa55" }]}
                      >
                        <Feather name="rotate-ccw" size={13} color="#00d4aa" />
                        <Text style={{ color: "#00d4aa", fontSize: 11, fontWeight: "700" }}> Restaurar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(cp.id)} style={{ padding: 4 }}>
                        <Feather name="trash-2" size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { height: "85%", borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: "700" },
  saveBox: { margin: 12, padding: 14, borderRadius: 10, borderWidth: 1 },
  input: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 10, fontSize: 13 },
  saveBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  cpRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1 },
  actionBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
});
