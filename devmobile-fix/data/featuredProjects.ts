export interface FeaturedProjectFile {
  path: string;
  content: string;
}

export interface FeaturedProject {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  badge?: string;
  files: FeaturedProjectFile[];
}

const APP_TSX = `import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  StatusBar, BackHandler, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

const STORAGE_KEY = "@assistente_juridico_url";
type Screen = "setup" | "loading" | "app";

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [serverUrl, setServerUrl] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [webError, setWebError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const webRef = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && saved.startsWith("http")) {
          setServerUrl(saved); setInputUrl(saved); setScreen("app");
        } else { setScreen("setup"); }
      } catch { setScreen("setup"); }
      finally { await SplashScreen.hideAsync(); }
    })();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showSettings) { setShowSettings(false); return true; }
      if (canGoBack && webRef.current) { webRef.current.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, showSettings]);

  const saveUrl = async (url: string) => {
    const clean = url.trim().replace(/\\/$/, "");
    if (!clean.startsWith("http")) {
      Alert.alert("URL inválida", "Cole a URL completa começando com https://");
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, clean);
    setServerUrl(clean); setInputUrl(clean);
    setShowSettings(false); setWebError(false); setScreen("app");
  };

  const clearUrl = async () => {
    Alert.alert("Redefinir servidor", "Isso vai te levar para a tela de configuração. Continuar?",
      [{ text: "Cancelar", style: "cancel" },
       { text: "Redefinir", style: "destructive", onPress: async () => {
           await AsyncStorage.removeItem(STORAGE_KEY);
           setServerUrl(""); setInputUrl(""); setWebError(false);
           setShowSettings(false); setScreen("setup");
         }
       }]
    );
  };

  if (screen === "loading") return (
    <View style={s.splash}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Text style={s.splashIcon}>⚖️</Text>
      <Text style={s.splashTitle}>Assistente Jurídico IA</Text>
      <ActivityIndicator color="#6366f1" style={{ marginTop: 24 }} />
    </View>
  );

  if (screen === "setup") return (
    <KeyboardAvoidingView style={s.setup} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={s.setupContent}>
        <Text style={s.setupIcon}>⚖️</Text>
        <Text style={s.setupTitle}>Assistente Jurídico IA</Text>
        <Text style={s.setupSub}>Maikon Caldeira — OAB/MG 183712</Text>
        <View style={s.card}>
          <Text style={s.cardTitle}>🌐 URL do Servidor</Text>
          <Text style={s.cardDesc}>Cole o endereço onde o Assistente Jurídico está hospedado (Railway, VPS, etc).</Text>
          <TextInput
            style={s.input} value={inputUrl} onChangeText={setInputUrl}
            placeholder="https://seuapp.seuservidor.com" placeholderTextColor="#64748b"
            autoCapitalize="none" autoCorrect={false} keyboardType="url"
            onSubmitEditing={() => saveUrl(inputUrl)}
          />
          <TouchableOpacity style={[s.btn, !inputUrl.trim() && s.btnOff]} disabled={!inputUrl.trim()} onPress={() => saveUrl(inputUrl)}>
            <Text style={s.btnText}>Conectar →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      {showSettings && (
        <View style={s.overlay}>
          <View style={s.settingsCard}>
            <Text style={s.settingsTitle}>⚙️ Configurações</Text>
            <Text style={s.lbl}>URL do Servidor</Text>
            <TextInput style={s.input} value={inputUrl} onChangeText={setInputUrl}
              placeholder="https://seuapp.seuservidor.com" placeholderTextColor="#64748b"
              autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <TouchableOpacity style={s.saveBtn} onPress={() => saveUrl(inputUrl)}>
              <Text style={s.saveBtnText}>Salvar URL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.reloadBtn} onPress={() => { setWebError(false); setShowSettings(false); webRef.current?.reload(); }}>
              <Text style={s.reloadBtnText}>Recarregar App</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.resetBtn} onPress={clearUrl}>
              <Text style={s.resetBtnText}>Redefinir Servidor</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.closeBtn} onPress={() => setShowSettings(false)}>
              <Text style={s.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {webError && !showSettings && (
        <View style={s.errorScreen}>
          <Text style={s.errorIcon}>📡</Text>
          <Text style={s.errorTitle}>Servidor não encontrado</Text>
          <Text style={s.errorDesc}>Não foi possível conectar a:{"\n"}{serverUrl}</Text>
          <TouchableOpacity style={s.btn} onPress={() => { setWebError(false); webRef.current?.reload(); }}>
            <Text style={s.btnText}>Tentar novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.textBtn} onPress={() => { setWebError(false); setInputUrl(serverUrl); setShowSettings(true); }}>
            <Text style={s.textBtnText}>Alterar URL do servidor</Text>
          </TouchableOpacity>
        </View>
      )}
      {!webError && (
        <WebView ref={webRef} source={{ uri: serverUrl }} style={s.webview}
          onNavigationStateChange={(st) => setCanGoBack(st.canGoBack)}
          onError={() => setWebError(true)}
          onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setWebError(true); }}
          startInLoadingState
          renderLoading={() => (
            <View style={s.loading}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={s.loadingText}>Conectando ao servidor...</Text>
            </View>
          )}
          javaScriptEnabled domStorageEnabled allowFileAccess
          mixedContentMode="always" allowUniversalAccessFromFileURLs
          userAgent="AssistenteJuridicoApp/1.0 (Android; Mobile)"
          pullToRefreshEnabled cacheEnabled cacheMode="LOAD_CACHE_ELSE_NETWORK"
        />
      )}
      {!showSettings && screen === "app" && (
        <TouchableOpacity style={s.fab} onPress={() => { setInputUrl(serverUrl); setShowSettings(true); }}>
          <Text style={s.fabIcon}>⚙</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const C = { bg: "#0f172a", card: "#1e293b", border: "#334155", primary: "#6366f1", text: "#f1f5f9", muted: "#94a3b8" };
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  webview: { flex: 1 },
  splash: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  splashIcon: { fontSize: 64, marginBottom: 16 },
  splashTitle: { color: C.text, fontSize: 22, fontWeight: "700" },
  setup: { flex: 1, backgroundColor: C.bg },
  setupContent: { flexGrow: 1, padding: 24, paddingTop: 60, alignItems: "center" },
  setupIcon: { fontSize: 72, marginBottom: 16 },
  setupTitle: { color: C.text, fontSize: 24, fontWeight: "800", textAlign: "center" },
  setupSub: { color: C.muted, fontSize: 13, marginTop: 4, marginBottom: 32, textAlign: "center" },
  card: { width: "100%", backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  cardDesc: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 16 },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, color: C.text, fontSize: 14, marginBottom: 16 },
  btn: { backgroundColor: C.primary, borderRadius: 10, padding: 14, alignItems: "center" },
  btnOff: { opacity: 0.4 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)", zIndex: 100, justifyContent: "center", padding: 20 },
  settingsCard: { backgroundColor: C.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: C.border },
  settingsTitle: { color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 20, textAlign: "center" },
  lbl: { color: C.muted, fontSize: 12, marginBottom: 6 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 10 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  reloadBtn: { backgroundColor: "#0369a1", borderRadius: 10, padding: 12, alignItems: "center", marginBottom: 10 },
  reloadBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  resetBtn: { borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#ef444466", marginBottom: 10 },
  resetBtnText: { color: "#ef4444", fontWeight: "600", fontSize: 14 },
  closeBtn: { padding: 12, alignItems: "center" },
  closeBtnText: { color: C.muted, fontSize: 14 },
  errorScreen: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 32 },
  errorIcon: { fontSize: 64, marginBottom: 20 },
  errorTitle: { color: C.text, fontSize: 20, fontWeight: "800", marginBottom: 12, textAlign: "center" },
  errorDesc: { color: C.muted, fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 20 },
  textBtn: { padding: 12 },
  textBtnText: { color: C.muted, fontSize: 14 },
  loading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  loadingText: { color: C.muted, fontSize: 14, marginTop: 16 },
  fab: { position: "absolute", bottom: 24, right: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: "#1e293bcc", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  fabIcon: { fontSize: 20 },
});
`;

