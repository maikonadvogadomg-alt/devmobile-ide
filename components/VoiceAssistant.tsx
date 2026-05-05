import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import { useApp } from "@/context/AppContext";
import { useApiBase } from "@/hooks/useApiBase";
import { useColors } from "@/hooks/useColors";
import MessageRenderer from "@/components/MessageRenderer";
import type { AIProvider } from "@/context/AppContext";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

interface VoiceMsg {
  role: "user" | "assistant";
  content: string;
  id: string;
}

const STATUS: Record<VoiceState, string> = {
  idle: "Toque no microfone para começar",
  listening: "Ouvindo... fale agora",
  thinking: "Processando...",
  speaking: "Respondendo...",
};

const STATE_COLOR: Record<VoiceState, string> = {
  idle: "#444",
  listening: "#ef4444",
  thinking: "#6366f1",
  speaking: "#10b981",
};

const NUM_BARS = 9;

function WaveformBars({ state, color }: { state: VoiceState; color: string }) {
  const anims = useRef(
    Array.from({ length: NUM_BARS }, (_, i) => new Animated.Value(0.15 + (i % 3) * 0.1))
  ).current;
  const loopRefs = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    loopRefs.current.forEach((a) => a.stop());
    loopRefs.current = [];

    if (state === "listening" || state === "speaking") {
      const animations = anims.map((anim, i) => {
        const maxH = state === "listening" ? 0.9 : 0.7;
        const minH = 0.1;
        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(i * 60),
            Animated.timing(anim, {
              toValue: minH + Math.random() * maxH,
              duration: 180 + i * 30,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: minH,
              duration: 180 + i * 30,
              useNativeDriver: true,
            }),
          ])
        );
        loop.start();
        return loop;
      });
      loopRefs.current = animations;
    } else if (state === "thinking") {
      const animations = anims.map((anim, i) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.delay(i * 100),
            Animated.timing(anim, { toValue: 0.5, duration: 400, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.1, duration: 400, useNativeDriver: true }),
          ])
        );
        loop.start();
        return loop;
      });
      loopRefs.current = animations;
    } else {
      anims.forEach((anim, i) => {
        Animated.timing(anim, {
          toValue: 0.15 + (i % 3) * 0.08,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }

    return () => {
      loopRefs.current.forEach((a) => a.stop());
    };
  }, [state]);

  return (
    <View style={styles.waveRow}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              transform: [{ scaleY: anim }],
              opacity: state === "idle" ? 0.3 : 0.9,
            },
          ]}
        />
      ))}
    </View>
  );
}

