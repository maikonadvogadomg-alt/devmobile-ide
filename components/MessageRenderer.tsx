import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface Segment {
  type: "text" | "code";
  content: string;
  language?: string;
}

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "code",
      language: match[1] || "código",
      content: match[2].trim(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}

const TERMINAL_LANGS = new Set(["bash", "sh", "shell", "terminal", "cmd", "zsh", "fish", "console", "powershell"]);

function CodeBlock({
  code,
  language,
  onApplyToFile,
}: {
  code: string;
  language: string;
  onApplyToFile?: (code: string) => void;
}) {
  const colors = useColors();
  const { queueTerminalCommand } = useApp();
  const [copied, setCopied] = useState(false);
  const [executed, setExecuted] = useState(false);
  const isTerminalBlock = TERMINAL_LANGS.has((language || "").toLowerCase());

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecute = () => {
    const lines = code.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
    const cmd = lines[0] || code.trim();
    queueTerminalCommand(cmd);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setExecuted(true);
    setTimeout(() => setExecuted(false), 2500);
  };

  return (
    <View
      style={[
        styles.codeBlock,
        { backgroundColor: "#0d1117", borderColor: isTerminalBlock ? "#22c55e44" : colors.border },
      ]}
    >
      {/* Code block header */}
      <View style={[styles.codeHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.codeLangRow}>
          <Feather name={isTerminalBlock ? "terminal" : "code"} size={11} color={isTerminalBlock ? "#22c55e" : "#00d4aa"} />
          <Text style={[styles.codeLang, { color: isTerminalBlock ? "#22c55e" : "#00d4aa" }]}>{language || "código"}</Text>
        </View>
        <View style={styles.codeActions}>
          {isTerminalBlock && (
            <TouchableOpacity
              onPress={handleExecute}
              style={[styles.codeBtn, { backgroundColor: executed ? "#22c55e22" : "#22c55e15", borderColor: executed ? "#22c55e66" : "#22c55e33" }]}
            >
              <Feather name={executed ? "check" : "play"} size={11} color={executed ? "#22c55e" : "#4ade80"} />
              <Text style={[styles.codeBtnText, { color: executed ? "#22c55e" : "#4ade80" }]}>
                {executed ? "Enviado!" : "Executar"}
              </Text>
            </TouchableOpacity>
          )}
          {onApplyToFile && (
            <TouchableOpacity
              onPress={() => onApplyToFile(code)}
              style={[styles.codeBtn, { backgroundColor: "#00d4aa22", borderColor: "#00d4aa44" }]}
            >
              <Feather name="file-plus" size={11} color="#00d4aa" />
              <Text style={[styles.codeBtnText, { color: "#00d4aa" }]}>Aplicar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleCopy}
            style={[
              styles.codeBtn,
              {
                backgroundColor: copied ? "#10b98122" : "#ffffff12",
                borderColor: copied ? "#10b98144" : "#ffffff22",
              },
            ]}
          >
            <Feather name={copied ? "check" : "copy"} size={11} color={copied ? "#10b981" : "#aaa"} />
            <Text style={[styles.codeBtnText, { color: copied ? "#10b981" : "#aaa" }]}>
              {copied ? "Copiado!" : "Copiar"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Code content */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 260 }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <Text
          selectable
          style={[
            styles.codeText,
            { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
          ]}
        >
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

interface MessageRendererProps {
  content: string;
  isUser?: boolean;
  /** If true, shows "Aplicar ao arquivo" button on code blocks */
  showApply?: boolean;
}

export default function MessageRenderer({ content, isUser, showApply = true }: MessageRendererProps) {
  const colors = useColors();
  const { activeProject, activeFile, updateFile } = useApp();

  const handleApplyToFile = (code: string) => {
    if (!activeProject || !activeFile) {
      Alert.alert(
        "Nenhum arquivo aberto",
        "Abra um arquivo no Editor antes de aplicar o código.",
        [{ text: "OK" }]
      );
      return;
    }
    Alert.alert(
      "Aplicar ao arquivo",
      `Isso vai substituir o conteúdo de "${activeFile.name}". Continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Substituir tudo",
          style: "destructive",
          onPress: () => {
            updateFile(activeProject.id, activeFile.id, code);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
        {
          text: "Adicionar ao final",
          onPress: () => {
            updateFile(activeProject.id, activeFile.id, activeFile.content + "\n\n" + code);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const segments = parseSegments(content);

  return (
    <View style={{ gap: 6 }}>
      {segments.map((seg, i) => {
        if (seg.type === "code") {
          return (
            <CodeBlock
              key={i}
              code={seg.content}
              language={seg.language || "código"}
              onApplyToFile={showApply && !isUser ? handleApplyToFile : undefined}
            />
          );
        }
        // Plain text segment — clean up leading/trailing blank lines
        const text = seg.content.replace(/^\n+/, "").replace(/\n+$/, "");
        if (!text) return null;
        return (
          <Text
            key={i}
            selectable
            style={[
              styles.textSegment,
              {
                color: isUser ? colors.primaryForeground : colors.foreground,
              },
            ]}
          >
            {text}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  codeBlock: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    marginVertical: 2,
  },
  codeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  codeLangRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  codeLang: {
    color: "#00d4aa",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "lowercase",
  },
  codeActions: {
    flexDirection: "row",
    gap: 6,
  },
  codeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  codeBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },
  codeText: {
    color: "#e6edf3",
    fontSize: 12,
    lineHeight: 19,
    padding: 10,
  },
  textSegment: {
    fontSize: 14,
    lineHeight: 22,
  },
});
