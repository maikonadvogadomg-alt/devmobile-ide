import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { Paths, File as FSFile } from "expo-file-system/next";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as Speech from "expo-speech";
import { fetch } from "expo/fetch";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useApiBase } from "@/hooks/useApiBase";

// ── Types ──────────────────────────────────────────────────────────────────
interface CLMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ── Provider detection (same as AIChat) ────────────────────────────────────
const AUTO_DETECT: [string, string, string, string][] = [
  ["gsk_",   "https://api.groq.com/openai/v1",                           "llama-3.3-70b-versatile",  "Groq"],
  ["sk-or-", "https://openrouter.ai/api/v1",                             "openai/gpt-4o-mini",       "OpenRouter"],
  ["pplx-",  "https://api.perplexity.ai",                                "sonar-pro",                "Perplexity (🌐 Web)"],
  ["AIza",   "https://generativelanguage.googleapis.com/v1beta/openai/", "gemini-2.0-flash",         "Google Gemini"],
  ["xai-",   "https://api.x.ai/v1",                                      "grok-2-latest",            "xAI / Grok"],
  ["sk-ant", "https://api.anthropic.com/v1",                             "claude-haiku-4-20250514",  "Anthropic"],
  ["sk-",    "https://api.openai.com/v1",                                "gpt-4o-mini",              "OpenAI"],
];

function detectProvider(key: string) {
  const k = (key || "").trim();
  for (const [prefix, url, model, name] of AUTO_DETECT) {
    if (k.startsWith(prefix)) return { url, model, name };
  }
  return null;
}

function isPerplexity(key: string) {
  return key.trim().startsWith("pplx-");
}

// ── Link detection ─────────────────────────────────────────────────────────
const URL_REGEX = /(https?:\/\/[^\s\)\]\>\"\']+)/g;

function TextWithLinks({ text, textStyle }: { text: string; textStyle: object }) {
  const parts: { type: "text" | "link"; value: string }[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    parts.push({ type: "link", value: match[1] });
    last = match.index + match[1].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return (
    <Text style={textStyle} selectable>
      {parts.map((p, i) =>
        p.type === "link" ? (
          <Text
            key={i}
            style={{ color: "#60a5fa", textDecorationLine: "underline" }}
            onPress={() => Linking.openURL(p.value).catch(() => Alert.alert("Erro", "Não foi possível abrir o link"))}
          >
            {p.value}
          </Text>
        ) : (
          <Text key={i}>{p.value}</Text>
        )
      )}
    </Text>
  );
}

// ── Code block ─────────────────────────────────────────────────────────────
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View style={clStyles.codeWrap}>
      <View style={clStyles.codeHeader}>
        <Feather name="code" size={11} color="#00d4aa" />
        <Text style={{ color: "#00d4aa", fontSize: 11, fontWeight: "700", flex: 1, marginLeft: 5 }}>{language || "código"}</Text>
        <TouchableOpacity onPress={handleCopy} style={[clStyles.copyBtn, { backgroundColor: copied ? "#10b98122" : "#ffffff12", borderColor: copied ? "#10b98144" : "#ffffff22" }]}>
          <Feather name={copied ? "check" : "copy"} size={11} color={copied ? "#10b981" : "#aaa"} />
          <Text style={{ color: copied ? "#10b981" : "#aaa", fontSize: 11, fontWeight: "600" }}>{copied ? "Copiado!" : "Copiar"}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text selectable style={clStyles.codeText}>{code}</Text>
      </ScrollView>
    </View>
  );
}

// ── Message renderer ───────────────────────────────────────────────────────
function CLMessageRenderer({ content, isUser }: { content: string; isUser: boolean }) {
  const textColor = isUser ? "#fff" : "#e2e8f0";
  const segments: { type: "text" | "code"; value: string; lang?: string }[] = [];
  const codeRx = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = codeRx.exec(content)) !== null) {
    if (m.index > last) segments.push({ type: "text", value: content.slice(last, m.index) });
    segments.push({ type: "code", value: m[2].trim(), lang: m[1] });
    last = m.index + m[0].length;
  }
  if (last < content.length) segments.push({ type: "text", value: content.slice(last) });

  return (
    <View style={{ gap: 5 }}>
      {segments.map((s, i) =>
        s.type === "code" ? (
          <CodeBlock key={i} code={s.value} language={s.lang || "código"} />
        ) : (
          <TextWithLinks
            key={i}
            text={s.value.replace(/^\n+/, "").replace(/\n+$/, "")}
            textStyle={{ color: textColor, fontSize: 14, lineHeight: 22 }}
          />
        )
      )}
    </View>
  );
}