const APP_JSON = `{
  "expo": {
    "name": "Assistente Jurídico IA",
    "slug": "assistente-juridico",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "scheme": "assistentejuridico",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0f172a"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.maikoncaldeira.assistentejuridico"
    },
    "android": {
      "package": "com.maikoncaldeira.assistentejuridico",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0f172a"
      },
      "permissions": [
        "android.permission.INTERNET",
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.DOWNLOAD_WITHOUT_NOTIFICATION"
      ],
      "usesCleartextTraffic": true
    },
    "web": { "favicon": "./assets/favicon.png" },
    "plugins": ["expo-splash-screen"],
    "owner": "maikons-individual-orga2",
    "extra": {
      "eas": {
        "projectId": "cdf4f804-8f80-4135-8a15-4b60a9f304b0"
      }
    }
  }
}`;

const EAS_JSON = `{
  "cli": {
    "version": ">= 10.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": { "production": {} }
}`;

const PACKAGE_JSON = `{
  "name": "assistente-juridico-apk",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "build:preview": "EAS_NO_VCS=1 eas build --platform android --profile preview --non-interactive",
    "build:prod": "EAS_NO_VCS=1 eas build --platform android --profile production --non-interactive"
  },
  "dependencies": {
    "expo": "~54.0.34",
    "expo-status-bar": "~2.0.1",
    "expo-splash-screen": "~0.29.22",
    "expo-constants": "~17.0.8",
    "react": "18.3.1",
    "react-native": "0.76.9",
    "react-native-webview": "13.12.5",
    "@react-native-async-storage/async-storage": "2.1.2"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.3.11",
    "typescript": "^5.3.3"
  },
  "private": true
}`;

