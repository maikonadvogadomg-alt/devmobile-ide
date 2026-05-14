import React, { useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApiBase } from "@/hooks/useApiBase";

// Converte URL HTTP → WS para o WebSocket terminal
function toWsUrl(apiBase: string): string {
  return apiBase
    .replace(/\/api\/?$/, "")
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://")
    + "/api/ws/terminal";
}

// HTML completo com xterm.js via CDN — roda dentro do WebView
function buildHtml(wsUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Terminal</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; background:#0f172a; overflow:hidden; }
  #toolbar {
    display:flex; align-items:center; gap:8px; padding:6px 10px;
    background:#1e293b; border-bottom:1px solid #334155;
    font-family:'Segoe UI',sans-serif;
  }
  #dot { width:10px; height:10px; border-radius:50%; background:#64748b; flex-shrink:0; }
  #dot.connecting { background:#facc15; animation:pulse 1s infinite; }
  #dot.connected { background:#4ade80; }
  #dot.error { background:#f87171; }
  #status { font-size:11px; color:#94a3b8; flex:1; }
  #terminal-container { position:absolute; top:40px; left:0; right:0; bottom:0; }
  .xterm-viewport { overflow-y:auto !important; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
</style>
</head>
<body>
<div id="toolbar">
  <span id="dot"></span>
  <span id="status">Carregando xterm...</span>
  <span style="font-size:10px;color:#475569;margin-left:auto">bash · Linux</span>
</div>
<div id="terminal-container"></div>
<script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js"></script>
<script>
(function() {
  const WS_URL = "${wsUrl}";
  const dot = document.getElementById('dot');
  const statusEl = document.getElementById('status');
  let ws = null;
  let term = null;
  let fitAddon = null;
  let sessionN = 0;

  function setState(s, msg) {
    dot.className = s;
    statusEl.textContent = msg;
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'state',state:s,msg}));
  }

  function initTerm() {
    if (term) { term.dispose(); }
    term = new Terminal({
      theme: {
        background:'#0f172a', foreground:'#e2e8f0', cursor:'#a78bfa',
        cursorAccent:'#0f172a', selectionBackground:'#4c1d9580',
        black:'#1e293b', brightBlack:'#475569',
        red:'#ef4444', brightRed:'#f87171',
        green:'#22c55e', brightGreen:'#4ade80',
        yellow:'#eab308', brightYellow:'#facc15',
        blue:'#3b82f6', brightBlue:'#60a5fa',
        magenta:'#a855f7', brightMagenta:'#c084fc',
        cyan:'#06b6d4', brightCyan:'#22d3ee',
        white:'#e2e8f0', brightWhite:'#f8fafc',
      },
      fontFamily:"'Fira Code','Cascadia Code','Consolas',monospace",
      fontSize: 13, lineHeight: 1.4,
      cursorBlink: true, cursorStyle:'block',
      scrollback: 5000, allowProposedApi: true,
    });
    fitAddon = new FitAddon.FitAddon();
    const webLinks = new WebLinksAddon.WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinks);
    const container = document.getElementById('terminal-container');
    term.open(container);
    try { fitAddon.fit(); } catch(e) {}

    term.onData(data => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
    });
    term.onResize(({cols,rows}) => {
      if (ws && ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({type:'resize',cols,rows}));
    });

    const ro = new ResizeObserver(() => { try { fitAddon.fit(); } catch(e) {} });
    ro.observe(container);

    term.writeln('\\x1b[35m╔══════════════════════════════════════╗\\x1b[0m');
    term.writeln('\\x1b[35m║   \\x1b[1;37mDevMobile — Terminal Linux\\x1b[0m\\x1b[35m         ║\\x1b[0m');
    term.writeln('\\x1b[35m╚══════════════════════════════════════╝\\x1b[0m');
    term.writeln('\\x1b[90mConectando ao servidor...\\x1b[0m\\r');
  }

  function connect() {
    if (ws) { try { ws.close(); } catch(e) {} }
    setState('connecting', 'Conectando...');
    sessionN++;

    ws = new WebSocket(WS_URL);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setState('connected', 'Conectado — sessão #' + sessionN);
      term.writeln('\\x1b[32m[✓ Terminal Linux ativo — sessão #' + sessionN + ']\\x1b[0m\\r');
      try {
        fitAddon.fit();
        ws.send(JSON.stringify({type:'resize',cols:term.cols,rows:term.rows}));
      } catch(e) {}
    };

    ws.onmessage = ev => {
      if (ev.data instanceof ArrayBuffer) term.write(new Uint8Array(ev.data));
      else term.write(ev.data);
    };

    ws.onerror = () => {
      setState('error', 'Erro WebSocket — servidor acessível?');
      term.writeln('\\r\\n\\x1b[31m[✗ Erro de conexão. Configure o servidor em Configurações.]\\x1b[0m\\r');
    };

    ws.onclose = e => {
      setState('disconnected', 'Desconectado (cod ' + e.code + ')');
      term.writeln('\\r\\n\\x1b[90m[Sessão encerrada]\\x1b[0m\\r');
    };
  }

  // Recebe mensagens do React Native (ex: 'reconnect', 'cmd:...')
  document.addEventListener('message', ev => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'reconnect') connect();
      if (msg.type === 'cmd' && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(msg.data + '\\n');
      }
    } catch(e) {}
  });

  // Init
  initTerm();
  connect();
})();
</script>
</body>
</html>`;
}

interface XTermWebViewProps {
  style?: object;
  onClose?: () => void;
}

export default function XTermWebView({ style, onClose }: XTermWebViewProps) {
  const colors = useColors();
  const apiBase = useApiBase();
  const webViewRef = useRef<WebView>(null);
  const [wsState, setWsState] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");

  const wsUrl = apiBase ? toWsUrl(apiBase) : "";
  const htmlContent = wsUrl ? buildHtml(wsUrl) : "";

  const handleMessage = useCallback((ev: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(ev.nativeEvent.data);
      if (msg.type === "state") {
        setWsState(msg.state as any);
      }
    } catch {}
  }, []);

  const reconnect = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type: "reconnect" }));
  };

  const stateColor = {
    connecting: "#facc15",
    connected: "#4ade80",
    disconnected: "#64748b",
    error: "#f87171",
  }[wsState];

  const stateLabel = {
    connecting: "Conectando...",
    connected: "Conectado",
    disconnected: "Desconectado",
    error: "Erro",
  }[wsState];

  if (!apiBase) {
    return (
      <View style={[styles.noServer, { backgroundColor: colors.background }]}>
        <Feather name="alert-triangle" size={32} color="#f59e0b" />
        <Text style={[styles.noServerTitle, { color: colors.foreground }]}>
          Servidor não configurado
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 8, paddingHorizontal: 20 }}>
          O Terminal Linux real precisa de um servidor.{"\n"}
          Configure o endereço em{" "}
          <Text style={{ color: colors.primary, fontWeight: "700" }}>Configurações → API</Text>.{"\n\n"}
          Você pode usar o terminal <Text style={{ color: colors.accent, fontWeight: "700" }}>local (JS/SQL)</Text> sem servidor.
        </Text>
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.foreground, fontWeight: "700" }}>← Voltar ao terminal local</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Toolbar React Native sobre o WebView */}
      <View style={[styles.toolbar, { backgroundColor: "#1e293b", borderBottomColor: "#334155" }]}>
        <View style={[styles.dot, { backgroundColor: stateColor }]} />
        <Text style={styles.statusText}>{stateLabel}</Text>
        <Text style={styles.urlText} numberOfLines={1}>{wsUrl.replace("wss://", "").replace("ws://", "").slice(0, 30)}</Text>
        <TouchableOpacity onPress={reconnect} style={styles.reconnectBtn}>
          <Feather name="refresh-cw" size={13} color="#94a3b8" />
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.reconnectBtn}>
            <Feather name="x" size={15} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {wsState === "connecting" && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color="#a78bfa" size="small" />
          <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>Carregando xterm.js...</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        style={{ flex: 1, backgroundColor: "#0f172a" }}
        originWhitelist={["*"]}
        source={{ html: htmlContent, baseUrl: "https://cdn.jsdelivr.net" }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mediaPlaybackRequiresUserAction={false}
        onError={() => setWsState("error")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { fontSize: 11, color: "#94a3b8", minWidth: 80 },
  urlText: { fontSize: 10, color: "#475569", flex: 1 },
  reconnectBtn: { padding: 4 },
  loadingOverlay: {
    position: "absolute",
    top: 40, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    zIndex: 10,
  },
  noServer: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 12,
  },
  noServerTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  closeBtn: {
    marginTop: 16, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
});
