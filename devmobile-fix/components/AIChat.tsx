import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { fetch } from "expo/fetch";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useApiBase } from "@/hooks/useApiBase";
import type { AIProvider } from "@/context/AppContext";
import MessageRenderer from "@/components/MessageRenderer";

// ─── Busca conteúdo de URL pública ───────────────────────────────────────────
async function fetchUrlContent(url: string): Promise<string> {
  const u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    throw new Error("URL deve começar com http:// ou https://");
  }
  const resp = await fetch(u, {
    headers: { "User-Agent": "DevMobile-IDE/1.0", "Accept": "text/html,text/plain,application/json" },
  });
  if (!resp.ok) throw new Error(`Erro ${resp.status} ao buscar URL`);
  const text = await resp.text();
  // Remove HTML tags para leitura limpa
  return text.replace(/<script[\s\S]*?<\/script>/gi, "")
             .replace(/<style[\s\S]*?<\/style>/gi, "")
             .replace(/<[^>]+>/g, " ")
             .replace(/\s{2,}/g, " ")
             .trim()
             .slice(0, 12000);
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Auto-detect table: [prefix, baseUrl, defaultModel, displayName]
const AUTO_DETECT: [string, string, string, string][] = [
  ["gsk_",   "https://api.groq.com/openai/v1",                           "llama-3.3-70b-versatile",  "Groq"],
  ["sk-or-", "https://openrouter.ai/api/v1",                             "openai/gpt-4o-mini",       "OpenRouter"],
  ["pplx-",  "https://api.perplexity.ai",                                "sonar-pro",                "Perplexity"],
  ["AIza",   "https://generativelanguage.googleapis.com/v1beta/openai/", "gemini-2.5-flash",         "Google Gemini"],
  ["xai-",   "https://api.x.ai/v1",                                      "grok-2-latest",            "xAI / Grok"],
  ["sk-ant", "https://api.anthropic.com/v1",                             "claude-haiku-4-20250514",  "Anthropic"],
  ["sk-",    "https://api.openai.com/v1",                                "gpt-4o-mini",              "OpenAI"],
];

function autoDetect(key: string): { url: string; model: string; name: string } | null {
  const k = (key || "").trim();
  for (const [prefix, url, model, name] of AUTO_DETECT) {
    if (k.startsWith(prefix)) return { url, model, name };
  }
  return null;
}