const TSCONFIG_JSON = `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": { "strict": true }
}`;

const BABEL_CONFIG = `module.exports = function(api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};`;

const COMO_COMPILAR = `# Assistente Jurídico IA — Como Compilar o APK

## O que é este projeto
App Android nativo que abre o Assistente Jurídico IA num WebView.
- Funciona como app real instalado no celular
- Botão voltar do Android funciona normalmente
- Salva a URL do servidor no aparelho
- Tela de erro quando o servidor estiver offline

## Conta EAS configurada
- Conta: maikons-individual-orga2
- Projeto: assistente-juridico
- ProjectID: cdf4f804-8f80-4135-8a15-4b60a9f304b0

## Compilar via EAS (recomendado)
Execute no Termux ou terminal:

  pkg install nodejs
  npm install -g eas-cli
  npm install
  eas login
  EAS_NO_VCS=1 eas build --platform android --profile preview

O APK ficará disponível em:
https://expo.dev/accounts/maikons-individual-orga2/projects/assistente-juridico/builds

## Após instalar o APK
Cole a URL do seu servidor quando o app pedir.
Exemplo: https://assistente-juridico.seuservidor.com
`;

// ── Templates dos modelos top de linha ──────────────────────────────────────

const GROQ_SERVER = `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GROQ_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Groq é GRATUITO — crie sua chave em console.groq.com
app.post('/api/chat', async (req, res) => {
  const { messages, system } = req.body;
  if (!GROQ_KEY) return res.status(400).json({ erro: 'GROQ_API_KEY não configurada no .env' });

  try {
    const groqMsgs = [];
    if (system) groqMsgs.push({ role: 'system', content: system });
    groqMsgs.push(...(messages || []));

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${GROQ_KEY}\` },
      body: JSON.stringify({ model: MODEL, messages: groqMsgs, max_tokens: 8192 }),
    });

    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ erro: data.error?.message || 'Erro Groq' });
    res.json({ resposta: data.choices[0].message.content, modelo: MODEL });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/saude', (req, res) => res.json({ status: 'ok', modelo: MODEL, gratis: true }));

app.listen(PORT, () => {
  console.log(\`Servidor Groq rodando: http://localhost:\${PORT}\`);
  console.log(\`Modelo: \${MODEL}\`);
  console.log(\`Gratuito: sim — console.groq.com\`);
});
`;

const GROQ_ENV = `# Cole sua chave GRATUITA do Groq aqui
# Crie em: https://console.groq.com/keys
GROQ_API_KEY=gsk_SUA_CHAVE_AQUI

# Modelos disponíveis (todos gratuitos):
# llama-3.3-70b-versatile  ← recomendado (mais inteligente)
# llama-3.1-8b-instant     ← mais rápido
# mixtral-8x7b-32768       ← contexto enorme
# gemma2-9b-it             ← Google Gemma
GROQ_MODEL=llama-3.3-70b-versatile

PORT=3000
`;

