import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface Token {
  type: "keyword" | "string" | "comment" | "number" | "function" | "operator" | "variable" | "type" | "text" | "whitespace";
  value: string;
}

function tokenize(code: string, language: string): Token[] {
  const tokens: Token[] = [];
  let remaining = code;

  const patterns: { type: Token["type"]; regex: RegExp }[] = [];

  if (["javascript", "typescript", "jsx", "tsx"].includes(language)) {
    patterns.push(
      { type: "comment", regex: /^(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/ },
      { type: "string", regex: /^(`[\s\S]*?`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/ },
      { type: "keyword", regex: /^(import|export|from|const|let|var|function|class|return|if|else|for|while|do|switch|case|break|continue|new|typeof|instanceof|in|of|async|await|try|catch|finally|throw|default|extends|implements|interface|type|enum|namespace|abstract|private|protected|public|static|readonly|declare|as|is|keyof|void|null|undefined|true|false|this|super)\b/ },
      { type: "type", regex: /^(string|number|boolean|object|any|never|unknown|bigint|symbol)\b/ },
      { type: "number", regex: /^(0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+|-?\d+(\.\d+)?([eE][+-]?\d+)?)/ },
      { type: "function", regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/ },
      { type: "variable", regex: /^[A-Z][a-zA-Z0-9_$]*\b/ },
      { type: "operator", regex: /^(===|!==|=>|\.\.\.|\?\?|\?\.|[+\-*/%=<>!&|^~?:;,.])/ },
      { type: "text", regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*/ },
      { type: "whitespace", regex: /^[\s]+/ },
    );
  } else if (language === "python") {
    patterns.push(
      { type: "comment", regex: /^#[^\n]*/ },
      { type: "string", regex: /^("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|f"(?:[^"\\]|\\.)*"|f'(?:[^'\\]|\\.)*')/ },
      { type: "keyword", regex: /^(import|from|as|def|class|return|if|elif|else|for|while|break|continue|pass|try|except|finally|raise|with|lambda|yield|global|nonlocal|del|assert|in|is|not|and|or|True|False|None|async|await|self|cls)\b/ },
      { type: "type", regex: /^(int|str|float|bool|list|dict|tuple|set|bytes|type|None)\b/ },
      { type: "number", regex: /^-?\d+(\.\d+)?([eE][+-]?\d+)?/ },
      { type: "function", regex: /^[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/ },
      { type: "operator", regex: /^[+\-*/%=<>!&|^~@?:;,.()\[\]{}]/ },
      { type: "text", regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
      { type: "whitespace", regex: /^\s+/ },
    );
  } else if (language === "json") {
    patterns.push(
      { type: "string", regex: /^"(?:[^"\\]|\\.)*"/ },
      { type: "number", regex: /^-?\d+(\.\d+)?([eE][+-]?\d+)?/ },
      { type: "keyword", regex: /^(true|false|null)\b/ },
      { type: "operator", regex: /^[{}\[\]:,]/ },
      { type: "whitespace", regex: /^\s+/ },
    );
  } else if (language === "html") {
    patterns.push(
      { type: "comment", regex: /^<!--[\s\S]*?-->/ },
      { type: "string", regex: /^"[^"]*"|'[^']*'/ },
      { type: "keyword", regex: /^<\/?[a-zA-Z][a-zA-Z0-9\-]*/ },
      { type: "operator", regex: /^[<>/=]/ },
      { type: "variable", regex: /^[a-zA-Z\-]+(?==)/ },
      { type: "whitespace", regex: /^\s+/ },
    );
  } else if (language === "css" || language === "scss") {
    patterns.push(
      { type: "comment", regex: /^\/\*[\s\S]*?\*\// },
      { type: "string", regex: /^"[^"]*"|'[^']*'/ },
      { type: "keyword", regex: /^(@media|@keyframes|@import|@font-face|@charset|@supports|@layer|!important)\b/ },
      { type: "function", regex: /^[a-zA-Z\-]+(?=\s*\()/ },
      { type: "number", regex: /^-?\d+(\.\d+)?(px|em|rem|vh|vw|%|s|ms|deg|fr|ch|ex)?/ },
      { type: "variable", regex: /^--[a-zA-Z\-]+/ },
      { type: "type", regex: /^[a-zA-Z\-]+(?=\s*:)/ },
      { type: "operator", regex: /^[{};:,.()\[\]>+~*]/ },
      { type: "whitespace", regex: /^\s+/ },
    );
  } else if (language === "markdown") {
    return [{ type: "text", value: code }];
  } else if (language === "bash" || language === "sh") {
    patterns.push(
      { type: "comment", regex: /^#[^\n]*/ },
      { type: "string", regex: /^"(?:[^"\\]|\\.)*"|'[^']*'/ },
      { type: "keyword", regex: /^(if|then|else|elif|fi|for|do|done|while|case|esac|function|return|export|source|echo|cd|ls|grep|sed|awk|cat|cp|mv|rm|mkdir)\b/ },
      { type: "variable", regex: /^\$\{?[a-zA-Z_][a-zA-Z0-9_]*\}?/ },
      { type: "number", regex: /^-?\d+/ },
      { type: "operator", regex: /^[|&;(){}<>]/ },
      { type: "whitespace", regex: /^\s+/ },
    );
  }

  if (patterns.length === 0) {
    return [{ type: "text", value: code }];
  }

  while (remaining.length > 0) {
    let matched = false;
    for (const { type, regex } of patterns) {
      const m = remaining.match(regex);
      if (m) {
        tokens.push({ type, value: m[0] });
        remaining = remaining.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push({ type: "text", value: remaining[0] });
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

function SyntaxLine({
  line,
  lineNum,
  colors,
  showLineNumbers,
  fontSize,
  language,
}: {
  line: string;
  lineNum: number;
  colors: ReturnType<typeof useColors>;
  showLineNumbers: boolean;
  fontSize: number;
  language: string;
}) {
  const tokens = useMemo(() => tokenize(line, language), [line, language]);

  const tokenColor = (type: Token["type"]): string => {
    switch (type) {
      case "keyword":   return colors.syntaxKeyword;
      case "string":    return colors.syntaxString;
      case "comment":   return colors.syntaxComment;
      case "number":    return colors.syntaxNumber;
      case "function":  return colors.syntaxFunction;
      case "variable":  return colors.syntaxVariable;
      case "operator":  return colors.syntaxOperator;
      case "type":      return "#79c0ff";
      default:          return colors.foreground;
    }
  };

  const MONO = Platform.OS === "ios" ? "Menlo" : "monospace";

  return (
    <View style={styles.lineRow}>
      {showLineNumbers && (
        <Text
          style={[
            styles.lineNumber,
            {
              color: colors.mutedForeground,
              fontSize: fontSize - 2,
              fontFamily: MONO,
              minWidth: lineNum >= 1000 ? 40 : lineNum >= 100 ? 34 : 28,
            },
          ]}
        >
          {lineNum}
        </Text>
      )}
      <View style={[styles.lineContent, { borderLeftColor: colors.border }]}>
        <Text style={{ fontFamily: MONO, fontSize, lineHeight: fontSize * 1.5 }}>
          {tokens.map((t, i) => (
            <Text key={i} style={{ color: tokenColor(t.type) }}>
              {t.value}
            </Text>
          ))}
        </Text>
      </View>
    </View>
  );
}

export default function CodeEditor() {
  const colors = useColors();
  const { activeFile, updateFile, activeProject, settings } = useApp();
  const [localContent, setLocalContent] = useState(activeFile?.content ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs sempre atualizados — usados dentro de callbacks e AppState sem closure stale
  const latestContentRef = useRef(activeFile?.content ?? "");
  const prevFileRef = useRef<{ fileId: string; projectId: string } | null>(
    activeFile && activeProject ? { fileId: activeFile.id, projectId: activeProject.id } : null
  );
  const updateFileRef = useRef(updateFile);
  updateFileRef.current = updateFile;

  // Salva o arquivo atual imediatamente (sem timer)
  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const prev = prevFileRef.current;
    if (prev) {
      updateFileRef.current(prev.projectId, prev.fileId, latestContentRef.current);
    }
  }, []);

  // Quando activeFile muda: salva o ANTERIOR antes de carregar o novo
  useEffect(() => {
    const newFileId = activeFile?.id ?? null;
    const newProjectId = activeProject?.id ?? null;
    const prev = prevFileRef.current;

    if (prev && prev.fileId !== newFileId) {
      // Salva conteúdo do arquivo anterior antes de trocar
      if (saveTimer.current) clearTimeout(saveTimer.current);
      updateFileRef.current(prev.projectId, prev.fileId, latestContentRef.current);
    }

    // Carrega conteúdo do novo arquivo
    if (activeFile) {
      latestContentRef.current = activeFile.content;
      setLocalContent(activeFile.content);
      prevFileRef.current = newProjectId ? { fileId: activeFile.id, projectId: newProjectId } : null;
    } else {
      prevFileRef.current = null;
    }
    setIsEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile?.id]);

  // Salva quando o app vai para background (fechou, recebeu ligação, etc.)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "background" || state === "inactive") {
        flushSave();
      }
    });
    return () => sub.remove();
  }, [flushSave]);

  const handleChange = useCallback(
    (text: string) => {
      latestContentRef.current = text;
      setLocalContent(text);
      // Auto-save com timer curto
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const prev = prevFileRef.current;
        if (prev) updateFileRef.current(prev.projectId, prev.fileId, latestContentRef.current);
      }, Math.min(settings.autoSaveInterval || 1500, 1500));
    },
    [settings.autoSaveInterval]
  );

  const handleSave = useCallback(() => {
    flushSave();
    setIsEditing(false);
  }, [flushSave]);

  if (!activeFile) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
          Nenhum arquivo aberto
        </Text>
        <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
          Selecione um arquivo na barra lateral
        </Text>
      </View>
    );
  }

  const lines = localContent.split("\n");
  const MONO = Platform.OS === "ios" ? "Menlo" : "monospace";
  const FS = settings.fontSize || 14;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Modo visualização com syntax highlighting */}
      {!isEditing && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4, paddingBottom: 60 }}
          horizontal={false}
          onTouchStart={() => setIsEditing(true)}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator scrollEventThrottle={16}>
            <View>
              {lines.map((line, i) => (
                <SyntaxLine
                  key={i}
                  line={line}
                  lineNum={i + 1}
                  colors={colors}
                  showLineNumbers={settings.showLineNumbers}
                  fontSize={FS}
                  language={activeFile.language}
                />
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      )}

      {/* Modo edição */}
      {isEditing && (
        <View style={{ flex: 1 }}>
          <View style={[styles.editingBanner, { backgroundColor: colors.warning + "22", borderBottomColor: colors.warning }]}>
            <Text style={[styles.editingText, { color: colors.warning, fontFamily: MONO }]}>
              EDITANDO — Toque fora para ver syntax highlighting
            </Text>
          </View>
          <TextInput
            style={[
              styles.editor,
              {
                color: colors.foreground,
                backgroundColor: colors.background,
                fontFamily: MONO,
                fontSize: FS,
                lineHeight: FS * 1.5,
              },
            ]}
            multiline
            value={localContent}
            onChangeText={handleChange}
            onBlur={handleSave}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            textAlignVertical="top"
            scrollEnabled
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  lineRow: {
    flexDirection: "row",
    minHeight: 20,
  },
  lineNumber: {
    textAlign: "right",
    paddingRight: 8,
    paddingLeft: 4,
    opacity: 0.5,
    lineHeight: 21,
    userSelect: "none",
  },
  lineContent: {
    flex: 1,
    paddingLeft: 8,
    borderLeftWidth: 1,
  },
  editingBanner: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  editingText: { fontSize: 10 },
  editor: {
    flex: 1,
    padding: 12,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptyHint: { fontSize: 13 },
});
