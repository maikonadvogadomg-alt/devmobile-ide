import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useApiBase } from "@/hooks/useApiBase";

// Common ports to auto-detect
const COMMON_PORTS = [3000, 3001, 4000, 5000, 5173, 8000, 8080, 8888, 9000];

interface Props {
  visible: boolean;
  onClose: () => void;
  initialPort?: number;
}

interface PortStatus { port: number; open: boolean }

export default function PreviewPanel({ visible, onClose, initialPort = 3000 }: Props) {
  const insets = useSafeAreaInsets();
  const apiBase = useApiBase();
  const API_BASE = apiBase ? `${apiBase}/api` : "";
  const webRef = useRef<WebView>(null);

  const [port, setPort] = useState(String(initialPort));
  const [activePort, setActivePort] = useState(initialPort);
  const [loading, setLoading] = useState(false);
  const [urlOverride, setUrlOverride] = useState("");
  const [editingUrl, setEditingUrl] = useState(false);
  const [portStatuses, setPortStatuses] = useState<PortStatus[]>([]);
  const [scanning, setScanning] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentTitle, setCurrentTitle] = useState("");

  const previewUrl = urlOverride
    ? urlOverride
    : API_BASE
    ? `${API_BASE}/preview/port/${activePort}/`
    : "";

  const scanPorts = useCallback(async () => {
    if (!API_BASE) return;
    setScanning(true);
    const results: PortStatus[] = [];
    await Promise.all(
      COMMON_PORTS.map(async (p) => {
        try {
          const r = await fetch(`${API_BASE}/preview/check?port=${p}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(2000),
          });
          const j = await r.json();
          if (j.open) results.push({ port: p, open: true });
        } catch {}
      }),
    );
    setPortStatuses(results);
    setScanning(false);
    // Auto-select first open port if found
    if (results.length > 0) {
      const p = results[0].port;
      setPort(String(p));
      setActivePort(p);
      setUrlOverride("");
      setLoading(true);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      scanPorts();
    }
  }, [visible]);

  const openPort = useCallback(() => {
    const n = Number(port.trim());
    if (!n || n < 1 || n > 65535) return;
    setActivePort(n);
    setUrlOverride("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    webRef.current?.reload();
  }, [port]);

  const reload = useCallback(() => {
    setLoading(true);
    webRef.current?.reload();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const currentDisplayUrl = urlOverride || (API_BASE ? `${API_BASE}/preview/port/${activePort}/` : "");

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: "#0a0a0a" }]}>
        {/* ── Top bar ── */}
        <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Feather name="x" size={18} color="#aaa" />
          </TouchableOpacity>

          {/* URL bar */}
          <TouchableOpacity
            onPress={() => setEditingUrl(true)}
            style={styles.urlBar}
            activeOpacity={0.7}
          >
            <Feather name="globe" size={12} color="#64748b" />
            {editingUrl ? (
              <TextInput
                style={styles.urlInput}
                value={urlOverride || currentDisplayUrl}
                onChangeText={setUrlOverride}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={() => {
                  setEditingUrl(false);
                  setLoading(true);
                  webRef.current?.reload();
                }}
                onBlur={() => setEditingUrl(false)}
                selectTextOnFocus
              />
            ) : (
              <Text style={styles.urlText} numberOfLines={1}>
                {currentDisplayUrl || "Nenhum servidor detectado"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={reload} style={styles.iconBtn}>
            <Feather name="refresh-cw" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* ── Nav bar ── */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => webRef.current?.goBack()}
            disabled={!canGoBack}
            style={[styles.navBtn, !canGoBack && { opacity: 0.3 }]}
          >
            <Feather name="chevron-left" size={18} color="#aaa" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => webRef.current?.goForward()}
            disabled={!canGoForward}
            style={[styles.navBtn, !canGoForward && { opacity: 0.3 }]}
          >
            <Feather name="chevron-right" size={18} color="#aaa" />
          </TouchableOpacity>

          {/* Port quick-select */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 8, alignItems: "center" }}
            style={{ flex: 1 }}
          >
            {scanning && <ActivityIndicator size="small" color="#007acc" />}
            {portStatuses.map((ps) => (
              <TouchableOpacity
                key={ps.port}
                onPress={() => {
                  setPort(String(ps.port));
                  setActivePort(ps.port);
                  setUrlOverride("");
                  setLoading(true);
                  Haptics.selectionAsync();
                }}
                style={[
                  styles.portChip,
                  ps.port === activePort && { backgroundColor: "#007acc22", borderColor: "#007acc" },
                ]}
              >
                <View style={styles.portDot} />
                <Text style={[styles.portChipText, ps.port === activePort && { color: "#007acc" }]}>
                  :{ps.port}
                </Text>
              </TouchableOpacity>
            ))}
            {portStatuses.length === 0 && !scanning && (
              <Text style={{ color: "#444", fontSize: 11 }}>Nenhum servidor detectado</Text>
            )}
          </ScrollView>

          {/* Manual port input */}
          <View style={styles.portRow}>
            <TextInput
              style={styles.portInput}
              value={port}
              onChangeText={setPort}
              keyboardType="number-pad"
              placeholder="porta"
              placeholderTextColor="#444"
              returnKeyType="go"
              onSubmitEditing={openPort}
            />
            <TouchableOpacity onPress={openPort} style={styles.portGoBtn}>
              <Text style={{ color: "#007acc", fontSize: 12, fontWeight: "700" }}>IR</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={scanPorts} style={styles.iconBtn} disabled={scanning}>
            {scanning
              ? <ActivityIndicator size="small" color="#007acc" />
              : <Feather name="search" size={15} color="#64748b" />}
          </TouchableOpacity>
        </View>

        {/* Title bar */}
        {currentTitle.length > 0 && (
          <View style={styles.titleBar}>
            <Text style={styles.titleText} numberOfLines={1}>{currentTitle}</Text>
          </View>
        )}

        {/* ── WebView ── */}
        <View style={{ flex: 1, position: "relative" }}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007acc" />
              <Text style={styles.loadingText}>
                Carregando porta {activePort}…
              </Text>
              <Text style={styles.loadingHint}>
                Certifique-se que seu servidor está rodando no terminal{"\n"}
                (ex: node index.js, npm run dev)
              </Text>
            </View>
          )}

          {Platform.OS === "web" ? (
            /* On web, we can't use WebView — show link + instructions */
            <View style={{ flex: 1, padding: 20 }}>
              <View style={styles.webFallback}>
                <Text style={{ color: "#60a5fa", fontSize: 16, fontWeight: "700", marginBottom: 8 }}>
                  Preview — Porta {activePort}
                </Text>
                <Text style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
                  Acesse diretamente no browser:
                </Text>
                <Text style={{ color: "#a5f3fc", fontFamily: "monospace", fontSize: 13, marginBottom: 20 }} selectable>
                  {currentDisplayUrl}
                </Text>
                <Text style={{ color: "#64748b", fontSize: 12 }}>
                  (No APK Android o preview abre embutido)
                </Text>
              </View>

              {/* Instructions */}
              <View style={[styles.webFallback, { marginTop: 16, backgroundColor: "#0d1f0d", borderColor: "#1a4d1a" }]}>
                <Text style={{ color: "#4ade80", fontWeight: "700", fontSize: 14, marginBottom: 10 }}>
                  Como usar o Preview
                </Text>
                {[
                  "1. Abra o terminal (aba Terminal)",
                  "2. Envie seu projeto: botão [UPLOAD]",
                  "3. Execute: node index.js  OU  npm run dev",
                  "4. Volte aqui e toque em 'Detectar Servidores'",
                  "5. Ou informe a porta manualmente e toque em IR",
                ].map((s, i) => (
                  <Text key={i} style={{ color: "#86efac", fontSize: 13, lineHeight: 22 }}>{s}</Text>
                ))}
              </View>
            </View>
          ) : (
            previewUrl ? (
              <WebView
                ref={webRef}
                source={{ uri: previewUrl }}
                style={{ flex: 1, backgroundColor: "#fff" }}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onLoad={() => setLoading(false)}
                onNavigationStateChange={(state) => {
                  setCanGoBack(state.canGoBack);
                  setCanGoForward(state.canGoForward);
                  setCurrentTitle(state.title ?? "");
                }}
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="always"
                allowFileAccess
                userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                onError={() => setLoading(false)}
                onHttpError={() => setLoading(false)}
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
                <Text style={{ fontSize: 40 }}>🔌</Text>
                <Text style={{ color: "#aaa", fontSize: 15, fontWeight: "700", textAlign: "center" }}>Preview indisponível</Text>
                <Text style={{ color: "#555", fontSize: 13, textAlign: "center", lineHeight: 20 }}>
                  O preview ao vivo precisa de um servidor rodando.{"\n\n"}
                  Para usar:{"\n"}
                  • Instale o Termux + rode o servidor DevMobile{"\n"}
                  • Ou use seu servidor externo enquanto estiver ativo
                </Text>
              </View>
            )
          )}
        </View>

        {/* ── Bottom bar ── */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
          <TouchableOpacity onPress={scanPorts} disabled={scanning} style={styles.detectBtn}>
            {scanning
              ? <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
              : <Feather name="zap" size={14} color="#fff" style={{ marginRight: 6 }} />}
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
              {scanning ? "Detectando…" : "Detectar Servidores"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={reload} style={styles.reloadBtn}>
            <Feather name="refresh-cw" size={14} color="#007acc" />
            <Text style={{ color: "#007acc", fontWeight: "700", fontSize: 13, marginLeft: 4 }}>Recarregar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 6,
    flexShrink: 0,
  },
  urlBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  urlInput: {
    flex: 1,
    color: "#e2e8f0",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  urlText: {
    flex: 1,
    color: "#94a3b8",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f0f0f",
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    gap: 2,
  },
  navBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  portChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    gap: 4,
  },
  portDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  portChipText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  portRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  portInput: {
    width: 56,
    color: "#e2e8f0",
    fontSize: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlign: "center",
  },
  portGoBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#007acc22",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#007acc44",
  },
  titleBar: {
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  titleText: { color: "#475569", fontSize: 11 },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "#0a0a0a",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: "#94a3b8", fontSize: 15, fontWeight: "600" },
  loadingHint: { color: "#475569", fontSize: 12, textAlign: "center", lineHeight: 18 },
  webFallback: {
    backgroundColor: "#0a1530",
    borderWidth: 1,
    borderColor: "#1e3a5f",
    borderRadius: 12,
    padding: 16,
  },
  bottomBar: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#111",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#1e1e1e",
  },
  detectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007acc",
    borderRadius: 10,
    paddingVertical: 11,
  },
  reloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#007acc1a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#007acc44",
  },
});
