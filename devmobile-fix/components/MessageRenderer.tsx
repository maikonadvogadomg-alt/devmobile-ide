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
  TextStyle,
  TouchableOpacity,
  View,
} from "react-native";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

// ─── Tipos de segmento ────────────────────────────────────────────────────────
type SegmentType = "text" | "code" | "heading" | "bullet_list" | "numbered_list" | "blockquote" | "hr" | "command";

interface Segment {
  type: SegmentType;
  content: string;
  language?: string;
  level?: 1 | 2 | 3;
  items?: string[];
}

// ─── Parser de markdown completo ─────────────────────────────────────────────
function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Bloco de código ```lang\n...\n``` ──────────────────────────────────
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim() || "código";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // pula o ``` de fechamento
      const code = codeLines.join("\n").trim();
      if (code) {
        // Detecta se é um comando de terminal
        const isCommand = ["bash", "sh", "shell", "zsh", "terminal", "cmd", "powershell"].includes(lang.toLowerCase());
        segments.push({ type: isCommand ? "command" : "code", content: code, language: lang });
      }
      continue;
    }

    // ── Regra horizontal --- ───────────────────────────────────────────────
    if (/^[-*_]{3,}$/.test(line.trim())) {
      segments.push({ type: "hr", content: "" });
      i++;
      continue;
    }

    // ── Cabeçalhos # ## ### ───────────────────────────────────────────────
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3;
      segments.push({ type: "heading", content: headingMatch[2].trim(), level });
      i++;
      continue;
    }

    // ── Lista com bullet - item ou * item ─────────────────────────────────
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, "").trim());
        i++;
      }
      segments.push({ type: "bullet_list", content: "", items });
      continue;
    }

    // ── Lista numerada 1. item ────────────────────────────────────────────
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
        i++;
      }
      segments.push({ type: "numbered_list", content: "", items });
      continue;
    }

    // ── Citação > texto ───────────────────────────────────────────────────
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].slice(1).trim());
        i++;
      }
      segments.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // ── Texto comum (acumula linhas até próximo bloco especial) ──────────
    const textLines: string[] = [];
    while (
      i < lines.length &&
      !lines[i].trimStart().startsWith("```") &&
      !headingMatch &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].startsWith(">") &&
      !/^[-*_]{3,}$/.test(lines[i].trim())
    ) {
      textLines.push(lines[i]);
      i++;
    }
    const joined = textLines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
    if (joined.trim()) {
      segments.push({ type: "text", content: joined });
    }
  }

  return segments;
}

// ─── Renderiza texto inline com markdown ─────────────────────────────────────
function renderInlineMarkdown(text: string, baseStyle: TextStyle, colors: ReturnType<typeof useColors>): React.ReactNode {
  // Processa: **bold**, *italic*, `code`, ~~strike~~
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|~~([^~]+)~~|_([^_]+)_)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<Text key={`t${idx++}`} style={baseStyle}>{text.slice(last, match.index)}</Text>);
    }
    if (match[2]) {
      parts.push(<Text key={`b${idx++}`} style={[baseStyle, { fontWeight: "700" }]}>{match[2]}</Text>);
    } else if (match[3]) {
      parts.push(<Text key={`i${idx++}`} style={[baseStyle, { fontStyle: "italic" }]}>{match[3]}</Text>);
    } else if (match[6]) {
      parts.push(<Text key={`i2${idx++}`} style={[baseStyle, { fontStyle: "italic" }]}>{match[6]}</Text>);
    } else if (match[4]) {
      parts.push(
        <Text key={`c${idx++}`} style={[baseStyle, {
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          backgroundColor: "#ffffff1a",
          color: "#00d4aa",
          fontSize: (baseStyle.fontSize as number || 14) - 1,
        }]}>{" "}{match[4]}{" "}</Text>
      );
    } else if (match[5]) {
      parts.push(<Text key={`s${idx++}`} style={[baseStyle, { textDecorationLine: "line-through", opacity: 0.6 }]}>{match[5]}</Text>);
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(<Text key={`t${idx++}`} style={baseStyle}>{text.slice(last)}</Text>);
  }

  return parts.length === 0 ? <Text style={baseStyle}>{text}</Text> : <Text>{parts}</Text>;
}

