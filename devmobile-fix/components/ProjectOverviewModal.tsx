import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SECTIONS = [
  { id: "visao",    icon: "🎯", title: "Visão Geral" },
  { id: "stack",    icon: "🏗️", title: "Stack" },
  { id: "telas",    icon: "📱", title: "Telas" },
  { id: "api",      icon: "🔌", title: "Rotas API" },
  { id: "terminal", icon: "🖥️", title: "Terminal" },
  { id: "ia",       icon: "🤖", title: "IA" },
  { id: "plugins",  icon: "🔧", title: "Plugins" },
  { id: "github",   icon: "🐙", title: "GitHub" },
  { id: "limites",  icon: "⚠️", title: "Limites" },
  { id: "recriar",  icon: "🔄", title: "Recriar" },
];

export default function ProjectOverviewModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState("visao");
  const [copied, setCopied] = useState("");

  const copy = useCallback(async (text: string, key: string) => {
    try { await Clipboard.setStringAsync(text); setCopied(key); setTimeout(() => setCopied(""), 1800); } catch {}
  }, []);

  const mono = Platform.OS === "ios" ? "Menlo" : "monospace";
  const green = "#22c55e";
  const blue  = "#60a5fa";
  const yellow = "#fcd34d";
  const purple = "#a78bfa";

  const H1 = ({ children }: { children: string }) => (
    <Text style={{ color: green, fontWeight: "800", fontSize: 16, marginTop: 4, marginBottom: 8, letterSpacing: 0.3 }}>{children}</Text>
  );
  const H2 = ({ children }: { children: string }) => (
    <Text style={{ color: blue, fontWeight: "700", fontSize: 14, marginTop: 16, marginBottom: 6 }}>{children}</Text>
  );
  const H3 = ({ children }: { children: string }) => (
    <Text style={{ color: "#86efac", fontWeight: "600", fontSize: 13, marginTop: 10, marginBottom: 4 }}>{children}</Text>
  );
  const P = ({ children }: { children: string }) => (
    <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 20, marginBottom: 6 }}>{children}</Text>
  );
  const Li = ({ label, val }: { label: string; val?: string }) => (
    <View style={{ flexDirection: "row", marginBottom: 5, gap: 6 }}>
      <Text style={{ color: green, fontSize: 13, marginTop: 1 }}>›</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{label}</Text>
        {val ? <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>{val}</Text> : null}
      </View>
    </View>
  );
  const Badge = ({ text, color }: { text: string; color: string }) => (
    <View style={{ backgroundColor: `${color}22`, borderWidth: 1, borderColor: `${color}55`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 4 }}>
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{text}</Text>
    </View>
  );
  const Code = ({ children, copyKey }: { children: string; copyKey?: string }) => (
    <View style={{ backgroundColor: "#0d1117", borderWidth: 1, borderColor: "#1e2d1e", borderRadius: 8, padding: 12, marginBottom: 10, position: "relative" }}>
      <Text style={{ color: "#a8d5a2", fontFamily: mono, fontSize: 12, lineHeight: 18 }}>{children}</Text>
      {copyKey && (
        <TouchableOpacity
          onPress={() => copy(children, copyKey)}
          style={{ position: "absolute", top: 8, right: 8, backgroundColor: "#1a3d14", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 }}
        >
          <Text style={{ color: green, fontSize: 11, fontWeight: "600" }}>{copied === copyKey ? "✓ Copiado" : "Copiar"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
  const Info = ({ color, children }: { color: string; children: string }) => (
    <View style={{ backgroundColor: `${color}15`, borderWidth: 1, borderColor: `${color}40`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <Text style={{ color, fontSize: 13, lineHeight: 20 }}>{children}</Text>
    </View>
  );
  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );

  const renderContent = () => {
    switch (active) {

      case "visao": return (
        <View>
          <H1>{"DevMobile — IDE Real no Celular"}</H1>
          <Info color={green}>{"Um IDE completo para Android que conecta a um servidor Linux real (Node.js) e executa código de verdade — não simulação."}</Info>

          <H2>{"📦 Versão Atual"}</H2>
          <Row label="Versão do app" value="1.5.0 (versionCode 8)" />
          <Row label="SDK Expo" value="54.0.0 (SDK 54)" />
          <Row label="React Native" value="0.76+" />
          <Row label="Plataforma" value="Android (APK via EAS)" />
          <Row label="Pacote Android" value="com.devmobile.ide" />
          <Row label="Projeto Expo" value="oab183/caldeira" />

          <H2>{"🎯 O que o app faz"}</H2>
          <Li label="Editor de código" val="Syntax highlight para 20+ linguagens, abas, autocomplete" />
          <Li label="Terminal Linux real" val="Executa bash, node, python, npm — via SSE no servidor" />
          <Li label="VS Code no celular" val="code-server rodando no servidor, WebView no app" />
          <Li label="IA integrada (Jasmim)" val="11 provedores: Gemini grátis + OpenAI, Claude, Groq, etc." />
          <Li label="GitHub completo" val="Clone, push, pull, criar repo — com token pessoal" />
          <Li label="Instalador de plugins" val="Java, Go, Rust, Python, PHP, Ruby, Node, etc." />
          <Li label="Preview ao vivo" val="Detecta portas abertas, abre no WebView" />
          <Li label="Banco de dados" val="Neon, PostgreSQL, SQLite — executa queries" />
          <Li label="Playground HTML/React/JS" val="Renderiza ao vivo sem criar projeto" />
          <Li label="Campo Livre (IA geral)" val="IA conversacional com busca na web e upload de arquivos" />
          <Li label="Servidor configurável" val="Servidor configurável (Termux/VPS)" />

          <H2>{"📁 Estrutura do Monorepo"}</H2>
          <Code copyKey="struct">{"artifacts/\n  mobile/          ← App React Native (Expo)\n  api-server/      ← Servidor Node.js/Express\n  mockup-sandbox/  ← Servidor de previews\nlib/               ← Bibliotecas compartilhadas\nscripts/           ← Scripts utilitários"}</Code>
        </View>
      );

      case "stack": return (
        <View>
          <H1>{"Stack Técnica"}</H1>

          <H2>{"📱 App Mobile (artifacts/mobile)"}</H2>
          <Li label="Framework" val="Expo SDK 54 + React Native 0.76" />
          <Li label="Navegação" val="Expo Router (file-based, tabs)" />
          <Li label="Estado global" val="React Context (AppContext.tsx)" />
          <Li label="Armazenamento local" val="AsyncStorage — projetos, configs, sessões" />
          <Li label="HTTP/SSE" val="expo/fetch para streaming do terminal" />
          <Li label="WebView" val="react-native-webview — VS Code e Preview" />
          <Li label="Editor" val="react-native-code-editor (syntax highlight)" />
          <Li label="Build" val="EAS Build — profile 'preview' → APK Android" />
          <Li label="TypeScript" val="Strict mode, sem JSX namespace" />

          <H2>{"🖥️ Servidor API (artifacts/api-server)"}</H2>
          <Li label="Runtime" val="Node.js v24 + TypeScript" />
          <Li label="Framework" val="Express.js" />
          <Li label="Terminal" val="node-pty (pseudo-terminal) + SSE streaming" />
          <Li label="Porta" val="8080 (env PORT)" />
          <Li label="VS Code" val="code-server proxy — todas rotas não-/api" />
          <Li label="IA proxy" val="API gratuita (Gemini 2.5)" />
          <Li label="GitHub" val="API REST do GitHub via token Bearer" />
          <Li label="Busca web" val="DuckDuckGo Lite scraping" />

          <H2>{"🏗️ Gerenciador de Pacotes"}</H2>
          <Li label="Workspace" val="pnpm workspaces (pnpm-workspace.yaml)" />
          <Li label="Build" val="tsc --noEmit (leaf packages, sem emit)" />
          <Li label="Dev" val="Workflows internos" />

          <H2>{"🚀 Deploy / Build"}</H2>
          <Li label="APK Android" val="EAS Build — profile: preview, distribution: internal" />
          <Li label="Servidor" val="Servidor externo (auto-deploy em push)" />
          <Li label="Variável de env" val="EXPO_PUBLIC_DOMAIN = seu domínio" />
          <Li label="EAS Project ID" val="5a362717-5618-472c-8ba6-3580aad41bfa" />
          <Code copyKey="eas-cmd">{"# Gerar novo APK:\ncd artifacts/mobile\nEAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN \\\n  eas build --platform android \\\n  --profile preview --non-interactive --no-wait"}</Code>
        </View>
      );

      case "telas": return (
        <View>
          <H1>{"Telas e Componentes"}</H1>

          <H2>{"📂 Abas principais (app/(tabs)/)"}</H2>
          <Li label="index.tsx — Editor" val="Editor de código, seletor de projetos/arquivos, templates, salvar/rodar" />
          <Li label="terminal.tsx — Terminal" val="Sessões de terminal, histórico, entrada de comandos" />
          <Li label="plugins.tsx — Plugins" val="Instalador de linguagens/ferramentas via nix-env ou cargo" />
          <Li label="settings.tsx — Configurações" val="IA, GitHub, Banco, Editor, Servidor, Sobre" />

          <H2>{"🧩 Componentes principais (components/)"}</H2>
          <Li label="Terminal.tsx" val="Terminal SSE real — sessões, linhas coloridas, autocomplete" />
          <Li label="AIChat.tsx" val="Chat IA com streaming, 11 provedores, contexto de arquivo" />
          <Li label="VSCodeView.tsx" val="VS Code via WebView + upload/download de arquivos" />
          <Li label="PreviewPanel.tsx" val="Preview de portas, URL customizada, WebView" />
          <Li label="GitHubModal.tsx" val="Clone, push, criar repo, gerenciar token" />
          <Li label="SystemStatus.tsx" val="Checa 11 serviços: internet, API, Node, Python, Git, etc." />
          <Li label="CampoLivreModal.tsx" val="IA conversacional geral, busca web, upload de arquivo, fala" />
          <Li label="ManualModal.tsx" val="Manual do usuário com 12 seções" />
          <Li label="ProjectOverviewModal.tsx" val="Este modal — visão técnica completa" />
          <Li label="HtmlPlayground.tsx" val="Playground HTML/React/JS ao vivo" />
          <Li label="AIMemoryModal.tsx" val="Memórias persistentes da IA" />
          <Li label="CheckpointsModal.tsx" val="Salvar e restaurar versões do projeto" />
          <Li label="MessageRenderer.tsx" val="Renderiza markdown do chat IA" />

          <H2>{"🗂️ Context e Hooks"}</H2>
          <Li label="context/AppContext.tsx" val="Estado global: projetos, arquivos, terminal, IA, settings" />
          <Li label="hooks/useApiBase.ts" val="Retorna URL do servidor (custom ou padrão)" />
          <Li label="hooks/useColors.ts" val="Tema de cores (dark/darker/monokai/dracula)" />
        </View>
      );

      case "api": return (
        <View>
          <H1>{"Rotas da API (api-server)"}</H1>
          <Info color={blue}>{"Base URL: https://SEU_DOMINIO/api\nTodas as rotas usam JSON. Terminal usa SSE."}</Info>

          <H2>{"🖥️ Terminal — /api/terminal"}</H2>
          <Li label="POST /exec" val="Executa comando e retorna saída (JSON)" />
          <Li label="POST /write" val="Envia input para sessão ativa (stdin)" />
          <Li label="GET /read?sessionId=X" val="Lê buffer de saída da sessão" />
          <Li label="GET /stream?sessionId=X" val="SSE — streaming ao vivo de saída do terminal" />
          <Li label="POST /kill" val="Encerra processo em execução (Ctrl+C)" />
          <Li label="GET /sessions" val="Lista sessões abertas" />

          <H2>{"🤖 IA — /api/ai"}</H2>
          <Li label="POST /ai/chat" val="Proxy Gemini grátis — SSE streaming de resposta" />

          <H2>{"🐙 GitHub — /api/github"}</H2>
          <Li label="GET /github/user" val="Busca perfil do usuário (x-github-token header)" />
          <Li label="GET /github/repos" val="Lista repositórios do usuário" />
          <Li label="POST /github/clone" val="Clona repo para pasta do servidor" />
          <Li label="POST /github/create-repo" val="Cria novo repositório no GitHub" />
          <Li label="POST /github/push-files" val="Faz commit e push de arquivos" />

          <H2>{"🌐 Preview — /api/preview"}</H2>
          <Li label="GET /preview/check?port=X" val="Verifica se uma porta está aberta" />
          <Li label="GET /preview/port/:port/*" val="Proxy reverso para porta X do servidor" />

          <H2>{"🔍 Busca — /api/search"}</H2>
          <Li label="GET /search?q=texto" val="Busca DuckDuckGo, retorna array de resultados" />

          <H2>{"❤️ Health — /api/healthz"}</H2>
          <Li label="GET /healthz" val="Retorna {ok:true} se o servidor está no ar" />

          <H2>{"🖥️ VS Code (fora de /api)"}</H2>
          <Li label="GET /*" val="Todas as rotas não-/api são proxy para o code-server" />

          <H2>{"📡 SSE — como funciona"}</H2>
          <P>{"O terminal usa Server-Sent Events para streaming ao vivo. O app usa expo/fetch com ReadableStream para ler chunks de texto em tempo real sem polling."}</P>
          <Code copyKey="sse-ex">{"// Exemplo de conexão SSE no app:\nconst res = await fetch(`${apiBase}/api/terminal/stream?sessionId=X`);\nconst reader = res.body.getReader();\nwhile (true) {\n  const {value, done} = await reader.read();\n  if (done) break;\n  const text = new TextDecoder().decode(value);\n  // processar linha...\n}"}</Code>
        </View>
      );

      case "terminal": return (
        <View>
          <H1>{"Sistema de Terminal"}</H1>

          <H2>{"⚙️ Como funciona"}</H2>
          <P>{"O servidor usa node-pty para criar um pseudo-terminal (PTY) real — igual a abrir um terminal no Linux. Cada sessão tem um processo bash independente."}</P>
          <Li label="PTY real" val="Não é exec() — é um terminal interativo de verdade" />
          <Li label="Sessões múltiplas" val="Cada aba do terminal é uma sessão separada" />
          <Li label="Streaming SSE" val="Saída chega em tempo real via Server-Sent Events" />
          <Li label="Estado persistente" val="Sessões sobrevivem entre telas do app" />

          <H2>{"🔧 PATH configurado no servidor"}</H2>
          <Code copyKey="path">{"PATH=/home/runner/.nix-profile/bin\n     :/home/runner/.cargo/bin\n     :/usr/local/sbin:/usr/local/bin\n     :/usr/bin:/bin"}</Code>

          <H2>{"✅ Ferramentas pré-instaladas"}</H2>
          <Li label="Node.js v24" val="+ npm v11, npx" />
          <Li label="Python 3.11" val="+ pip3" />
          <Li label="GCC/G++ 14" val="Compilador C/C++" />
          <Li label="Git" val="Controle de versão" />
          <Li label="Bash" val="Shell padrão" />
          <Li label="curl, wget" val="HTTP clients" />

          <H2>{"🔧 Ferramentas instaláveis (via Plugins)"}</H2>
          <Li label="Java" val="nix-env -iA nixpkgs.jdk17" />
          <Li label="Go" val="nix-env -iA nixpkgs.go" />
          <Li label="Rust" val="rustup install stable" />
          <Li label="PHP" val="nix-env -iA nixpkgs.php" />
          <Li label="Ruby" val="nix-env -iA nixpkgs.ruby" />
          <Li label="Lua" val="nix-env -iA nixpkgs.lua5_4" />
          <Li label="Kotlin" val="nix-env -iA nixpkgs.kotlin" />

          <H2>{"🌐 Ambiente do servidor"}</H2>
          <Li label="OS" val="Linux (servidor)" />
          <Li label="Usuário" val="runner" />
          <Li label="Home" val="/home/runner" />
          <Li label="Nix packages" val="nixpkgs — qualquer pacote do nixpkgs.search" />
        </View>
      );

      case "ia": return (
        <View>
          <H1>{"Sistema de IA (Jasmim)"}</H1>

          <H2>{"🎯 Provedores suportados"}</H2>
          <Li label="✨ Cortesia Gemini" val="GRÁTIS — proxy via API gratuita. Sem chave necessária." />
          <Li label="Groq" val="Llama 3.3 70B, Mixtral, Gemma — muito rápido, plano grátis generoso" />
          <Li label="OpenAI" val="GPT-4.1, GPT-4o, o3-mini — requer chave paga" />
          <Li label="Anthropic" val="Claude Opus/Sonnet/Haiku — requer chave paga" />
          <Li label="Google Gemini" val="Gemini 2.5 Pro/Flash — requer chave do AI Studio" />
          <Li label="xAI / Grok" val="Grok-3, Grok-3-mini" />
          <Li label="OpenRouter" val="Acesso a 100+ modelos com uma chave" />
          <Li label="Perplexity" val="Modelos com busca na web integrada" />
          <Li label="DeepSeek" val="R1, V3 — excelente custo-benefício" />
          <Li label="Mistral" val="Mistral Large, Codestral" />
          <Li label="Custom" val="Qualquer endpoint OpenAI-compatível (LM Studio, Ollama, etc.)" />

          <H2>{"🔧 Como adiciona nova chave"}</H2>
          <P>{"Configurações → IA → + Adicionar Chave. O app detecta o provedor automaticamente pelo prefixo da chave."}</P>

          <H2>{"🧠 Memória da IA"}</H2>
          <P>{"A IA tem memória persistente (AIMemoryModal). Você pode salvar fatos, preferências, contexto de projeto. A memória é incluída automaticamente em todas as conversas."}</P>

          <H2>{"📡 Proxy Cortesia (grátis)"}</H2>
          <P>{"O provedor 'Cortesia Gemini' usa a API gratuita para acessar o Gemini sem custo. A rota /api/ai/chat no servidor faz o proxy com SSE streaming."}</P>
          <Info color={yellow}>{"⚠️ A Cortesia funciona apenas com o servidor externo. Com Termux, use um provedor com chave própria."}</Info>
        </View>
      );

      case "plugins": return (
        <View>
          <H1>{"Sistema de Plugins"}</H1>
          <P>{"Os plugins instalam linguagens e ferramentas no servidor via terminal. A instalação é real — não simulada."}</P>

          <H2>{"📦 Categorias"}</H2>
          <Li label="Linguagens" val="Java, Go, Rust, Kotlin, PHP, Ruby, Lua" />
          <Li label="Frameworks" val="React, Vue, Express, Next.js, Django, Spring, Flutter" />
          <Li label="IA/ML" val="TensorFlow, PyTorch, scikit-learn, OpenCV" />
          <Li label="Ferramentas" val="Docker (limitado), Make, CMake, pkg-config" />

          <H2>{"⚙️ Como instala"}</H2>
          <Li label="Nix packages" val="nix-env -iA nixpkgs.PACOTE — Java, Go, PHP, Ruby, Lua, Kotlin" />
          <Li label="Cargo/Rust" val="rustup install stable → cargo" />
          <Li label="npm global" val="npm install -g PACOTE — frameworks Node.js" />
          <Li label="pip" val="pip3 install PACOTE — bibliotecas Python" />

          <H2>{"⏱️ Tempo de instalação"}</H2>
          <Row label="npm global (React, Vue)" value="30-90 segundos" />
          <Row label="Nix packages (Java, Go)" value="3-8 minutos" />
          <Row label="Rust completo" value="5-15 minutos" />
          <Row label="pip (PyTorch, TF)" value="2-5 minutos" />

          <Info color={yellow}>{"⚠️ Nix packages (Java, Go, etc.) precisam de conexão. Com Termux, use: pkg install openjdk17 golang"}</Info>
        </View>
      );

      case "github": return (
        <View>
          <H1>{"Integração GitHub"}</H1>

          <H2>{"🔑 Autenticação"}</H2>
          <P>{"Usa Personal Access Token (PAT) do GitHub. Configurar em: Configurações → GitHub → Adicionar Token."}</P>
          <P>{"Permissões mínimas do token: repo (full), user:read"}</P>

          <H2>{"✅ Funcionalidades"}</H2>
          <Li label="Ver perfil e avatar" val="Nome, login, repos públicos/privados" />
          <Li label="Listar repositórios" val="Todos os repos do usuário autenticado" />
          <Li label="Clonar repositório" val="Clone para pasta do servidor + importa para o app" />
          <Li label="Criar repositório" val="Cria repo novo no GitHub (público ou privado)" />
          <Li label="Push de arquivos" val="Commit e push dos arquivos do projeto ativo" />
          <Li label="Pull (via terminal)" val="git pull origin main no terminal" />

          <H2>{"📡 Como o push funciona"}</H2>
          <P>{"O app envia o conteúdo dos arquivos para a rota /api/github/push-files. O servidor usa a API REST do GitHub para criar/atualizar os blobs, criar tree, commit e atualizar a ref — sem precisar de git local no servidor."}</P>

          <H2>{"⚠️ Limitações"}</H2>
          <Li label="Arquivos binários" val="Não suportados (apenas texto)" />
          <Li label="Histórico de commits" val="Cada push é um único commit" />
          <Li label="Merge/rebase" val="Apenas via terminal com git" />
        </View>
      );

      case "limites": return (
        <View>
          <H1>{"Limites e Restrições"}</H1>

          <H2>{"💤 Servidor Externo (padrão)"}</H2>
          <Info color={yellow}>{"O servidor pode desligar por inatividade (~30 min sem uso). Ao abrir o app após tempo parado, o terminal pode demorar 10-30 segundos para responder enquanto o servidor reinicia."}</Info>
          <Li label="Solução" val="Configure o Termux como servidor local (Configurações → Servidor Backend)" />

          <H2>{"💾 Armazenamento"}</H2>
          <Li label="Projetos/arquivos" val="AsyncStorage — 6MB por default no Android" />
          <Li label="Servidor Externo" val="Disco temporário no servidor" />
          <Li label="Com Termux" val="Disco do celular — persistente" />

          <H2>{"🤖 IA Cortesia (Gemini grátis)"}</H2>
          <Li label="Rate limit" val="~60 requisições/minuto (API gratuita)" />
          <Li label="Contexto" val="~1 milhão de tokens (Gemini 2.5 Flash)" />
          <Li label="Disponibilidade" val="Depende do servidor externo estar ligado" />

          <H2>{"📦 Instalação de Plugins"}</H2>
          <Li label="Nix packages" val="Temporários — reinstalar após reinício do servidor" />
          <Li label="npm global: Temporários, persistentes no Termux" />

          <H2>{"🌐 Preview de Portas"}</H2>
          <Li label="Portas disponíveis" val="3000, 3001, 4000, 5000, 5173, 8000, 8080, 8888, 9000" />
          <Li label="HTTPS" val="Apenas via domínio próprio (proxy mTLS)" />
          <Li label="WebSocket" val="Suporte limitado no WebView" />

          <H2>{"📱 App Android"}</H2>
          <Li label="Android mínimo" val="Android 8.0 (API 26)" />
          <Li label="Arquitetura" val="arm64-v8a, x86_64" />
          <Li label="Permissões" val="Internet, Vibrate — sem permissões sensíveis" />
          <Li label="Tamanho APK" val="~85-100 MB" />
        </View>
      );

      case "recriar": return (
        <View>
          <H1>{"Como Recriar ou Atualizar"}</H1>

          <H2>{"🔄 Gerar novo APK"}</H2>
          <P>{"Para enviar uma versão nova para o EAS Build:"}</P>
          <Step n={1} text={"Atualize a versão em artifacts/mobile/app.json"} />
          <Step n={2} text={"Incremente o versionCode (Android)"} />
          <Step n={3} text={"Execute no servidor:"} />
          <Code copyKey="build-cmd">{"cd artifacts/mobile\nEAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN \\\n  eas build --platform android \\\n  --profile preview --non-interactive --no-wait"}</Code>
          <Step n={4} text={"Acompanhe em: expo.dev/accounts/oab183/projects/caldeira/builds"} />

          <H2>{"✏️ Adicionar nova funcionalidade"}</H2>
          <Li label="Nova tela" val="Criar artifacts/mobile/app/(tabs)/nome.tsx" />
          <Li label="Novo componente" val="Criar artifacts/mobile/components/Nome.tsx" />
          <Li label="Nova rota API" val="Criar artifacts/api-server/src/routes/nome.ts e registrar em app.ts" />
          <Li label="Nova config" val="Adicionar em AppSettings (AppContext.tsx) + defaultSettings" />
          <Li label="Novo template" val="Adicionar no objeto TEMPLATES em index.tsx" />
          <Li label="Novo plugin" val="Adicionar no array PLUGINS em plugins.tsx" />

          <H2>{"🏗️ Recriar do zero (blueprint)"}</H2>
          <Info color={purple}>{"Stack mínima para um app similar:"}</Info>
          <Li label="1. Expo + React Native" val="npx create-expo-app --template" />
          <Li label="2. Expo Router" val="Navegação por abas (tabs)" />
          <Li label="3. Servidor Express" val="Node.js + node-pty para terminal SSE" />
          <Li label="4. AsyncStorage" val="Estado persistente de projetos/arquivos" />
          <Li label="5. EAS Build" val="eas.json com profile preview (APK interno)" />
          <Li label="6. react-native-webview" val="Para VS Code e Preview" />
          <Li label="7. expo/fetch" val="Para SSE do terminal (não use fetch padrão)" />

          <H2>{"🔑 Variáveis de ambiente necessárias"}</H2>
          <Code copyKey="env-vars">{"# No servidor:\nSESSION_SECRET=chave-aleatoria-32-chars\nPORT=8080\n\n# No EAS (eas.json env section):\nNODE_ENV=production\nEXPO_PUBLIC_DOMAIN=SEU_DOMINIO:8080\n\n# Para build:\nEXPO_TOKEN=seu-token-expo"}</Code>

          <H2>{"📋 Checklist de versão"}</H2>
          <Li label="app.json" val="Atualizar version e android.versionCode" />
          <Li label="eas.json" val="EXPO_PUBLIC_DOMAIN correto" />
          <Li label="TypeScript" val="npx tsc --noEmit (sem erros novos)" />
          <Li label="EAS Build" val="Aguardar build concluir (~20 min)" />
          <Li label="Testar APK" val="Instalar e testar terminal, IA, GitHub" />
        </View>
      );

      default: return <P>{"Seção não encontrada."}</P>;
    }
  };

  const Step = ({ n, text }: { n: number; text: string }) => (
    <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#1a1040", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, borderWidth: 1, borderColor: purple }}>
        <Text style={{ color: purple, fontWeight: "700", fontSize: 11 }}>{n}</Text>
      </View>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 20, flex: 1 }}>{text}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        <View style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 16, paddingTop: insets.top + 6, paddingBottom: 10,
          backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10,
        }}>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, flex: 1 }}>📋 Visão Técnica Completa</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8, gap: 6 }}>
            {SECTIONS.map((sec) => (
              <TouchableOpacity
                key={sec.id}
                onPress={() => setActive(sec.id)}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                  backgroundColor: active === sec.id ? "#7c3aed" : "#7c3aed22",
                  borderWidth: 1, borderColor: active === sec.id ? "#7c3aed" : colors.border,
                }}
              >
                <Text style={{ fontSize: 12 }}>{sec.icon}</Text>
                <Text style={{ color: active === sec.id ? "#fff" : colors.mutedForeground, fontSize: 12, fontWeight: active === sec.id ? "700" : "500" }}>
                  {sec.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
          {renderContent()}
        </ScrollView>
      </View>
    </Modal>
  );
}