const GROQ_README = `# API Chat com Groq (GRATUITO)

## O que é o Groq?
Groq é uma plataforma de IA **100% gratuita** que oferece os melhores modelos de linguagem abertos
com velocidade extremamente rápida. Inclui Llama 3.3 70B, Mixtral, Gemma e outros.

## Como usar

### 1. Criar chave gratuita
1. Acesse https://console.groq.com
2. Clique em "API Keys" → "Create API Key"
3. Copie a chave (começa com gsk_...)
4. Cole no arquivo **.env** em \`GROQ_API_KEY=\`

### 2. Instalar e rodar
\`\`\`bash
npm install
npm start
\`\`\`

### 3. Testar
\`\`\`bash
curl -X POST http://localhost:3000/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Olá! Quem é você?"}]}'
\`\`\`

## Modelos gratuitos disponíveis
| Modelo | Tokens/min | Melhor para |
|--------|-----------|-------------|
| llama-3.3-70b-versatile | 6.000 | Tudo — mais inteligente |
| llama-3.1-8b-instant | 30.000 | Velocidade máxima |
| mixtral-8x7b-32768 | 5.000 | Contexto longo (32k) |
| gemma2-9b-it | 15.000 | Análise de texto |
`;

const CLAUDE_SERVER = `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-20250514';

// Claude da Anthropic — modelos mais avançados do mundo
app.post('/api/chat', async (req, res) => {
  const { messages, system } = req.body;
  if (!CLAUDE_KEY) return res.status(400).json({ erro: 'ANTHROPIC_API_KEY não configurada no .env' });

  try {
    const body = {
      model: MODEL,
      max_tokens: 8192,
      messages: messages || [],
    };
    if (system) body.system = system;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ erro: data.error?.message || 'Erro Claude' });
    res.json({ resposta: data.content[0].text, modelo: MODEL });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/saude', (req, res) => res.json({ status: 'ok', modelo: MODEL }));

app.listen(PORT, () => {
  console.log(\`Servidor Claude rodando: http://localhost:\${PORT}\`);
  console.log(\`Modelo: \${MODEL}\`);
});
`;

const CLAUDE_ENV = `# Chave da Anthropic (Claude)
# Crie em: https://console.anthropic.com/keys
ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI

# Modelos Claude disponíveis:
# claude-haiku-4-20250514    ← mais rápido e barato
# claude-sonnet-4-20250514   ← melhor custo-benefício
# claude-opus-4-20250514     ← mais inteligente do mundo
CLAUDE_MODEL=claude-haiku-4-20250514

PORT=3000
`;

const GEMINI_SERVER = `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// Google Gemini — gratuito com limite generoso
app.post('/api/chat', async (req, res) => {
  const { messages, system } = req.body;
  if (!GEMINI_KEY) return res.status(400).json({ erro: 'GEMINI_API_KEY não configurada no .env' });

  try {
    // Gemini usa formato OpenAI-compatible via endpoint /openai/
    const geminiMsgs = [];
    if (system) geminiMsgs.push({ role: 'user', content: \`[Sistema]: \${system}\` });
    geminiMsgs.push(...(messages || []));

    const resp = await fetch(\`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${GEMINI_KEY}\` },
      body: JSON.stringify({ model: MODEL, messages: geminiMsgs, max_tokens: 8192 }),
    });

    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ erro: data.error?.message || 'Erro Gemini' });
    res.json({ resposta: data.choices[0].message.content, modelo: MODEL });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/api/saude', (req, res) => res.json({ status: 'ok', modelo: MODEL }));

app.listen(PORT, () => {
  console.log(\`Servidor Gemini rodando: http://localhost:\${PORT}\`);
  console.log(\`Modelo: \${MODEL}\`);
  console.log(\`Chave gratuita: aistudio.google.com\`);
});
`;

const GEMINI_ENV = `# Chave GRATUITA do Google Gemini
# Crie em: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSUA_CHAVE_AQUI

# Modelos Gemini disponíveis:
# gemini-2.0-flash           ← recomendado (rápido + inteligente)
# gemini-2.5-pro             ← mais avançado
# gemini-2.5-flash           ← ultra-rápido
GEMINI_MODEL=gemini-2.0-flash

PORT=3000
`;