// ─── Bloco de código com destaque ────────────────────────────────────────────
function CodeBlock({
  code,
  language,
  isCommand = false,
  onApplyToFile,
  onCopyToTerminal,
}: {
  code: string;
  language: string;
  isCommand?: boolean;
  onApplyToFile?: (code: string) => void;
  onCopyToTerminal?: (cmd: string) => void;
}) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lineCount = code.split("\n").length;
  const MAX_LINES = 18;
  const shouldCollapse = lineCount > MAX_LINES && !expanded;
  const displayCode = shouldCollapse ? code.split("\n").slice(0, MAX_LINES).join("\n") + "\n..." : code;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const headerColor = isCommand ? "#f59e0b" : "#00d4aa";

  return (
    <View style={[styles.codeBlock, { borderColor: isCommand ? "#f59e0b33" : colors.border }]}>
      <View style={[styles.codeHeader, { borderBottomColor: isCommand ? "#f59e0b22" : colors.border, backgroundColor: isCommand ? "#1a0e0022" : "#0d111788" }]}>
        <View style={styles.codeLangRow}>
          <Feather name={isCommand ? "terminal" : "code"} size={11} color={headerColor} />
          <Text style={[styles.codeLang, { color: headerColor }]}>{isCommand ? "terminal" : (language || "código")}</Text>
          {lineCount > 1 && (
            <Text style={{ color: "#ffffff44", fontSize: 10, marginLeft: 6 }}>{lineCount} linhas</Text>
          )}
        </View>
        <View style={styles.codeActions}>
          {isCommand && onCopyToTerminal && (
            <TouchableOpacity
              onPress={() => onCopyToTerminal(code)}
              style={[styles.codeBtn, { backgroundColor: "#f59e0b22", borderColor: "#f59e0b44" }]}
            >
              <Feather name="terminal" size={11} color="#f59e0b" />
              <Text style={[styles.codeBtnText, { color: "#f59e0b" }]}>Terminal</Text>
            </TouchableOpacity>
          )}
          {!isCommand && onApplyToFile && (
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
            style={[styles.codeBtn, { backgroundColor: copied ? "#10b98122" : "#ffffff12", borderColor: copied ? "#10b98144" : "#ffffff22" }]}
          >
            <Feather name={copied ? "check" : "copy"} size={11} color={copied ? "#10b981" : "#aaa"} />
            <Text style={[styles.codeBtnText, { color: copied ? "#10b981" : "#aaa" }]}>
              {copied ? "Copiado!" : "Copiar"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <Text
          selectable
          style={[styles.codeText, { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}
        >
          {displayCode}
        </Text>
      </ScrollView>

      {lineCount > MAX_LINES && (
        <TouchableOpacity
          onPress={() => setExpanded(v => !v)}
          style={[styles.expandBtn, { borderTopColor: colors.border }]}
        >
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={13} color="#7d8590" />
          <Text style={{ color: "#7d8590", fontSize: 11, marginLeft: 4 }}>
            {expanded ? "Recolher" : `Ver mais ${lineCount - MAX_LINES} linhas`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface MessageRendererProps {
  content: string;
  isUser?: boolean;
  showApply?: boolean;
  onCopyToTerminal?: (cmd: string) => void;
}

export default function MessageRenderer({ content, isUser, showApply = true, onCopyToTerminal }: MessageRendererProps) {
  const colors = useColors();
  const { activeProject, activeFile, updateFile, createFile } = useApp();

  // Aplica código ao arquivo ativo
  const handleApplyToFile = (code: string) => {
    if (!activeProject || !activeFile) {
      Alert.alert("Nenhum arquivo aberto", "Abra um arquivo no Editor antes de aplicar o código.", [{ text: "OK" }]);
      return;
    }
    Alert.alert(
      "Aplicar ao arquivo",
      `Substituir "${activeFile.name}"?`,
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

  // Cria arquivo sugerido pela IA
  const handleCreateFile = (filename: string, fileContent: string = "") => {
    if (!activeProject) {
      Alert.alert("Nenhum projeto ativo", "Abra um projeto primeiro.", [{ text: "OK" }]);
      return;
    }
    Alert.alert(
      "Criar arquivo",
      `Criar "${filename}" no projeto "${activeProject.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Criar",
          onPress: () => {
            createFile(activeProject.id, filename, fileContent);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const segments = parseSegments(content);
  const baseTextStyle: TextStyle = {
    fontSize: 14,
    lineHeight: 22,
    color: isUser ? colors.primaryForeground : colors.foreground,
  };

  return (
    <View style={{ gap: 5 }}>
      {segments.map((seg, i) => {
        // ── Código / Comando ──────────────────────────────────────────────
        if (seg.type === "code" || seg.type === "command") {
          return (
            <CodeBlock
              key={i}
              code={seg.content}
              language={seg.language || "código"}
              isCommand={seg.type === "command"}
              onApplyToFile={showApply && !isUser ? handleApplyToFile : undefined}
              onCopyToTerminal={onCopyToTerminal}
            />
          );
        }

        // ── Cabeçalho ─────────────────────────────────────────────────────
        if (seg.type === "heading") {
          const fontSize = seg.level === 1 ? 18 : seg.level === 2 ? 16 : 14;
          const borderBottom = seg.level === 1 || seg.level === 2;
          return (
            <View key={i} style={borderBottom ? [styles.headingContainer, { borderBottomColor: colors.border }] : undefined}>
              <Text selectable style={{ fontSize, fontWeight: "700", color: colors.foreground, lineHeight: fontSize + 8 }}>
                {seg.content}
              </Text>
            </View>
          );
        }

        // ── Lista com bullet ──────────────────────────────────────────────
        if (seg.type === "bullet_list" && seg.items) {
          return (
            <View key={i} style={{ gap: 3, paddingLeft: 4 }}>
              {seg.items.map((item, j) => (
                <View key={j} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <Text style={{ color: colors.accent, fontSize: 14, lineHeight: 22, marginTop: 1 }}>•</Text>
                  <View style={{ flex: 1 }}>
                    {renderInlineMarkdown(item, baseTextStyle, colors)}
                  </View>
                </View>
              ))}
            </View>
          );
        }

        // ── Lista numerada ────────────────────────────────────────────────
        if (seg.type === "numbered_list" && seg.items) {
          return (
            <View key={i} style={{ gap: 3, paddingLeft: 4 }}>
              {seg.items.map((item, j) => (
                <View key={j} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <Text style={{ color: colors.accent, fontSize: 13, lineHeight: 22, fontWeight: "700", minWidth: 18 }}>{j + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    {renderInlineMarkdown(item, baseTextStyle, colors)}
                  </View>
                </View>
              ))}
            </View>
          );
        }

        // ── Citação ───────────────────────────────────────────────────────
        if (seg.type === "blockquote") {
          return (
            <View key={i} style={[styles.blockquote, { borderLeftColor: colors.accent, backgroundColor: colors.accent + "11" }]}>
              <Text selectable style={[baseTextStyle, { color: colors.mutedForeground, fontStyle: "italic" }]}>
                {seg.content}
              </Text>
            </View>
          );
        }

        // ── Linha horizontal ──────────────────────────────────────────────
        if (seg.type === "hr") {
          return <View key={i} style={[styles.hr, { backgroundColor: colors.border }]} />;
        }

        // ── Texto comum — renderiza inline markdown ────────────────────────
        if (seg.type === "text") {
          const text = seg.content.replace(/^\n+/, "").replace(/\n+$/, "");
          if (!text) return null;

          // Detecta sugestão de criação de arquivo (ex: "Criar arquivo `nome.js`" ou "arquivo chamado `nome.js`")
          const fileMatch = text.match(/(?:cri(?:ar?|e|ação)|novo arquivo|arquivo|file)[^`]*`([a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,6})`/i);
          const suggestedFile = fileMatch ? fileMatch[1] : null;

          return (
            <View key={i} style={{ gap: 4 }}>
              {renderInlineMarkdown(text, baseTextStyle, colors)}
              {suggestedFile && !isUser && activeProject && (
                <TouchableOpacity
                  onPress={() => handleCreateFile(suggestedFile)}
                  style={[styles.createFileBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}
                >
                  <Feather name="file-plus" size={12} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
                    Criar {suggestedFile}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }

        return null;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  codeBlock: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    marginVertical: 3,
    backgroundColor: "#0d1117",
  },
  codeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  codeLangRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  codeLang: { fontSize: 11, fontWeight: "700", textTransform: "lowercase" },
  codeActions: { flexDirection: "row", gap: 6 },
  codeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 5, borderWidth: 1,
  },
  codeBtnText: { fontSize: 11, fontWeight: "600" },
  codeText: {
    color: "#e6edf3", fontSize: 12.5, lineHeight: 20,
    padding: 12,
  },
  expandBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    padding: 8, borderTopWidth: 1,
    backgroundColor: "#ffffff08",
  },
  headingContainer: {
    paddingBottom: 6, marginBottom: 2, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  blockquote: {
    borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 6,
    borderRadius: 4, marginVertical: 2,
  },
  hr: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  createFileBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    alignSelf: "flex-start", marginTop: 4,
  },
});
