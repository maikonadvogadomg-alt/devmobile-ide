import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const QUICK_LINKS = [
  { label: "YouTube", url: "https://m.youtube.com", icon: "▶" },
  { label: "Google", url: "https://www.google.com", icon: "🔍" },
  { label: "GitHub", url: "https://github.com", icon: "🐙" },
  { label: "ChatGPT", url: "https://chat.openai.com", icon: "🤖" },
  { label: "Reddit", url: "https://m.reddit.com", icon: "📱" },
  { label: "Dev.to", url: "https://dev.to", icon: "💻" },
];

function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) return "https://www.google.com";
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.includes(".") && !t.includes(" ")) return `https://${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}

export default function BrowserScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);

  const [url, setUrl] = useState("https://m.youtube.com");
  const [inputText, setInputText] = useState("m.youtube.com");
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const navigate = useCallback((target: string) => {
    const finalUrl = normalizeUrl(target);
    setUrl(finalUrl);
    setInputText(finalUrl.replace(/^https?:\/\//, ""));
    setLoading(true);
    Keyboard.dismiss();
  }, []);

  const handleSubmit = () => navigate(inputText);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* URL bar */}
      <View style={[styles.bar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => canGoBack && webRef.current?.goBack()}
          style={[styles.navBtn, !canGoBack && { opacity: 0.35 }]}
        >
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => canGoForward && webRef.current?.goForward()}
          style={[styles.navBtn, !canGoForward && { opacity: 0.35 }]}
        >
          <Feather name="chevron-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => webRef.current?.reload()}
          style={styles.navBtn}
        >
          <Feather name={loading ? "x" : "refresh-cw"} size={16} color={colors.foreground} />
        </TouchableOpacity>

        <View style={[styles.urlBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Feather name="globe" size={13} color={colors.mutedForeground} style={{ marginRight: 6 }} />
          <TextInput
            style={[styles.urlInput, { color: colors.foreground }]}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSubmit}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            selectTextOnFocus
            placeholderTextColor={colors.mutedForeground}
            placeholder="Pesquisar ou digitar URL..."
          />
          {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 4 }} />}
        </View>
      </View>

      {/* Quick links */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.quickRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 10, gap: 8, alignItems: "center" }}
      >
        {QUICK_LINKS.map((q) => (
          <TouchableOpacity
            key={q.url}
            style={[styles.quickBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => navigate(q.url)}
          >
            <Text style={styles.quickIcon}>{q.icon}</Text>
            <Text style={[styles.quickLabel, { color: colors.foreground }]}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* WebView */}
      {Platform.OS === "web" ? (
        <iframe
          src={url}
          style={{ flex: 1, border: "none", width: "100%", height: "100%" } as any}
          onLoad={() => setLoading(false)}
        />
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: url }}
          style={styles.webview}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          setSupportMultipleWindows={false}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          mixedContentMode="always"
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(state) => {
            setCanGoBack(state.canGoBack);
            setCanGoForward(state.canGoForward);
            if (state.url && state.url !== "about:blank") {
              setInputText(state.url.replace(/^https?:\/\//, ""));
            }
          }}
          onError={() => setLoading(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  navBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  urlBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 36,
  },
  urlInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  quickRow: {
    maxHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  quickIcon: { fontSize: 12 },
  quickLabel: { fontSize: 11, fontWeight: "600" },
  webview: { flex: 1 },
});
