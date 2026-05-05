import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { APKBuilderModal } from "@/components/APKBuilderModal";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 80;

interface CheckItem {
  id: string;
  label: string;
  description: string;
  status: "pass" | "fail" | "warn" | "skip" | "pending";
  detail?: string;
}

const TOOLS = [
  {
    name: "Bubblewrap (Google)",
    url: "https://github.com/GoogleChromeLabs/bubblewrap",
    desc: "Ferramenta oficial para converter PWA em APK/AAB com TWA (Trusted Web Activity). Gratuito, open-source.",
    icon: "package" as const,
  },
  {
    name: "PWA Builder (Microsoft)",
    url: "https://www.pwabuilder.com",
    desc: "Cole a URL do seu site, valida a PWA e gera APK, AAB, MSIX e IPA. Mais fácil que Bubblewrap.",
    icon: "globe" as const,
  },
  {
    name: "PWA2APK",
    url: "https://pwa2apk.com",
    desc: "Converte PWA em APK simples. Ideal para testes rápidos.",
    icon: "smartphone" as const,
  },
  {
    name: "GoNative.io",
    url: "https://gonative.io",
    desc: "Converte qualquer site em app nativo Android/iOS com funcionalidades extras (push, câmera, GPS).",
    icon: "arrow-right-circle" as const,
  },
];

const REQUIRED_CHECKS: Omit<CheckItem, "status" | "detail">[] = [
  { id: "https", label: "HTTPS", description: "O site deve servir via HTTPS (obrigatório para PWA)." },
  { id: "manifest", label: "Web App Manifest", description: "Deve existir um arquivo manifest.json ou manifest.webmanifest linkado no HTML." },
  { id: "sw", label: "Service Worker", description: "Deve registrar um service worker para cache offline." },
  { id: "icons", label: "Ícones 192x192 e 512x512", description: "O manifest deve ter ícones PNG de pelo menos 192px e 512px." },
  { id: "name", label: "name e short_name", description: "O manifest deve ter 'name' e 'short_name' definidos." },
  { id: "start_url", label: "start_url", description: "O manifest deve ter 'start_url' definido." },
  { id: "display", label: "display: standalone/fullscreen", description: "O manifest deve ter display='standalone' ou 'fullscreen' para instalar como app." },
  { id: "maskable", label: "Ícone maskable", description: "Recomendado: ícone com purpose='maskable' para ícone adaptativo no Android." },
  { id: "theme_color", label: "theme_color", description: "Define a cor da barra de status no Android." },
  { id: "background_color", label: "background_color", description: "Cor de fundo da tela de splash." },
  { id: "description", label: "description", description: "Descrição do app no manifest." },
];

