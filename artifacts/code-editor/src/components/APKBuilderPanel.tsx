import { useState, useCallback } from "react";
import {
  Smartphone, Globe, GitBranch, Download, CheckCircle2,
  AlertCircle, Loader2, ExternalLink, X, ChevronRight,
  Package, Zap, Settings, RefreshCw,
} from "lucide-react";
import { VirtualFileSystem } from "@/lib/virtual-fs";
import { loadGitHubCredentials, createRepo, pushAllFiles, enableGitHubPages, makeRepoPublic } from "@/lib/github-service";

interface APKBuilderPanelProps {
  open: boolean;
  onClose: () => void;
  vfs: VirtualFileSystem;
  projectName: string;
}

interface PWAInfo {
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  startUrl: string;
  display: string;
  hasIcons: boolean;
  hasManifest: boolean;
  pagesUrl: string;
}

function analyzePWA(vfs: VirtualFileSystem, pagesUrl: string): PWAInfo {
  const files = vfs.toJSON();
  let manifest: any = {};

  // Tenta encontrar manifest.json
  const manifestPath = Object.keys(files).find(f =>
    f === "manifest.json" || f === "public/manifest.json" || f.endsWith("/manifest.json")
  );
  if (manifestPath) {
    try { manifest = JSON.parse(files[manifestPath]); } catch {}
  }

  const hasIcons = Object.keys(files).some(f =>
    f.match(/\.(png|svg|ico|webp)$/i) && (f.includes("icon") || f.includes("logo"))
  );

  return {
    name: manifest.name || manifest.short_name || "Meu App",
    shortName: manifest.short_name || manifest.name || "App",
    description: manifest.description || "Aplicativo PWA",
    themeColor: manifest.theme_color || "#1a237e",
    backgroundColor: manifest.background_color || "#ffffff",
    startUrl: manifest.start_url || "./",
    display: manifest.display || "standalone",
    hasIcons,
    hasManifest: !!manifestPath,
    pagesUrl,
  };
}