function getEndpoint(provider: AIProvider, apiBase?: string): { url: string; headers: Record<string, string> } {
  // Cortesia Gemini — proxy via servidor (sem chave necessária)
  if (provider.type === "cortesia") {
    const base = apiBase || "http://localhost:8080";
    return {
      url: `${base}/api/ai/chat`,
      headers: { "Content-Type": "application/json" },
    };
  }
  // Anthropic uses its own protocol
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
  // All other providers (OpenAI, Groq, OpenRouter, Perplexity, Gemini OpenAI-compat, xAI, DeepSeek, Mistral, custom)
  // use the OpenAI-compatible /chat/completions format
  const detected = autoDetect(provider.apiKey);
  let base = provider.baseUrl?.replace(/\/$/, "");
  if (!base) {
    base = detected?.url?.replace(/\/$/, "") || "https://api.openai.com/v1";
  }
  const url = base.endsWith("/chat/completions") ? base : base + "/chat/completions";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider.apiKey}`,
  };
  if (provider.type === "openrouter") {
    headers["HTTP-Referer"] = "https://devmobile.app";
    headers["X-Title"] = "DevMobile IDE";
  }
  return { url, headers };
}

const GEMINI_DIRECT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Chama Google Gemini diretamente do celular (sem servidor externo)
async function callGeminiDirect(
  apiKey: string,
  messages: Message[],
  systemPrompt: string | undefined,
  model: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const safeModel = model || "gemini-2.5-flash";
  const chatMsgs = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
  if (systemPrompt) {
    chatMsgs.unshift({ role: "user" as const, content: `[Sistema]: ${systemPrompt}` });
  }
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };

  // Tenta com streaming primeiro; se falhar, faz chamada sem streaming
  const tryStream = async (): Promise<boolean> => {
    const resp = await fetch(GEMINI_DIRECT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: safeModel, stream: true, max_tokens: 16384, messages: chatMsgs }),
    });
    if (!resp.ok) {
      let errDetail = `status ${resp.status}`;
      try { const j = await resp.json() as { error?: { message?: string } }; errDetail = j?.error?.message || errDetail; } catch {}
      throw new Error(`Gemini erro: ${errDetail}`);
    }
    const reader = resp.body?.getReader();
    if (!reader) return false; // sem suporte a streaming → tenta sem streaming
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const j = line.slice(6).trim();
        if (j === "[DONE]") return true;
        try { const p = JSON.parse(j); if (p.choices?.[0]?.delta?.content) onChunk(p.choices[0].delta.content); } catch {}
      }
    }
    return true;
  };

  const streamOk = await tryStream();
  if (streamOk) return;

  // Fallback: sem streaming
  const resp2 = await fetch(GEMINI_DIRECT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: safeModel, stream: false, max_tokens: 16384, messages: chatMsgs }),
  });
  if (!resp2.ok) {
    let errDetail = `status ${resp2.status}`;
    try { const j = await resp2.json() as { error?: { message?: string } }; errDetail = j?.error?.message || errDetail; } catch {}
    throw new Error(`Gemini erro: ${errDetail}`);
  }
  const data = await resp2.json() as { choices?: { message?: { content?: string } }[] };
  const text = data?.choices?.[0]?.message?.content || "";
  if (text) onChunk(text);
}

async function callAI(
  provider: AIProvider,
  messages: Message[],
  onChunk: (chunk: string) => void,
  apiBase?: string,
  directKey?: string
): Promise<void> {
  const { url, headers } = getEndpoint(provider, apiBase);

  // ── Cortesia Gemini ──────────────────────────────────────────────────────
  if (provider.type === "cortesia") {
    const systemMsg = messages.find(m => m.id === "system");
    const chatMsgs = messages.filter(m => m.id !== "system");
    const model = provider.model || "gemini-2.5-flash";

    // PRIORIDADE 1: chave direta configurada → vai direto no Google, sem servidor
    if (directKey?.trim()) {
      return callGeminiDirect(directKey.trim(), chatMsgs, systemMsg?.content, model, onChunk);
    }

    // PRIORIDADE 2: servidor externo (proxy gratuito)
    const parseSSELine = (line: string) => {
      if (!line.startsWith("data: ")) return;
      const j = line.slice(6).trim();
      try {
        const parsed = JSON.parse(j);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.content) onChunk(parsed.content);
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
      }
    };

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const body = JSON.stringify({
        messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
        systemPrompt: systemMsg?.content,
        model,
      });
      const response = await fetch(url, { method: "POST", headers, body, signal: ctrl.signal });
      clearTimeout(t);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const useFullText = Platform.OS === "web" || !response.body;
      if (useFullText) {
        const text = await response.text();
        for (const line of text.split("\n")) parseSSELine(line);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          try {
            const parsed = JSON.parse(j);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.done) return;
            if (parsed.content) onChunk(parsed.content);
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }
      return;
    } catch {
      throw new Error("Gemini indisponível. Adicione sua chave gratuita em Configurações → GEMINI DIRETO.");
    }
  }

  // ── Demais provedores ────────────────────────────────────────────────────
  const model = provider.model || getDefaultModel(provider.type);
  let body: string;
  const isAnthropicNative = provider.type === "anthropic";

  if (isAnthropicNative) {
    const systemMsg = messages.find(m => m.id === "system");
    const chatMsgs = messages.filter(m => m.id !== "system");
    body = JSON.stringify({
      model,
      max_tokens: 16384,
      stream: true,
      system: systemMsg?.content,
      messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
    });
  } else {
    body = JSON.stringify({
      model,
      stream: true,
      max_tokens: 16384,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
  }

  const response = await fetch(url, { method: "POST", headers, body });

  if (!response.ok) {
    const err = await response.text();
    let msg = `Erro ${response.status}`;
    try { const j = JSON.parse(err); msg = j.error?.message || j.error || j.message || msg; } catch {}
    throw new Error(msg);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Sem stream disponível");
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const j = line.slice(6).trim();
      if (j === "[DONE]") continue;
      try {
        const parsed = JSON.parse(j);
        if (parsed.error) throw new Error(parsed.error?.message || parsed.error);
        const text = isAnthropicNative
          ? (parsed.delta?.text || "")
          : (parsed.choices?.[0]?.delta?.content || "");
        if (text) onChunk(text);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

function getDefaultModel(type: AIProvider["type"]): string {
  switch (type) {
    case "openai":     return "gpt-4o-mini";
    case "anthropic":  return "claude-haiku-4-20250514";
    case "gemini":     return "gemini-2.5-flash";
    case "groq":       return "llama-3.3-70b-versatile";
    case "openrouter": return "openai/gpt-4o-mini";
    case "perplexity": return "sonar-pro";
    case "xai":        return "grok-2-latest";
    case "deepseek":   return "deepseek-chat";
    case "mistral":    return "mistral-small";
    default:           return "gpt-4o-mini";
  }
}

const AI_KEY_PROVIDERS: { type: AIProvider["type"]; label: string; hint: string }[] = [
  { type: "groq",       label: "Groq",       hint: "gsk_..." },
  { type: "openai",     label: "OpenAI",     hint: "sk-..." },
  { type: "anthropic",  label: "Claude",     hint: "sk-ant-..." },
  { type: "gemini",     label: "Gemini",     hint: "AIza..." },
  { type: "xai",        label: "xAI / Grok", hint: "xai-..." },
  { type: "openrouter", label: "OpenRouter", hint: "sk-or-..." },
  { type: "perplexity", label: "Perplexity", hint: "pplx-..." },
  { type: "deepseek",   label: "DeepSeek",   hint: "sk-..." },
];

function detectType(key: string): AIProvider["type"] {
  const d = autoDetect(key);
  if (!d) return "openai";
  if (d.name === "Groq")          return "groq";
  if (d.name === "OpenRouter")    return "openrouter";
  if (d.name === "Perplexity")    return "perplexity";
  if (d.name === "Google Gemini") return "gemini";
  if (d.name === "xAI / Grok")   return "xai";
  if (d.name === "Anthropic")     return "anthropic";
  return "openai";
}

// ─── Chips de ação rápida (tela vazia) ───────────────────────────────────────
const SUGGESTION_CHIPS = [
  { label: "📦 Instalar biblioteca",  msg: "Quero instalar uma biblioteca npm no meu projeto. Me ajude a escolher e instalar." },
  { label: "📋 Criar plano",          msg: "Crie um plano de desenvolvimento passo a passo para o projeto atual." },
  { label: "🐛 Debugar erro",         msg: "Tenho um erro no código. Me ajude a identificar e corrigir o problema." },
  { label: "⚡ Executar projeto",     msg: "Como executo/testo este projeto? Qual o comando correto?" },
  { label: "📄 Criar arquivo",        msg: "Preciso criar um novo arquivo no projeto. Me guie no processo." },
  { label: "🔍 Revisar código",       msg: "Revise o código do arquivo atual e sugira melhorias de qualidade e performance." },
  { label: "🔒 Adicionar .gitignore", msg: "Crie um .gitignore completo para este projeto." },
  { label: "📝 Gerar README",         msg: "Gere um README.md profissional para este projeto." },
];

// Chips de resposta rápida pós-mensagem IA
const QUICK_REPLIES = [
  { label: "✅ OK, pode fazer",       msg: "OK, pode fazer." },
  { label: "▶ Continue",             msg: "Continue com o próximo passo." },
  { label: "📁 Criar pasta de notas", msg: "Crie uma pasta chamada '_analises_ia' com os seguintes arquivos: 1) ANALISE.md com toda a análise que você acabou de fazer, 2) BUGS.md com todos os bugs encontrados, 3) SUGESTOES.md com as melhorias sugeridas. Use markdown bem estruturado." },
  { label: "📋 Gerar relatório",      msg: "Gere um relatório completo em markdown com: resumo executivo, bugs encontrados, melhorias sugeridas, próximos passos priorizados." },
  { label: "🔄 Tente de novo",       msg: "Tente de outro jeito." },
  { label: "❓ Explica melhor",      msg: "Pode explicar com mais detalhes?" },
  { label: "❌ Não, obrigado",       msg: "Não, obrigado." },
];

type ChatMode = "dev" | "livre" | "juridico";

const CHAT_MODES: { key: ChatMode; label: string; icon: string; color: string; prompt: string }[] = [
  {
    key: "dev",
    label: "Dev",
    icon: "code",
    color: "#00d4aa",
    prompt: "",
  },
  {
    key: "livre",
    label: "Campo Livre",
    icon: "message-circle",
    color: "#6366f1",
    prompt: "Você é uma IA de conversação livre, sem restrições temáticas. Responda com naturalidade, clareza e sem julgamentos. O usuário pode perguntar qualquer coisa.",
  },
  {
    key: "juridico",
    label: "Jurídico",
    icon: "book",
    color: "#f59e0b",
    prompt: "Você é um assistente jurídico especializado em direito brasileiro. Forneça informações legais claras, cite artigos de lei relevantes, e sempre recomende consultar um advogado para casos específicos. Responda em português do Brasil.",
  },
];

interface AIChatProps {
  pendingMessage?: string;
  onPendingMessageConsumed?: () => void;
}

// ─── Extrai blocos de código com nome de arquivo da resposta da IA ───────────
type CodeBlock = { filename: string; lang: string; code: string };

function extractCodeBlocks(text: string): CodeBlock[] {
  const results: CodeBlock[] = [];
  // Padrão: ```lang caminho/arquivo.ext\n...code...``` (com filename no cabeçalho)
  const pat = /```(\w+)[ \t]+([^\n`\s]+\.[\w]+)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = pat.exec(text)) !== null) {
    const [, lang, filename, code] = m;
    const fn = filename.trim();
    // só aceita caminhos com extensão (não aceita palavras soltas como "tsx" ou "python")
    if (fn && /\.\w{1,10}$/.test(fn) && !fn.includes(" ")) {
      results.push({ filename: fn, lang, code: code.trimEnd() });
    }
  }
  return results;
}

// ─── Detecta se mensagem é um trigger de "executar agora" ────────────────────
function isTrigger(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[!.,?]+$/, "");
  return /^(ok|sim|pode|implementa?r?|aplica?r?|faz(er)?|vai|continua?r?|confirmo?|cria?r?|executa?r?|bora|vamos|go|yes|start|faz isso|pode fazer|pode ir|pode implementar|pode criar|pode aplicar|pode continuar|pode come[cç]ar)$/.test(t);
}

// ─── Pesquisa web automática via DuckDuckGo ────────────────────────────────────
async function searchWeb(query: string, apiBase: string): Promise<string> {
  try {
    const resp = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(query.slice(0, 120))}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return "";
    const data = await resp.json() as { results?: { title: string; snippet: string; url: string }[] };
    if (!data.results?.length) return "";
    const items = data.results.slice(0, 5).map((r, i) =>
      `${i + 1}. **${r.title}**\n${r.snippet}${r.url ? `\nFonte: ${r.url}` : ""}`
    ).join("\n\n");
    return `\n\n🔍 RESULTADOS DA INTERNET para "${query}":\n${items}`;
  } catch { return ""; }
}

// detecta se a mensagem pede busca na internet e retorna o termo
function extractSearchQuery(text: string): string | null {
  const t = text.trim();
  const pats = [
    /^pesquise?\s+(?:na\s+internet\s+)?(?:sobre\s+)?(.+)/i,
    /^busqu[ea]\s+(?:na\s+internet\s+)?(?:sobre\s+)?(.+)/i,
    /^procure?\s+(?:na\s+internet\s+)?(?:sobre\s+)?(.+)/i,
    /^search(?:\s+for)?\s+(.+)/i,
    /\bpesquise?\s+na\s+(?:web|internet|google)\s+(?:sobre\s+)?(.+)/i,
    /\bbusqu[ea]\s+na\s+(?:web|internet|google)\s+(?:sobre\s+)?(.+)/i,
  ];
  for (const p of pats) {
    const m = t.match(p);
    if (m?.[1]) return m[1].replace(/[?!.]+$/, "").trim();
  }
  return null;
}

export default function AIChat({ pendingMessage, onPendingMessageConsumed }: AIChatProps = {}) {
  const colors = useColors();
  const apiBase = useApiBase();
  const { getActiveAIProvider, activeFile, activeProject, addAIProvider, aiProviders, setActiveAIProvider, aiMemory, settings, updateFile, createFile, createFiles, setActiveFile } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [quickKey, setQuickKey] = useState("");
  const [showQuickKey, setShowQuickKey] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("dev");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [pendingCodeBlocks, setPendingCodeBlocks] = useState<{ filename: string; lang: string; code: string }[]>([]);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Autorize acesso à galeria para enviar imagens.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setAttachedImage({ uri: asset.uri, base64: asset.base64 || "" });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível acessar a galeria.");
    }
  };

  const handleFetchUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setIsFetchingUrl(true);
    try {
      const content = await fetchUrlContent(url);
      setInput((prev) => {
        const urlNote = `\n\n[Conteúdo da URL: ${url}]\n${content}`;
        return (prev + urlNote).slice(0, 4000);
      });
      setUrlInput("");
      setShowUrlInput(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("Erro ao buscar URL", e instanceof Error ? e.message : "Verifique a URL e tente novamente.");
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleCopyToTerminal = (cmd: string) => {
    Clipboard.setStringAsync(cmd);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copiado para área de transferência", `Comando copiado:\n\n${cmd.slice(0, 120)}\n\nCole no Terminal do app.`, [{ text: "OK" }]);
  };

  useEffect(() => {
    if (pendingMessage && pendingMessage.trim()) {
      setInput(pendingMessage);
      onPendingMessageConsumed?.();
    }
  }, [pendingMessage]);

  const handleSaveQuickKey = () => {
    const k = quickKey.trim();
    if (!k) return;
    const det = autoDetect(k);
    const type = detectType(k);
    addAIProvider({
      name: det?.name || AI_KEY_PROVIDERS.find(p => p.type === type)?.label || "OpenAI",
      type,
      apiKey: k,
      baseUrl: det?.url,
      model: det?.model,
      isActive: true,
    });
    setQuickKey("");
    setShowQuickKey(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ── Aplica blocos de código ao projeto ──────────────────────────────────────
  const applyCodeBlocks = useCallback((blocks: { filename: string; lang: string; code: string }[]) => {
    if (!activeProject) return [];
    const applied: string[] = [];
    for (const block of blocks) {
      const filename = block.filename.replace(/^\/+/, "");
      // Tenta encontrar arquivo existente por path ou name
      const existing = activeProject.files.find(
        f => (f.path || f.name) === filename || f.name === filename.split("/").pop()
      );
      if (existing) {
        updateFile(activeProject.id, existing.id, block.code);
        applied.push(filename);
      } else {
        const newFile = createFile(activeProject.id, filename, block.code);
        setActiveFile(newFile);
        applied.push(filename);
      }
    }
    return applied;
  }, [activeProject, updateFile, createFile, setActiveFile]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const provider = getActiveAIProvider();
    let text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    // ── Auto-apply: se usuário disser "ok/implementa/etc" e há blocos pendentes ─
    if (isTrigger(text) && pendingCodeBlocks.length > 0) {
      const applied = applyCodeBlocks(pendingCodeBlocks);
      setPendingCodeBlocks([]);
      if (applied.length > 0) {
        setApplySuccess(`✅ ${applied.length} arquivo${applied.length > 1 ? "s" : ""} aplicado${applied.length > 1 ? "s" : ""}: ${applied.join(", ")}`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setApplySuccess(null), 4000);
        // Informa o AI o que foi aplicado e pede próximo passo
        text = `Os arquivos foram aplicados ao projeto: ${applied.join(", ")}. Continue com o próximo passo.`;
      }
    }

    // Inclui imagem anexada como descrição no contexto (base64 para providers compatíveis)
    const imgContext = attachedImage
      ? `\n\n[IMAGEM ANEXADA pelo usuário — analise visualmente conforme o contexto da pergunta acima. base64_jpeg: data:image/jpeg;base64,${attachedImage.base64.slice(0, 200)}... (imagem completa disponível)]`
      : "";
    const fullText = imgContext ? text + imgContext : text;

    setShowQuickReplies(false);
    setAttachedImage(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: generateId(), role: "user", content: text };
    const assistantId = generateId();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };

    if (!overrideText) setInput("");
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    if (!provider) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  "Nenhum provedor de IA configurado. Vá em Configuracoes > IA e adicione uma chave de API.",
              }
            : m
        )
      );
      setIsLoading(false);
      return;
    }

    const modeConfig = CHAT_MODES.find((m) => m.key === chatMode)!;

    let systemContext: string;

    if (chatMode !== "dev") {
      systemContext = modeConfig.prompt;
    } else {
      systemContext = settings.systemPrompt?.trim()
        ? settings.systemPrompt
        : `Você é Jasmim — assistente de desenvolvimento pessoal do DevMobile, um IDE profissional para Android. Você é especialista em criar, analisar e modificar código.

⚡ CAPACIDADES REAIS — NUNCA diga que "não pode" ou "não consegue":
- Você VÊ e ANALISA TODOS os arquivos do projeto (recebidos acima no contexto)
- Você CRIA novos arquivos com código completo e funcional
- Você MODIFICA arquivos existentes, corrigindo bugs e adicionando features
- Você ENTENDE a estrutura completa do projeto e dá diagnóstico preciso
- Você IMPLEMENTA imediatamente quando o usuário confirmar

📝 COMO CRIAR/MODIFICAR ARQUIVOS — FORMATO OBRIGATÓRIO:
Para criar ou modificar qualquer arquivo, use este formato EXATO:
\`\`\`typescript caminho/do/arquivo.tsx
// código completo aqui — NUNCA escreva "...resto do código..."
\`\`\`
O DevMobile aplica automaticamente os arquivos ao projeto quando o usuário confirmar.
Use o caminho real do arquivo (ex: components/App.tsx, utils/api.ts, index.js).
Para múltiplos arquivos: um bloco de código por arquivo, cada um com seu caminho.

🚀 QUANDO O USUÁRIO DISSER "OK", "SIM", "PODE", "IMPLEMENTA", "APLICA", "FAZ", "VAI", "CONTINUA", "CONFIRMO":
- EXECUTE IMEDIATAMENTE — não peça confirmação de novo
- Gere o código COMPLETO e funcional de todos os arquivos necessários
- Liste no final: "✅ Arquivos criados/modificados: arquivo1.tsx, arquivo2.ts"
- Dê o próximo passo automaticamente sem esperar

🧠 ANÁLISE DO PROJETO:
- Você recebe o conteúdo COMPLETO de todos os arquivos no contexto desta conversa
- Ao analisar, mencione os arquivos pelo nome real e cite trechos específicos
- Identifique dependências, imports, funções exportadas, tipos TypeScript
- NUNCA diga "não tenho acesso ao projeto" — você TEM, está no contexto acima

📋 FLUXO DE TRABALHO:
1. Analise o pedido com base nos arquivos reais
2. Proponha uma solução clara com plano de arquivos
3. Pergunte apenas se faltam informações CRÍTICAS (não pergunte o óbvio)
4. Quando confirmado: gere TODOS os arquivos necessários, código completo
5. Informe ✅ o resultado + 📋 próximo passo sugerido

⚠️ REGRAS DE CÓDIGO:
- Código SEMPRE completo — JAMAIS coloque "// ... resto do código ..."
- JAMAIS coloque "// código anterior aqui" — escreva tudo
- Para criar pastas: use o caminho completo (ex: src/screens/Home.tsx cria a pasta automaticamente)
- Imports: use os mesmos padrões do projeto existente
- TypeScript: mantenha tipagem consistente com o resto do projeto`;

      if (activeFile) {
        systemContext += `\n\n📄 ARQUIVO ATUAL: ${activeFile.name} (${activeFile.language})\n\`\`\`${activeFile.language}\n${activeFile.content.slice(0, 10000)}\n\`\`\``;
      }
      if (activeProject) {
        systemContext += `\n\n📁 PROJETO: ${activeProject.name} (${activeProject.files.length} arquivo${activeProject.files.length !== 1 ? "s" : ""})`;
        const outrosArquivos = activeProject.files.filter(f => f.id !== activeFile?.id);
        if (outrosArquivos.length > 0) {
          let blocos = "";
          let totalChars = 0;
          for (let i = 0; i < outrosArquivos.length; i++) {
            const f = outrosArquivos[i];
            if (totalChars >= 50000) {
              blocos += `\n\n[... ${outrosArquivos.length - i} arquivo(s) omitidos por limite de contexto (50k) ...]`;
              break;
            }
            const conteudo = (f.content || "").slice(0, 6000);
            blocos += `\n\n--- ${f.path || f.name} ---\n${conteudo}`;
            totalChars += conteudo.length;
          }
          systemContext += `\n\nTODOS OS ARQUIVOS DO PROJETO (acesso completo, limite 50k):${blocos}`;
        }
      }
    }

    if (aiMemory.length > 0) {
      const memStr = aiMemory.map((e) => `- [${e.category}] ${e.content}`).join("\n");
      systemContext += `\n\n🧠 MEMÓRIA DO USUÁRIO (use como contexto, não mencione explicitamente):\n${memStr}`;
    }

    // ── Pesquisa automática na internet ────────────────────────────────────────
    let searchResults = "";
    const searchQuery = extractSearchQuery(text);
    if (searchQuery && apiBase) {
      searchResults = await searchWeb(searchQuery, apiBase);
      if (searchResults) {
        systemContext += `\n\n${searchResults}\n\nUse os resultados acima para responder com informações atuais da internet.`;
      }
    }

    const allMessages: Message[] = [
      { id: "system", role: "user", content: systemContext },
      ...messages,
      { ...userMsg, content: fullText || text },
    ];

    try {
      let fullAIResponse = "";
      await callAI(provider, allMessages, (chunk) => {
        fullAIResponse += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      }, apiBase, settings.geminiDirectKey);

      // ── Extrai blocos de código com nome de arquivo da resposta ───────────
      const blocks = extractCodeBlocks(fullAIResponse);
      setPendingCodeBlocks(blocks);

      // Mostra resposta rápida após IA responder com sucesso
      setShowQuickReplies(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        // Geração parada pelo usuário — não mostra erro
        setShowQuickReplies(true);
      } else {
        const errMsg = e instanceof Error ? e.message : "Erro desconhecido";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `⚠️ ${errMsg}\n\nVerifique sua chave de API e tente novamente.` } : m
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [input, isLoading, messages, getActiveAIProvider, activeFile, activeProject, pendingCodeBlocks, applyCodeBlocks]);

  const sendQuickReply = (msg: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowQuickReplies(false);
    sendMessage(msg);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
          {
            backgroundColor: isUser ? colors.primary : colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {!isUser && (
          <View style={styles.aiLabel}>
            <Feather name="cpu" size={10} color={colors.accent} />
            <Text style={[styles.aiLabelText, { color: colors.accent }]}>IA</Text>
          </View>
        )}
        <MessageRenderer
          content={item.content || (isLoading && item.role === "assistant" ? "Pensando..." : "")}
          isUser={isUser}
          showApply={!isUser}
          onCopyToTerminal={!isUser ? handleCopyToTerminal : undefined}
        />
      </View>
    );
  };

  const provider = getActiveAIProvider();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Feather name="cpu" size={14} color={colors.primary} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Assistente IA</Text>

        {/* Badge do provedor — SEMPRE clicável para trocar/adicionar */}
        <TouchableOpacity
          onPress={() => setShowQuickKey(v => !v)}
          style={[
            styles.providerBadge,
            provider
              ? { backgroundColor: colors.primary + "22", borderColor: colors.primary + "66", borderWidth: 1 }
              : { backgroundColor: "#f59e0b22", borderColor: "#f59e0b", borderWidth: 1 }
          ]}
        >
          <Feather name={provider ? "zap" : "key"} size={11} color={provider ? colors.primary : "#f59e0b"} />
          <Text style={[styles.providerText, { color: provider ? colors.primary : "#f59e0b", fontWeight: "700" }]}>
            {provider ? provider.name : "Adicionar Chave"}
          </Text>
          <Feather name="chevron-down" size={10} color={provider ? colors.primary : "#f59e0b"} />
        </TouchableOpacity>

        {messages.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setMessages([]);
              setShowQuickReplies(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }}
            style={[styles.resetBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="trash-2" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Banner: aviso execuções de terminal limitadas */}
      {chatMode === "dev" && messages.length === 0 && (
        <View style={{ backgroundColor: "#0f172a", borderBottomWidth: 1, borderBottomColor: "#334155", paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="alert-triangle" size={12} color="#94a3b8" />
          <Text style={{ color: "#94a3b8", fontSize: 11, flex: 1, lineHeight: 16 }}>
            <Text style={{ color: "#cbd5e1", fontWeight: "700" }}>⚠️ Terminal limitado:</Text>
            {" "}execuções têm timeout de 30s e sem internet. A IA pode sugerir comandos — use o botão <Text style={{ color: "#f59e0b" }}>Terminal</Text> para copiar e executar.
          </Text>
        </View>
      )}

      {/* Banner: sem servidor E sem chave direta = IA indisponível */}
      {provider?.type === "cortesia" && !apiBase && !settings.geminiDirectKey && (
        <View style={{ backgroundColor: "#1a1000", borderBottomWidth: 1, borderBottomColor: "#ca8a0444", padding: 12, gap: 6 }}>
          <Text style={{ color: "#fbbf24", fontWeight: "700", fontSize: 13 }}>
            ⚠️ IA sem servidor — configure sua chave gratuita
          </Text>
          <Text style={{ color: "#fde68a", fontSize: 12, lineHeight: 18 }}>
            O app funciona 100% standalone. Só precisa de uma chave gratuita do Google:{"\n"}
            <Text style={{ color: "#fbbf24", fontWeight: "700" }}>aistudio.google.com</Text>
            {" → Criar chave → colar em Configurações → Gemini Direto"}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              onPress={() => { Linking.openURL("https://aistudio.google.com/apikey"); }}
              style={{ flex: 1, backgroundColor: "#4285f422", borderRadius: 8, padding: 8, alignItems: "center", borderWidth: 1, borderColor: "#4285f444" }}
            >
              <Text style={{ color: "#7cb9ff", fontWeight: "700", fontSize: 12 }}>Abrir Google AI Studio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowQuickKey(true)}
              style={{ flex: 1, backgroundColor: "#fbbf2422", borderRadius: 8, padding: 8, alignItems: "center", borderWidth: 1, borderColor: "#fbbf2444" }}
            >
              <Text style={{ color: "#fbbf24", fontWeight: "700", fontSize: 12 }}>+ Colar chave aqui</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modo de chat */}
      <View style={[styles.modeBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {CHAT_MODES.map((m) => {
          const active = chatMode === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => {
                setChatMode(m.key);
                setMessages([]);
                setShowQuickReplies(false);
                Haptics.selectionAsync();
              }}
              style={[
                styles.modeBtn,
                { backgroundColor: active ? m.color + "22" : "transparent", borderColor: active ? m.color : "transparent" },
              ]}
            >
              <Feather name={m.icon as any} size={12} color={active ? m.color : colors.mutedForeground} />
              <Text style={{ fontSize: 11, fontWeight: active ? "700" : "400", color: active ? m.color : colors.mutedForeground, marginLeft: 4 }}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Atalhos de geração (modo Dev) — ACIMA das mensagens */}
      {chatMode === "dev" && activeProject && !isLoading && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6, gap: 6 }}
          style={[{ borderBottomWidth: 1, borderBottomColor: colors.border }]}
        >
          {[
            { label: "📊 Gerar SPEC Completo", msg: `Gere uma ESPECIFICAÇÃO COMPLETA do projeto "${activeProject.name}" (arquivos: ${activeProject.files.map(f => f.name).join(", ") || "nenhum"}). Inclua: 1) O que o app faz (propósito e funcionalidades principais), 2) Rotas de API (se houver) com método, caminho e o que retorna, 3) Funções principais — nome, o que faz, limitações, 4) O que funciona e o que não funciona ainda, 5) Como o terminal funciona (comandos, limitações, timeout), 6) Limites do sistema (tamanho, memória, dependências), 7) Índice de documentação (cada arquivo e sua função), 8) Próximos passos recomendados. Seja técnico, objetivo e use markdown com títulos e tabelas.` },
            { label: "📋 Gerar PLANO.md", msg: `Analise o projeto "${activeProject.name}" (arquivos: ${activeProject.files.map(f => f.name).join(", ") || "nenhum"}) e gere um PLANO.md completo com: objetivo, stack tecnológico, estrutura de pastas, funcionalidades implementadas, próximos passos e arquitetura. Use markdown.` },
            { label: "⚙️ Gerar SISTEMA.md", msg: `Documente o projeto "${activeProject.name}" em um SISTEMA.md técnico com: descrição do sistema, variáveis de ambiente, endpoints da API (se houver), dependências, instruções de build/run, e notas de arquitetura. Use markdown.` },
            { label: "🐛 Revisar código", msg: `Revise todos os arquivos do projeto "${activeProject.name}" e liste: bugs encontrados, melhorias de performance, boas práticas não seguidas, e sugestões de refatoração. Seja objetivo e direto.` },
            { label: "📦 Listar deps", msg: `Quais bibliotecas/pacotes devo instalar para o projeto "${activeProject.name}"? Liste com: nome do pacote, versão recomendada, motivo de usar, e o comando npm install.` },
            { label: "🔌 Rotas de API", msg: `Liste todas as rotas de API do projeto "${activeProject.name}". Para cada rota: método HTTP (GET/POST/PUT/DELETE), caminho completo, o que ela recebe (body/params), o que ela retorna, se funciona ou não, e o código de status esperado. Formato de tabela markdown.` },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => sendMessage(item.msg)}
              style={[styles.quickReplyChip, { backgroundColor: colors.card, borderColor: colors.primary + "44" }]}
            >
              <Text style={[styles.quickReplyText, { color: colors.primary }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Painel de troca/adição de provedor — abre ao tocar no badge */}
      {showQuickKey && (
        <View style={[styles.quickKeyPanel, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>

          {/* Provedores já configurados — toca para ativar */}
          {aiProviders.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", marginBottom: 6 }}>
                TROCAR PROVEDOR ATIVO
              </Text>
              {aiProviders.map((p) => (
                <TouchableOpacity
                  key={p.id ?? p.name}
                  onPress={() => {
                    if (p.id) setActiveAIProvider(p.id);
                    setShowQuickKey(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                  style={[
                    styles.cortesiaBtn,
                    {
                      backgroundColor: p.isActive ? colors.primary + "18" : colors.secondary,
                      borderColor: p.isActive ? colors.primary : colors.border,
                      marginBottom: 4,
                    }
                  ]}
                >
                  <Text style={{ fontSize: 16 }}>
                    {p.type === "cortesia" ? "✨" : p.type === "groq" ? "⚡" : p.type === "perplexity" ? "🔍" : p.type === "openrouter" ? "🔀" : p.type === "anthropic" ? "🟠" : "🤖"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.isActive ? colors.primary : colors.foreground, fontWeight: p.isActive ? "700" : "400", fontSize: 13 }}>
                      {p.name}
                    </Text>
                    {p.model && <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{p.model}</Text>}
                  </View>
                  {p.isActive && <Feather name="check-circle" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
            </View>
          )}

          {/* Cortesia Gemini — sem chave */}
          <TouchableOpacity
            onPress={() => {
              addAIProvider({ name: "Cortesia Gemini", type: "cortesia", apiKey: "", isActive: true });
              setShowQuickKey(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
            style={[styles.cortesiaBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary, marginBottom: 6 }]}
          >
            <Text style={{ fontSize: 16 }}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Cortesia Gemini (grátis)</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Sem chave · Gemini 2.0 Flash</Text>
            </View>
            <Feather name="chevron-right" size={14} color={colors.primary} />
          </TouchableOpacity>

          {/* Sugestões rápidas de provedores populares */}
          <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", marginBottom: 6 }}>
            ADICIONAR CHAVE PRÓPRIA
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {[
                { label: "⚡ Groq (grátis)", hint: "gsk_...", url: "https://console.groq.com/keys" },
                { label: "🔍 Perplexity (internet)", hint: "pplx-...", url: "https://www.perplexity.ai/settings/api" },
                { label: "🔀 OpenRouter", hint: "sk-or-...", url: "https://openrouter.ai/keys" },
                { label: "🤖 OpenAI", hint: "sk-...", url: "https://platform.openai.com/api-keys" },
                { label: "🟠 Anthropic", hint: "sk-ant-...", url: "https://console.anthropic.com/keys" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => Linking.openURL(item.url)}
                  style={{ backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: "600" }}>{item.label}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>{item.hint}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={{ color: colors.mutedForeground, fontSize: 10, marginBottom: 4 }}>
            gsk_ Groq · sk-or- OpenRouter · pplx- Perplexity · AIza Gemini · xai- Grok · sk-ant Anthropic · sk- OpenAI
          </Text>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              style={[styles.quickKeyInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.primary }]}
              value={quickKey}
              onChangeText={setQuickKey}
              placeholder="Cole qualquer API key aqui..."
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={async () => {
                try {
                  const txt = await Clipboard.getStringAsync();
                  if (txt) setQuickKey(txt.trim());
                } catch {}
              }}
              style={[styles.quickKeyBtn, { backgroundColor: colors.secondary }]}
            >
              <Feather name="clipboard" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {quickKey.length > 10 && (() => {
            const det = autoDetect(quickKey);
            return (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 2 }}>
                <Feather name="check-circle" size={12} color={colors.accent} />
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  Detectado: <Text style={{ color: colors.accent, fontWeight: "700" }}>{det?.name || "OpenAI"}</Text>
                  {det ? ` · ${det.model}` : ""}
                </Text>
              </View>
            );
          })()}
          <TouchableOpacity
            onPress={handleSaveQuickKey}
            disabled={!quickKey.trim()}
            style={[styles.quickKeySave, { backgroundColor: quickKey.trim() ? colors.primary : colors.muted, marginTop: 8 }]}
          >
            <Feather name="check" size={15} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Salvar e Usar esta Chave</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 8, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={[styles.emptyChat]}>
            <Feather name="cpu" size={28} color={colors.primary + "99"} />
            <Text style={[styles.emptyChatText, { color: colors.foreground }]}>IA Assistente</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center" }}>
              {activeFile ? `Contexto: ${activeFile.name}` : "Escreva abaixo ou toque em uma sugestão"}
            </Text>
          </View>
        }
      />

      {/* Chips de sugestão — aparecem ACIMA do input quando não há mensagens */}
      {messages.length === 0 && !isLoading && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          >
            {SUGGESTION_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip.label}
                onPress={() => sendMessage(chip.msg)}
                style={[styles.suggestionChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.suggestionChipText, { color: colors.foreground }]}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Banner de SUCESSO ao aplicar arquivos ── */}
      {applySuccess && (
        <View style={{ backgroundColor: "#16a34a", paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="check-circle" size={14} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600", flex: 1 }}>{applySuccess}</Text>
        </View>
      )}

      {/* ── Banner APLICAR arquivo(s) pendentes ── */}
      {pendingCodeBlocks.length > 0 && !isLoading && (
        <View style={{ backgroundColor: "#7c3aed", paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="file-text" size={14} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              {pendingCodeBlocks.length} arquivo{pendingCodeBlocks.length > 1 ? "s" : ""} pronto{pendingCodeBlocks.length > 1 ? "s" : ""}
            </Text>
            <Text style={{ color: "#ffffffcc", fontSize: 10 }} numberOfLines={1}>
              {pendingCodeBlocks.map(b => b.filename).join(", ")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              const applied = applyCodeBlocks(pendingCodeBlocks);
              setPendingCodeBlocks([]);
              if (applied.length > 0) {
                setApplySuccess(`✅ ${applied.length} arquivo${applied.length > 1 ? "s" : ""} aplicado${applied.length > 1 ? "s" : ""}: ${applied.join(", ")}`);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTimeout(() => setApplySuccess(null), 4000);
              }
            }}
            style={{ backgroundColor: "#fff", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}
          >
            <Text style={{ color: "#7c3aed", fontSize: 12, fontWeight: "700" }}>Aplicar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPendingCodeBlocks([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={14} color="#ffffffaa" />
          </TouchableOpacity>
        </View>
      )}

      {/* Painel URL — buscar conteúdo de link público */}
      {showUrlInput && (
        <View style={[styles.urlPanel, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Feather name="globe" size={13} color={colors.accent} />
          <TextInput
            style={[styles.urlInput, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border }]}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="https://... (link público)"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
          />
          <TouchableOpacity
            onPress={handleFetchUrl}
            disabled={isFetchingUrl || !urlInput.trim()}
            style={[styles.urlFetchBtn, { backgroundColor: urlInput.trim() ? colors.accent : colors.muted }]}
          >
            {isFetchingUrl
              ? <ActivityIndicator size={14} color="#fff" />
              : <Feather name="download" size={14} color="#fff" />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowUrlInput(false); setUrlInput(""); }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Indicador de imagem anexada */}
      {attachedImage && (
        <View style={[styles.imgAttached, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Feather name="image" size={13} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 12, flex: 1, fontWeight: "600" }}>Imagem anexada — será analisada pela IA</Text>
          <TouchableOpacity onPress={() => setAttachedImage(null)}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Barra de input — sempre acessível na base */}
      <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {/* Colar */}
        <TouchableOpacity
          onPress={async () => {
            try {
              const text = await Clipboard.getStringAsync();
              if (text) {
                setInput((prev) => prev + text);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            } catch {}
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ paddingHorizontal: 3, opacity: 0.6 }}
        >
          <Feather name="clipboard" size={17} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Imagem */}
        <TouchableOpacity
          onPress={handlePickImage}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          style={{ paddingHorizontal: 3, opacity: attachedImage ? 1 : 0.6 }}
        >
          <Feather name="image" size={17} color={attachedImage ? colors.primary : colors.mutedForeground} />
        </TouchableOpacity>

        {/* URL — buscar conteúdo de link */}
        <TouchableOpacity
          onPress={() => setShowUrlInput(v => !v)}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          style={{ paddingHorizontal: 3, opacity: showUrlInput ? 1 : 0.6 }}
        >
          <Feather name="globe" size={17} color={showUrlInput ? colors.accent : colors.mutedForeground} />
        </TouchableOpacity>

        {/* Drive — envia projeto como ZIP para Google Drive */}
        {apiBase && activeProject && (
          <TouchableOpacity
            onPress={async () => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const JSZip = (await import("jszip")).default;
                const zip = new JSZip();
                for (const f of activeProject.files) {
                  const path = (f.path || f.name).replace(/^\//, "");
                  if (!path.endsWith(".gitkeep")) zip.file(path, f.content || "");
                }
                const uint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
                // uint8 → base64
                let binary = "";
                for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
                const zipB64 = btoa(binary);
                const safeName = activeProject.name.replace(/[^a-zA-Z0-9_\-]/g, "_");
                const fileName = `devmobile-${safeName}-${Date.now()}.zip`;
                const resp = await fetch(`${apiBase}/api/drive/upload`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: fileName, zipBase64: zipB64 }),
                });
                const data = await resp.json() as { webViewLink?: string; name?: string; error?: string };
                if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                  "✅ Enviado para o Drive!",
                  `${data.name || fileName}\n\nO projeto foi salvo no Google Drive.`,
                  [
                    { text: "Fechar" },
                    { text: "Abrir Drive", onPress: () => data.webViewLink && Linking.openURL(data.webViewLink) },
                  ]
                );
              } catch (e: unknown) {
                Alert.alert("Erro ao enviar para Drive", e instanceof Error ? e.message : "Verifique se o servidor está ativo.", [{ text: "OK" }]);
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            style={{ paddingHorizontal: 3, opacity: 0.8 }}
          >
            <Feather name="upload-cloud" size={17} color="#4285f4" />
          </TouchableOpacity>
        )}

        <TextInput
          style={[
            styles.chatInput,
            { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
          value={input}
          onChangeText={(t) => { setInput(t); if (showQuickReplies) setShowQuickReplies(false); }}
          placeholder="Digite aqui e toque em ▶ Enviar"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={4000}
          returnKeyType="default"
          blurOnSubmit={false}
        />

        {/* Stop quando gerando / Enviar quando parado */}
        {isLoading ? (
          <TouchableOpacity
            onPress={stopGeneration}
            style={[styles.sendButton, { backgroundColor: "#ef4444" }]}
          >
            <Feather name="square" size={14} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => { if (input.trim()) sendMessage(); }}
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="send" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerTitle: { flex: 1, fontSize: 14, fontWeight: "600" },
  providerBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  providerText: { fontSize: 11 },
  noProvider: { fontSize: 11 },
  resetBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  modeBar: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickKeyPanel: {
    padding: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  cortesiaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  quickKeyTitle: { fontSize: 13, fontWeight: "600" },
  quickKeyInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  quickKeyBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  quickKeySave: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
  },
  messageBubble: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  userBubble: { alignSelf: "flex-end", maxWidth: "85%", borderWidth: 0 },
  aiBubble: { alignSelf: "stretch" },
  aiLabel: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  aiLabelText: { fontSize: 10, fontWeight: "700" },
  messageText: { fontSize: 14, lineHeight: 20 },
  emptyChat: { alignItems: "center", justifyContent: "center", paddingVertical: 40, paddingHorizontal: 16, gap: 8 },
  emptyChatText: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  contextHint: { fontSize: 12, fontWeight: "600" },
  suggestionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, width: "100%" },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestionChipText: { fontSize: 13, fontWeight: "500" },
  quickReplyBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: 50,
  },
  quickReplyRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    alignItems: "center",
  },
  quickReplyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickReplyText: { fontSize: 13, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  chatInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  urlPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  urlInput: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    fontSize: 13,
  },
  urlFetchBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  imgAttached: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderTopWidth: 1,
  },
});
