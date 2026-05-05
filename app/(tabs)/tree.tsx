import React, { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import FileSidebar from "@/components/FileSidebar";
import GitHubModal from "@/components/GitHubModal";
import { APKBuilderModal } from "@/components/APKBuilderModal";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;

export default function TreeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { activeProject } = useApp();

  const [showGitHub, setShowGitHub] = useState(false);
  const [gitInitialView, setGitInitialView] = useState<"main" | "import" | "push-existing" | "token" | undefined>(undefined);
  const [showApk, setShowApk] = useState(false);

  const [easToken, setEasToken] = useState("");
  const [easBuilding, setEasBuilding] = useState(false);
  const [easMsg, setEasMsg] = useState("");
  const [showEasCard, setShowEasCard] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("apk_eas_token").then(v => { if (v) setEasToken(v); });
  }, []);

  const saveToken = (v: string) => {
    setEasToken(v);
    AsyncStorage.setItem("apk_eas_token", v);
  };

  const dispararBuild = async () => {
    if (!easToken.trim()) {
      Alert.alert("Token obrigatório", "Cole seu token EAS antes de disparar.");
      return;
    }
    setEasBuilding(true);
    setEasMsg("🔄 Disparando build...");
    try {
      const slug = (activeProject?.name || "meuapp").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const appId = `com.devmobile.${slug}`;
      const resp = await fetch("https://api.expo.dev/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${easToken.trim()}`,
          "expo-platform": "android",
        },
        body: JSON.stringify({
          query: `mutation CreateBuild($appIdentifier: String!, $platform: AppPlatform!, $profile: String!) {
            build {
              createBuild(appIdentifier: $appIdentifier platform: $platform profile: $profile) {
                id status createdAt
              }
            }
          }`,
          variables: { appIdentifier: appId, platform: "ANDROID", profile: "preview" },
        }),
      });
      const json = await resp.json();
      if (json?.errors?.length) {
        setEasMsg(`❌ ${json.errors[0].message}`);
      } else if (json?.data?.build?.createBuild?.id) {
        const id = json.data.build.createBuild.id;
        setEasMsg(`✅ Build disparado!\nID: ${id}\n\nexpo.dev → Projects → ${slug} → Builds`);
      } else {
        setEasMsg("⚠️ Resposta inesperada. Verifique o token e o Package ID no Expo.");
      }
    } catch (e) {
      setEasMsg(`❌ Erro de conexão: ${String(e)}`);
    } finally {
      setEasBuilding(false);
    }
  };

  const openGitHub = (view?: typeof gitInitialView) => {
    setGitInitialView(view);
    setShowGitHub(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* Barra de ações rápidas */}
      <View style={{
        paddingHorizontal: 10,
        paddingTop: insets.top + 8,
        paddingBottom: 8,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 8,
      }}>
        {/* Linha 1: GitHub */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <TouchableOpacity
            onPress={() => openGitHub("token")}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#22c55e22", borderWidth: 1, borderColor: "#22c55e44", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 }}
          >
            <Feather name="github" size={13} color="#22c55e" />
            <Text style={{ color: "#22c55e", fontSize: 11, fontWeight: "700" }}>Token GitHub</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openGitHub("import")}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#6366f122", borderWidth: 1, borderColor: "#6366f144", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 }}
          >
            <Feather name="download" size={13} color="#6366f1" />
            <Text style={{ color: "#6366f1", fontSize: 11, fontWeight: "700" }}>Importar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openGitHub("push-existing")}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#007acc22", borderWidth: 1, borderColor: "#007acc44", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 }}
          >
            <Feather name="upload-cloud" size={13} color="#007acc" />
            <Text style={{ color: "#007acc", fontSize: 11, fontWeight: "700" }}>Exportar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowApk(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#7c3aed22", borderWidth: 1, borderColor: "#7c3aed44", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 }}
          >
            <Feather name="smartphone" size={13} color="#7c3aed" />
            <Text style={{ color: "#7c3aed", fontSize: 11, fontWeight: "700" }}>Gerar APK</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setShowEasCard(v => !v); setEasMsg(""); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: showEasCard ? "#f97316" : "#f9731622", borderWidth: 1, borderColor: "#f9731644", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 }}
          >
            <Feather name="zap" size={13} color={showEasCard ? "#fff" : "#f97316"} />
            <Text style={{ color: showEasCard ? "#fff" : "#f97316", fontSize: 11, fontWeight: "700" }}>Disparar APK</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Card de disparo rápido EAS */}
      {showEasCard && (
        <View style={{
          margin: 10,
          padding: 14,
          borderRadius: 12,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: "#f9731633",
          gap: 10,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="zap" size={16} color="#f97316" />
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "800" }}>Disparar Build EAS</Text>
            {easToken.trim() ? (
              <View style={{ marginLeft: "auto", backgroundColor: "#10b98122", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ color: "#10b981", fontSize: 10, fontWeight: "700" }}>token salvo ✓</Text>
              </View>
            ) : null}
          </View>

          <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 17 }}>
            Cole seu token EAS abaixo e toque em DISPARAR. O build roda nos servidores do Expo e gera o APK para você baixar.
          </Text>

          <TextInput
            style={{
              borderWidth: 1,
              borderColor: easToken.trim() ? "#f9731655" : colors.border,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 11,
              fontSize: 14,
              color: colors.foreground,
              backgroundColor: colors.background,
              fontFamily: "monospace",
            }}
            value={easToken}
            onChangeText={saveToken}
            placeholder="Cole aqui o token EAS  (eas_xxxxxxxx...)"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={false}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            onPress={dispararBuild}
            disabled={easBuilding}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: easBuilding ? colors.muted : "#f97316",
              borderRadius: 10,
              paddingVertical: 13,
            }}
          >
            <Feather name={easBuilding ? "loader" : "zap"} size={16} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
              {easBuilding ? "Disparando..." : "🚀 DISPARAR"}
            </Text>
          </TouchableOpacity>

          {easMsg ? (
            <View style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: easMsg.startsWith("✅") ? "#052e16" : easMsg.startsWith("🔄") ? colors.secondary : "#450a0a",
              borderWidth: 1,
              borderColor: easMsg.startsWith("✅") ? "#10b98133" : easMsg.startsWith("🔄") ? colors.border : "#ef444433",
            }}>
              <Text style={{
                color: easMsg.startsWith("✅") ? "#4ade80" : easMsg.startsWith("🔄") ? colors.mutedForeground : "#f87171",
                fontSize: 12,
                lineHeight: 18,
                fontFamily: "monospace",
              }}>
                {easMsg}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Árvore de arquivos */}
      <View style={{ flex: 1, paddingBottom: TAB_BAR_HEIGHT + insets.bottom }}>
        <FileSidebar />
      </View>

      {/* Modais */}
      <GitHubModal visible={showGitHub} onClose={() => setShowGitHub(false)} initialView={gitInitialView} />
      <APKBuilderModal visible={showApk} onClose={() => setShowApk(false)} />
    </View>
  );
}