export default function PwaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [apkBuilderVisible, setApkBuilderVisible] = useState(false);

  const validatePWA = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    const rawUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;

    setLoading(true);
    setError(null);
    setChecks([]);
    setScore(null);
    setSummary(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const results: CheckItem[] = REQUIRED_CHECKS.map((c) => ({
      ...c,
      status: "pending",
    }));
    setChecks([...results]);

    try {
      // 1. Busca o HTML
      const htmlRes = await fetch(rawUrl, {
        headers: { "User-Agent": "Mozilla/5.0 DevMobile-PWA-Checker/1.0" },
      });
      const htmlText = await htmlRes.text();
      const finalUrl = htmlRes.url || rawUrl;

      const update = (id: string, status: CheckItem["status"], detail?: string) => {
        results.forEach((r) => { if (r.id === id) { r.status = status; if (detail) r.detail = detail; } });
        setChecks([...results]);
      };

      // HTTPS
      if (finalUrl.startsWith("https://") || rawUrl.startsWith("https://")) {
        update("https", "pass", `URL: ${finalUrl}`);
      } else {
        update("https", "fail", "Serve via HTTP — troque para HTTPS antes de publicar.");
      }

      // Manifest link no HTML
      const manifestMatch = htmlText.match(/<link[^>]+rel=["'][^"']*manifest[^"']*["'][^>]*>/i);
      let manifestUrl: string | null = null;
      let manifest: Record<string, unknown> | null = null;

      if (manifestMatch) {
        const hrefMatch = manifestMatch[0].match(/href=["']([^"']+)["']/i);
        if (hrefMatch) {
          try {
            const base = new URL(finalUrl);
            manifestUrl = new URL(hrefMatch[1], base).href;
            const mRes = await fetch(manifestUrl);
            if (mRes.ok) {
              manifest = await mRes.json();
              update("manifest", "pass", `Encontrado: ${manifestUrl}`);
            } else {
              update("manifest", "fail", `manifest linkado mas retornou HTTP ${mRes.status}`);
            }
          } catch {
            update("manifest", "fail", "Erro ao buscar o manifest.json");
          }
        }
      } else {
        // Tenta /manifest.json diretamente
        try {
          const base = new URL(finalUrl);
          const guess = new URL("/manifest.json", base).href;
          const mRes = await fetch(guess);
          if (mRes.ok) {
            manifest = await mRes.json();
            manifestUrl = guess;
            update("manifest", "warn", `Manifest não linkado no HTML mas encontrado em ${guess}`);
          } else {
            update("manifest", "fail", "Nenhum <link rel=manifest> no HTML e /manifest.json não encontrado.");
          }
        } catch {
          update("manifest", "fail", "Nenhum <link rel=manifest> no HTML.");
        }
      }

      // Service Worker
      const swMatch = htmlText.match(/serviceWorker|registerServiceWorker|navigator\.serviceWorker/i);
      if (swMatch) {
        update("sw", "pass", "Registro de service worker detectado no HTML.");
      } else {
        // Tenta /sw.js ou /service-worker.js
        try {
          const base = new URL(finalUrl);
          const swUrls = ["/sw.js", "/service-worker.js", "/serviceworker.js", "/sw-prod.js"];
          let found = false;
          for (const p of swUrls) {
            const r = await fetch(new URL(p, base).href, { method: "HEAD" });
            if (r.ok) { update("sw", "warn", `Service worker não registrado no HTML, mas arquivo ${p} existe.`); found = true; break; }
          }
          if (!found) update("sw", "fail", "Service worker não encontrado. Crie e registre um para cache offline.");
        } catch {
          update("sw", "fail", "Não foi possível verificar service worker.");
        }
      }

      if (manifest) {
        const m = manifest as Record<string, unknown>;

        // Icons
        const icons = Array.isArray(m.icons) ? m.icons as Array<Record<string, unknown>> : [];
        const has192 = icons.some((ic) => String(ic.sizes || "").includes("192"));
        const has512 = icons.some((ic) => String(ic.sizes || "").includes("512"));
        if (has192 && has512) {
          update("icons", "pass", `${icons.length} ícone(s) definido(s) incluindo 192x192 e 512x512.`);
        } else if (has192 || has512) {
          update("icons", "warn", `Tem ${icons.length} ícone(s) mas faltam tamanhos: ${!has192 ? "192x192 " : ""}${!has512 ? "512x512" : ""}`);
        } else {
          update("icons", "fail", "Nenhum ícone 192x192 ou 512x512 no manifest.");
        }

        // name e short_name
        if (m.name && m.short_name) {
          update("name", "pass", `name: "${m.name}", short_name: "${m.short_name}"`);
        } else if (m.name) {
          update("name", "warn", `name: "${m.name}" — falta short_name (máx 12 chars recomendado).`);
        } else {
          update("name", "fail", "Faltam 'name' e 'short_name' no manifest.");
        }

        // start_url
        if (m.start_url) {
          update("start_url", "pass", `start_url: "${m.start_url}"`);
        } else {
          update("start_url", "fail", "Falta 'start_url' no manifest. Use '/' se for a raiz.");
        }

        // display
        const display = String(m.display || "");
        if (display === "standalone" || display === "fullscreen" || display === "minimal-ui") {
          update("display", "pass", `display: "${display}" ✓`);
        } else if (!display) {
          update("display", "fail", "Falta 'display' no manifest. Use \"standalone\" para instalar como app.");
        } else {
          update("display", "warn", `display: "${display}" — use "standalone" ou "fullscreen" para melhor experiência.`);
        }

        // maskable
        const hasMaskable = icons.some((ic) => String(ic.purpose || "").includes("maskable"));
        update("maskable", hasMaskable ? "pass" : "warn",
          hasMaskable ? "Ícone maskable presente ✓" : 'Sem ícone maskable. Adicione purpose: "maskable" para ícone adaptativo no Android.');

        // theme_color
        update("theme_color", m.theme_color ? "pass" : "warn",
          m.theme_color ? `theme_color: "${m.theme_color}"` : "Sem theme_color. Recomendado para barra de status do Android.");

        // background_color
        update("background_color", m.background_color ? "pass" : "warn",
          m.background_color ? `background_color: "${m.background_color}"` : "Sem background_color. Recomendado para tela de splash.");

        // description
        update("description", m.description ? "pass" : "warn",
          m.description ? `description: "${m.description}"` : "Sem description no manifest.");
      } else {
        ["icons", "name", "start_url", "display", "maskable", "theme_color", "background_color", "description"].forEach((id) =>
          update(id, "skip", "Manifest não disponível para verificar.")
        );
      }

      // Calcula score
      const pass = results.filter((r) => r.status === "pass").length;
      const fail = results.filter((r) => r.status === "fail").length;
      const total = results.filter((r) => r.status !== "skip").length;
      const sc = Math.round((pass / total) * 100);
      setScore(sc);

      const failItems = results.filter((r) => r.status === "fail").map((r) => r.label);
      if (sc === 100) {
        setSummary("✅ PWA perfeita! Pronta para converter em APK com PWABuilder ou Bubblewrap.");
      } else if (sc >= 75) {
        setSummary(`⚠️ Quase lá! Corrija: ${failItems.join(", ")} e tente converter.`);
      } else if (fail > 0) {
        setSummary(`❌ Faltam itens obrigatórios: ${failItems.join(", ")}. Corrija antes de converter.`);
      } else {
        setSummary("🔶 Alguns itens recomendados estão faltando. O APK pode funcionar, mas com limitações.");
      }
    } catch (e) {
      setError(
        `Não foi possível acessar "${rawUrl}".\n\n` +
        `• Verifique se a URL está correta\n` +
        `• O site pode bloquear requisições de outras origens (CORS)\n` +
        `• Tente acessar pelo PWABuilder: pwabuilder.com\n\n` +
        `Erro: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setLoading(false);
    }
  }, [url]);

  const statusIcon = (s: CheckItem["status"]) => {
    if (s === "pass") return { icon: "check-circle" as const, color: "#22c55e" };
    if (s === "fail") return { icon: "x-circle" as const, color: "#ef4444" };
    if (s === "warn") return { icon: "alert-circle" as const, color: "#f59e0b" };
    if (s === "skip") return { icon: "minus-circle" as const, color: "#6b7280" };
    return { icon: "loader" as const, color: colors.mutedForeground };
  };

  const scoreColor = score === null ? colors.foreground : score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <APKBuilderModal visible={apkBuilderVisible} onClose={() => setApkBuilderVisible(false)} />

      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>PWA → APK</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Valide seu site antes de converter</Text>
        </View>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setApkBuilderVisible(true); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#6366f1", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Feather name="cpu" size={14} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>APK Builder</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* APK Builder banner */}
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setApkBuilderVisible(true); }}
          activeOpacity={0.85}
          style={{ borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#6366f144", backgroundColor: "#6366f111" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 24 }}>🤖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#f1f5f9", fontSize: 15, fontWeight: "800" }}>APK Builder — Importar e compilar</Text>
              <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                Importe ZIP, TAR.GZ ou repositório GitHub, gere um projeto Android nativo com WebView + CI automático no GitHub Actions.
              </Text>
            </View>
            <Feather name="arrow-right" size={18} color="#6366f1" />
          </View>
        </TouchableOpacity>

        {/* URL input */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>URL do seu site</Text>
          <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Feather name="globe" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="meusite.com ou https://meusite.com"
              placeholderTextColor={colors.mutedForeground}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={validatePWA}
            />
            {url.length > 0 && (
              <TouchableOpacity onPress={() => setUrl("")}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
            onPress={validatePWA}
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="zap" size={16} color="#fff" />
            )}
            <Text style={styles.btnText}>{loading ? "Validando..." : "Validar PWA"}</Text>
          </TouchableOpacity>
        </View>

        {/* Erro de acesso */}
        {error && (
          <View style={[styles.card, { backgroundColor: "#ef444420", borderColor: "#ef4444" }]}>
            <Text style={[styles.sectionTitle, { color: "#ef4444" }]}>Erro ao acessar o site</Text>
            <Text style={{ color: "#ef4444", fontSize: 13, lineHeight: 20 }}>{error}</Text>
          </View>
        )}

        {/* Score */}
        {score !== null && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center" }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pontuação PWA</Text>
            <Text style={[styles.score, { color: scoreColor }]}>{score}%</Text>
            {summary && <Text style={[styles.summaryText, { color: colors.foreground }]}>{summary}</Text>}
          </View>
        )}

        {/* Checklist */}
        {checks.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Checklist PWA</Text>
            {checks.map((item) => {
              const { icon, color } = statusIcon(item.status);
              return (
                <View key={item.id} style={[styles.checkRow, { borderBottomColor: colors.border }]}>
                  <Feather name={icon} size={18} color={color} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.checkLabel, { color: colors.foreground }]}>{item.label}</Text>
                    <Text style={[styles.checkDesc, { color: colors.mutedForeground }]}>{item.description}</Text>
                    {item.detail && (
                      <Text style={[styles.checkDetail, { color: item.status === "fail" ? "#ef4444" : item.status === "pass" ? "#22c55e" : "#f59e0b" }]}>
                        {item.detail}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Ferramentas de conversão */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ferramentas para converter em APK</Text>
          <Text style={[styles.toolsIntro, { color: colors.mutedForeground }]}>
            Depois de validar a PWA, use uma dessas ferramentas para gerar o APK/AAB:
          </Text>
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.name}
              style={[styles.toolRow, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL(tool.url);
              }}
            >
              <View style={[styles.toolIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name={tool.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toolName, { color: colors.foreground }]}>{tool.name}</Text>
                <Text style={[styles.toolDesc, { color: colors.mutedForeground }]}>{tool.desc}</Text>
                <Text style={[styles.toolUrl, { color: colors.primary }]}>{tool.url}</Text>
              </View>
              <Feather name="external-link" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── TWA: PWA → APK em 3 passos ── */}
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: "#22c55e40", backgroundColor: "#052e16", padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18 }}>🚀</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#f0fdf4", fontSize: 15, fontWeight: "800" }}>PWA → TWA → APK</Text>
              <Text style={{ color: "#86efac", fontSize: 11 }}>Trusted Web Activity — método mais rápido</Text>
            </View>
          </View>

          {/* Botão principal PWABuilder */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Linking.openURL("https://www.pwabuilder.com"); }}
            style={{ backgroundColor: "#22c55e", borderRadius: 10, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
          >
            <Text style={{ fontSize: 16 }}>🏗️</Text>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Abrir PWABuilder</Text>
            <Feather name="external-link" size={14} color="#ffffff99" />
          </TouchableOpacity>

          <Text style={{ color: "#86efac", fontSize: 12, textAlign: "center" }}>
            Cole a URL do seu site → clica "Package for Stores" → Android → baixa o APK/AAB pronto
          </Text>

          {/* Passos rápidos */}
          {[
            { n: "1", t: "Valide a PWA acima", d: "Score mínimo 80 para PWABuilder aceitar a URL." },
            { n: "2", t: "PWABuilder → Package for Stores → Android", d: "Clique no botão acima, cole a URL, gera AAB ou APK assinado gratuitamente." },
            { n: "3", t: "Instale o APK no Android", d: "Baixe o .apk, ative 'Fontes desconhecidas' em Configurações → Segurança, abra o arquivo." },
            { n: "4", t: "Publique na Play Store (opcional)", d: "Use o .aab gerado para envio na Google Play Console." },
          ].map((step) => (
            <View key={step.n} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{step.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#f0fdf4", fontSize: 13, fontWeight: "700" }}>{step.t}</Text>
                <Text style={{ color: "#86efac", fontSize: 11, lineHeight: 16, marginTop: 2 }}>{step.d}</Text>
              </View>
            </View>
          ))}

          {/* Instalar APK direto no Android */}
          <View style={{ borderTopWidth: 1, borderTopColor: "#22c55e30", paddingTop: 10, gap: 6 }}>
            <Text style={{ color: "#86efac", fontSize: 12, fontWeight: "700" }}>📲 Instalar APK direto no Android</Text>
            {[
              { label: "Ativar 'Fontes desconhecidas'", url: "https://support.google.com/android/answer/9217471", icon: "unlock" as const },
              { label: "APKMirror — instalar via browser", url: "https://www.apkmirror.com", icon: "download" as const },
              { label: "SAI (Split APKs Installer)", url: "https://github.com/Aefyr/SAI", icon: "package" as const },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(item.url); }}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, backgroundColor: "#0f3d1f", borderWidth: 1, borderColor: "#22c55e25" }}
              >
                <Feather name={item.icon} size={13} color="#22c55e" />
                <Text style={{ color: "#86efac", fontSize: 12, flex: 1 }}>{item.label}</Text>
                <Feather name="external-link" size={11} color="#22c55e55" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Como funciona */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Como funciona a conversão</Text>
          {[
            { n: "1", t: "Crie seu site como PWA", d: "Deve ter HTTPS, manifest.json, service worker e ícones." },
            { n: "2", t: "Valide aqui", d: "Use o validador acima para checar o que está faltando." },
            { n: "3", t: "Use PWABuilder ou Bubblewrap", d: "Cole a URL e gere o APK/AAB com um clique." },
            { n: "4", t: "Assine e publique", d: "Faça upload do AAB na Google Play Store ou distribua o APK direto." },
          ].map((step) => (
            <View key={step.n} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumText}>{step.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>{step.t}</Text>
                <Text style={[styles.stepDesc, { color: colors.mutedForeground }]}>{step.d}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* APK Nativo via WebView — opção extra */}
        <View style={[styles.card, { backgroundColor: "#0f172a", borderColor: "#6366f144" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 16 }}>📦</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: "#e2e8f0" }]}>APK Nativo via WebView (sem loja)</Text>
          </View>
          <Text style={{ color: "#94a3b8", fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
            Cria um app Android real que carrega seu site em WebView nativo. Ideal para hospedar um site/PWA existente como app instalável sem precisar da Google Play.
          </Text>
          {[
            { icon: "⚖️", title: "Template Assistente Jurídico", desc: "WebView wrapper com URL configurável, botão voltar Android, tela de erro e FAB de configurações. EAS já configurado para maikons-individual-orga2.", badge: "EAS PRONTO", action: () => Linking.openURL("devmobile://projetos") },
            { icon: "🌐", title: "Template WebView Genérico", desc: "Qualquer URL vira APK. Substitua a URL no App.tsx e compile via EAS.", badge: "EXPO", action: () => Linking.openURL("https://snack.expo.dev") },
            { icon: "🔧", title: "Compilar com EAS via terminal", desc: "No terminal do app: EAS_NO_VCS=1 eas build --platform android --profile preview", badge: "TERMINAL", action: null },
          ].map((item) => (
            <TouchableOpacity
              key={item.title}
              onPress={() => item.action ? (Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), item.action()) : null}
              activeOpacity={item.action ? 0.7 : 1}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, backgroundColor: "#1e293b", marginBottom: 6, borderWidth: 1, borderColor: "#334155" }}
            >
              <Text style={{ fontSize: 22, lineHeight: 28 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <Text style={{ color: "#f1f5f9", fontSize: 13, fontWeight: "700" }}>{item.title}</Text>
                  <View style={{ backgroundColor: "#6366f1", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{item.badge}</Text>
                  </View>
                </View>
                <Text style={{ color: "#94a3b8", fontSize: 11, lineHeight: 16 }}>{item.desc}</Text>
              </View>
              {item.action && <Feather name="chevron-right" size={16} color="#64748b" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Capacidades do arquivo */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>📊 Capacidades do DevMobile</Text>
          {[
            { label: "Arquivos por projeto", value: "50.000+ arquivos", icon: "file", color: "#10b981" },
            { label: "Formatos de importação", value: "ZIP, TAR, TAZ, TGZ, Git Clone", icon: "download", color: "#3b82f6" },
            { label: "Formatos de exportação", value: "ZIP, compartilhamento direto", icon: "upload", color: "#f59e0b" },
            { label: "Compilação APK", value: "EAS Build (Expo) + PWA→APK", icon: "cpu", color: "#8b5cf6" },
            { label: "Terminal", value: "Linux real via servidor, Termux local", icon: "terminal", color: "#ef4444" },
            { label: "IA integrada", value: "Gemini, GPT, Claude, DeepSeek", icon: "zap", color: "#6366f1" },
          ].map((cap) => (
            <View key={cap.label} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: cap.color + "22", alignItems: "center", justifyContent: "center" }}>
                <Feather name={cap.icon as never} size={15} color={cap.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>{cap.label}</Text>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{cap.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  headerSub: { fontSize: 13, marginTop: 2 },
  content: { padding: 16, gap: 14 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 14 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  score: { fontSize: 64, fontWeight: "900", lineHeight: 72 },
  summaryText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  checkRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkLabel: { fontSize: 14, fontWeight: "600" },
  checkDesc: { fontSize: 12, marginTop: 2, lineHeight: 18 },
  checkDetail: { fontSize: 12, marginTop: 4, fontWeight: "500" },
  toolsIntro: { fontSize: 13, lineHeight: 18 },
  toolRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  toolIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toolName: { fontSize: 14, fontWeight: "700" },
  toolDesc: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  toolUrl: { fontSize: 11, marginTop: 4 },
  stepRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  stepTitle: { fontSize: 14, fontWeight: "600" },
  stepDesc: { fontSize: 12, lineHeight: 18, marginTop: 2 },
});