const MULTI_IA_SERVER = `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Configuração de todos os provedores
const PROVIDERS = {
  groq: {
    nome: 'Groq (Gratuito)',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    chave: process.env.GROQ_API_KEY,
    modelo: 'llama-3.3-70b-versatile',
    cabecalho: (k) => ({ Authorization: \`Bearer \${k}\` }),
    parseResposta: (d) => d.choices[0].message.content,
  },
  gemini: {
    nome: 'Google Gemini (Gratuito)',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    chave: process.env.GEMINI_API_KEY,
    modelo: 'gemini-2.0-flash',
    cabecalho: (k) => ({ Authorization: \`Bearer \${k}\` }),
    parseResposta: (d) => d.choices[0].message.content,
  },
  claude: {
    nome: 'Anthropic Claude',
    url: 'https://api.anthropic.com/v1/messages',
    chave: process.env.ANTHROPIC_API_KEY,
    modelo: 'claude-haiku-4-20250514',
    cabecalho: (k) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01' }),
    parseResposta: (d) => d.content[0].text,
    formatarBody: (msgs, sys, modelo) => ({ model: modelo, max_tokens: 4096, messages: msgs, ...(sys ? { system: sys } : {}) }),
  },
  openai: {
    nome: 'OpenAI GPT-4o',
    url: 'https://api.openai.com/v1/chat/completions',
    chave: process.env.OPENAI_API_KEY,
    modelo: 'gpt-4o-mini',
    cabecalho: (k) => ({ Authorization: \`Bearer \${k}\` }),
    parseResposta: (d) => d.choices[0].message.content,
  },
};

// Rota principal: escolhe provedor automaticamente ou por parâmetro
app.post('/api/chat', async (req, res) => {
  const { messages, system, provedor } = req.body;

  // Escolhe o primeiro provedor com chave configurada, ou o especificado
  let p = provedor ? PROVIDERS[provedor] : null;
  if (!p) {
    p = Object.values(PROVIDERS).find(x => x.chave);
  }
  if (!p || !p.chave) {
    return res.status(400).json({
      erro: 'Nenhuma chave de IA configurada no .env',
      dica: 'Configure GROQ_API_KEY (gratuito) em console.groq.com',
    });
  }

  try {
    const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
    const body = p.formatarBody
      ? p.formatarBody(messages, system, p.modelo)
      : { model: p.modelo, messages: msgs, max_tokens: 4096 };

    const resp = await fetch(p.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...p.cabecalho(p.chave) },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || \`Erro \${resp.status}\`);
    res.json({ resposta: p.parseResposta(data), provedor: p.nome, modelo: p.modelo });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Lista provedores configurados
app.get('/api/provedores', (req, res) => {
  res.json(Object.entries(PROVIDERS).map(([id, p]) => ({
    id, nome: p.nome, modelo: p.modelo, configurado: !!p.chave,
  })));
});

app.get('/api/saude', (req, res) => res.json({ status: 'ok', provedores: Object.keys(PROVIDERS) }));

app.listen(PORT, () => {
  console.log(\`Multi-IA rodando: http://localhost:\${PORT}\`);
  const configurados = Object.values(PROVIDERS).filter(p => p.chave).map(p => p.nome);
  console.log(\`Provedores ativos: \${configurados.join(', ') || 'nenhum — configure .env'}\`);
});
`;

const MULTI_IA_ENV = `# ═══════════════════════════════════════════
# API Multi-Modelo — configure pelo menos UM
# ═══════════════════════════════════════════

# GROQ — GRATUITO, mais rápido
# Crie em: https://console.groq.com/keys
GROQ_API_KEY=gsk_SUA_CHAVE_AQUI

# GEMINI — GRATUITO, Google
# Crie em: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSUA_CHAVE_AQUI

# CLAUDE — Pago, mais inteligente do mundo
# Crie em: https://console.anthropic.com/keys
ANTHROPIC_API_KEY=sk-ant-SUA_CHAVE_AQUI

# OPENAI — Pago, GPT-4o
# Crie em: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-SUA_CHAVE_AQUI

PORT=3000
`;

const PKG_IA = `{
  "name": "api-ia",
  "version": "1.0.0",
  "description": "API com integração de IA",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
`;

