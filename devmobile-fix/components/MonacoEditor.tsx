import React, { useRef, useEffect } from "react";
import { Platform, StyleSheet, View, ActivityIndicator, Text } from "react-native";
import { WebView } from "react-native-webview";
import { useColors } from "@/hooks/useColors";

interface MonacoEditorProps {
  value: string;
  language?: string;
  filename?: string;
  onChange?: (code: string) => void;
  readOnly?: boolean;
}

function buildHTML(value: string, language: string, isDark: boolean, readOnly: boolean): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Monaco Editor</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #1e1e1e; }
  #container { width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="container"></div>
<script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
<script>
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
require(['vs/editor/editor.main'], function() {
  const editor = monaco.editor.create(document.getElementById('container'), {
    value: \`${escaped}\`,
    language: '${language}',
    theme: '${isDark ? "vs-dark" : "vs"}',
    fontSize: 14,
    lineHeight: 22,
    readOnly: ${readOnly},
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    automaticLayout: true,
    padding: { top: 8, bottom: 8 },
    scrollbar: {
      verticalScrollbarSize: 6,
      horizontalScrollbarSize: 6,
    },
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    parameterHints: { enabled: true },
    formatOnType: true,
    formatOnPaste: true,
  });

  let saveTimeout;
  editor.onDidChangeModelContent(() => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const content = editor.getValue();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'change', content }));
    }, 500);
  });

  window.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'setValue') editor.setValue(msg.content);
      if (msg.type === 'getContent') {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'content', content: editor.getValue() }));
      }
    } catch {}
  });

  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
});
</script>
</body>
</html>`;
}

export default function MonacoEditor({ value, language = "javascript", filename, onChange, readOnly = false }: MonacoEditorProps) {
  const colors = useColors();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = React.useState(true);
  const isDark = colors.background === "#09090b" || colors.background === "#0a0a0a" || colors.background.startsWith("#0") || colors.background.startsWith("#1");

  useEffect(() => {
    if (!loading && webRef.current) {
      webRef.current.postMessage(JSON.stringify({ type: "setValue", content: value }));
    }
  }, [value]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.webFallback, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.mutedForeground, textAlign: "center", fontSize: 13 }}>
          Monaco Editor disponível apenas no app Android.{"\n"}Use o editor embutido neste preview.
        </Text>
      </View>
    );
  }

  const html = buildHTML(value, language, isDark, readOnly);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: "#1e1e1e" }]}>
          <ActivityIndicator color="#007acc" size="large" />
          <Text style={{ color: "#ccc", marginTop: 12, fontSize: 13 }}>
            Carregando VS Code Editor…
          </Text>
        </View>
      )}
      <WebView
        ref={webRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        mixedContentMode="always"
        onLoadEnd={() => setLoading(false)}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.type === "change" && onChange) {
              onChange(msg.content);
            }
          } catch {}
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative" },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  webFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    margin: 12,
  },
});