// ─── Opção 1: PWABuilder ──────────────────────────────────────────────────
function PWABuilderOption({ pwaInfo, onSetUrl }: { pwaInfo: PWAInfo; onSetUrl: () => void }) {
  const hasUrl = !!pwaInfo.pagesUrl.trim();

  return (
    <div className="space-y-3">
      <div className="px-3 py-3 bg-blue-500/8 border border-blue-500/20 rounded-xl space-y-1.5">
        <p className="text-[12px] font-bold text-blue-300">Como funciona</p>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          O PWABuilder analisa seu site publicado e gera o APK em menos de 1 minuto.
          É gratuito, feito pelo Microsoft, e não precisa instalar nada.
        </p>
      </div>

      {!hasUrl ? (
        <div className="px-3 py-3 bg-yellow-500/8 border border-yellow-500/20 rounded-xl">
          <p className="text-[12px] font-bold text-yellow-300 mb-1">⚠️ Precisa do link do site publicado</p>
          <p className="text-[11px] text-gray-400 mb-2">
            Primeiro publique no GitHub Pages, depois cole o link aqui.
          </p>
          <button
            onClick={onSetUrl}
            className="px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-[12px] font-semibold text-yellow-300 hover:bg-yellow-500/30 transition-colors"
          >
            Inserir link do site →
          </button>
        </div>
      ) : (
        <a
          href={`https://www.pwabuilder.com/generate?url=${encodeURIComponent(pwaInfo.pagesUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-blue-600/15 border border-blue-500/30 rounded-xl hover:bg-blue-600/20 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
            <Package size={18} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-blue-300">Abrir PWABuilder</p>
            <p className="text-[10px] text-gray-500 truncate">{pwaInfo.pagesUrl}</p>
          </div>
          <ExternalLink size={13} className="text-gray-600 shrink-0" />
        </a>
      )}

      <div className="space-y-1.5">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold px-1">No PWABuilder:</p>
        {["Clique em 'Start'", "Aguarde a análise", "Clique em 'Package for stores'", "Selecione Android", "Clique em 'Generate Package'", "Baixe e instale o .apk no celular"].map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
            <p className="text-[11px] text-gray-400">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Opção 2: GitHub Actions ──────────────────────────────────────────────
function GitHubActionsOption({ pwaInfo, vfs, projectName }: { pwaInfo: PWAInfo; vfs: VirtualFileSystem; projectName: string }) {
  const [step, setStep] = useState<"idle" | "pushing" | "done" | "error">("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [repoName, setRepoName] = useState(projectName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "sk-code-editor");
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");

  const creds = loadGitHubCredentials();
  const hasToken = !!creds.token;

  const log = (msg: string) => setLogs(l => [...l, msg]);

  const handleBuild = useCallback(async () => {
    if (!hasToken) return;
    setStep("pushing");
    setLogs(["🚀 Iniciando…"]);
    setError("");
    setResultUrl("");

    try {
      const owner = creds.username;
      const repo = repoName.trim();

      // 1. Cria ou usa repo existente
      log(`📁 Verificando repositório "${repo}"…`);
      try {
        await createRepo(creds, repo, `${pwaInfo.name} — gerado pelo SK Code Editor`, false);
        log("✅ Repositório criado.");
      } catch (e: any) {
        if (e.message?.includes("422") || e.message?.includes("already exists")) {
          log("ℹ️ Repositório já existe — usando existente.");
        } else throw e;
      }

      await makeRepoPublic(creds, owner, repo);
      log("🌐 Repositório público.");

      // 2. Monta os arquivos a enviar
      const files = vfs.toJSON();
      const pagesUrl = `https://${owner}.github.io/${repo}/`;
      const manifest = files["manifest.json"] || files["public/manifest.json"] || JSON.stringify({
        name: pwaInfo.name, short_name: pwaInfo.shortName,
        start_url: "./", display: "standalone",
        background_color: pwaInfo.backgroundColor, theme_color: pwaInfo.themeColor,
        icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }]
      }, null, 2);

      // GitHub Actions: deploy + APK
      const deployWorkflow = `name: Deploy GitHub Pages
on:
  push:
    branches: [main, master]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v4
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: "."
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
`;

      const apkWorkflow = `name: Build APK Android
on:
  workflow_dispatch:
  workflow_run:
    workflows: ["Deploy GitHub Pages"]
    types: [completed]
permissions:
  contents: write
jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g @bubblewrap/cli@latest
      - name: Gerar keystore
        run: |
          keytool -genkey -v -keystore android.keystore -alias app \\
            -keyalg RSA -keysize 2048 -validity 10000 \\
            -storepass mypassword123 -keypass mypassword123 \\
            -dname "CN=${pwaInfo.name}, OU=App, O=App, L=BR, ST=BR, C=BR"
      - name: Criar configuração TWA
        run: |
          cat > twa-manifest.json << 'TWAEOF'
          {
            "packageId": "com.${owner.toLowerCase().replace(/[^a-z0-9]/g, "")}.${repo.toLowerCase().replace(/[^a-z0-9]/g, "")}",
            "host": "${owner}.github.io",
            "name": "${pwaInfo.name}",
            "launcherName": "${pwaInfo.shortName}",
            "display": "standalone",
            "themeColor": "${pwaInfo.themeColor}",
            "navigationColor": "${pwaInfo.themeColor}",
            "backgroundColor": "${pwaInfo.backgroundColor}",
            "enableNotifications": false,
            "startUrl": "/${repo}/",
            "iconUrl": "${pagesUrl}icon-192.png",
            "maskableIconUrl": "${pagesUrl}icon-192.png",
            "appVersion": "1.0.0",
            "appVersionCode": 1,
            "signingKey": { "path": "../android.keystore", "alias": "app" },
            "shortcuts": [],
            "generatorApp": "bubblewrap-cli",
            "webManifestUrl": "${pagesUrl}manifest.json",
            "fallbackType": "customtabs",
            "features": {},
            "minSdkVersion": 21,
            "orientation": "default",
            "fullScopeUrl": "${pagesUrl}"
          }
          TWAEOF
      - name: Build APK
        run: |
          bubblewrap init --manifest twa-manifest.json --directory ./twa-app
          cd twa-app && bubblewrap build
        env:
          BUBBLEWRAP_KEYSTORE_PASSWORD: mypassword123
          BUBBLEWRAP_KEY_PASSWORD: mypassword123
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: APK-Android
          path: "**/*.apk"
          retention-days: 30
`;

      const allFiles: Record<string, string> = {
        ...files,
        "manifest.json": manifest,
        ".github/workflows/deploy.yml": deployWorkflow,
        ".github/workflows/build-apk.yml": apkWorkflow,
      };

      log(`📤 Enviando ${Object.keys(allFiles).length} arquivo(s)…`);
      const result = await pushAllFiles(creds, owner, repo, allFiles, `${pwaInfo.name} — SK Code Editor`);
      log(`✅ ${result.success} arquivo(s) enviados.`);

      // 3. Ativa GitHub Pages
      log("🌐 Ativando GitHub Pages…");
      const url = await enableGitHubPages(creds, owner, repo, "main", "/");
      log(`✅ GitHub Pages ativado: ${url}`);
      log("⏳ Aguarde ~3 min para o deploy e ~10 min para o APK...");
      log(`📥 APK disponível em: github.com/${owner}/${repo}/actions`);

      setResultUrl(`https://github.com/${owner}/${repo}/actions`);
      setStep("done");
    } catch (e: any) {
      setError(e.message || String(e));
      setStep("error");
    }
  }, [creds, repoName, vfs, pwaInfo, projectName]);

  if (!hasToken) {
    return (
      <div className="px-3 py-3 bg-yellow-500/8 border border-yellow-500/20 rounded-xl space-y-2">
        <p className="text-[12px] font-bold text-yellow-300">⚠️ Token do GitHub necessário</p>
        <p className="text-[11px] text-gray-400">
          Conecte sua conta GitHub primeiro. Vá em Menu → GitHub — Clonar / Enviar → configure o token.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="px-3 py-3 bg-green-500/8 border border-green-500/20 rounded-xl space-y-1.5">
        <p className="text-[12px] font-bold text-green-300">O que acontece:</p>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Sobe seu projeto no GitHub, ativa o Pages, e dispara o processo de build do APK nos servidores do GitHub. Você baixa o APK pronto na aba Actions.
        </p>
      </div>

      {step === "idle" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Nome do repositório</label>
            <input
              value={repoName}
              onChange={e => setRepoName(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
              className="w-full px-3 py-2.5 bg-[#1c2714] border border-gray-700/50 rounded-xl text-sm text-gray-300 outline-none focus:border-green-500/50"
            />
            <p className="text-[10px] text-gray-600">APK: github.com/{creds.username}/{repoName}/actions</p>
          </div>
          <button
            onClick={handleBuild}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white rounded-xl font-bold text-[15px] hover:bg-green-500 transition-colors"
          >
            <Zap size={16} />
            Publicar e Gerar APK
          </button>
        </div>
      )}

      {step === "pushing" && (
        <div className="space-y-2">
          <div className="bg-black/40 border border-gray-700/40 rounded-xl p-3 max-h-48 overflow-y-auto font-mono">
            {logs.map((l, i) => <p key={i} className="text-[11px] text-gray-300 leading-relaxed">{l}</p>)}
            <div className="flex items-center gap-2 mt-1">
              <Loader2 size={11} className="animate-spin text-green-400" />
              <span className="text-[11px] text-green-400">Processando…</span>
            </div>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-3">
          <div className="px-3 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
            <p className="text-[12px] font-bold text-green-400 mb-1">✅ Publicado com sucesso!</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              O GitHub está construindo o APK. Leva ~10 minutos. Quando terminar, baixe na aba Actions.
            </p>
          </div>
          <div className="bg-black/40 border border-gray-700/40 rounded-xl p-3 max-h-32 overflow-y-auto font-mono">
            {logs.map((l, i) => <p key={i} className="text-[11px] text-gray-300 leading-relaxed">{l}</p>)}
          </div>
          <a
            href={resultUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600/15 border border-blue-500/30 rounded-xl hover:bg-blue-600/20 transition-colors"
          >
            <GitBranch size={16} className="text-blue-400 shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] font-bold text-blue-300">Abrir Actions no GitHub</p>
              <p className="text-[10px] text-gray-500">Baixar APK quando terminar</p>
            </div>
            <ExternalLink size={13} className="text-gray-600" />
          </a>
          <button
            onClick={() => { setStep("idle"); setLogs([]); }}
            className="w-full text-center text-[11px] text-gray-600 hover:text-gray-400 transition-colors py-1"
          >
            <RefreshCw size={11} className="inline mr-1" />
            Gerar novamente
          </button>
        </div>
      )}

      {step === "error" && (
        <div className="space-y-2">
          <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
            <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-400 leading-relaxed">{error}</p>
          </div>
          <button onClick={() => setStep("idle")} className="w-full text-center text-[11px] text-gray-600 hover:text-gray-400 py-1">
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function APKBuilderPanel({ open, onClose, vfs, projectName }: APKBuilderPanelProps) {
  const [tab, setTab] = useState<"pwabuilder" | "actions">("pwabuilder");
  const [pagesUrl, setPagesUrl] = useState("");
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const pwaInfo = analyzePWA(vfs, pagesUrl);

  const handleSetUrl = () => {
    setEditingUrl(true);
    setUrlInput(pagesUrl);
  };

  const handleSaveUrl = () => {
    let url = urlInput.trim();
    if (url && !url.endsWith("/")) url += "/";
    setPagesUrl(url);
    setEditingUrl(false);
  };

  if (!open) return null;

  const tabs = [
    { id: "pwabuilder" as const, label: "PWABuilder", icon: <Package size={13} />, color: "blue" },
    { id: "actions" as const,    label: "GitHub Actions", icon: <GitBranch size={13} />, color: "green" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/70" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
        <div className="bg-[#0d1117] border-t border-[#30363d] rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "88vh" }}>
          {/* Drag handle */}
          <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-[#30363d] rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#21262d] shrink-0">
            <div className="flex items-center gap-2">
              <Smartphone size={18} className="text-orange-400" />
              <p className="text-[15px] font-bold text-white">Gerar APK Android</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500">
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-4 space-y-4">

              {/* Análise PWA */}
              <div className="px-3 py-3 bg-[#161b22] border border-[#30363d] rounded-xl space-y-2">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Projeto atual</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: pwaInfo.themeColor + "33" }}>
                    📱
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-white">{pwaInfo.name}</p>
                    <p className="text-[10px] text-gray-500">{pwaInfo.description}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${pwaInfo.hasManifest ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                    {pwaInfo.hasManifest ? "✅ manifest.json" : "⚠️ sem manifest"}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${pwaInfo.hasIcons ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                    {pwaInfo.hasIcons ? "✅ ícones" : "⚠️ sem ícones"}
                  </span>
                </div>
              </div>

              {/* URL do site */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Link do site publicado</p>
                  <button onClick={handleSetUrl} className="text-[10px] text-blue-400 hover:text-blue-300">
                    <Settings size={11} className="inline mr-1" />editar
                  </button>
                </div>
                {editingUrl ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSaveUrl()}
                      placeholder="https://usuario.github.io/nome-do-repo/"
                      className="flex-1 px-3 py-2 bg-[#161b22] border border-gray-700/50 rounded-xl text-sm text-gray-300 placeholder-gray-700 outline-none focus:border-blue-500/50"
                    />
                    <button onClick={handleSaveUrl} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-[12px] font-bold">OK</button>
                  </div>
                ) : (
                  <div
                    onClick={handleSetUrl}
                    className={`px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${pagesUrl ? "bg-[#161b22] border-gray-700/50 text-gray-300" : "bg-yellow-500/5 border-yellow-500/20 text-gray-600"}`}
                  >
                    <p className="text-[12px] font-mono truncate">
                      {pagesUrl || "Clique para inserir o link do GitHub Pages…"}
                    </p>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex bg-[#161b22] rounded-xl p-1 gap-1">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                      tab === t.id
                        ? t.color === "blue" ? "bg-blue-600/20 text-blue-300 border border-blue-500/30" : "bg-green-600/20 text-green-300 border border-green-500/30"
                        : "text-gray-500 hover:text-gray-400"
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Conteúdo da tab */}
              {tab === "pwabuilder" && <PWABuilderOption pwaInfo={pwaInfo} onSetUrl={handleSetUrl} />}
              {tab === "actions" && <GitHubActionsOption pwaInfo={pwaInfo} vfs={vfs} projectName={projectName} />}

              {/* Dica */}
              <div className="px-3 py-2.5 bg-[#161b22] border border-[#30363d] rounded-xl">
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  <span className="text-gray-400 font-semibold">💡 Dica:</span> Para instalar no celular, ative "Fontes desconhecidas" em Configurações → Segurança, depois abra o .apk.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