const AUTO_DETECT: [string, string, string][] = [
  ["gsk_", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"],
  ["sk-or-", "https://openrouter.ai/api/v1", "openai/gpt-4o-mini"],
  ["pplx-", "https://api.perplexity.ai", "sonar-pro"],
  ["AIza", "https://generativelanguage.googleapis.com/v1beta/openai/", "gemini-2.0-flash"],
  ["xai-", "https://api.x.ai/v1", "grok-2-latest"],
  ["sk-ant", "https://api.anthropic.com/v1", "claude-haiku-4-20250514"],
  ["sk-", "https://api.openai.com/v1", "gpt-4o-mini"],
];

function autoDetectBase(key: string): { url: string; model: string } | null {
  for (const [prefix, url, model] of AUTO_DETECT) {
    if ((key || "").trim().startsWith(prefix)) return { url, model };
  }
  return null;
}

function getEndpoint(
  provider: AIProvider,
  apiBase?: string
): { url: string; headers: Record<string, string> } {
  if (provider.type === "cortesia") {
    const base = apiBase || "http://localhost:8080";
    return { url: `${base}/api/ai/chat`, headers: { "Content-Type": "application/json" } };
  }
  if (provider.type === "anthropic") {
    return {
      url: (provider.baseUrl || "https://api.anthropic.com") + "/v1/messages",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
    };
  }
  const detected = autoDetectBase(provider.apiKey);
  let base = provider.baseUrl?.replace(/\/$/, "");
  if (!base) base = detected?.url?.replace(/\/$/, "") || "https://api.openai.com/v1";
  const url = base.endsWith("/chat/completions") ? base : base + "/chat/completions";
  return {
    url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
  };
}

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "bloco de código omitido")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_{1,3}(.+?)_{1,3}/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/>\s+/gm, "")
    .replace(/---+/g, "")
    .replace(/[🔴🟠🟡🟢🔵🟣⚫⚪🔶🔷🔸🔹✅❌⚠️🚀🎯📌💡🔑🛠️⚙️📊📈📉🗂️🔧🔨]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const VOICE_MODES: { key: string; label: string; icon: string; color: string; prompt: string; showCode?: boolean }[] = [
  {
    key: "copiloto",
    label: "Copiloto",
    icon: "cpu",
    color: "#10b981",
    showCode: true,
    prompt: `Você é um COPILOTO de desenvolvimento — age como um par programador experiente que conversa de forma natural e também entrega código quando necessário.

COMPORTAMENTO:
- Fale naturalmente em português do Brasil como uma pessoa real, sem asteriscos ou markdown na parte falada
- Quando precisar mostrar código, comando de terminal ou arquivo, coloque em bloco de código com a linguagem correta (ex: \`\`\`bash, \`\`\`javascript, \`\`\`python)
- Para comandos de terminal, use SEMPRE \`\`\`bash ou \`\`\`sh para que o usuário possa executar com um toque
- Para código de arquivos, use a linguagem correta para que o usuário possa aplicar com um toque
- Seja proativo: após explicar o que fazer, já mostre o código/comando pronto
- Para tarefas grandes, liste os passos e execute um por vez
- Após cada ação, explique o que foi feito e o próximo passo sugerido`,
  },
  {
    key: "dev",
    label: "Dev",
    icon: "code",
    color: "#6366f1",
    prompt: "Você é um assistente de voz especialista em programação. Responda como se estivesse conversando pessoalmente — voz natural, fluida, sem formatação. NUNCA use asteriscos, travessões, negrito, código entre backticks, listas com hífens, hashtags ou qualquer símbolo de markdown. Fale como uma pessoa real fala: em frases completas e naturais. Seja conciso, direto e amigável. Fale em português do Brasil.",
  },
  {
    key: "juridico",
    label: "Jurídico",
    icon: "book",
    color: "#f59e0b",
    prompt: "Você é um assistente de voz jurídico especializado em direito brasileiro. Responda como se estivesse conversando pessoalmente — voz natural, fluida, sem formatação. NUNCA use asteriscos, listas, negrito, hífens ou qualquer símbolo de markdown. Quando citar artigos de lei, integre-os naturalmente na fala. Fale como uma pessoa real fala. Seja conciso e amigável. Fale em português do Brasil.",
  },
  {
    key: "livre",
    label: "Campo Livre",
    icon: "message-circle",
    color: "#a78bfa",
    prompt: "Você é um assistente de voz amigável e inteligente. Responda como se estivesse conversando pessoalmente — voz natural, fluida, sem formatação. NUNCA use asteriscos, listas, negrito, hífens ou qualquer símbolo de markdown. Fale como uma pessoa real fala: em frases completas e naturais. Seja conciso, direto e agradável. Fale em português do Brasil.",
  },
];

async function callAIVoice(
  provider: AIProvider,
  history: { role: string; content: string }[],
  onChunk: (t: string) => void,
  apiBase?: string,
  systemPrompt?: string,
  directKey?: string
): Promise<void> {
  const { url, headers } = getEndpoint(provider, apiBase);

  if (provider.type === "cortesia") {
    const model = provider.model || "gemini-2.5-flash";
    const sysPrompt = systemPrompt || VOICE_MODES[0].prompt;

    const streamSSE = async (resp: Response) => {
      if (Platform.OS === "web" || !resp.body) {
        const text = await resp.text();
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try { const p = JSON.parse(line.slice(6)); if (p.content) onChunk(p.content); } catch {}
        }
        return;
      }
      const reader = resp.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try { const p = JSON.parse(line.slice(6).trim()); if (p.done) return; if (p.content) onChunk(p.content); } catch {}
        }
      }
    };

    // PRIORIDADE 1: chave direta configurada → vai direto no Google
    if (directKey?.trim()) {
      const msgs = [{ role: "user" as const, content: `[Sistema]: ${sysPrompt}` }, ...history.map(m => ({ role: m.role as "user"|"assistant", content: m.content }))];
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${directKey.trim()}` },
        body: JSON.stringify({ model, stream: true, max_tokens: 1024, messages: msgs }),
      });
      if (!r.ok) throw new Error(`Gemini erro ${r.status}`);
      if (!r.body) { onChunk(await r.text()); return; }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const ln of lines) {
          if (!ln.startsWith("data: ")) continue; const j = ln.slice(6).trim(); if (j === "[DONE]") return;
          try { const p = JSON.parse(j); if (p.choices?.[0]?.delta?.content) onChunk(p.choices[0].delta.content); } catch {}
        }
      }
      return;
    }

    // PRIORIDADE 2: servidor externo
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const body = JSON.stringify({ messages: history, model, systemPrompt: sysPrompt });
      const resp = await fetch(url, { method: "POST", headers, body, signal: ctrl.signal });
      clearTimeout(t);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await streamSSE(resp);
      return;
    } catch {
      throw new Error("Gemini indisponível. Adicione sua chave gratuita em Configurações.");
    }
  }

  const model =
    provider.model ||
    autoDetectBase(provider.apiKey)?.model ||
    "gpt-4o-mini";
  const isAnthropic = provider.type === "anthropic";
  const body = isAnthropic
    ? JSON.stringify({
        model,
        max_tokens: 1024,
        stream: true,
        system:
          "Você é um assistente de voz amigável e inteligente. Responda como se estivesse conversando pessoalmente — voz natural, fluida, como uma pessoa real. NUNCA use asteriscos, negrito, itálico, listas com hífens, numerações, backticks, hashtags ou qualquer símbolo de markdown. Responda em frases completas e naturais. Seja conciso e agradável. Fale em português do Brasil.",
        messages: history,
      })
    : JSON.stringify({
        model,
        stream: true,
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente de voz amigável e inteligente. Responda como se estivesse conversando pessoalmente — voz natural, fluida, como uma pessoa real. NUNCA use asteriscos, negrito, itálico, listas com hífens, numerações, backticks, hashtags ou qualquer símbolo de markdown. Responda em frases completas e naturais. Seja conciso e agradável. Fale em português do Brasil.",
          },
          ...history,
        ],
      });

  const resp = await fetch(url, { method: "POST", headers, body });
  if (!resp.ok) {
    const err = await resp.text();
    let msg = `Erro ${resp.status}`;
    try { const j = JSON.parse(err); msg = j.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error("Sem stream");
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const j = line.slice(6).trim();
      if (j === "[DONE]") continue;
      try {
        const p = JSON.parse(j);
        const text = isAnthropic
          ? (p.delta?.text || "")
          : (p.choices?.[0]?.delta?.content || "");
        if (text) onChunk(text);
      } catch {}
    }
  }
}

const SPEECH_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script>
var recognition = null;
var active = false;

function init() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:'SpeechRecognition não disponível'}));
    return;
  }
  recognition = new SR();
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = function() {
    active = true;
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'start'}));
  };
  recognition.onresult = function(e) {
    var text = e.results[0][0].transcript;
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'result',text:text}));
  };
  recognition.onerror = function(e) {
    active = false;
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:e.error}));
  };
  recognition.onend = function() {
    active = false;
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'end'}));
  };
}

window.startListening = function() {
  if (!recognition) init();
  if (recognition && !active) {
    try { recognition.start(); } catch(e) {}
  }
};
window.stopListening = function() {
  if (recognition && active) {
    try { recognition.stop(); } catch(e) {}
  }
};

window.addEventListener('load', function() { init(); });
</script>
</body>
</html>`;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function VoiceAssistant({ visible, onClose }: Props) {
  const colors = useColors();
  const apiBase = useApiBase();
  const { getActiveAIProvider, settings, activeProject, activeFile, aiMemory } = useApp();

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [messages, setMessages] = useState<VoiceMsg[]>([]);
  const [currentReply, setCurrentReply] = useState("");
  const [autoListen, setAutoListen] = useState(true);
  const [voiceRate, setVoiceRate] = useState(0.9);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");
  const [voiceMode, setVoiceMode] = useState(VOICE_MODES[0]);

  const webviewRef = useRef<WebView>(null);
  const scrollRef = useRef<ScrollView>(null);
  const isSpeaking = useRef(false);
  const shouldContinue = useRef(false);
  const messagesRef = useRef<VoiceMsg[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (visible) {
      Speech.getAvailableVoicesAsync().then((v) => {
        const pt = v.filter((voice) => voice.language?.startsWith("pt"));
        const list = pt.length > 0 ? pt : v.slice(0, 8);
        setAvailableVoices(list);
        // Auto-seleciona a melhor voz disponível (prioridade: network > enhanced > pt-BR)
        const best =
          list.find(voice => (voice as any).quality === "Enhanced" && voice.language?.includes("BR")) ||
          list.find(voice => voice.identifier?.toLowerCase().includes("network") && voice.language?.includes("BR")) ||
          list.find(voice => voice.identifier?.toLowerCase().includes("network") && voice.language?.startsWith("pt")) ||
          list.find(voice => (voice as any).quality === "Enhanced") ||
          list.find(voice => voice.language?.includes("BR")) ||
          list[0];
        if (best && !selectedVoice) setSelectedVoice(best.identifier);
      }).catch(() => {});
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      Speech.stop();
      setVoiceState("idle");
      setCurrentReply("");
      shouldContinue.current = false;
    }
  }, [visible]);

  const speak = useCallback(
    (text: string) => {
      const cleanText = cleanTextForSpeech(text);
      if (!cleanText.trim()) return;
      setVoiceState("speaking");
      isSpeaking.current = true;
      Speech.speak(cleanText, {
        language: "pt-BR",
        rate: voiceRate,
        pitch: voicePitch,
        voice: selectedVoice,
        onDone: () => {
          isSpeaking.current = false;
          if (shouldContinue.current && autoListen) {
            setTimeout(() => {
              setVoiceState("listening");
              webviewRef.current?.injectJavaScript("window.startListening(); true;");
            }, 600);
          } else {
            setVoiceState("idle");
          }
        },
        onError: () => {
          isSpeaking.current = false;
          setVoiceState("idle");
        },
      });
    },
    [voiceRate, voicePitch, selectedVoice, autoListen]
  );

  const buildProjectContext = useCallback(() => {
    if (!voiceMode.showCode) return "";
    let ctx = "";
    if (activeProject) {
      ctx += `\n\n📁 PROJETO ABERTO: ${activeProject.name} (${activeProject.files.length} arquivo${activeProject.files.length !== 1 ? "s" : ""})`;
      if (activeFile) {
        ctx += `\n📄 ARQUIVO ATIVO: ${activeFile.name} (${activeFile.language})\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\``;
      }
      const outros = activeProject.files.filter(f => f.id !== activeFile?.id);
      if (outros.length > 0) {
        ctx += `\n\nDEMAIS ARQUIVOS:`;
        for (const f of outros) {
          ctx += `\n--- ${f.path || f.name} ---\n${f.content || ""}`;
        }
      }
    }
    if (aiMemory.length > 0) {
      ctx += `\n\n🧠 MEMÓRIA: ${aiMemory.slice(-20).map(e => `[${e.category}] ${e.content}`).join(" | ")}`;
    }
    return ctx;
  }, [voiceMode.showCode, activeProject, activeFile, aiMemory]);

  const handleSpeechResult = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setError("");
      setVoiceState("thinking");
      shouldContinue.current = true;

      const userMsg: VoiceMsg = { id: Date.now().toString(), role: "user", content: text };
      const newMsgs = [...messagesRef.current, userMsg];
      setMessages(newMsgs);

      const provider = getActiveAIProvider();
      if (!provider) {
        setError("Configure uma IA em Configurações primeiro.");
        setVoiceState("idle");
        return;
      }

      let reply = "";
      setCurrentReply("");

      try {
        const history = newMsgs.map((m) => ({ role: m.role, content: m.content }));
        const fullPrompt = voiceMode.prompt + buildProjectContext();
        await callAIVoice(provider, history, (chunk) => {
          reply += chunk;
          setCurrentReply(reply);
        }, apiBase, fullPrompt, settings.geminiDirectKey);

        const assistantMsg: VoiceMsg = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: reply,
        };
        setMessages([...newMsgs, assistantMsg]);
        setCurrentReply("");
        speak(reply);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro desconhecido";
        setError(msg);
        setVoiceState("idle");
      }
    },
    [getActiveAIProvider, apiBase, speak, voiceMode, buildProjectContext]
  );

  const handleWebViewMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type: string;
          text?: string;
          msg?: string;
        };
        if (data.type === "result" && data.text) {
          handleSpeechResult(data.text);
        } else if (data.type === "error") {
          setError(`Reconhecimento: ${data.msg}`);
          setVoiceState("idle");
        }
      } catch {}
    },
    [handleSpeechResult]
  );

  const toggleListening = () => {
    if (voiceState === "speaking") {
      Speech.stop();
      isSpeaking.current = false;
    }
    if (voiceState === "listening") {
      webviewRef.current?.injectJavaScript("window.stopListening(); true;");
      setVoiceState("idle");
    } else if (voiceState === "idle" || voiceState === "speaking") {
      setVoiceState("listening");
      setTimeout(() => {
        webviewRef.current?.injectJavaScript("window.startListening(); true;");
      }, 300);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleClose = () => {
    Speech.stop();
    shouldContinue.current = false;
    webviewRef.current?.injectJavaScript("window.stopListening(); true;");
    onClose();
  };

  const clearConversation = () => {
    Speech.stop();
    shouldContinue.current = false;
    setMessages([]);
    setCurrentReply("");
    setVoiceState("idle");
  };

  const stateColor = STATE_COLOR[voiceState];
  const micIcon = voiceState === "listening" ? "mic" : voiceState === "speaking" ? "volume-2" : "mic";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>🎙️ Voz — Gemini</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={clearConversation} style={styles.headerBtn}>
              <Feather name="trash-2" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSettings(!showSettings)} style={styles.headerBtn}>
              <Feather name="sliders" size={18} color={showSettings ? stateColor : colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Seletor de campo/modo */}
        <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 8, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {VOICE_MODES.map((m) => {
            const active = voiceMode.key === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => { setVoiceMode(m); setMessages([]); setCurrentReply(""); }}
                style={{
                  flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
                  paddingVertical: 7, borderRadius: 10,
                  backgroundColor: active ? m.color + "22" : colors.secondary,
                  borderWidth: 1, borderColor: active ? m.color : colors.border,
                }}
              >
                <Feather name={m.icon as any} size={12} color={active ? m.color : colors.mutedForeground} />
                <Text style={{ fontSize: 11, fontWeight: active ? "700" : "400", color: active ? m.color : colors.mutedForeground }}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {showSettings && (
          <View style={[styles.settingsPanel, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.settingsTitle, { color: colors.foreground }]}>Configurações de Voz</Text>

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.mutedForeground }]}>
                Velocidade: {voiceRate.toFixed(1)}x
              </Text>
              <View style={styles.sliderRow}>
                {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setVoiceRate(v)}
                    style={[
                      styles.sliderBtn,
                      {
                        backgroundColor: voiceRate === v ? stateColor : colors.secondary,
                        borderColor: voiceRate === v ? stateColor : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: voiceRate === v ? "#fff" : colors.foreground, fontSize: 11 }}>
                      {v}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.mutedForeground }]}>
                Tom: {voicePitch.toFixed(1)}
              </Text>
              <View style={styles.sliderRow}>
                {[0.5, 0.75, 1.0, 1.25, 1.5].map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setVoicePitch(v)}
                    style={[
                      styles.sliderBtn,
                      {
                        backgroundColor: voicePitch === v ? stateColor : colors.secondary,
                        borderColor: voicePitch === v ? stateColor : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: voicePitch === v ? "#fff" : colors.foreground, fontSize: 11 }}>
                      {v}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {availableVoices.length > 0 && (
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.mutedForeground }]}>Voz:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.sliderRow}>
                    <TouchableOpacity
                      onPress={() => setSelectedVoice(undefined)}
                      style={[
                        styles.sliderBtn,
                        { paddingHorizontal: 10,
                          backgroundColor: !selectedVoice ? stateColor : colors.secondary,
                          borderColor: !selectedVoice ? stateColor : colors.border },
                      ]}
                    >
                      <Text style={{ color: !selectedVoice ? "#fff" : colors.foreground, fontSize: 11 }}>
                        Padrão
                      </Text>
                    </TouchableOpacity>
                    {availableVoices.slice(0, 6).map((v) => (
                      <TouchableOpacity
                        key={v.identifier}
                        onPress={() => setSelectedVoice(v.identifier)}
                        style={[
                          styles.sliderBtn,
                          { paddingHorizontal: 10,
                            backgroundColor: selectedVoice === v.identifier ? stateColor : colors.secondary,
                            borderColor: selectedVoice === v.identifier ? stateColor : colors.border },
                        ]}
                      >
                        <Text
                          style={{
                            color: selectedVoice === v.identifier ? "#fff" : colors.foreground,
                            fontSize: 11,
                          }}
                          numberOfLines={1}
                        >
                          {(v.name || v.identifier || "").replace(/com\.[a-z.]+:/, "").replace(/_/g, " ").replace(/pt.br.x./i, "").replace(/ptb.network/i, "Network").replace(/ptb.local/i, "Local").replace(/#.*/, "").trim().slice(0, 20) || "Voz " + availableVoices.indexOf(v)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.mutedForeground }]}>
                Auto-ouvir após resposta
              </Text>
              <TouchableOpacity
                onPress={() => setAutoListen(!autoListen)}
                style={[
                  styles.toggle,
                  { backgroundColor: autoListen ? stateColor : colors.secondary },
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    { transform: [{ translateX: autoListen ? 18 : 2 }] },
                  ]}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.waveSection}>
          <WaveformBars state={voiceState} color={stateColor} />
          <Text style={[styles.statusText, { color: stateColor }]}>{STATUS[voiceState]}</Text>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: "#1a0000", borderColor: "#ef4444" }]}>
            <Feather name="alert-circle" size={14} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.transcript}
          contentContainerStyle={{ paddingBottom: 16 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubble,
                m.role === "user"
                  ? [styles.bubbleUser, { backgroundColor: "#6366f1" }]
                  : [styles.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border }],
              ]}
            >
              <Text style={[styles.bubbleLabel, { color: m.role === "user" ? "#c7d2fe" : colors.mutedForeground }]}>
                {m.role === "user" ? "Você" : "IA"}
              </Text>
              {m.role === "assistant" && voiceMode.showCode ? (
                <MessageRenderer content={m.content} isUser={false} showApply />
              ) : (
                <Text style={[styles.bubbleText, { color: m.role === "user" ? "#fff" : colors.foreground }]}>
                  {m.content}
                </Text>
              )}
            </View>
          ))}

          {currentReply ? (
            <View style={[styles.bubble, styles.bubbleAssistant, { backgroundColor: colors.card, borderColor: stateColor }]}>
              <Text style={[styles.bubbleLabel, { color: stateColor }]}>IA (digitando...)</Text>
              {voiceMode.showCode ? (
                <MessageRenderer content={currentReply} isUser={false} showApply={false} />
              ) : (
                <Text style={[styles.bubbleText, { color: colors.foreground }]}>{currentReply}</Text>
              )}
            </View>
          ) : null}
        </ScrollView>

        {/* Chips de ação rápida — só no modo Copiloto */}
        {voiceMode.showCode && messages.length === 0 && voiceState === "idle" && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 6, textAlign: "center" }}>
              Diga ou toque para começar:
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {[
                "Explique o arquivo atual",
                "Refatore este código",
                "Crie um componente",
                "Instale uma biblioteca",
                "Corrija os erros",
                "Crie um novo arquivo",
              ].map((chip) => (
                <TouchableOpacity
                  key={chip}
                  onPress={() => handleSpeechResult(chip)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
                    backgroundColor: "#10b98115", borderWidth: 1, borderColor: "#10b98133",
                  }}
                >
                  <Text style={{ color: "#10b981", fontSize: 11, fontWeight: "600" }}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.controls}>
          <Pressable
            onPress={toggleListening}
            style={({ pressed }) => [
              styles.micBtn,
              {
                backgroundColor: stateColor,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: voiceState === "listening" ? 1.12 : 1 }],
              },
            ]}
          >
            <Feather name={micIcon} size={34} color="#fff" />
          </Pressable>
          <Text style={[styles.micHint, { color: colors.mutedForeground }]}>
            {voiceState === "listening"
              ? "Toque para parar"
              : voiceState === "speaking"
              ? "Toque para interromper"
              : "Toque para falar"}
          </Text>
        </View>

        <WebView
          ref={webviewRef}
          source={{ html: SPEECH_HTML }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          mediaPlaybackRequiresUserAction={false}
          style={styles.hiddenWebview}
          originWhitelist={["*"]}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  headerRight: { flexDirection: "row", gap: 4 },
  settingsPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  settingsTitle: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  settingRow: { gap: 6 },
  settingLabel: { fontSize: 12 },
  sliderRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sliderBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  waveSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 16,
  },
  waveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 80,
  },
  bar: {
    width: 6,
    height: 80,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  errorText: { color: "#ef4444", fontSize: 12, flex: 1 },
  transcript: { flex: 1, paddingHorizontal: 16 },
  bubble: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleUser: { alignSelf: "flex-end", borderRadius: 14 },
  bubbleAssistant: { alignSelf: "flex-start", borderRadius: 14 },
  bubbleLabel: { fontSize: 10, fontWeight: "700", marginBottom: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  controls: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  micHint: { fontSize: 13 },
  hiddenWebview: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
