import React, { useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface ManualModalProps {
  visible: boolean;
  onClose: () => void;
}

const SECTIONS = [
  { id: "novidades",  icon: "🆕", title: "v2.7.4" },
  { id: "inicio",     icon: "🏠", title: "Início" },
  { id: "instalar",   icon: "📲", title: "Instalar" },
  { id: "terminal",   icon: "🖥️", title: "Terminal" },
  { id: "db",         icon: "🗄️", title: "Banco" },
  { id: "jasmim",     icon: "🤖", title: "Jasmim" },
  { id: "github",     icon: "🐙", title: "GitHub" },
  { id: "preview",    icon: "🌐", title: "Preview" },
  { id: "importexport", icon: "📦", title: "Import/Export" },
  { id: "apikeys",    icon: "🔑", title: "API Keys" },
  { id: "projetos",   icon: "🗂️", title: "Projetos" },
  { id: "playground", icon: "🎮", title: "Playground" },
  { id: "termux",     icon: "📡", title: "Termux" },
];

export default function ManualModal({ visible, onClose }: ManualModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState("novidades");
  const [copied, setCopied] = useState("");

  const copyText = useCallback(async (text: string, key: string) => {
    try {
      const Clipboard = await import("expo-clipboard");
      await Clipboard.setStringAsync(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    } catch {}
  }, []);

  const bg = colors.background;
  const card = colors.card;
  const border = colors.border;
  const fg = colors.foreground;
  const muted = colors.mutedForeground;
  const green = "#22c55e";
  const purple = "#7c3aed";
  const mono = Platform.OS === "ios" ? "Menlo" : "monospace";

  // ── Sub-components ──────────────────────────────────────

  const H2 = ({ children }: { children: string }) => (
    <Text style={{ color: green, fontWeight: "700", fontSize: 14, marginTop: 18, marginBottom: 6 }}>
      {children}
    </Text>
  );

  const H3 = ({ children }: { children: string }) => (
    <Text style={{ color: "#86efac", fontWeight: "600", fontSize: 13, marginTop: 12, marginBottom: 4 }}>
      {children}
    </Text>
  );

  const P = ({ children }: { children: string }) => (
    <Text style={{ color: muted, fontSize: 13, lineHeight: 20, marginBottom: 6 }}>{children}</Text>
  );

  const Li = ({ children }: { children: string }) => (
    <View style={{ flexDirection: "row", gap: 6, marginBottom: 4 }}>
      <Text style={{ color: green, fontSize: 13 }}>›</Text>
      <Text style={{ color: muted, fontSize: 13, lineHeight: 20, flex: 1 }}>{children}</Text>
    </View>
  );

  const Step = ({ n, children }: { n: number; children: string }) => (
    <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#1a3d14", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
        <Text style={{ color: green, fontWeight: "700", fontSize: 11 }}>{n}</Text>
      </View>
      <Text style={{ color: muted, fontSize: 13, lineHeight: 20, flex: 1 }}>{children}</Text>
    </View>
  );

  const Alert = ({ color, children }: { color: "green" | "blue" | "yellow" | "red"; children: string }) => {
    const styles = {
      green:  { bg: "#0d2210", border: "#2d5a1e", text: "#4ade80" },
      blue:   { bg: "#0a1530", border: "#1e3d7a", text: "#60a5fa" },
      yellow: { bg: "#1e1500", border: "#4a3800", text: "#fcd34d" },
      red:    { bg: "#1e0a0a", border: "#5a1e1e", text: "#f87171" },
    }[color];
    return (
      <View style={{ backgroundColor: styles.bg, borderWidth: 1, borderColor: styles.border, borderRadius: 8, padding: 12, marginBottom: 10 }}>
        <Text style={{ color: styles.text, fontSize: 13, lineHeight: 20 }}>{children}</Text>
      </View>
    );
  };

  const Code = ({ children, copyKey }: { children: string; copyKey?: string }) => (
    <View style={{ backgroundColor: "#0d1117", borderWidth: 1, borderColor: "#1e2d1e", borderRadius: 8, padding: 12, marginBottom: 10, position: "relative" }}>
      <Text style={{ color: "#a8d5a2", fontFamily: mono, fontSize: 12, lineHeight: 19 }}>{children}</Text>
      {copyKey && (
        <TouchableOpacity
          onPress={() => copyText(children, copyKey)}
          style={{ position: "absolute", top: 8, right: 8, backgroundColor: "#1a3d14", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 }}
        >
          <Text style={{ color: green, fontSize: 11, fontWeight: "600" }}>
            {copied === copyKey ? "✓ Copiado" : "Copiar"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const Card = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
    <View style={{ backgroundColor: "#0d1309", borderWidth: 1, borderColor: "#2d4a1e", borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Text style={{ fontSize: 14 }}>{icon}</Text>
        <Text style={{ color: green, fontWeight: "700", fontSize: 13 }}>{title}</Text>
      </View>
      <Text style={{ color: muted, fontSize: 12, lineHeight: 18 }}>{desc}</Text>
    </View>
  );

  // ── Section Content ──────────────────────────────────────

  const renderSection = () => {
    switch (activeSection) {

      // ── NOVIDADES v2.7.4 ──
      case "novidades": return (
        <View>
          <Alert color="green">{"🆕 DevMobile v2.7.4 — Clone 50.000+ arquivos em segundos, extração paralela e salvamento em segundo plano."}</Alert>

          <H2>{"✅ v2.7.4 — Velocidade máxima"}</H2>

          <H3>{"⚡ Extração paralela — 200 arquivos ao mesmo tempo"}</H3>
          <P>{"Antes o app extraía 1 arquivo por vez do ZIP. Agora extrai 200 em paralelo com Promise.all. Resultado: 50.000 arquivos em segundos em vez de minutos."}</P>
          <Li>{"200 arquivos extraídos simultaneamente (paralelo real)"}</Li>
          <Li>{"Suporta 50.000+ arquivos sem travamento"}</Li>
          <Li>{"Progresso em tempo real durante a extração"}</Li>

          <H3>{"🚀 Salvamento em segundo plano"}</H3>
          <P>{"O projeto aparece na tela IMEDIATAMENTE após o clone. O salvamento no disco acontece em paralelo sem travar a UI."}</P>
          <Li>{"Arquivos visíveis na hora — sem esperar o disco"}</Li>
          <Li>{"Árvore de arquivos abre assim que o clone termina"}</Li>

          <H3>{"🔧 Leitura do ZIP via XHR Blob (sem truncamento)"}</H3>
          <P>{"Corrigido bug onde o Hermes (engine JS do Android) truncava strings base64 maiores que ~16 MB. Agora usa XHR com responseType=blob — sem limite, sem arquivo faltando."}</P>
          <Li>{"ZIPs de 200 MB+ lidos sem truncamento"}</Li>
          <Li>{"40.000 arquivos chegam completos no APK"}</Li>

          <H2>{"📋 v2.7.3 — Correções críticas"}</H2>
          <Li>{"Download via FileSystem.downloadAsync — sem estouro de memória"}</Li>
          <Li>{"Importação ZIP/TAR corrigida — sem arquivos faltando"}</Li>
          <Li>{"Termux com porta configurável (padrão: 8080)"}</Li>

          <H2>{"📋 v2.7.2 — Lote único no AsyncStorage"}</H2>
          <Li>{"Todas as operações de arquivo usam lote — sem race conditions"}</Li>

          <H2>{"📋 v2.7.1 — Modo Offline"}</H2>
          <Li>{"App detecta quando não há servidor e funciona offline"}</Li>

          <Alert color="blue">{"💡 v2.7.4 é a versão mais rápida já lançada. Clone de 50.000 arquivos em segundos."}</Alert>
        </View>
      );

      // ── INÍCIO RÁPIDO ──
      case "inicio": return (
        <View>
          <P>{"Bem-vindo ao DevMobile — IDE no Celular. Editor profissional com terminal, IA (Jasmim), GitHub, banco de dados e Playground — tudo no seu Android."}</P>

          <H2>{"⚡ O que você pode fazer agora"}</H2>
          <Li>{"Criar projetos com modelos prontos (React, Node.js, Python, HTML...)"}</Li>
          <Li>{"Escrever código no editor Monaco com syntax highlight"}</Li>
          <Li>{"Pedir à Jasmim (IA) para criar, corrigir e explicar código"}</Li>
          <Li>{"Conectar GitHub e fazer push/pull diretamente no app"}</Li>
          <Li>{"Configurar banco PostgreSQL (Neon) gratuitamente"}</Li>
          <Li>{"Usar o Playground HTML/React/JS com preview ao vivo"}</Li>
          <Li>{"Exportar projetos como ZIP e importar de volta"}</Li>

          <H2>{"🎯 Primeira vez? Faça isso"}</H2>
          <Step n={1}>{"Toque em + na tela inicial ou na aba CRIAR"}</Step>
          <Step n={2}>{"Escolha um modelo (React, Node.js, Python, HTML...)"}</Step>
          <Step n={3}>{"O editor abre com os arquivos do modelo prontos"}</Step>
          <Step n={4}>{"Toque em ☰ (Menu Completo) para ver todas as funções"}</Step>
          <Step n={5}>{"Toque no ícone 🤖 no canto superior direito para chamar a Jasmim"}</Step>

          <H2>{"📱 Instalar como App no celular"}</H2>
          <Li>{"Android/Chrome: Menu ⋮ → 'Adicionar à tela inicial'"}</Li>
          <Li>{"Para APK nativo: veja a seção 📲 Instalar"}</Li>

          <H2>{"⌨️ Atalhos do Editor"}</H2>
          <Li>{"Toque longo no código → menu de ações rápidas"}</Li>
          <Li>{"Barra ⚡ acima do teclado → inserir {}, (), [], ; e mais"}</Li>
          <Li>{"Botão ↑/↓ no terminal → navegar histórico de comandos"}</Li>
        </View>
      );

      // ── INSTALAR ──
      case "instalar": return (
        <View>
          <Alert color="green">{"✅ DevMobile gera APK Android real via EAS Build. O APK é instalado diretamente no celular sem precisar da Play Store."}</Alert>

          <H2>{"📱 APK via EAS Build (recomendado)"}</H2>
          <Step n={1}>{"Instale o EAS CLI no computador:\nnpx install -g eas-cli"}</Step>
          <Step n={2}>{"Faça login no Expo:\neas login"}</Step>
          <Step n={3}>{"Dentro da pasta do projeto:\neas build -p android --profile preview"}</Step>
          <Step n={4}>{"Aguarde o build (5-15 min). Você recebe o link do .apk"}</Step>
          <Step n={5}>{"Baixe o .apk e instale no celular Android"}</Step>

          <H2>{"📲 Instalar o APK no celular"}</H2>
          <Step n={1}>{"Transfira o .apk pelo Google Drive, WhatsApp para si mesmo, email ou cabo USB"}</Step>
          <Step n={2}>{"No Android: Configurações → Privacidade → ative 'Instalar apps desconhecidos'"}</Step>
          <Step n={3}>{"Abra o gerenciador de arquivos, localize o .apk e toque nele"}</Step>
          <Step n={4}>{"Toque em Instalar → ✅ App instalado!"}</Step>

          <Alert color="blue">{"💡 Para uso PWA (sem APK): Chrome Android → menu ⋮ → 'Adicionar à tela inicial'. Funciona online — carrega mais rápido que baixar o APK."}</Alert>

          <H2>{"🍎 iPhone/iPad"}</H2>
          <Li>{"Safari → botão Compartilhar → 'Adicionar à Tela de Início'"}</Li>
          <Li>{"Funciona como PWA — requer internet para abrir"}</Li>
          <Li>{"APK só funciona em Android. iOS não suporta instalação fora da App Store"}</Li>

          <H2>{"🖥️ Computador (Windows/Mac/Linux)"}</H2>
          <Li>{"Chrome → ícone ⊕ na barra de endereço → Instalar"}</Li>
          <Li>{"Abre numa janela própria sem abas do navegador"}</Li>
          <Li>{"Aparece no menu Iniciar (Windows) ou Launchpad (Mac)"}</Li>
        </View>
      );

      // ── TERMINAL ──
      case "terminal": return (
        <View>
          <P>{"O Terminal do DevMobile executa comandos bash reais via servidor. Abra com ☰ → Terminal ou pelo ícone ⬛ na barra inferior."}</P>

          <H2>{"🔧 Comandos mais usados"}</H2>

          <H3>{"Gerenciar pacotes Node.js"}</H3>
          <Code copyKey="npm">{"npm install express axios cors dotenv\nnpm run dev\nnpm start\nnpm run build"}</Code>

          <H3>{"Gerenciar pacotes Python"}</H3>
          <Code copyKey="pip">{"pip install flask requests pandas sqlalchemy\npython app.py\npython -m pytest"}</Code>

          <H3>{"Navegação e arquivos"}</H3>
          <Code copyKey="nav">{"ls -la           # listar arquivos\npwd              # diretório atual\ncd meu-projeto   # entrar na pasta\nmkdir nova-pasta # criar pasta\ncat package.json # ler arquivo"}</Code>

          <H3>{"Processos"}</H3>
          <Code copyKey="proc">{"ps aux | grep node    # ver processos rodando\nkill -9 PID          # encerrar pelo ID\nlsof -i :3000        # ver quem usa a porta"}</Code>

          <H3>{"Git"}</H3>
          <Code copyKey="git">{"git status\ngit add .\ngit commit -m \"minha mensagem\"\ngit push origin main"}</Code>

          <H2>{"⚙️ Variáveis de ambiente (.env)"}</H2>
          <Code copyKey="env">{"DATABASE_URL=postgresql://user:pass@host/db?sslmode=require\nPORT=3000\nJWT_SECRET=minha-chave-secreta\nNODE_ENV=development"}</Code>

          <H2>{"🚀 Rodar servidor"}</H2>
          <Code copyKey="server">{"node index.js            # Node puro\nnpm run dev              # com nodemon\nnpx ts-node src/main.ts  # TypeScript\nuvicorn main:app --reload # FastAPI"}</Code>

          <H2>{"💡 Dicas do Terminal"}</H2>
          <Li>{"Use ↑ / ↓ para navegar no histórico de comandos"}</Li>
          <Li>{"Ctrl+C para parar qualquer processo"}</Li>
          <Li>{"Use o microfone 🎙️ para ditar comandos"}</Li>
          <Li>{"Peça para a Jasmim: \"rode npm install e corrija os erros\""}</Li>
        </View>
      );

      // ── BANCO DE DADOS ──
      case "db": return (
        <View>
          <P>{"Neon DB é PostgreSQL serverless gratuito — a melhor opção para projetos profissionais. Sem cartão de crédito."}</P>

          <H2>{"🚀 Criar banco em 5 minutos"}</H2>
          <Step n={1}>{"Acesse neon.tech e crie conta gratuita (sem cartão)"}</Step>
          <Step n={2}>{"Clique em 'New Project' → dê um nome"}</Step>
          <Step n={3}>{"Vá em 'Connection Details' e copie a Connection String"}</Step>
          <Step n={4}>{"No DevMobile: ☰ → Banco de Dados → cole a URL"}</Step>
          <Step n={5}>{"Toque em 'Testar Conexão' — pronto! ✅"}</Step>

          <H2>{"📦 Instalar dependências"}</H2>
          <Code copyKey="neon-install">{"npm install @neondatabase/serverless dotenv"}</Code>

          <H2>{"🔌 Arquivo de conexão (db/neon.js)"}</H2>
          <Code copyKey="neon-connect">{"const { neon } = require('@neondatabase/serverless');\nrequire('dotenv').config();\n\nconst sql = neon(process.env.DATABASE_URL);\n\nasync function initDb() {\n  await sql`\n    CREATE TABLE IF NOT EXISTS usuarios (\n      id SERIAL PRIMARY KEY,\n      nome VARCHAR(255) NOT NULL,\n      email VARCHAR(255) UNIQUE NOT NULL,\n      criado_em TIMESTAMP DEFAULT NOW()\n    )\n  `;\n  console.log('✅ Banco inicializado!');\n}\n\nmodule.exports = { sql, initDb };"}</Code>

          <H2>{"⚡ SQL útil"}</H2>
          <Code copyKey="sql">{"-- Criar tabela\nCREATE TABLE IF NOT EXISTS tarefas (\n  id SERIAL PRIMARY KEY,\n  titulo VARCHAR(255) NOT NULL,\n  concluida BOOLEAN DEFAULT false,\n  criado_em TIMESTAMP DEFAULT NOW()\n);\n\n-- Inserir\nINSERT INTO tarefas (titulo) VALUES ('Primeira tarefa');\n\n-- Consultar\nSELECT * FROM tarefas ORDER BY criado_em DESC LIMIT 10;\n\n-- Alterar\nALTER TABLE tarefas ADD COLUMN descricao TEXT;"}</Code>

          <H2>{"⚠️ Regras importantes"}</H2>
          <Li>{"NUNCA commite o .env com dados reais no git"}</Li>
          <Li>{"SEMPRE crie .gitignore com .env listado"}</Li>
          <Li>{"Use sslmode=require na URL do Neon"}</Li>
          <Li>{"Toque em '📋 Gerar .env' no painel para criar o arquivo automaticamente"}</Li>
        </View>
      );

      // ── JASMIM ──
      case "jasmim": return (
        <View>
          <P>{"Jasmim é sua IA desenvolvedora sênior — cria projetos completos, corrige erros e configura banco automaticamente. Toque no ícone 🤖 no editor."}</P>

          <H2>{"🎯 O que a Jasmim faz"}</H2>
          <Li>{"Criar projeto do zero em qualquer linguagem/framework"}</Li>
          <Li>{"Instalar dependências (npm, pip, qualquer gerenciador)"}</Li>
          <Li>{"Criar e modificar qualquer arquivo do projeto"}</Li>
          <Li>{"Configurar banco de dados completo (schema, tabelas)"}</Li>
          <Li>{"Adicionar autenticação JWT, rotas, APIs REST"}</Li>
          <Li>{"Corrigir erros automaticamente ao ver o terminal"}</Li>
          <Li>{"Fazer push para GitHub quando você pedir"}</Li>

          <H2>{"📋 Exemplos de comandos"}</H2>

          <H3>{"Criar projeto completo"}</H3>
          <Code copyKey="j1">{"\"Crie um app de lista de tarefas com React, Node.js/Express, Neon DB PostgreSQL e autenticação JWT. Interface em português.\""}</Code>

          <H3>{"Corrigir erro"}</H3>
          <Code copyKey="j2">{"\"Tem um erro no terminal acima, corrija.\""}</Code>

          <H3>{"Adicionar funcionalidade"}</H3>
          <Code copyKey="j3">{"\"Adicione upload de arquivos PDF usando multer. Salve os arquivos na pasta uploads/.\""}</Code>

          <H3>{"Refatorar"}</H3>
          <Code copyKey="j4">{"\"Reorganize o projeto seguindo boas práticas do Express: routes/, controllers/, models/, middleware/.\""}</Code>

          <H2>{"🧠 Memória da Jasmim"}</H2>
          <P>{"A Jasmim guarda informações sobre seu projeto no arquivo .jasmim-memory.json. Acesse em ☰ → Memória da Jasmim para ver e editar."}</P>
          <Li>{"Decisões técnicas tomadas"}</Li>
          <Li>{"Tecnologias usadas no projeto"}</Li>
          <Li>{"Progresso e próximos passos"}</Li>

          <H2>{"💬 Campo Livre"}</H2>
          <P>{"Para conversas sem restrições: ☰ → Campo Livre. Ideal para tirar dúvidas gerais, pesquisa ou texto livre sem contexto de código."}</P>
        </View>
      );

      // ── GITHUB ──
      case "github": return (
        <View>
          <P>{"Conecte seu repositório GitHub ao DevMobile para fazer push, pull e gerenciar branches. Acesse em ☰ → GitHub."}</P>

          <H2>{"🔑 Criar Personal Access Token (PAT)"}</H2>
          <Step n={1}>{"Acesse: github.com → Settings → Developer Settings"}</Step>
          <Step n={2}>{"Vá em: Personal access tokens → Tokens (classic) → Generate new token"}</Step>
          <Step n={3}>{"Permissões: marque repo (todas) e workflow"}</Step>
          <Step n={4}>{"Copie o token — começa com ghp_..."}</Step>
          <Step n={5}>{"No DevMobile: ☰ → GitHub → cole o token no campo"}</Step>
          <Step n={6}>{"Toque em '📋 Colar Token e Conectar' para conectar com 1 toque"}</Step>

          <H2>{"📦 Operações disponíveis"}</H2>
          <Li>{"Clonar repositório — suporta 38.000+ arquivos via zipball (1 requisição)"}</Li>
          <Li>{"Commit e push de arquivos modificados"}</Li>
          <Li>{"Pull para atualizar com o repositório remoto"}</Li>
          <Li>{"Ver diff dos arquivos modificados"}</Li>
          <Li>{"Criar e trocar de branch"}</Li>

          <Alert color="green">{"✅ v2.7.3: Clone usa zipball — baixa o repo inteiro como ZIP em 1 chamada. Sem rate limit, sem arquivos faltando, mesmo em repos gigantes."}</Alert>

          <H2>{"🖥️ Git via Terminal"}</H2>
          <Code copyKey="git-full">{"# Configurar identidade (primeira vez)\ngit config --global user.name \"Seu Nome\"\ngit config --global user.email \"seu@email.com\"\n\n# Clonar repositório\ngit clone https://github.com/usuario/repo.git\n\n# Repositório privado (com token)\ngit clone https://SEU_TOKEN@github.com/usuario/repo.git\n\n# Fazer commit e push\ngit add .\ngit commit -m \"feat: adiciona funcionalidade X\"\ngit push origin main\n\n# Criar branch nova\ngit checkout -b minha-feature\ngit push -u origin minha-feature"}</Code>

          <H2>{"⚠️ Segurança"}</H2>
          <Li>{"NUNCA commite arquivos .env com senhas"}</Li>
          <Li>{"Adicione .env ao .gitignore ANTES do primeiro commit"}</Li>
          <Li>{"Seu token fica armazenado localmente — nunca é exposto"}</Li>
        </View>
      );

      // ── PREVIEW ──
      case "preview": return (
        <View>
          <P>{"O preview renderiza HTML, CSS e JS diretamente no app — sem precisar abrir o navegador externo."}</P>

          <H2>{"🖥️ Como abrir o Preview"}</H2>
          <Li>{"Com arquivo .html aberto: toque em '🌐 Preview' na barra inferior do editor"}</Li>
          <Li>{"Ou toque no ícone 👁️ no cabeçalho do editor"}</Li>
          <Li>{"O Preview abre mostrando o HTML renderizado ao vivo"}</Li>

          <H2>{"✅ Para o preview funcionar"}</H2>
          <Li>{"O arquivo aberto precisa ter extensão .html"}</Li>
          <Li>{"CSS e JS inline ou em <script> e <style> são executados"}</Li>
          <Li>{"Botões onclick, alert, prompt — tudo funciona"}</Li>

          <H2>{"🎮 Playground (preview mais poderoso)"}</H2>
          <P>{"Para HTML livre sem abrir um arquivo: ☰ → Playground HTML"}</P>
          <Li>{"Modo HTML: qualquer HTML com botões, animações, formulários"}</Li>
          <Li>{"Modo ⚛️ React: escreva function App() e veja ao vivo (Babel + React CDN)"}</Li>
          <Li>{"Modo ⚡ JS: JavaScript com console visual (saída dos console.log)"}</Li>
          <Li>{"Toggle AUTO: renderiza 0,9s após parar de digitar"}</Li>

          <H2>{"🚀 Preview de app Node.js/React"}</H2>
          <Code copyKey="preview-node">{"# 1. Instale as dependências\nnpm install\n\n# 2. Rode o servidor\nnpm run dev   # ou: npm start\n\n# O servidor inicia e mostra a URL de acesso"}</Code>
        </View>
      );

      // ── IMPORTAR / EXPORTAR ──
      case "importexport": return (
        <View>
          <Alert color="green">{"✅ v2.7.3 — Importação 100% corrigida. Repositórios com 38.000+ arquivos importam sem nenhum arquivo faltando."}</Alert>

          <H2>{"📥 Importar projeto (ZIP)"}</H2>
          <Step n={1}>{"Toque em ☰ → Importar ZIP"}</Step>
          <Step n={2}>{"Selecione o arquivo .zip do seu projeto"}</Step>
          <Step n={3}>{"O DevMobile extrai e carrega TODOS os arquivos — sem limite"}</Step>
          <Step n={4}>{"Compatível com VS Code, GitHub (Download ZIP), Glitch e outros"}</Step>
          <Alert color="blue">{"💡 Funciona também no editor (aba Editor → ☰ → Importar ZIP) para adicionar arquivos a um projeto já aberto — preserva estrutura de pastas."}</Alert>

          <H2>{"📤 Exportar projeto"}</H2>
          <Step n={1}>{"Abra o projeto que quer exportar"}</Step>
          <Step n={2}>{"Toque em ☰ → Exportar ZIP"}</Step>
          <Step n={3}>{"Um arquivo .zip com todos os arquivos é gerado"}</Step>
          <Step n={4}>{"Compartilhe via WhatsApp, Google Drive ou salve localmente"}</Step>

          <H2>{"⬇️ Trazer projeto de outro servidor"}</H2>
          <P>{"Método 1 — Via ZIP (mais fácil):"}</P>
          <Step n={1}>{"Abra o projeto no servidor"}</Step>
          <Step n={2}>{"Clique nos 3 pontinhos (⋯) → Files → Download as zip"}</Step>
          <Step n={3}>{"Salve o .zip no celular (Drive, WhatsApp, cabo...)"}</Step>
          <Step n={4}>{"No DevMobile: ☰ → Importar ZIP → selecione o arquivo"}</Step>
          <Step n={5}>{"Todos os arquivos aparecem — sem nenhum faltando ✅"}</Step>

          <P>{"Método 2 — Via GitHub (clone direto no app):"}</P>
          <Step n={1}>{"☰ → Importar do Git → cole a URL do repositório"}</Step>
          <Step n={2}>{"O DevMobile baixa o repo INTEIRO como ZIP em 1 requisição"}</Step>
          <Step n={3}>{"Suporta 38.000+ arquivos sem rate limit"}</Step>

          <H2>{"💡 Dicas"}</H2>
          <Li>{"node_modules é ignorado na exportação — muito pesado"}</Li>
          <Li>{"Arquivos .env são incluídos — cuidado ao compartilhar"}</Li>
          <Li>{"A Memória da Jasmim (.jasmim-memory.json) vai junto no ZIP"}</Li>
          <Li>{"TAR e TAR.GZ também são suportados (☰ → Importar TAR)"}</Li>
        </View>
      );

      // ── API KEYS ──
      case "apikeys": return (
        <View>
          <P>{"O DevMobile usa chaves de API para conectar serviços externos. Todas ficam armazenadas localmente no dispositivo."}</P>

          <H2>{"🔑 Onde configurar cada credencial"}</H2>
          <Card icon="🤖" title="API Key de IA (OpenAI, Gemini, Groq...)" desc="Painel da Jasmim → ⚙️ Configurações. Prefixos: sk- (OpenAI), AIza (Gemini), gsk_ (Groq), sk-ant (Anthropic), xai- (Grok)" />
          <Card icon="🐙" title="GitHub Personal Access Token" desc="☰ → GitHub → Inserir credenciais. Começa com ghp_... Permissões: repo, workflow" />
          <Card icon="🗄️" title="Connection String do Banco" desc="☰ → Banco de Dados → cole a URL. postgresql://user:pass@host/db?sslmode=require" />

          <H2>{"⚡ Detecção automática de provedor"}</H2>
          <P>{"A Jasmim detecta o provedor pela sua API key:"}</P>
          <Code copyKey="providers">{"gsk_     → Groq (rápido e gratuito)\nsk-or-   → OpenRouter\nAIza     → Google Gemini\nxai-     → Grok (xAI)\nsk-ant   → Anthropic Claude\nsk-      → OpenAI\npplx-    → Perplexity\nneon_api_→ Neon DB API"}</Code>

          <H2>{"🔒 Segurança"}</H2>
          <Li>{"Credenciais ficam no armazenamento local do dispositivo"}</Li>
          <Li>{"API keys são enviadas apenas ao backend do DevMobile (nunca expostas)"}</Li>
          <Li>{"Para trocar, cole a nova chave no mesmo campo"}</Li>
          <Li>{"Para revogar, delete a key no serviço externo (GitHub, OpenAI, etc.)"}</Li>

          <H2>{"💳 Opção sem chave (Cortesia)"}</H2>
          <P>{"O DevMobile tem um servidor próprio que oferece IA sem precisar de chave. Acesse em Jasmim → ⚙️ → Cortesia. Ideal para começar."}</P>
        </View>
      );

      // ── MEUS PROJETOS ──
      case "projetos": return (
        <MeusProjetosSection
          H2={H2} H3={H3} P={P} Li={Li} Step={Step} Alert={Alert} Code={Code}
          copied={copied} copyText={copyText}
          colors={{ fg, muted, card, border, green }}
        />
      );

      // ── PLAYGROUND ──
      case "playground": return (
        <View>
          <P>{"O Playground permite escrever e visualizar HTML, React ou JavaScript ao vivo — sem precisar criar um arquivo de projeto. Acesse em ☰ → Playground HTML."}</P>

          <H2>{"🌐 Modo HTML"}</H2>
          <P>{"Escreva qualquer código HTML/CSS/JS e veja renderizado ao vivo."}</P>
          <Li>{"Botões onclick, alert, prompt — tudo funciona"}</Li>
          <Li>{"Estilos CSS inline e em <style>"}</Li>
          <Li>{"Scripts JavaScript em <script>"}</Li>
          <Code copyKey="html-ex">{"<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { font-family: sans-serif; padding: 20px; }\n    button { padding: 10px 20px; background: #7c3aed;\n             color: white; border: none; border-radius: 8px; }\n  </style>\n</head>\n<body>\n  <h1>Meu App</h1>\n  <button onclick=\"alert('Funcionou!')\">Clique</button>\n</body>\n</html>"}</Code>

          <H2>{"⚛️ Modo React"}</H2>
          <P>{"Escreva um componente React completo com hooks. O Playground usa React CDN + Babel — não precisa de npm."}</P>
          <Li>{"Escreva function App() { ... } e veja ao vivo"}</Li>
          <Li>{"useState, useEffect, useMemo, useRef — todos disponíveis"}</Li>
          <Li>{"Estilo inline com objetos JavaScript"}</Li>
          <Code copyKey="react-ex">{"function App() {\n  const [count, setCount] = React.useState(0);\n  return (\n    <div style={{padding: 20, fontFamily: 'sans-serif'}}>\n      <h1>Contador: {count}</h1>\n      <button onClick={() => setCount(c => c + 1)}\n        style={{padding: '10px 20px', background: '#7c3aed',\n                color: '#fff', border: 'none', borderRadius: 8}}>\n        +1\n      </button>\n    </div>\n  );\n}"}</Code>

          <H2>{"⚡ Modo JavaScript"}</H2>
          <P>{"JavaScript puro com console visual. Os console.log aparecem na tela."}</P>
          <Code copyKey="js-ex">{"const dados = [1, 2, 3, 4, 5];\nconsole.log('Soma:', dados.reduce((a, b) => a + b, 0));\nconsole.log('Quadrados:', dados.map(n => n * n));\n\nconst fatorial = n => n <= 1 ? 1 : n * fatorial(n - 1);\nconsole.log('5! =', fatorial(5));"}</Code>

          <H2>{"⚙️ Controles do Playground"}</H2>
          <Li>{"Toggle AUTO/MANUAL: AUTO atualiza 0,9s após parar de digitar"}</Li>
          <Li>{"▶ Renderizar: atualiza a prévia manualmente"}</Li>
          <Li>{"📋 Copiar: copia todo o código para a área de transferência"}</Li>
          <Li>{"💾 Salvar: cria um arquivo no projeto aberto com o código"}</Li>
          <Li>{"🗑️ Limpar: apaga o código (pede confirmação)"}</Li>
        </View>
      );

      case "termux": return (
        <View>
          <Alert color="blue">{"📡 Modo Termux v2.7.3 — terminal Linux real no seu celular, sem internet, 100% offline. O servidor roda direto no celular pelo Termux."}</Alert>

          <H2>{"📲 Passo 1 — Instalar o Termux"}</H2>
          <P>{"Baixe o Termux pelo F-Droid (NÃO pela Play Store — a versão da Play Store está desatualizada)."}</P>
          <Step n={1}>{"Abra o navegador e acesse: f-droid.org"}</Step>
          <Step n={2}>{"Busque por \"Termux\" e instale"}</Step>
          <Step n={3}>{"Se aparecer aviso de segurança, permita instalar de fontes desconhecidas"}</Step>
          <Alert color="yellow">{"⚠️ Só instale pelo F-Droid. A versão da Play Store está desatualizada e não funciona."}</Alert>

          <H2>{"⚙️ Passo 2 — Preparar o Termux"}</H2>
          <P>{"Abra o Termux e execute esses comandos um por um:"}</P>
          <H3>{"Atualizar pacotes:"}</H3>
          <Code copyKey="termux-update">{"pkg update && pkg upgrade -y"}</Code>
          <H3>{"Instalar Node.js, Git e curl:"}</H3>
          <Code copyKey="termux-node">{"pkg install nodejs git curl -y"}</Code>
          <H3>{"Verificar instalação:"}</H3>
          <Code copyKey="termux-check">{"node --version && npm --version && git --version"}</Code>
          <Alert color="green">{"✅ Se aparecer versões para os três comandos, está pronto para o próximo passo."}</Alert>

          <H2>{"📥 Passo 3 — Instalar o servidor DevMobile (1 comando)"}</H2>
          <P>{"Cole esse comando no Termux — ele baixa e instala tudo automaticamente:"}</P>
          <Code copyKey="termux-install-auto">{"curl -fsSL https://SEU-SERVIDOR.com/api/termux/setup.sh | bash"}</Code>
          <Alert color="yellow">{"⏳ Aguarde 3-5 minutos. O script instala Node.js, Express, e o servidor DevMobile automaticamente."}</Alert>
          <Alert color="green">{"✅ Quando aparecer: '✅ Instalação concluída!' — está pronto!"}</Alert>

          <H2>{"▶️ Passo 4 — Iniciar o servidor"}</H2>
          <P>{"Toda vez que quiser usar o DevMobile offline, abra o Termux e execute:"}</P>
          <Code copyKey="termux-start">{"bash ~/start-devmobile.sh"}</Code>
          <P>{"O servidor vai mostrar:"}</P>
          <Code>{"🚀 DevMobile Server rodando na porta 8080\n✅ Terminal, IA e plugins prontos\nAcesse: http://127.0.0.1:8080"}</Code>
          <Alert color="green">{"✅ Deixe o Termux aberto em segundo plano (minimize, não feche)."}</Alert>

          <H2>{"🔗 Passo 5 — Conectar o DevMobile ao Termux"}</H2>
          <P>{"No app DevMobile, vá em Configurações e ative o Modo Termux:"}</P>
          <Step n={1}>{"Abra o DevMobile → toque no ícone de engrenagem ⚙️ (aba Conf.)"}</Step>
          <Step n={2}>{"Role até a seção SERVIDOR BACKEND"}</Step>
          <Step n={3}>{"Confira a Porta do Termux (padrão: 8080) — mude se precisar"}</Step>
          <Step n={4}>{"Toque em '📱 Ativar Modo Termux' — detecta automaticamente em 127.0.0.1"}</Step>
          <Alert color="green">{"✅ Pronto! Terminal, IA Cortesia e instalação de plugins agora usam o Termux — sem internet."}</Alert>

          <H2>{"⚙️ Porta diferente de 8080?"}</H2>
          <P>{"Se seu servidor Termux roda em outra porta (ex: 3000, 8888):"}</P>
          <Step n={1}>{"Configurações → Servidor Backend → Porta do Termux"}</Step>
          <Step n={2}>{"Toque no número e altere para a porta desejada"}</Step>
          <Step n={3}>{"Toque OK — o app detecta na nova porta automaticamente"}</Step>
          <P>{"Para rodar o servidor em outra porta no Termux:"}</P>
          <Code copyKey="termux-custom-port">{"PORT=3000 node ~/devmobile-server/server.mjs"}</Code>

          <H2>{"🔄 Uso no dia a dia (2 passos)"}</H2>
          <Step n={1}>{"Abra o Termux → digite: bash ~/start-devmobile.sh → minimize"}</Step>
          <Step n={2}>{"Abra o DevMobile e use normalmente"}</Step>
          <Alert color="blue">{"💡 Dois apps abertos ao mesmo tempo: Termux (servidor) + DevMobile (IDE). Funciona offline, no metrô, em qualquer lugar."}</Alert>

          <H2>{"❓ Problemas comuns"}</H2>
          <H3>{"\"Port 8080 already in use\""}</H3>
          <Code copyKey="fix-port">{"pkill -f server.mjs\nbash ~/start-devmobile.sh"}</Code>
          <H3>{"Terminal do DevMobile mostra erro de conexão"}</H3>
          <Li>{"Verifique se o Termux está aberto e o servidor rodando"}</Li>
          <Li>{"Confirme a porta em Configurações → Servidor Backend → Porta do Termux"}</Li>
          <Li>{"O app tenta 127.0.0.1:PORTA a cada 8 segundos automaticamente"}</Li>
          <H3>{"Instalação falhou ou script não rodou — instale manualmente:"}</H3>
          <Code copyKey="termux-manual">{"mkdir -p ~/devmobile-server && cd ~/devmobile-server\ncurl -fsSL https://SEU-SERVIDOR.com/api/termux/server.mjs -o server.mjs\nnpm install express cors\nnode server.mjs"}</Code>
          <H3>{"Quer voltar ao modo automático (sem Termux)"}</H3>
          <Li>{"Configurações → URL do Servidor → toque em Limpar URL"}</Li>
          <Li>{"O app volta a detectar automaticamente o melhor servidor disponível"}</Li>
        </View>
      );

      default: return <P>{"Seção não encontrada."}</P>;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: bg }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: insets.top + 6, paddingBottom: 10, backgroundColor: card, borderBottomWidth: 1, borderBottomColor: border, gap: 10 }}>
          <Text style={{ color: fg, fontWeight: "700", fontSize: 17, flex: 1 }}>📖 Manual DevMobile v2.7.3</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="x" size={22} color={muted} />
          </TouchableOpacity>
        </View>

        {/* Section Tabs */}
        <View style={{ backgroundColor: card, borderBottomWidth: 1, borderBottomColor: border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 8, gap: 6 }}>
            {SECTIONS.map((sec) => (
              <TouchableOpacity
                key={sec.id}
                onPress={() => setActiveSection(sec.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: activeSection === sec.id ? purple : `${purple}22`,
                  borderWidth: 1,
                  borderColor: activeSection === sec.id ? purple : border,
                }}
              >
                <Text style={{ fontSize: 12 }}>{sec.icon}</Text>
                <Text style={{ color: activeSection === sec.id ? "#fff" : muted, fontSize: 12, fontWeight: activeSection === sec.id ? "700" : "500" }}>
                  {sec.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content */}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {renderSection()}
        </ScrollView>

      </View>
    </Modal>
  );
}

// ── Meus Projetos (sub-tabs) ──────────────────────────────

type SharedProps = {
  H2: (p: { children: string }) => JSX.Element;
  H3: (p: { children: string }) => JSX.Element;
  P: (p: { children: string }) => JSX.Element;
  Li: (p: { children: string }) => JSX.Element;
  Step: (p: { n: number; children: string }) => JSX.Element;
  Alert: (p: { color: "green" | "blue" | "yellow" | "red"; children: string }) => JSX.Element;
  Code: (p: { children: string; copyKey?: string }) => JSX.Element;
  copied: string;
  copyText: (text: string, key: string) => void;
  colors: { fg: string; muted: string; card: string; border: string; green: string };
};

const PROJ_TABS = [
  { id: "trazer",   icon: "⬇️", label: "Trazer" },
  { id: "juntar",   icon: "🔗", label: "Juntar Apps" },
  { id: "duplicar", icon: "📋", label: "Duplicar" },
  { id: "organizar",icon: "🧭", label: "Organizar" },
];

function MeusProjetosSection({ H2, H3, P, Li, Step, Alert, Code, colors }: SharedProps) {
  const [tab, setTab] = useState("trazer");
  const { card, border, muted, green } = colors;
  const purple = "#7c3aed";

  return (
    <View>
      {/* Sub-tabs */}
      <View style={{ flexDirection: "row", marginBottom: 16, gap: 6, flexWrap: "wrap" }}>
        {PROJ_TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
              backgroundColor: tab === t.id ? "#1a3d14" : card,
              borderWidth: 1, borderColor: tab === t.id ? green : border,
            }}
          >
            <Text style={{ fontSize: 12 }}>{t.icon}</Text>
            <Text style={{ color: tab === t.id ? green : muted, fontSize: 12, fontWeight: tab === t.id ? "700" : "400" }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "trazer" && (
        <View>
          <Alert color="blue">{"⬇️ Você não precisa recriar nada. Seus projetos chegam aqui prontos — código, arquivos e tudo mais."}</Alert>

          <H2>{"📦 Método 1 — Via ZIP (mais fácil)"}</H2>
          <Step n={1}>{"Abra o projeto no servidor"}</Step>
          <Step n={2}>{"Clique nos 3 pontinhos (⋯) → Files → Download as zip"}</Step>
          <Step n={3}>{"Salve o .zip no celular (Google Drive, WhatsApp, etc.)"}</Step>
          <Step n={4}>{"No DevMobile: ☰ → Importar ZIP → selecione o arquivo"}</Step>
          <Step n={5}>{"✅ Projeto aparece com todos os arquivos prontos"}</Step>

          <Alert color="green">{"💡 Funciona com qualquer projeto: Node.js, Python, React, HTML — qualquer linguagem."}</Alert>

          <H2>{"🐙 Método 2 — Via GitHub"}</H2>
          <Step n={1}>{"Faça push do projeto para o GitHub"}</Step>
          <Step n={2}>{"No DevMobile, abra o Terminal"}</Step>
          <Step n={3}>{"Digite: git clone https://github.com/SEU_USUARIO/SEU_REPO.git"}</Step>
          <Step n={4}>{"Ou use ☰ → GitHub → Clonar repositório"}</Step>
        </View>
      )}

      {tab === "juntar" && (
        <View>
          <Alert color="blue">{"🔗 A ideia é simples: você traz cada app para cá, identifica o que funciona em cada um, e a Jasmim une tudo num único projeto — sem reescrever o que já funciona."}</Alert>

          <H2>{"📋 Passo a passo para juntar vários apps"}</H2>
          <Step n={1}>{"Liste seus apps e o que cada um faz bem.\nEx: 'App 1 → login funciona. App 2 → relatórios. App 3 → chat.'"}</Step>
          <Step n={2}>{"Importe todos para o DevMobile (um por vez) via ZIP ou GitHub"}</Step>
          <Step n={3}>{"Abra a Jasmim (ícone 🤖) no editor"}</Step>
          <Step n={4}>{"Diga exatamente quais partes funcionam e quais não. Seja específico."}</Step>
          <Step n={5}>{"Peça para a Jasmim unir:"}</Step>
          <Code copyKey="j-juntar">{"\"Tenho 3 projetos aqui. O login está em app1/, os relatórios em app2/ e o chat em app3/. Quero um único projeto que use o login do app1, relatórios do app2 e chat do app3. Não reescreva — aproveite o código que já funciona.\""}</Code>
          <Step n={6}>{"Teste no terminal: npm install && npm start"}</Step>
          <Step n={7}>{"Para qualquer erro: 'Tem um erro no terminal, corrija sem reescrever o que estava funcionando.'"}</Step>

          <H2>{"💬 Mais exemplos para a Jasmim"}</H2>
          <H3>{"Juntar dois apps"}</H3>
          <Code copyKey="j-dois">{"\"Tenho dois projetos: app-login/ (o login funciona bem) e app-dashboard/ (os gráficos funcionam bem). Una os dois num projeto só chamado meu-app/. Reutilize o código existente.\""}</Code>

          <H3>{"Aproveitar partes específicas"}</H3>
          <Code copyKey="j-partes">{"\"Do app1/ aproveite: auth/. Do app2/ aproveite: routes/reports.js. Do app3/ aproveite: components/Chat.jsx. Crie um único projeto unindo essas partes.\""}</Code>

          <Alert color="yellow">{"✋ Sempre diga: 'não reescreva o que já funciona, aproveite o código existente'. Com essa instrução, a Jasmim vai copiar e adaptar o que já está pronto — não criar do zero."}</Alert>
        </View>
      )}

      {tab === "duplicar" && (
        <View>
          <P>{"Para criar uma cópia exata de um projeto já no DevMobile:"}</P>
          <Step n={1}>{"Abra o projeto que quer duplicar"}</Step>
          <Step n={2}>{"Toque em ☰ → Duplicar Projeto"}</Step>
          <Step n={3}>{"Confirme — o DevMobile cria uma cópia com '(cópia)' no nome"}</Step>
          <Step n={4}>{"O novo projeto já abre com todos os arquivos copiados"}</Step>

          <Alert color="green">{"✅ Isso cria um projeto completamente independente. Alterações na cópia não afetam o original."}</Alert>

          <H2>{"📤 Exportar e importar como backup"}</H2>
          <Step n={1}>{"Exporte o projeto: ☰ → Exportar ZIP"}</Step>
          <Step n={2}>{"Salve em local seguro (Google Drive, etc.)"}</Step>
          <Step n={3}>{"Para restaurar: ☰ → Importar ZIP"}</Step>

          <H2>{"⏱️ Checkpoints (snapshots)"}</H2>
          <P>{"Salve pontos de restauração enquanto trabalha:"}</P>
          <Li>{"☰ → Salvar Checkpoint → cria um snapshot do projeto"}</Li>
          <Li>{"☰ → Histórico de Checkpoints → ver e restaurar versões antigas"}</Li>
          <Li>{"Dica: salve antes de mudanças grandes!"}</Li>
        </View>
      )}

      {tab === "organizar" && (
        <View>
          <Alert color="green">{"🧭 Você tem vários apps e cada um funciona só em parte. Aqui está o roteiro para se organizar."}</Alert>

          <H2>{"📊 Etapa 1 — Mapear o que você tem"}</H2>
          <P>{"Para cada app, faça uma lista:"}</P>
          <Code copyKey="mapeamento">{"App 1 — Nome: ___________\n✅ O que funciona: ___________\n❌ O que não funciona: ___________\n\nApp 2 — Nome: ___________\n✅ O que funciona: ___________\n❌ O que não funciona: ___________\n\n(repita para cada app)"}</Code>

          <H2>{"🎯 Etapa 2 — Definir o app final que você quer"}</H2>
          <P>{"Responda: qual seria o app perfeito se tudo funcionasse?"}</P>
          <Code copyKey="app-final">{"App Final \"Meu Sistema\":\n- Login de usuário ✅ (já existe no App 1)\n- Painel de controle ✅ (já existe no App 3)\n- Relatórios em PDF ✅ (já existe no App 5)\n- Chat com IA ✅ (já existe no App 7)\n- Pagamentos ❌ (não existe ainda)\n- Notificações push ❌ (não existe ainda)"}</Code>

          <H2>{"🚀 Etapa 3 — Executar com a Jasmim"}</H2>
          <Step n={1}>{"Importe todos os apps para o DevMobile"}</Step>
          <Step n={2}>{"Cole o mapeamento para a Jasmim"}</Step>
          <Step n={3}>{"Peça: 'Crie o app final unindo as partes que funcionam e criando as que faltam'"}</Step>
          <Step n={4}>{"Teste cada funcionalidade no terminal"}</Step>
          <Step n={5}>{"Para erros: 'Corrija sem reescrever o que já estava funcionando'"}</Step>

          <Alert color="yellow">{"⚡ Estratégia: sempre faça a Jasmim trabalhar em partes. 'Junte primeiro o login e o painel. Depois adicione os relatórios. Depois o chat.' Uma funcionalidade por vez é mais seguro."}</Alert>
        </View>
      )}
    </View>
  );
}