// ── TTS helper ─────────────────────────────────────────────────────────────
function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, "código")
    .replace(/[*_~`#>]/g, "")
    .replace(URL_REGEX, "link");
}

let ttsActive = false;

interface TTSSettings { voiceId?: string | null; rate?: number; pitch?: number; }

async function speakText(text: string, settings?: TTSSettings): Promise<void> {
  return new Promise(resolve => {
    if (ttsActive) { Speech.stop(); ttsActive = false; resolve(); return; }
    ttsActive = true;
    Speech.speak(stripMarkdown(text), {
      language: "pt-BR",
      voice: settings?.voiceId ?? undefined,
      rate: settings?.rate ?? 1.0,
      pitch: settings?.pitch ?? 1.0,
      onDone: () => { ttsActive = false; resolve(); },
      onError: () => { ttsActive = false; resolve(); },
    });
  });
}

// ── System prompt ──────────────────────────────────────────────────────────
const CL_SYSTEM_PROMPT = `Você é uma assistente de IA no modo Campo Livre — sem restrições temáticas. 
Responda em português brasileiro. 
Quando o usuário pedir código, use blocos de código com \`\`\`.
Quando referenciar links, coloque a URL completa começando com https:// para que fiquem clicáveis.
Seja direto, útil e completo.`;

const PPLX_SYSTEM_PROMPT = `Você é uma assistente de IA com acesso à internet no modo Campo Livre.
Responda em português brasileiro.
Ao citar fontes, inclua as URLs completas (https://...) para que fiquem clicáveis.
Quando referenciar código, use blocos de código com \`\`\`.
Seja direto, útil e completo.`;

// ── Main component ─────────────────────────────────────────────────────────
export default function CampoLivreModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const apiBase = useApiBase() || "http://localhost:8080";

  const [messages, setMessages] = useState<CLMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const abortRef = useRef<boolean>(false);

  // ── TTS settings ──
  const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);

  const ttsSettings: TTSSettings = { voiceId: selectedVoiceId, rate: speechRate, pitch: 1.0 };

  useEffect(() => {
    Speech.getAvailableVoicesAsync()
      .then(voices => {
        const ptBR = voices.filter(v => v.language?.startsWith("pt") || v.language?.startsWith("en-"));
        setAvailableVoices(ptBR.length > 0 ? ptBR : voices.slice(0, 20));
      })
      .catch(() => {});
  }, []);

  const detected = detectProvider(apiKey);
  const providerName = detected?.name ?? "Cortesia (Gemini)";
  const isPplx = isPerplexity(apiKey);

  const doWebSearch = useCallback(async (query: string): Promise<string> => {
    try {
      setSearching(true);
      // DuckDuckGo direct API — no server required
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const r = await fetch(ddgUrl);
      if (!r.ok) return "";
      const data = await r.json();
      const results: string[] = [];
      // Abstract (summary)
      if (data.AbstractText) {
        const src = data.AbstractURL ? ` (${data.AbstractURL})` : "";
        results.push(`📌 ${data.AbstractText}${src}`);
      }
      // Related topics
      if (data.RelatedTopics?.length) {
        for (const t of data.RelatedTopics.slice(0, 6)) {
          if (t.Text && t.FirstURL) results.push(`• ${t.Text} (${t.FirstURL})`);
          else if (t.Topics) {
            for (const sub of t.Topics.slice(0, 3)) {
              if (sub.Text && sub.FirstURL) results.push(`• ${sub.Text} (${sub.FirstURL})`);
            }
          }
        }
      }
      // Answer (instant answer)
      if (data.Answer) results.push(`💡 ${data.Answer}`);
      if (!results.length) return "";
      return `\n\n🌐 Resultados da busca por "${query}":\n${results.join("\n")}`;
    } catch {
      return "";
    } finally {
      setSearching(false);
    }
  }, []);

  // Fetch URL content when user sends a message with URLs
  const fetchUrlContents = useCallback(async (msg: string): Promise<string> => {
    const urlRx = /https?:\/\/[^\s"'<>)]+/g;
    const urls = msg.match(urlRx);
    if (!urls?.length) return "";
    const fetched: string[] = [];
    for (const url of urls) {
      try {
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DevMobile/1.0)" } });
        if (!r.ok) continue;
        const ct = r.headers.get("content-type") ?? "";
        if (ct.includes("text/html") || ct.includes("text/plain") || ct.includes("application/json")) {
          const text = await r.text();
          // Strip HTML tags and trim
          const clean = text
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();
          if (clean.length > 50) fetched.push(`\n📄 Conteúdo de ${url}:\n${clean}`);
        }
      } catch {}
    }
    return fetched.join("\n");
  }, []);

  // ── Send message ──
  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: CLMessage = { id: Date.now() + "u", role: "user", content: msg };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);
    abortRef.current = false;

    // Auto-fetch URL contents when URLs are detected in message
    let urlContext = "";
    if (!isPplx) {
      urlContext = await fetchUrlContents(msg);
    }

    // Inject web search results if enabled
    let searchContext = "";
    if (webSearch && !isPplx) {
      searchContext = await doWebSearch(msg);
    }

    const aiMsg: CLMessage = { id: Date.now() + "a", role: "assistant", content: "" };
    setMessages([...history, aiMsg]);

    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      let url: string;
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: object;

      const baseSysPt = isPplx ? PPLX_SYSTEM_PROMPT : CL_SYSTEM_PROMPT;
      const extraCtx = [urlContext, searchContext].filter(Boolean).join("\n");
      const sysPt = extraCtx
        ? `${baseSysPt}\n\nUse os contextos fornecidos (conteúdo de URLs e/ou resultados de busca) para enriquecer sua resposta.`
        : baseSysPt;

      // Inject url/search context into last user message
      const messagesForAI = extraCtx
        ? history.map((m, i) =>
            i === history.length - 1
              ? { role: m.role, content: m.content + extraCtx }
              : { role: m.role, content: m.content }
          )
        : history.map(m => ({ role: m.role, content: m.content }));

      if (!apiKey.trim()) {
        // Cortesia via proxy
        url = `${apiBase}/api/ai/chat`;
        body = {
          messages: [
            { role: "system", content: sysPt },
            ...messagesForAI,
          ],
          stream: true,
        };
      } else if (detected) {
        const baseUrl = detected.url.replace(/\/$/, "");
        url = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
        headers["Authorization"] = `Bearer ${apiKey.trim()}`;
        body = {
          model: detected.model,
          messages: [
            { role: "system", content: sysPt },
            ...messagesForAI,
          ],
          stream: true,
          max_tokens: 16384,
          ...(isPplx ? {
            search_domain_filter: [],
            return_images: false,
            return_related_questions: false,
            search_recency_filter: "month",
          } : {}),
        };
      } else {
        setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: "❌ Chave de API não reconhecida. Verifique o formato." } : m));
        setLoading(false);
        return;
      }

      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.text().catch(() => res.status.toString());
        setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: `❌ Erro ${res.status}: ${err}` } : m));
        setLoading(false);
        return;
      }

      // Stream reading
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      if (!reader) throw new Error("Sem stream");

      while (true) {
        if (abortRef.current) { reader.cancel(); break; }
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          const trimmed = line.replace(/^data: /, "").trim();
          if (!trimmed || trimmed === "[DONE]") continue;
          try {
            const j = JSON.parse(trimmed);
            const delta = j.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: accumulated } : m));
            }
          } catch {}
        }
      }

      if (!accumulated) {
        setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: "(sem resposta)" } : m));
      } else if (autoSpeak && !abortRef.current) {
        setSpeaking(aiMsg.id);
        await speakText(accumulated, ttsSettings);
        setSpeaking(null);
      }
    } catch (e) {
      if (!abortRef.current) {
        setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: `❌ Erro: ${String(e)}` } : m));
      }
    } finally {
      setLoading(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, input, loading, apiKey, detected, isPplx, webSearch, doWebSearch, fetchUrlContents, autoSpeak, ttsSettings]);

  // ── Stop ──
  const stopGeneration = () => { abortRef.current = true; setLoading(false); };

  // ── Export conversation ──
  const exportConversation = async () => {
    if (messages.length === 0) { Alert.alert("Aviso", "Nenhuma conversa para exportar."); return; }
    const txt = messages.map(m => `${m.role === "user" ? "Você" : "IA"}: ${m.content}`).join("\n\n---\n\n");
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      const txtFile = new FSFile(Paths.cache, `campo_livre_${Date.now()}.txt`);
      txtFile.write(txt);
      await Sharing.shareAsync(txtFile.uri, { mimeType: "text/plain", dialogTitle: "Exportar conversa" });
    } else {
      await Clipboard.setStringAsync(txt);
      Alert.alert("Copiado!", "Conversa copiada para a área de transferência.");
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Copy all ──
  const copyAll = async () => {
    const txt = messages.map(m => `${m.role === "user" ? "Você" : "IA"}: ${m.content}`).join("\n\n");
    await Clipboard.setStringAsync(txt);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copiado!", "Toda a conversa foi copiada.");
  };

  // ── Import document ──
  const importDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/*", "application/pdf", "application/json", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const content = await new FSFile(asset.uri).text().catch(() => null);
      if (!content) { Alert.alert("Erro", "Não foi possível ler o arquivo. Tente um arquivo .txt."); return; }
      setInput(`Analise este documento (${asset.name}):\n\n${content}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Alert.alert("Erro", "Não foi possível importar o arquivo.");
    }
  };

  // ── TTS for a message ──
  const toggleSpeak = async (msgId: string, text: string) => {
    if (speaking === msgId) {
      Speech.stop();
      ttsActive = false;
      setSpeaking(null);
    } else {
      Speech.stop();
      ttsActive = false;
      setSpeaking(msgId);
      await speakText(text, ttsSettings);
      setSpeaking(null);
    }
  };

  // ── Clear chat ──
  const clearChat = () => {
    Alert.alert("Limpar conversa", "Apagar todas as mensagens?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Limpar", style: "destructive", onPress: () => { setMessages([]); Speech.stop(); setSpeaking(null); } },
    ]);
  };

  // ── Paste URL ──
  const pasteURL = async () => {
    const clip = await Clipboard.getStringAsync();
    if (clip.startsWith("http")) {
      sendMessage(`Pesquise e explique este link: ${clip}`);
    } else if (clip.trim()) {
      setInput(clip.trim());
    } else {
      Alert.alert("Área de transferência vazia");
    }
  };

  // ── Render message ──
  const renderMessage = ({ item }: { item: CLMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[clStyles.msgWrap, isUser ? clStyles.userWrap : clStyles.aiWrap]}>
        {!isUser && (
          <View style={clStyles.aiLabel}>
            <View style={clStyles.aiAvatar}>
              <Text style={{ fontSize: 13 }}>🤖</Text>
            </View>
            <Text style={{ color: "#7c3aed", fontSize: 11, fontWeight: "700" }}>
              {providerName}
              {isPplx ? " 🌐" : ""}
            </Text>
            {/* TTS + Copy buttons */}
            <TouchableOpacity onPress={() => toggleSpeak(item.id, item.content)} style={clStyles.iconBtn}>
              <Feather name={speaking === item.id ? "volume-x" : "volume-2"} size={13} color={speaking === item.id ? "#ef4444" : "#94a3b8"} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => { await Clipboard.setStringAsync(item.content); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert("Copiado!"); }}
              style={clStyles.iconBtn}
            >
              <Feather name="copy" size={13} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}
        <View style={[clStyles.bubble, isUser ? clStyles.userBubble : clStyles.aiBubble]}>
          <CLMessageRenderer content={item.content} isUser={isUser} />
        </View>
        {isUser && (
          <TouchableOpacity
            onPress={async () => { await Clipboard.setStringAsync(item.content); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
            style={clStyles.userCopyBtn}
          >
            <Feather name="copy" size={11} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const SUGGESTIONS = [
    "Pesquise as últimas notícias sobre IA",
    "Me explique como funciona o blockchain",
    "Escreva um e-mail profissional para...",
    "Qual é a capital da Finlândia?",
    "Me dê uma receita fácil de bolo",
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[clStyles.container, { backgroundColor: colors.background }]}>

        {/* ── Header ── */}
        <View style={[clStyles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={clStyles.iconBtnLg}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>💬 Campo Livre</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
              {providerName}{isPplx ? " • busca na internet 🌐" : ""}
            </Text>
          </View>
          {/* Configurar chave */}
          <TouchableOpacity onPress={() => setShowKeyInput(v => !v)} style={[clStyles.headerBtn, { backgroundColor: showKeyInput ? "#7c3aed22" : colors.secondary, borderColor: showKeyInput ? "#7c3aed55" : colors.border }]}>
            <Feather name="key" size={13} color={showKeyInput ? "#7c3aed" : colors.mutedForeground} />
            <Text style={{ color: showKeyInput ? "#7c3aed" : colors.mutedForeground, fontSize: 12, fontWeight: "600" }}>Chave</Text>
          </TouchableOpacity>
          {messages.length > 0 && (
            <TouchableOpacity onPress={exportConversation} style={[clStyles.headerBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="share-2" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          {messages.length > 0 && (
            <TouchableOpacity onPress={clearChat} style={[clStyles.headerBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="trash-2" size={13} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── API Key input (collapsible) ── */}
        {showKeyInput && (
          <View style={[clStyles.keyPanel, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "700", marginBottom: 6 }}>
              CHAVE DE API — AUTO-DETECTADA POR PREFIXO
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[clStyles.keyInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="pplx-... / gsk_... / sk-... / AIza... (deixe vazio = Cortesia)"
                placeholderTextColor={colors.mutedForeground}
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={false}
              />
              <TouchableOpacity
                onPress={() => setShowKeyInput(false)}
                style={[clStyles.headerBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="check" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
            {/* Dica Perplexity */}
            <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {[
                { label: "🌐 Perplexity (web)", prefix: "pplx-", url: "perplexity.ai" },
                { label: "🤖 Groq (rápido)", prefix: "gsk_", url: "console.groq.com" },
                { label: "✨ Gemini", prefix: "AIza", url: "ai.google.dev" },
                { label: "🔵 OpenAI", prefix: "sk-", url: "platform.openai.com" },
              ].map(p => (
                <TouchableOpacity
                  key={p.label}
                  onPress={() => Linking.openURL(`https://${p.url}`)}
                  style={[clStyles.providerChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Barra de ações — ACIMA das mensagens para não bloquear o input ── */}
        <View style={[clStyles.actionsBar, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1, borderTopWidth: 0 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingVertical: 7, alignItems: "center" }}>
            {/* 🌐 Web Search toggle */}
            <TouchableOpacity
              onPress={() => setWebSearch(w => !w)}
              style={[clStyles.actionBtn, {
                borderColor: webSearch ? "#22c55e" : colors.border,
                backgroundColor: webSearch ? "#22c55e22" : colors.secondary,
              }]}
            >
              {searching
                ? <ActivityIndicator size={12} color="#22c55e" />
                : <Feather name="globe" size={12} color={webSearch ? "#22c55e" : colors.foreground} />
              }
              <Text style={{ color: webSearch ? "#22c55e" : colors.foreground, fontSize: 12, fontWeight: webSearch ? "700" : "400" }}>
                {searching ? "Buscando..." : webSearch ? "🌐 Web ON" : "Busca Web"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={importDocument} style={[clStyles.actionBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
              <Feather name="paperclip" size={12} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontSize: 12 }}>Anexar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pasteURL} style={[clStyles.actionBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
              <Feather name="link" size={12} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontSize: 12 }}>Colar link</Text>
            </TouchableOpacity>
            {messages.length > 0 && (
              <TouchableOpacity onPress={copyAll} style={[clStyles.actionBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <Feather name="copy" size={12} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontSize: 12 }}>Copiar</Text>
              </TouchableOpacity>
            )}
            {messages.length > 0 && (
              <TouchableOpacity onPress={exportConversation} style={[clStyles.actionBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <Feather name="share-2" size={12} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontSize: 12 }}>Exportar</Text>
              </TouchableOpacity>
            )}
            {/* Auto-falar toggle */}
            <TouchableOpacity
              onPress={() => setAutoSpeak(a => !a)}
              style={[clStyles.actionBtn, { borderColor: autoSpeak ? "#a855f7" : colors.border, backgroundColor: autoSpeak ? "#a855f722" : colors.secondary }]}
            >
              <Feather name="mic" size={12} color={autoSpeak ? "#a855f7" : colors.foreground} />
              <Text style={{ color: autoSpeak ? "#a855f7" : colors.foreground, fontSize: 12, fontWeight: autoSpeak ? "700" : "400" }}>
                {autoSpeak ? "Auto-Voz ON" : "Auto-Voz"}
              </Text>
            </TouchableOpacity>
            {/* Voz settings */}
            <TouchableOpacity
              onPress={() => setShowVoicePanel(v => !v)}
              style={[clStyles.actionBtn, { borderColor: showVoicePanel ? "#7c3aed" : colors.border, backgroundColor: showVoicePanel ? "#7c3aed22" : colors.secondary }]}
            >
              <Feather name="settings" size={12} color={showVoicePanel ? "#7c3aed" : colors.foreground} />
              <Text style={{ color: showVoicePanel ? "#7c3aed" : colors.foreground, fontSize: 12 }}>Voz</Text>
            </TouchableOpacity>
            {messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
              <TouchableOpacity
                onPress={() => { const last = messages[messages.length - 1]; toggleSpeak(last.id, last.content); }}
                style={[clStyles.actionBtn, { borderColor: speaking ? "#7c3aed44" : colors.border, backgroundColor: speaking ? "#7c3aed22" : colors.secondary }]}
              >
                <Feather name={speaking ? "volume-x" : "volume-2"} size={12} color={speaking ? "#7c3aed" : colors.foreground} />
                <Text style={{ color: speaking ? "#7c3aed" : colors.foreground, fontSize: 12 }}>
                  {speaking ? "Parar voz" : "Ouvir"}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* ── Voice settings panel ── */}
        {showVoicePanel && (
          <View style={{ backgroundColor: "#1e1b4b", borderBottomWidth: 1, borderBottomColor: "#3730a3", paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text style={{ color: "#a5b4fc", fontSize: 12, fontWeight: "700", marginBottom: 8 }}>🎙️ CONFIGURAÇÕES DE VOZ</Text>

            {/* Rate control */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 }}>
              <Text style={{ color: "#94a3b8", fontSize: 11, width: 80 }}>Velocidade:</Text>
              <TouchableOpacity onPress={() => setSpeechRate(r => Math.max(0.5, parseFloat((r - 0.1).toFixed(1))))}
                style={{ backgroundColor: "#312e81", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#a5b4fc", fontWeight: "700" }}>–</Text>
              </TouchableOpacity>
              <Text style={{ color: "#c4b5fd", fontSize: 12, fontWeight: "700", minWidth: 32, textAlign: "center" }}>{speechRate.toFixed(1)}x</Text>
              <TouchableOpacity onPress={() => setSpeechRate(r => Math.min(2.0, parseFloat((r + 0.1).toFixed(1))))}
                style={{ backgroundColor: "#312e81", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: "#a5b4fc", fontWeight: "700" }}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSpeechRate(1.0)}
                style={{ backgroundColor: "#312e81", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 4 }}>
                <Text style={{ color: "#94a3b8", fontSize: 10 }}>Reset</Text>
              </TouchableOpacity>
            </View>

            {/* Voice list */}
            {availableVoices.length > 0 ? (
              <>
                <Text style={{ color: "#94a3b8", fontSize: 11, marginBottom: 6 }}>
                  Voz: {selectedVoiceId ? availableVoices.find(v => v.identifier === selectedVoiceId)?.name ?? "Personalizada" : "Padrão (pt-BR)"}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setSelectedVoiceId(null)}
                      style={{ backgroundColor: selectedVoiceId === null ? "#7c3aed" : "#312e81", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: "#fff", fontSize: 11 }}>Padrão</Text>
                    </TouchableOpacity>
                    {availableVoices.map(v => (
                      <TouchableOpacity
                        key={v.identifier}
                        onPress={() => setSelectedVoiceId(v.identifier)}
                        style={{ backgroundColor: selectedVoiceId === v.identifier ? "#7c3aed" : "#312e81", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ color: "#fff", fontSize: 11 }}>{v.name || v.identifier} ({v.language})</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            ) : (
              <Text style={{ color: "#64748b", fontSize: 11 }}>Vozes TTS nativas do Android (disponíveis no APK)</Text>
            )}

            {/* Test button */}
            <TouchableOpacity
              onPress={() => speakText("Olá! Esta é a voz selecionada para o Campo Livre.", ttsSettings)}
              style={{ marginTop: 8, backgroundColor: "#7c3aed33", borderWidth: 1, borderColor: "#7c3aed55", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, alignSelf: "flex-start" }}>
              <Text style={{ color: "#c4b5fd", fontSize: 12 }}>🔊 Testar voz</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Chat messages ── */}
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 8 }}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={clStyles.emptyState}>
                <Text style={{ fontSize: 40 }}>💬</Text>
                <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", textAlign: "center" }}>Campo Livre</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                  Chat sem restrições. Pergunte qualquer coisa, peça código, pesquise links, converse livremente.
                  {"\n\n"}
                  {isPplx ? "🌐 Com Perplexity: busca em tempo real na internet com links clicáveis." : "Use uma chave Perplexity (pplx-...) para ativar busca na internet."}
                </Text>
                {/* Sugestões */}
                <View style={clStyles.suggestGrid}>
                  {SUGGESTIONS.map(s => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => sendMessage(s)}
                      style={[clStyles.suggestChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 12 }}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            }
          />

          {/* Loading indicator */}
          {loading && (
            <View style={[clStyles.loadingBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <ActivityIndicator size="small" color="#7c3aed" />
              <Text style={{ color: "#7c3aed", fontSize: 13, flex: 1 }}>Gerando resposta...</Text>
              <TouchableOpacity onPress={stopGeneration} style={[clStyles.stopBtn, { backgroundColor: "#ef444422", borderColor: "#ef444444" }]}>
                <Feather name="square" size={12} color="#ef4444" />
                <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "700" }}>Parar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Input sempre acessível na base ── */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
          {/* ── Input bar ── */}
          <View style={[clStyles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              style={[clStyles.textInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="Pergunte qualquer coisa..."
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={4000}
              returnKeyType="default"
              blurOnSubmit={false}
            />

            {/* Enviar */}
            <TouchableOpacity
              onPress={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={[clStyles.sendBtn, { backgroundColor: input.trim() && !loading ? "#7c3aed" : colors.secondary }]}
            >
              <Feather name="send" size={16} color={input.trim() && !loading ? "#fff" : colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const clStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  iconBtn: { padding: 5 },
  iconBtnLg: { padding: 8 },
  keyPanel: {
    padding: 14,
    borderBottomWidth: 1,
  },
  keyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  providerChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    paddingHorizontal: 20,
    gap: 12,
  },
  suggestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  msgWrap: { marginBottom: 2 },
  userWrap: { alignItems: "flex-end" },
  aiWrap: { alignItems: "flex-start" },
  aiLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  aiAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#7c3aed22",
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    borderRadius: 14,
    padding: 12,
    maxWidth: "90%",
  },
  userBubble: {
    backgroundColor: "#7c3aed",
  },
  aiBubble: {
    backgroundColor: "#1e293b",
    alignSelf: "stretch",
    maxWidth: "100%",
  },
  userCopyBtn: {
    marginTop: 3,
    paddingHorizontal: 6,
  },
  loadingBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
    borderTopWidth: 1,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionsBar: {
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 1,
  },
  inputIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    maxHeight: 120,
    fontSize: 14,
    lineHeight: 20,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  // Code block
  codeWrap: {
    backgroundColor: "#0d1117",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#30363d",
    overflow: "hidden",
    marginVertical: 3,
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#30363d",
    gap: 4,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  codeText: {
    color: "#e6edf3",
    fontSize: 12,
    lineHeight: 19,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    padding: 10,
  },
});