export const FEATURED_PROJECTS: FeaturedProject[] = [
  {
    id: "assistente-juridico-apk",
    name: "Assistente Jurídico IA",
    description: "App nativo Android para Maikon Caldeira OAB/MG 183712. Abre o Assistente Jurídico IA em WebView nativo. EAS já configurado.",
    icon: "⚖️",
    color: "#6366f1",
    badge: "EAS PRONTO",
    files: [
      { path: "App.tsx", content: APP_TSX },
      { path: "app.json", content: APP_JSON },
      { path: "eas.json", content: EAS_JSON },
      { path: "package.json", content: PACKAGE_JSON },
      { path: "tsconfig.json", content: TSCONFIG_JSON },
      { path: "babel.config.js", content: BABEL_CONFIG },
      { path: "COMO_COMPILAR.md", content: COMO_COMPILAR },
    ],
  },
  {
    id: "api-groq-gratis",
    name: "API com Groq (Gratuito)",
    description: "API Node.js usando Groq — 100% gratuito, llama-3.3-70b. O modelo mais rápido e inteligente sem pagar nada. Ideal para começar.",
    icon: "⚡",
    color: "#22c55e",
    badge: "GRÁTIS",
    files: [
      { path: "server.js", content: GROQ_SERVER },
      { path: ".env", content: GROQ_ENV },
      { path: "package.json", content: PKG_IA },
      { path: ".gitignore", content: "node_modules/\n.env\n*.log\n" },
      { path: "README.md", content: GROQ_README },
    ],
  },
  {
    id: "api-gemini-gratis",
    name: "API com Gemini (Gratuito)",
    description: "API Node.js usando Google Gemini 2.0 Flash — gratuito com limite generoso. Crie a chave em aistudio.google.com.",
    icon: "✨",
    color: "#3b82f6",
    badge: "GRÁTIS",
    files: [
      { path: "server.js", content: GEMINI_SERVER },
      { path: ".env", content: GEMINI_ENV },
      { path: "package.json", content: PKG_IA },
      { path: ".gitignore", content: "node_modules/\n.env\n*.log\n" },
      { path: "README.md", content: "# API com Google Gemini\n\n## Chave gratuita\n1. Acesse https://aistudio.google.com/app/apikey\n2. Crie uma chave (começa com AIza...)\n3. Cole no .env em `GEMINI_API_KEY=`\n\n## Rodar\n```bash\nnpm install\nnpm start\n```\n\n## Testar\n```bash\ncurl -X POST http://localhost:3000/api/chat \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"messages\":[{\"role\":\"user\",\"content\":\"Olá!\"}]}'\n```\n" },
    ],
  },
  {
    id: "api-claude",
    name: "API com Claude (Anthropic)",
    description: "API Node.js usando Claude Haiku — o modelo mais inteligente do mundo. Precisa de chave paga da Anthropic.",
    icon: "🧠",
    color: "#f59e0b",
    badge: "TOP",
    files: [
      { path: "server.js", content: CLAUDE_SERVER },
      { path: ".env", content: CLAUDE_ENV },
      { path: "package.json", content: PKG_IA },
      { path: ".gitignore", content: "node_modules/\n.env\n*.log\n" },
      { path: "README.md", content: "# API com Claude (Anthropic)\n\n## Chave da API\n1. Acesse https://console.anthropic.com/keys\n2. Crie uma chave (sk-ant-...)\n3. Cole no .env em `ANTHROPIC_API_KEY=`\n\n## Modelos disponíveis\n- `claude-haiku-4-20250514` — mais rápido e barato\n- `claude-sonnet-4-20250514` — melhor custo-benefício\n- `claude-opus-4-20250514` — mais inteligente\n\n## Rodar\n```bash\nnpm install\nnpm start\n```\n" },
    ],
  },
  {
    id: "api-multi-ia",
    name: "API Multi-Modelo (Groq + Claude + Gemini)",
    description: "API que funciona com QUALQUER provedor: Groq (grátis), Gemini (grátis), Claude, GPT-4o. Configure pelo menos um no .env.",
    icon: "🚀",
    color: "#7c3aed",
    badge: "TOP DE LINHA",
    files: [
      { path: "server.js", content: MULTI_IA_SERVER },
      { path: ".env", content: MULTI_IA_ENV },
      { path: "package.json", content: PKG_IA },
      { path: ".gitignore", content: "node_modules/\n.env\n*.log\n" },
      { path: "README.md", content: "# API Multi-Modelo IA\n\nAPI que suporta Groq, Gemini, Claude e OpenAI num só projeto.\n\n## Início rápido (gratuito)\n1. Crie chave Groq em https://console.groq.com/keys\n2. Cole no .env: `GROQ_API_KEY=gsk_...`\n3. `npm install && npm start`\n\n## Endpoints\n- `POST /api/chat` — envia mensagem para a IA\n- `GET /api/provedores` — lista provedores configurados\n- `GET /api/saude` — status\n\n## Escolher provedor\n```json\n{\"provedor\": \"groq\", \"messages\": [{\"role\": \"user\", \"content\": \"Olá!\"}]}\n```\nProvedor omitido = usa o primeiro configurado automaticamente.\n" },
    ],
  },
];
