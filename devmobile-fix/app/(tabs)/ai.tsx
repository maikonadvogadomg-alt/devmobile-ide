import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AIChat from "@/components/AIChat";
import VoiceAssistant from "@/components/VoiceAssistant";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

export default function AIScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 14 : insets.top;
  const tabBottom = Platform.OS === "web" ? 70 : Math.max(insets.bottom, 16) + 70;
  const [voiceOpen, setVoiceOpen] = useState(false);
  const { getActiveAIProvider } = useApp();
  const provider = getActiveAIProvider();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: tabBottom }]}>
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
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Assistente IA</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: provider ? "#22c55e" : "#ef4444" }} />
            <Text style={[styles.headerSub, { color: provider ? "#22c55e" : colors.mutedForeground }]}>
              {provider ? provider.name : "Nenhum provedor — vá em Config"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setVoiceOpen(true)}
          style={[styles.voiceBtn, { backgroundColor: "#6366f1" }]}
          accessibilityLabel="Conversa por voz"
        >
          <Feather name="radio" size={16} color="#fff" />
          <Text style={styles.voiceBtnText}>🎙️ Voz</Text>
        </TouchableOpacity>
      </View>

      <AIChat />

      <VoiceAssistant visible={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerLeft: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  headerSub: { fontSize: 12 },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  voiceBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
