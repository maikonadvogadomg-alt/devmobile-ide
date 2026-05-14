import { Feather } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface AppEntry {
  id: string;
  name: string;
  url: string;
  works: string;
  broken: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSendToJasmim: (prompt: string) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function emptyApp(): AppEntry {
  return { id: uid(), name: "", url: "", works: "", broken: "" };
}

export default function CombinarAppsModal({ visible, onClose, onSendToJasmim }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [apps, setApps] = useState<AppEntry[]>([emptyApp(), emptyApp()]);
  const [goal, setGoal] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const addApp = useCallback(() => {
    setApps(prev => [...prev, emptyApp()]);
    setGeneratedPrompt("");
  }, []);

  const removeApp = useCallback((id: string) => {
    setApps(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(a => a.id !== id);
    });
    setGeneratedPrompt("");
  }, []);

  const updateApp = useCallback((id: string, field: keyof Omit<AppEntry, "id">, value: string) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    setGeneratedPrompt("");
  }, []);

  const generatePrompt = useCallback(() => {
    const filled = apps.filter(a => a.name.trim() || a.url.trim() || a.works.trim() || a.broken.trim());
    if (filled.length === 0) {
      Alert.alert("Preencha ao menos um app", "Adicione o nome e o que funciona em cada app antes de gerar.");
      return;
    }
    const appDescs = filled.map((a, i) => {
      const lines: string[] = [];
      lines.push(`App ${i + 1}${a.name ? ` — ${a.name}` : ""}:`);
      if (a.url.trim()) lines.push(`  URL do Servidor: ${a.url.trim()}`);
      if (a.works.trim()) lines.push(`  ✅ O que funciona bem: ${a.works.trim()}`);
      if (a.broken.trim()) lines.push(`  ❌ O que não funciona: ${a.broken.trim()}`);
      return lines.join("\n");
    }).join("\n\n");

    const goalSection = goal.trim() ? `\nObjetivo do app final: ${goal.trim()}\n` : "";

    const prompt = `Tenho ${filled.length} app${filled.length > 1 ? "s" : ""} e quero combiná-los num único projeto que aproveite o que já funciona em cada um.
${goalSection}
Aqui estão os apps:

${appDescs}

Por favor:
1. Analise o que cada app tem de melhor
2. Crie um único projeto unificado aproveitando o código que já funciona
3. Não reescreva do zero o que já está funcionando — aproveite o código existente
4. Para cada parte que for unir, explique de qual app está vindo
5. Ao final, mostre como rodar o projeto (npm install && npm start ou equivalente)

Comece dizendo qual será a estrutura do projeto unificado e como vai organizar os arquivos.`;

    setGeneratedPrompt(prompt);
    setSent(false);
    setCopied(false);
  }, [apps, goal]);

  const copyPrompt = useCallback(async () => {
    if (!generatedPrompt) return;
    try {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [generatedPrompt]);

  const sendToJasmim = useCallback(() => {
    if (!generatedPrompt) return;
    onSendToJasmim(generatedPrompt);
    setSent(true);
    setTimeout(() => setSent(false), 3000);
    onClose();
  }, [generatedPrompt, onSendToJasmim, onClose]);

  const filledCount = apps.filter(a => a.name.trim() || a.url.trim() || a.works.trim() || a.broken.trim()).length;

  const C = {
    bg: "#0f1a0a",
    card: "#0d1309",
    border: "#2d4a1e",
    fg: "#a8d5a2",
    green: "#7ec87a",
    greenDim: "#5aab56",
    muted: "#6b8f68",
    inputBg: "#141c0d",
    inputBorder: "#3d6e2a",
    inputFocus: "#5aab56",
  };

  const inputStyle = {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: C.fg,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  };

  const labelStyle = {
    color: C.greenDim,
    fontSize: 11,
    fontWeight: "700" as const,
    marginBottom: 4,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: insets.top + 6, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 }}>
          <Text style={{ fontSize: 20 }}>🔗</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.green, fontWeight: "700", fontSize: 17 }}>Combinar Apps</Text>
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>
              Preencha os apps e gere o prompt para a Jasmim unir tudo
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="x" size={22} color={C.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 14 }}>

          {/* Goal */}
          <View>
            <Text style={labelStyle}>🎯 Objetivo do app final (opcional)</Text>
            <TextInput
              style={[inputStyle, { minHeight: 56, textAlignVertical: "top" }]}
              value={goal}
              onChangeText={t => { setGoal(t); setGeneratedPrompt(""); }}
              placeholder="Ex: Um app de gestão com login, dashboard e relatórios em PDF"
              placeholderTextColor={C.inputBorder}
              multiline
              autoCapitalize="sentences"
              autoCorrect={false}
            />
          </View>

          {/* App list */}
          {apps.map((app, idx) => (
            <View key={app.id} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12 }}>
              {/* App header */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ color: C.green, fontSize: 11, fontWeight: "700", flex: 1 }}>
                  APP {idx + 1}
                </Text>
                {apps.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeApp(app.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={15} color="#d47070" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Name + URL row */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Nome do app</Text>
                  <TextInput
                    style={inputStyle}
                    value={app.name}
                    onChangeText={t => updateApp(app.id, "name", t)}
                    placeholder="Ex: app-login"
                    placeholderTextColor={C.inputBorder}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>URL do Servidor</Text>
                  <TextInput
                    style={inputStyle}
                    value={app.url}
                    onChangeText={t => updateApp(app.id, "url", t)}
                    placeholder="github.com/usuario/repo"
                    placeholderTextColor={C.inputBorder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>
              </View>

              {/* Works */}
              <View style={{ marginBottom: 8 }}>
                <Text style={labelStyle}>✅ O que funciona bem</Text>
                <TextInput
                  style={[inputStyle, { minHeight: 52, textAlignVertical: "top" }]}
                  value={app.works}
                  onChangeText={t => updateApp(app.id, "works", t)}
                  placeholder="Ex: Login com Google funciona. Sistema de autenticação está completo."
                  placeholderTextColor={C.inputBorder}
                  multiline
                  autoCapitalize="sentences"
                  autoCorrect={false}
                />
              </View>

              {/* Broken */}
              <View>
                <Text style={labelStyle}>❌ O que não funciona (opcional)</Text>
                <TextInput
                  style={[inputStyle, { minHeight: 52, textAlignVertical: "top" }]}
                  value={app.broken}
                  onChangeText={t => updateApp(app.id, "broken", t)}
                  placeholder="Ex: Os relatórios em PDF não geram. Painel de admin está incompleto."
                  placeholderTextColor={C.inputBorder}
                  multiline
                  autoCapitalize="sentences"
                  autoCorrect={false}
                />
              </View>
            </View>
          ))}

          {/* Add app button */}
          <TouchableOpacity
            onPress={addApp}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderWidth: 1, borderStyle: "dashed", borderColor: C.inputBorder, borderRadius: 12 }}
          >
            <Feather name="plus" size={16} color={C.greenDim} />
            <Text style={{ color: C.greenDim, fontSize: 14, fontWeight: "600" }}>Adicionar outro app</Text>
          </TouchableOpacity>

          {/* Generate button */}
          <TouchableOpacity
            onPress={generatePrompt}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, backgroundColor: filledCount > 0 ? "#2d4a1e" : "#1a2a10", borderRadius: 12, opacity: filledCount > 0 ? 1 : 0.5 }}
            activeOpacity={0.8}
          >
            <Feather name="zap" size={16} color={C.green} />
            <Text style={{ color: C.green, fontWeight: "700", fontSize: 15 }}>
              ✨ Gerar Prompt para Jasmim
            </Text>
          </TouchableOpacity>

          {/* Generated prompt */}
          {generatedPrompt !== "" && (
            <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: "#2d5a1e", borderRadius: 12, overflow: "hidden" }}>
              {/* Prompt header */}
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#1a3d14", borderBottomWidth: 1, borderBottomColor: "#2d5a1e" }}>
                <Text style={{ color: C.green, fontSize: 12, fontWeight: "700", flex: 1 }}>✨ Prompt gerado</Text>
                <TouchableOpacity
                  onPress={copyPrompt}
                  style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#2d4a1e", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                >
                  <Feather name={copied ? "check" : "copy"} size={12} color={C.green} />
                  <Text style={{ color: C.green, fontSize: 11, fontWeight: "600" }}>
                    {copied ? "Copiado!" : "Copiar"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Prompt text (scrollable) */}
              <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ padding: 12 }}>
                <Text style={{ color: "#8cba89", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 19 }}>
                  {generatedPrompt}
                </Text>
              </ScrollView>

              {/* Send button */}
              <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: "#2d5a1e" }}>
                <TouchableOpacity
                  onPress={sendToJasmim}
                  activeOpacity={0.8}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: sent ? "#1a4a2e" : "#1e5c9e" }}
                >
                  <Feather name={sent ? "check-circle" : "send"} size={15} color={sent ? C.green : "#fff"} />
                  <Text style={{ color: sent ? C.green : "#fff", fontWeight: "700", fontSize: 14 }}>
                    {sent ? "Enviado para a Jasmim! 🤖" : "Enviar para a Jasmim"}
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: C.muted, fontSize: 11, textAlign: "center", marginTop: 6 }}>
                  O prompt será enviado e o painel da Jasmim abrirá
                </Text>
              </View>
            </View>
          )}

          {/* Tips */}
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12 }}>
            <Text style={{ color: C.greenDim, fontSize: 12, fontWeight: "700", marginBottom: 8 }}>💡 Dicas</Text>
            {[
              "Seja específico sobre o que funciona — mencione nomes de arquivos ou módulos se souber",
              "Você pode adicionar quantos apps precisar com o botão + abaixo",
              "Depois de enviar, a Jasmim analisa e une os projetos automaticamente",
              "Se quiser ajustar, edite os campos e toque em Gerar novamente",
            ].map((tip, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
                <Text style={{ color: "#3d6e2a", fontSize: 12 }}>›</Text>
                <Text style={{ color: C.muted, fontSize: 12, lineHeight: 18, flex: 1 }}>{tip}</Text>
              </View>
            ))}
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}
