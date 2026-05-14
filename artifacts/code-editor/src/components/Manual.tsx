/**
 * Manual do SK Code Editor
 * Guia completo de uso: terminal, banco de dados, Neon DB, credenciais, comandos.
 */

import { useState, useCallback, useEffect } from "react";
import { saveAs } from "file-saver";
import { VirtualFileSystem } from "../lib/virtual-fs";
import { exportAsZip } from "../lib/zip-service";

type Section = {
  id: string;
  icon: string;
  title: string;
  content: React.ReactNode;
};

interface ManualProps {
  vfs?: VirtualFileSystem;
  projectName?: string;
}

export default function Manual({ vfs, projectName }: ManualProps) {
  const [active, setActive] = useState<string>("inicio");
  const [copied, setCopied] = useState<string>("");
  const [installTab, setInstallTab] = useState<string>("android-pwa");
  const [mergeTab, setMergeTab] = useState<string>("importar");
  const [twaUrl, setTwaUrl] = useState<string>("");
  const [pwaBuilderUrl, setPwaBuilderUrl] = useState<string>("");
  const [twaLoading, setTwaLoading] = useState(false);
  const [twaError, setTwaError] = useState<string>("");
  const [zipLoading, setZipLoading] = useState(false);
  const [zipEmptyWarning, setZipEmptyWarning] = useState(false);
  const [pwaCheckUrl, setPwaCheckUrl] = useState<string>("");
  const [pwaCheckLoading, setPwaCheckLoading] = useState(false);
  const [pwaCheckResult, setPwaCheckResult] = useState<null | {
    url: string; score: number; passed: number; total: number;
    items: Array<{ id: string; label: string; status: "ok" | "fail" | "warn"; detail: string; fix: string }>;
  }>(null);
  const [pwaCheckError, setPwaCheckError] = useState<string>("");

  useEffect(() => {
    if (!zipEmptyWarning || !vfs) return;
    const unsubscribe = vfs.onChange(() => {
      if (vfs.listFiles().length > 0) setZipEmptyWarning(false);
    });
    return () => { unsubscribe(); };
  }, [zipEmptyWarning, vfs]);

  const downloadProjectZip = useCallback(async () => {
    if (!vfs) return;
    if (vfs.listFiles().length === 0) {
      setZipEmptyWarning(true);
      return;
    }
    setZipEmptyWarning(false);
    setZipLoading(true);
    try {
      const files = vfs.toJSON();
      await exportAsZip(files, projectName || "projeto");
    } finally {
      setZipLoading(false);
    }
  }, [vfs, projectName]);

  const downloadTwaPackage = useCallback(async () => {
    setTwaLoading(true);
    setTwaError("");
    try {
      const url = twaUrl.trim() || window.location.origin;
      const res = await fetch(`/api/twa-package?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        let msg = "Erro ao gerar pacote";
        try { const j = await res.json() as { error?: string }; msg = j.error || msg; } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? "twa-app.zip";
      saveAs(blob, filename);
    } catch (e) {
      setTwaError(e instanceof Error ? e.message : "Não foi possível gerar o pacote. Verifique a URL e tente novamente.");
    } finally {
      setTwaLoading(false);
    }
  }, [twaUrl]);

  const downloadPwaReport = useCallback(() => {
    if (!pwaCheckResult) return;
    const { url, score, passed, total, items } = pwaCheckResult;
    const scoreColor = score >= 80 ? "#16a34a" : score >= 50 ? "#ca8a04" : "#dc2626";
    const scoreLabel = score >= 80 ? "Pronto para instalar" : score >= 50 ? "Quase lá — corrija os itens em vermelho" : "Precisa de ajustes antes de instalar";
    const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
    const date = new Date().toLocaleString("pt-BR");
    const itemsHtml = items.map(item => {
      const icon = item.status === "ok" ? "✅" : item.status === "warn" ? "⚠️" : "❌";
      const color = item.status === "ok" ? "#16a34a" : item.status === "warn" ? "#ca8a04" : "#dc2626";
      const fixHtml = item.status !== "ok" && item.fix
        ? `<div class="fix"><strong>Como corrigir:</strong> ${escape(item.fix)}</div>` : "";
      return `<div class="item" style="border-left:4px solid ${color}">
        <div class="item-title"><span>${icon}</span><strong>${escape(item.label)}</strong></div>
        <div class="item-detail">${escape(item.detail)}</div>
        ${fixHtml}
      </div>`;
    }).join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Relatório PWA — ${escape(url)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111;max-width:800px;margin:24px auto;padding:0 16px;line-height:1.5}
  h1{margin:0 0 4px;font-size:22px}
  .meta{color:#666;font-size:12px;margin-bottom:16px}
  .url{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;word-break:break-all;background:#f3f4f6;padding:6px 10px;border-radius:6px;display:inline-block}
  .score-card{display:flex;align-items:center;gap:20px;padding:16px;border:1px solid #e5e7eb;border-radius:10px;margin:16px 0}
  .score{font-size:42px;font-weight:700;color:${scoreColor};line-height:1}
  .score-sub{font-size:12px;color:#666}
  .score-label{font-weight:600;color:${scoreColor}}
  h2{font-size:16px;margin:24px 0 8px}
  .item{padding:10px 12px;margin-bottom:10px;background:#fafafa;border-radius:6px}
  .item-title{display:flex;gap:8px;align-items:center;font-size:14px}
  .item-detail{font-size:13px;color:#444;margin-top:4px;margin-left:24px}
  .fix{margin-top:6px;margin-left:24px;font-size:13px;background:#fff;border:1px dashed #d1d5db;border-radius:6px;padding:8px 10px}
  .footer{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#888;text-align:center}
  @media print{body{margin:0}.no-print{display:none}}
  .no-print{position:fixed;top:12px;right:12px}
  .no-print button{background:#16a34a;color:#fff;border:0;padding:10px 16px;border-radius:6px;font-weight:600;cursor:pointer}
</style></head><body>
<div class="no-print"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
<h1>Relatório do Verificador PWA</h1>
<div class="meta">Gerado em ${escape(date)}</div>
<div class="url">${escape(url)}</div>
<div class="score-card">
  <div><div class="score">${score}%</div><div class="score-sub">${passed}/${total} itens</div></div>
  <div><div class="score-label">${escape(scoreLabel)}</div></div>
</div>
<h2>Checklist (${items.length} itens)</h2>
${itemsHtml}
<div class="footer">Gerado pelo SK Code Editor — Verificador PWA</div>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)});</script>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) {
      const blob = new Blob([html], { type: "text/html" });
      saveAs(blob, `relatorio-pwa-${new Date().toISOString().slice(0, 10)}.html`);
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }, [pwaCheckResult]);

  const runPwaCheck = useCallback(async () => {
    const url = pwaCheckUrl.trim();
    if (!url) { setPwaCheckError("Cole a URL do seu app publicado."); return; }
    setPwaCheckLoading(true);
    setPwaCheckError("");
    setPwaCheckResult(null);
    try {
      const res = await fetch(`/api/pwa-check?url=${encodeURIComponent(url)}`);
      const data = await res.json() as { error?: string } & typeof pwaCheckResult;
      if (!res.ok || data.error) throw new Error((data as { error?: string }).error || "Erro ao verificar");
      setPwaCheckResult(data as NonNullable<typeof pwaCheckResult>);
    } catch (e: unknown) {
      setPwaCheckError((e instanceof Error ? e.message : "") || "Não foi possível verificar. Confira se a URL está correta e o app está publicado.");
    } finally {
      setPwaCheckLoading(false);
    }
  }, [pwaCheckUrl]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  };

  const Code = ({
    children,
    copyKey,
  }: {
    children: string;
    copyKey?: string;
  }) => (
    <div className="relative group my-2">
      <pre
        className="bg-[#0d1309] border border-[#2d4a1e] rounded-lg p-3 text-sm text-[#a8d5a2] overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed"
      >
        {children}
      </pre>
      {copyKey && (
        <button
          onClick={() => copy(children, copyKey)}
          className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded bg-[#2d4a1e] text-[#7ec87a] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#3d5e2a]"
        >
          {copied === copyKey ? "✓ Copiado" : "Copiar"}
        </button>
      )}
    </div>
  );

  const H2 = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-[#7ec87a] font-bold text-base mt-5 mb-2 flex items-center gap-2">
      {children}
    </h2>
  );

  const H3 = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-[#5aab56] font-semibold text-sm mt-4 mb-1">{children}</h3>
  );

  const P = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[#8cba89] text-sm leading-relaxed mb-2">{children}</p>
  );

  const Li = ({ children }: { children: React.ReactNode }) => (
    <li className="text-[#8cba89] text-sm leading-relaxed list-none flex gap-2 mb-1">
      <span className="text-[#5aab56] shrink-0">›</span>
      <span>{children}</span>
    </li>
  );

  const Badge = ({
    color,
    children,
  }: {
    color: "green" | "blue" | "yellow" | "red";
    children: React.ReactNode;
  }) => {
    const colors = {
      green:  "bg-[#1a3d14] text-[#7ec87a] border-[#3d6e2a]",
      blue:   "bg-[#0d1e3d] text-[#6ab4ff] border-[#1e4080]",
      yellow: "bg-[#2d2200] text-[#d4aa40] border-[#5a4500]",
      red:    "bg-[#2d0d0d] text-[#d47070] border-[#5a1e1e]",
    };
    return (
      <span
        className={`inline-block text-xs px-2 py-0.5 rounded border font-mono ${colors[color]}`}
      >
        {children}
      </span>
    );
  };

  const sections: Section[] = [
    {
      id: "inicio",
      icon: "🏠",
      title: "Início Rápido",
      content: (
        <div>
          <P>
            Bem-vindo ao <strong className="text-[#7ec87a]">SK Code Editor</strong> — editor
            profissional com terminal real, IA integrada (Jasmim), GitHub, banco de dados e
            muito mais. Este manual é seu guia completo.
          </P>

          <H2>⚡ O que você pode fazer agora</H2>
          <ul className="space-y-1 mb-3">
            <Li>Escrever código em qualquer linguagem com Monaco Editor (VS Code no browser)</Li>
            <Li>Executar comandos reais no terminal (npm install, python, git, etc.)</Li>
            <Li>Pedir ajuda para a Jasmim (IA) para criar, corrigir e melhorar código</Li>
            <Li>Conectar seu repositório GitHub e fazer push/pull direto no editor</Li>
            <Li>Configurar banco de dados PostgreSQL (Neon) gratuitamente</Li>
            <Li>Ver preview ao vivo do seu projeto HTML/React</Li>
            <Li>Importar/exportar projetos como ZIP ou TAR.GZ</Li>
            <Li>Instalar o app no celular como PWA (funciona offline)</Li>
          </ul>

          <H2>🎯 Primeira vez? Faça isso</H2>
          <ol className="space-y-2">
            {[
              "Toque no ícone 🤖 (Jasmim) na barra inferior",
              "Digite: \"Crie um projeto Node.js Express com conexão Neon DB\"",
              "A Jasmim cria tudo automaticamente — você só aplica os arquivos",
              "Rode npm install e npm start no terminal",
              "Veja o preview no ícone 👁️",
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-[#8cba89]">
                <span className="text-[#7ec87a] font-bold shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <H2>📱 Instalar como App (PWA)</H2>
          <ul className="space-y-1">
            <Li>Android/Chrome: Menu ⋮ → "Adicionar à tela inicial"</Li>
            <Li>iOS/Safari: Compartilhar → "Adicionar à Tela de Início"</Li>
            <Li>Desktop/Chrome: Ícone ⬇ na barra de endereço</Li>
          </ul>
        </div>
      ),
    },

    {
      id: "instalar",
      icon: "📲",
      title: "Instalar como App",
      content: (() => {
        const installTabs = [
          { id: "verificador",  label: "Verificador",  icon: "🔍" },
          { id: "android-pwa", label: "Android PWA", icon: "🤖" },
          { id: "ios-pwa",     label: "iOS PWA",     icon: "🍎" },
          { id: "pwabuilder",  label: "APK Online",  icon: "⚡" },
          { id: "twa",        label: "APK Projeto",  icon: "📦" },
          { id: "universal",   label: "Guia Universal", icon: "🌐" },
        ];

        const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
          <li className="flex gap-3 mb-3">
            <span className="bg-[#2d4a1e] text-[#7ec87a] font-bold rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5">{n}</span>
            <span className="text-[#8cba89] text-sm leading-relaxed">{children}</span>
          </li>
        );

        const Alert = ({ color, children }: { color: "green" | "blue" | "yellow"; children: React.ReactNode }) => {
          const c = {
            green:  "bg-[#0d2210] border-[#2d5a1e] text-[#7ec87a]",
            blue:   "bg-[#0a1530] border-[#1e3d7a] text-[#6ab4ff]",
            yellow: "bg-[#1e1500] border-[#4a3800] text-[#d4aa40]",
          }[color];
          return <div className={`border rounded-lg p-3 mb-3 text-sm ${c}`}>{children}</div>;
        };

        const tabContent: Record<string, React.ReactNode> = {
          "verificador": (
            <div>
              <Alert color="blue">
                🔍 <strong>Verificador PWA.</strong> Cole a URL do seu app publicado e veja instantaneamente o que está faltando para instalar como app no celular ou gerar APK.
              </Alert>

              <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-lg p-4 mb-4">
                <label className="block text-[#5aab56] text-xs mb-2 font-semibold">URL do app publicado</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={pwaCheckUrl}
                    onChange={e => { setPwaCheckUrl(e.target.value); setPwaCheckError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") runPwaCheck(); }}
                    placeholder="https://meu-app.replit.app"
                    className="flex-1 bg-[#141c0d] border border-[#3d6e2a] rounded px-3 py-2 text-sm text-[#a8d5a2] placeholder-[#3d6e2a] outline-none focus:border-[#5aab56]"
                  />
                  <button
                    onClick={runPwaCheck}
                    disabled={pwaCheckLoading}
                    className="bg-[#2d4a1e] hover:bg-[#3d5e2a] disabled:opacity-50 text-[#7ec87a] font-semibold text-sm px-4 rounded transition-colors whitespace-nowrap"
                  >
                    {pwaCheckLoading ? "⏳ Verificando..." : "🔍 Verificar"}
                  </button>
                </div>
                {pwaCheckError && <p className="text-[#d47070] text-xs mt-2">{pwaCheckError}</p>}
              </div>

              {pwaCheckResult && (() => {
                const { score, passed, total, items } = pwaCheckResult;
                const scoreColor = score >= 80 ? "#7ec87a" : score >= 50 ? "#d4aa40" : "#d47070";
                const scoreBg = score >= 80 ? "bg-[#0d2210] border-[#2d5a1e]" : score >= 50 ? "bg-[#1e1500] border-[#4a3800]" : "bg-[#1a0000] border-[#5a1a1a]";
                const scoreLabel = score >= 80 ? "Pronto para instalar! ✅" : score >= 50 ? "Quase lá — corrija os itens em vermelho" : "Precisa de ajustes antes de instalar";

                return (
                  <div>
                    <div className={`border rounded-lg p-4 mb-4 flex items-center gap-4 ${scoreBg}`}>
                      <div className="text-center shrink-0">
                        <div className="text-3xl font-bold" style={{ color: scoreColor }}>{score}%</div>
                        <div className="text-xs text-[#6b8f68] mt-0.5">{passed}/{total} itens</div>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm" style={{ color: scoreColor }}>{scoreLabel}</div>
                        <div className="text-xs text-[#6b8f68] mt-0.5 font-mono break-all">{pwaCheckResult.url}</div>
                      </div>
                      <button
                        onClick={downloadPwaReport}
                        className="shrink-0 bg-[#2d4a1e] hover:bg-[#3d5e2a] text-[#7ec87a] font-semibold text-xs px-3 py-2 rounded transition-colors whitespace-nowrap"
                        title="Abre uma janela pronta para imprimir ou salvar como PDF"
                      >
                        📄 Baixar relatório
                      </button>
                    </div>

                    <div className="space-y-2">
                      {items.map(item => {
                        const isOk = item.status === "ok";
                        const isWarn = item.status === "warn";
                        const icon = isOk ? "✅" : isWarn ? "⚠️" : "❌";
                        const borderCls = isOk ? "border-[#2d5a1e]" : isWarn ? "border-[#4a3800]" : "border-[#5a1a1a]";
                        const bgCls = isOk ? "bg-[#0a1a0a]" : isWarn ? "bg-[#151000]" : "bg-[#120000]";
                        const labelCls = isOk ? "text-[#7ec87a]" : isWarn ? "text-[#d4aa40]" : "text-[#d47070]";
                        return (
                          <div key={item.id} className={`border rounded-lg p-3 ${bgCls} ${borderCls}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-base shrink-0">{icon}</span>
                              <span className={`text-sm font-semibold ${labelCls}`}>{item.label}</span>
                            </div>
                            <p className="text-[#6b8f68] text-xs mt-1 ml-6 leading-relaxed">{item.detail}</p>
                            {!isOk && item.fix && (
                              <div className="mt-2 ml-6 bg-[#0d1309] border border-[#2d4a1e] rounded p-2">
                                <span className="text-[#5aab56] text-xs font-semibold block mb-0.5">💡 Como corrigir:</span>
                                <span className="text-[#8cba89] text-xs leading-relaxed">{item.fix}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {score < 80 && (() => {
                      const priorityOrder = [
                        "https",
                        "manifest",
                        "service-worker",
                        "icon-192",
                        "icon-512",
                        "manifest-name",
                        "manifest-start-url",
                        "manifest-display",
                      ];
                      const tabFor: Record<string, { tab: string; label: string }> = {
                        "https":              { tab: "universal",  label: "Guia Universal" },
                        "manifest":           { tab: "android-pwa", label: "Android PWA" },
                        "manifest-name":      { tab: "android-pwa", label: "Android PWA" },
                        "manifest-start-url": { tab: "android-pwa", label: "Android PWA" },
                        "manifest-display":   { tab: "android-pwa", label: "Android PWA" },
                        "service-worker":     { tab: "android-pwa", label: "Android PWA" },
                        "icon-192":           { tab: "android-pwa", label: "Android PWA" },
                        "icon-512":           { tab: "android-pwa", label: "Android PWA" },
                      };
                      const failed = items
                        .filter(i => i.status !== "ok")
                        .slice()
                        .sort((a, b) => {
                          const ai = priorityOrder.indexOf(a.id);
                          const bi = priorityOrder.indexOf(b.id);
                          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                        });
                      const top = failed.slice(0, 3);
                      if (top.length === 0) return null;
                      return (
                        <div className="mt-4 border border-[#3d6e2a] rounded-lg p-4 bg-[#0d1a08]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base">🚀</span>
                            <h3 className="text-[#7ec87a] font-semibold text-sm">Por onde começar</h3>
                          </div>
                          <p className="text-[#6b8f68] text-xs mb-3">Corrija estes itens primeiro — são os de maior impacto para o seu app virar PWA:</p>
                          <ol className="space-y-3">
                            {top.map((item, idx) => {
                              const target = tabFor[item.id] || { tab: "android-pwa", label: "Android PWA" };
                              return (
                                <li key={item.id} className="flex gap-3 items-start">
                                  <span className="bg-[#2d4a1e] text-[#7ec87a] font-bold rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5">{idx + 1}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[#a8d5a2] text-sm font-semibold">{item.label}</div>
                                    {item.fix && (
                                      <div className="text-[#6b8f68] text-xs mt-0.5 leading-relaxed">{item.fix}</div>
                                    )}
                                    <button
                                      onClick={() => setInstallTab(target.tab)}
                                      className="mt-2 inline-flex items-center gap-1 bg-[#2d4a1e] hover:bg-[#3d5e2a] text-[#7ec87a] text-xs font-semibold px-2.5 py-1 rounded transition-colors"
                                    >
                                      Ir para "{target.label}" →
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      );
                    })()}

                    {score === 100 && (
                      <Alert color="green">
                        🎉 <strong>Perfeito!</strong> Seu app tem todos os requisitos PWA. Instale via Chrome (Android PWA) ou gere um APK pela aba "APK Online".
                      </Alert>
                    )}
                  </div>
                );
              })()}
            </div>
          ),

          "android-pwa": (
            <div>
              <Alert color="green">
                ✅ <strong>Mais fácil e rápido.</strong> Não precisa instalar nada. O app fica na tela inicial igual a um app nativo.
              </Alert>
              <H2>📱 Passo a passo — Android com Chrome</H2>
              <ol className="mb-4">
                <Step n={1}><strong>Publique seu app</strong> no Replit para obter uma URL pública<br/><span className="text-[#5aab56] font-mono text-xs">ex: https://seu-app.replit.app</span> — veja a aba "Guia Universal" se tiver dúvidas</Step>
                <Step n={2}>No Android, abra o <strong>Google Chrome</strong> e acesse a URL do app publicado</Step>
                <Step n={3}>Toque nos <strong>3 pontinhos (⋮)</strong> no canto superior direito do Chrome</Step>
                <Step n={4}>Toque em <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar app"</strong></Step>
                <Step n={5}>Confirme tocando em <strong>"Adicionar"</strong> — o ícone aparece na tela inicial e abre sem barra do Chrome! ✅</Step>
              </ol>

              <Alert color="blue">
                💡 Em alguns Androids aparece um banner automático na parte inferior pedindo para instalar. Basta tocar nele!
              </Alert>

              <H2>🔍 Se o botão de instalar não aparecer</H2>
              <P>O app precisa ter manifest.json e service worker válidos:</P>
              <ul className="space-y-1">
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> Abra o Chrome DevTools (F12 no PC) → aba Application → Manifest</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> Verifique se aparece "Installable"</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> O SK Code Editor já tem tudo configurado ✅</li>
              </ul>
            </div>
          ),

          "ios-pwa": (
            <div>
              <Alert color="yellow">
                ⚠️ <strong>Atenção:</strong> No iPhone/iPad, a instalação PWA só funciona pelo <strong>Safari</strong>. Chrome e outros navegadores no iOS não suportam esse recurso.
              </Alert>
              <H2>📱 Passo a passo — iPhone e iPad</H2>
              <ol className="mb-4">
                <Step n={1}>Abra o <strong>Safari</strong> (o navegador padrão da Apple, ícone bússola azul)</Step>
                <Step n={2}>Acesse a URL do seu app publicado<br/><span className="text-[#5aab56] font-mono text-xs">ex: https://meu-app.replit.app</span></Step>
                <Step n={3}>Aguarde o app carregar completamente</Step>
                <Step n={4}>Toque no botão de <strong>Compartilhar</strong> — o ícone de uma caixa com uma seta para cima, na barra inferior do Safari</Step>
                <Step n={5}>Role para baixo no menu que aparece</Step>
                <Step n={6}>Toque em <strong>"Adicionar à Tela de Início"</strong></Step>
                <Step n={7}>Edite o nome se quiser e toque em <strong>"Adicionar"</strong></Step>
                <Step n={8}>✅ O ícone aparece na tela inicial — abre em tela cheia!</Step>
              </ol>

              <H2>⚙️ Limitações no iOS</H2>
              <ul className="space-y-1 mb-3">
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#d4aa40]">›</span> Notificações push não funcionam no iOS (limitação da Apple)</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#d4aa40]">›</span> Armazenamento offline tem limite de 50MB no Safari</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> A aparência e funcionamento são os mesmos do Android ✅</li>
              </ul>
            </div>
          ),

          "pwabuilder": (
            <div>
              <Alert color="green">
                ⚡ <strong>Gera APK real sem instalar nada.</strong> Serviço gratuito do próprio Google. Funciona para qualquer app PWA.
              </Alert>

              <H2>🌐 Cole a URL do seu app e abra o PWABuilder</H2>
              <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-lg p-4 mb-4">
                <label className="block text-[#5aab56] text-xs mb-2 font-semibold">URL do app publicado</label>
                <input
                  type="url"
                  value={pwaBuilderUrl}
                  onChange={e => setPwaBuilderUrl(e.target.value)}
                  placeholder="https://seu-app.replit.app"
                  className="w-full bg-[#141c0d] border border-[#3d6e2a] rounded px-3 py-2 text-sm text-[#a8d5a2] placeholder-[#3d6e2a] outline-none focus:border-[#5aab56] mb-3"
                />
                <a
                  href={`https://pwabuilder.com/?site=${encodeURIComponent(pwaBuilderUrl || "https://seu-app.replit.app")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-[#2d4a1e] hover:bg-[#3d5e2a] text-[#7ec87a] font-semibold text-sm py-2 rounded text-center transition-colors"
                >
                  ⚡ Abrir no PWABuilder.com
                </a>
              </div>

              <H2>🚀 Passo a passo</H2>
              <ol className="mb-4">
                <Step n={1}>Cole a URL acima e clique em <strong>"Abrir no PWABuilder.com"</strong></Step>
                <Step n={2}>O site analisa seu app (30-60 seg) — verifica manifest e service worker</Step>
                <Step n={3}>Role até a seção <strong>"Android"</strong> e clique em <strong>"Download"</strong></Step>
                <Step n={4}>Você recebe um <strong>.zip</strong> com um <strong>.apk</strong> já assinado dentro</Step>
                <Step n={5}>Transfira o .apk para o celular e instale (pode ser via Google Drive, cabo USB ou WhatsApp)</Step>
              </ol>

              <Alert color="blue">
                💡 O APK gerado pelo PWABuilder já vem assinado com uma chave de teste. Para publicar na Play Store com assinatura própria, use a aba "APK Projeto".
              </Alert>

              <details className="mt-6 border border-[#2d4a1e] rounded-lg overflow-hidden">
                <summary className="cursor-pointer bg-[#0d1309] px-4 py-3 text-[#5aab56] text-sm font-semibold select-none hover:bg-[#111e0b] transition-colors">
                  🔧 Avançado — Bubblewrap CLI (linha de comando)
                </summary>
                <div className="p-4">
                  <Alert color="yellow">
                    🔧 <strong>Método avançado.</strong> Requer Node.js, Java 17+ e Android SDK instalados no computador. Ideal para automatizar o processo ou publicar na Play Store.
                  </Alert>

                  <H2>📋 Requisitos</H2>
                  <div className="grid grid-cols-1 gap-2 mb-4">
                    {[
                      ["Node.js 18+", "nodejs.org", "https://nodejs.org"],
                      ["Java JDK 17+", "adoptium.net", "https://adoptium.net"],
                      ["Android Studio", "developer.android.com/studio", "https://developer.android.com/studio"],
                    ].map(([name, link, url]) => (
                      <div key={name} className="flex items-center justify-between bg-[#0d1309] border border-[#2d4a1e] rounded p-3">
                        <span className="text-[#8cba89] text-sm font-semibold">{name}</span>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#6ab4ff] text-xs underline">{link}</a>
                      </div>
                    ))}
                  </div>

                  <H2>🚀 Passo a passo</H2>
                  <H3>1. Instalar o Bubblewrap CLI</H3>
                  <Code copyKey="bw-install">npm install -g @bubblewrap/cli</Code>
                  <H3>2. Inicializar o projeto TWA</H3>
                  <Code copyKey="bw-init">{`bubblewrap init --manifest https://SEU-APP.replit.app/manifest.json`}</Code>
                  <P>O Bubblewrap faz perguntas sobre o app (nome, ícone, cor) e cria o projeto automaticamente.</P>
                  <H3>3. Compilar o APK</H3>
                  <Code copyKey="bw-build">bubblewrap build</Code>
                  <P>Gera <code className="text-[#a8d5a2] font-mono">app-release-signed.apk</code> na pasta do projeto.</P>
                  <H3>4. Instalar no celular via USB</H3>
                  <Code copyKey="bw-install-device">adb install app-release-signed.apk</Code>

                  <Alert color="blue">
                    🔁 Sempre que atualizar e republicar seu app web, o APK já busca a versão mais nova automaticamente — sem gerar novo APK!
                  </Alert>
                </div>
              </details>
            </div>
          ),

          "twa": (
            <div>
              <Alert color="blue">
                📦 <strong>Gera um projeto Android completo.</strong> Você compila com Android Studio e tem controle total — ideal para publicar na Play Store com sua própria assinatura.
              </Alert>

              <H2>⬇️ Gerar e baixar o projeto Android</H2>
              <P>Cole a URL do seu app publicado abaixo e clique em Baixar. Você receberá um .zip com o projeto Android completo pronto para compilar:</P>

              <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-lg p-4 mb-4">
                <label className="block text-[#5aab56] text-xs mb-2 font-semibold">URL do app publicado</label>
                <input
                  type="url"
                  value={twaUrl}
                  onChange={e => setTwaUrl(e.target.value)}
                  placeholder="https://meu-app.replit.app"
                  className="w-full bg-[#141c0d] border border-[#3d6e2a] rounded px-3 py-2 text-sm text-[#a8d5a2] placeholder-[#3d6e2a] outline-none focus:border-[#5aab56] mb-3"
                />
                {twaError && <p className="text-[#d47070] text-xs mb-2">{twaError}</p>}
                <button
                  onClick={downloadTwaPackage}
                  disabled={twaLoading}
                  className="w-full bg-[#2d4a1e] hover:bg-[#3d5e2a] disabled:opacity-50 text-[#7ec87a] font-semibold text-sm py-2 rounded transition-colors"
                >
                  {twaLoading ? "⏳ Gerando pacote..." : "📦 Baixar Projeto Android (.zip)"}
                </button>
              </div>

              <H2>🛠️ O que tem no ZIP baixado</H2>
              <ul className="space-y-1 mb-4">
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> <code className="text-[#a8d5a2] font-mono">AndroidManifest.xml</code> — configuração do app com sua URL</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> <code className="text-[#a8d5a2] font-mono">app/build.gradle</code> — dependências Android e configuração de build</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> <code className="text-[#a8d5a2] font-mono">strings.xml</code> — nome do app e URL configurada</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> <code className="text-[#a8d5a2] font-mono">.well-known/assetlinks.json</code> — template para verificação de domínio</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> <code className="text-[#a8d5a2] font-mono">README.md</code> — instruções completas de compilação</li>
              </ul>

              <H2>🏗️ Compilar com Android Studio (recomendado)</H2>
              <ol className="mb-4">
                <Step n={1}>Baixe e instale o <a href="https://developer.android.com/studio" target="_blank" rel="noopener noreferrer" className="text-[#6ab4ff] underline">Android Studio</a> no seu computador</Step>
                <Step n={2}>Extraia o .zip baixado em uma pasta</Step>
                <Step n={3}>Abra o Android Studio → <strong>File → Open</strong> → selecione a pasta extraída</Step>
                <Step n={4}>Aguarde o Gradle sincronizar (primeira vez pode demorar 5-10 min)</Step>
                <Step n={5}>Vá em <strong>Build → Generate Signed Bundle / APK → APK</strong></Step>
                <Step n={6}>Clique em <strong>"Create new keystore..."</strong> — preencha os dados e salve o arquivo .jks <span className="text-[#d47070]">(guarde esse arquivo! É sua assinatura)</span></Step>
                <Step n={7}>Escolha <strong>release</strong> e clique em <strong>Finish</strong></Step>
                <Step n={8}>O APK fica em: <code className="text-[#a8d5a2] font-mono text-xs">app/release/app-release.apk</code></Step>
              </ol>

              <H2>📲 Para publicar na Play Store</H2>
              <ul className="space-y-1">
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> Crie conta em <a href="https://play.google.com/console" target="_blank" rel="noopener noreferrer" className="text-[#6ab4ff] underline">Google Play Console</a> (taxa única de US$ 25)</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> Faça upload do .apk ou .aab (Android App Bundle)</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> Preencha as informações do app (nome, ícone, descrição, screenshots)</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> Configure o assetlinks.json no seu servidor (instruções no README)</li>
              </ul>
            </div>
          ),

          "universal": (
            <div>
              <Alert color="green">
                🌐 <strong>Este guia se aplica a QUALQUER projeto Replit.</strong> Siga os passos abaixo para transformar qualquer app web em app no celular.
              </Alert>

              <H2>📋 PASSO 1 — Escolha o plano Replit correto</H2>
              <div className="grid grid-cols-1 gap-2 mb-4">
                {[
                  { plano: "Free (Gratuito)", ok: "PWA via Chrome/Safari ✅", nok: "URL aleatória no Replit", rec: "Funciona para uso pessoal" },
                  { plano: "Hacker / Pro", ok: "Domínio .replit.app fixo ✅", nok: "—", rec: "Recomendado para apps sérios" },
                  { plano: "Custom Domain", ok: "Seu próprio domínio ✅", nok: "Custo extra", rec: "Para apps profissionais/Play Store" },
                ].map(({ plano, ok, nok, rec }) => (
                  <div key={plano} className="bg-[#0d1309] border border-[#2d4a1e] rounded-lg p-3">
                    <div className="text-[#7ec87a] font-bold text-sm mb-1">{plano}</div>
                    <div className="text-[#8cba89] text-xs">✅ {ok}</div>
                    {nok !== "—" && <div className="text-[#d4aa40] text-xs">⚠️ {nok}</div>}
                    <div className="text-[#5aab56] text-xs mt-1">→ {rec}</div>
                  </div>
                ))}
              </div>

              <H2>🚀 PASSO 2 — Publicar o app no Replit</H2>
              <ol className="mb-4">
                <Step n={1}>Abra seu projeto no <a href="https://replit.com" target="_blank" rel="noopener noreferrer" className="text-[#6ab4ff] underline">replit.com</a></Step>
                <Step n={2}>Certifique-se que o app está rodando (botão ▶ Run)</Step>
                <Step n={3}>Clique no botão <strong>"Deploy"</strong> (avião de papel) no canto superior direito</Step>
                <Step n={4}>Escolha <strong>"Reserved VM"</strong> ou <strong>"Autoscale"</strong></Step>
                <Step n={5}>Configure o domínio (ou use o .replit.app gerado automaticamente)</Step>
                <Step n={6}>Clique em <strong>"Deploy"</strong> e aguarde</Step>
                <Step n={7}>Copie a URL gerada — ex: <code className="text-[#a8d5a2] font-mono text-xs">https://meu-app.replit.app</code></Step>
              </ol>

              <H2>📱 PASSO 3 — Verificar se o app é PWA-pronto</H2>
              <P>Para funcionar como app, seu projeto precisa ter:</P>
              <div className="space-y-2 mb-4">
                {[
                  ["manifest.json", "Arquivo na pasta public/ com nome, ícones e cores", "obrigatório"],
                  ["Service Worker (sw.js)", "Permite funcionamento offline e instalação", "obrigatório"],
                  ["Ícones 192px e 512px", "Imagens PNG para o ícone do app", "obrigatório"],
                  ["HTTPS", "O Replit Deploy já usa HTTPS automaticamente", "automático"],
                ].map(([item, desc, req]) => (
                  <div key={item as string} className="flex items-start gap-3 bg-[#0d1309] border border-[#2d4a1e] rounded p-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${req === "automático" ? "bg-[#0d1e3d] text-[#6ab4ff]" : "bg-[#1a3d14] text-[#7ec87a]"}`}>{req}</span>
                    <div>
                      <div className="text-[#7ec87a] text-sm font-semibold">{item}</div>
                      <div className="text-[#6b8f68] text-xs">{desc as string}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Alert color="blue">
                💡 O SK Code Editor já tem manifest.json, sw.js e ícones prontos. Para outros projetos seus no Replit, peça para a Jasmim: "Adicione PWA neste projeto com manifest.json e service worker".
              </Alert>

              <H2>🔄 PASSO 4 — Escolha o método de instalação</H2>
              <div className="grid grid-cols-1 gap-2 mb-4">
                {[
                  ["📱 PWA (mais fácil)", "Chrome → 3 pontinhos → Instalar", "Qualquer projeto publicado", "Instantâneo"],
                  ["⚡ APK via PWABuilder", "pwabuilder.com → cola URL → baixa APK", "Projetos PWA-válidos", "5 minutos"],
                  ["📦 APK via TWA ZIP", "Baixe o pacote aqui → compile com Android Studio", "Qualquer projeto publicado", "30 minutos (1ª vez)"],
                  ["🔧 Bubblewrap CLI", "npm install bubblewrap → gera APK via terminal", "Desenvolvedores avançados", "1-2 horas (1ª vez)"],
                ].map(([método, como, req, tempo]) => (
                  <div key={método as string} className="bg-[#0d1309] border border-[#2d4a1e] rounded-lg p-3">
                    <div className="text-[#7ec87a] font-bold text-sm">{método}</div>
                    <div className="text-[#8cba89] text-xs mt-1">{como as string}</div>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-[#5aab56]">✓ {req as string}</span>
                      <span className="text-[#6b8f68]">⏱ {tempo as string}</span>
                    </div>
                  </div>
                ))}
              </div>

              <H2>♻️ Aplicar em todos os seus projetos</H2>
              <P>Para cada app que você tiver no Replit, repita estes passos:</P>
              <ol className="mb-2">
                {[
                  "Publique o app (Deploy) → copie a URL",
                  "Teste se o manifest.json está acessível: URL/manifest.json",
                  "Abra no Chrome do celular → instale como PWA",
                  "Para APK: cole a URL aqui ou no PWABuilder.com e baixe o pacote",
                ].map((t, i) => <Step key={i} n={i + 1}>{t}</Step>)}
              </ol>
            </div>
          ),
        };

        return (
          <div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1 bg-[#0d2210] border border-[#2d5a1e] rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[#7ec87a] font-semibold text-sm">⬇️ ZIP do Projeto</p>
                  <p className="text-[#5aab56] text-xs mt-0.5">Exporta todos os arquivos do editor</p>
                </div>
                <button
                  onClick={downloadProjectZip}
                  disabled={zipLoading}
                  className="shrink-0 bg-[#2d4a1e] hover:bg-[#3d5e2a] disabled:opacity-50 text-[#7ec87a] font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  {zipLoading ? "⏳ Gerando..." : "⬇️ Baixar ZIP"}
                </button>
              </div>
              <div className="flex-1 bg-[#0d1a30] border border-[#1e3d7a] rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[#6ab4ff] font-semibold text-sm">⬇️ Pacote Android TWA</p>
                  <p className="text-[#4a8fd4] text-xs mt-0.5">Projeto Android para gerar APK do seu app</p>
                </div>
                <button
                  onClick={() => { setInstallTab("twa"); downloadTwaPackage(); }}
                  disabled={twaLoading}
                  className="shrink-0 bg-[#1e3d7a] hover:bg-[#2a5099] disabled:opacity-50 text-[#6ab4ff] font-semibold text-xs px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  {twaLoading ? "⏳ Gerando..." : "⬇️ Baixar TWA"}
                </button>
              </div>
            </div>
            {zipEmptyWarning && (
              <div className="bg-[#2d2200] border border-[#5a4500] text-[#d4aa40] rounded-lg p-3 mb-4 text-sm flex items-start gap-2">
                <span className="shrink-0">⚠️</span>
                <div>
                  <p className="font-semibold">Nenhum arquivo no projeto</p>
                  <p className="text-xs text-[#b89030] mt-0.5">Adicione ou crie arquivos no editor antes de baixar o ZIP.</p>
                </div>
              </div>
            )}

            <div className="flex gap-1 mb-4 overflow-x-auto pb-1 flex-wrap">
              {installTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setInstallTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    installTab === tab.id
                      ? "bg-[#2d4a1e] text-[#7ec87a] border border-[#5aab56]"
                      : "bg-[#141c0d] text-[#5a7a56] border border-[#2d4a1e] hover:text-[#7ec87a]"
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
            {tabContent[installTab]}
          </div>
        );
      })(),
    },

    {
      id: "terminal",
      icon: "🖥️",
      title: "Terminal",
      content: (
        <div>
          <P>
            O terminal do SK Code Editor é um bash <strong className="text-[#7ec87a]">real</strong> —
            todos os comandos rodam no servidor e retornam saída verdadeira.
          </P>

          <H2>📂 Diretório de trabalho</H2>
          <Code copyKey="cwd">/home/runner/sk-user-workspace/</Code>
          <P>Todo projeto fica dentro desta pasta. Use paths relativos normalmente.</P>

          <H2>🔧 Comandos mais usados</H2>

          <H3>Gerenciamento de pacotes Node.js</H3>
          <Code copyKey="npm-install">npm install express axios cors dotenv</Code>
          <Code copyKey="npm-run">npm run dev
npm start
npm run build</Code>

          <H3>Gerenciamento de pacotes Python</H3>
          <Code copyKey="pip">pip install flask requests pandas sqlalchemy</Code>
          <Code copyKey="python-run">python app.py
python -m pytest
python -m py_compile arquivo.py</Code>

          <H3>Navegação e arquivos</H3>
          <Code copyKey="nav">ls -la           # listar arquivos
pwd              # diretório atual
cd meu-projeto   # entrar na pasta
mkdir nova-pasta # criar pasta
cat package.json # ler arquivo</Code>

          <H3>Processos</H3>
          <Code copyKey="proc">ps aux | grep node    # ver processos Node rodando
kill -9 PID          # matar processo pelo ID
lsof -i :3000        # ver quem usa a porta 3000</Code>

          <H3>Git no terminal</H3>
          <Code copyKey="git-terminal">git status
git add .
git commit -m "minha mensagem"
git push origin main</Code>

          <H2>⚙️ Variáveis de ambiente</H2>
          <P>Crie um arquivo <Badge color="green">.env</Badge> na raiz do projeto:</P>
          <Code copyKey="env-file">DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
PORT=3000
JWT_SECRET=minha-chave-secreta-longa-aqui
NODE_ENV=development</Code>
          <P>
            Instale o dotenv e use <Badge color="green">require('dotenv').config()</Badge> no início do
            seu script para carregar as variáveis.
          </P>

          <H2>🚀 Rodar um servidor</H2>
          <Code copyKey="server">node index.js           # Node puro
npm run dev             # com nodemon (auto-restart)
npx ts-node src/main.ts # TypeScript direto
uvicorn main:app --reload # FastAPI/Python</Code>

          <H2>💡 Dicas</H2>
          <ul className="space-y-1">
            <Li>Use Ctrl+C para parar qualquer processo rodando</Li>
            <Li>Se travar, feche e reabra o terminal (ícone ✕ → ▶)</Li>
            <Li>O terminal salva histórico — use ↑ para repetir comandos</Li>
            <Li>Peça para a Jasmim rodar comandos: "rode npm install e mostre o resultado"</Li>
          </ul>
        </div>
      ),
    },

    {
      id: "neon",
      icon: "🗄️",
      title: "Banco de Dados (Neon)",
      content: (
        <div>
          <P>
            <strong className="text-[#7ec87a]">Neon DB</strong> é PostgreSQL serverless gratuito —
            a melhor opção para projetos profissionais. Sem cartão de crédito.
          </P>

          <H2>🚀 Setup em 5 minutos</H2>
          <ol className="space-y-3 mb-4">
            {[
              { step: "Crie conta gratuita em", link: "https://neon.tech", detail: "plano Free, sem cartão" },
              { step: "Clique em \"New Project\"", link: null, detail: "dê um nome ao banco (ex: meu-app)" },
              { step: "Copie a Connection String", link: null, detail: "começa com postgresql://..." },
              { step: "Cole no painel 🗄️ do editor", link: null, detail: "ícone de banco na barra inferior" },
              { step: "Pronto!", link: null, detail: "a Jasmim já tem acesso ao seu banco" },
            ].map(({ step, link, detail }, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-[#7ec87a] font-bold shrink-0 w-5">{i + 1}.</span>
                <div>
                  <span className="text-[#8cba89] text-sm">{step} </span>
                  {link && (
                    <span className="text-[#6ab4ff] text-sm">{link}</span>
                  )}
                  <div className="text-[#5aab56] text-xs mt-0.5">{detail}</div>
                </div>
              </li>
            ))}
          </ol>

          <H2>🔑 Obter Neon API Key (para automação)</H2>
          <P>Com a API Key, a Jasmim pode criar o banco automaticamente para você:</P>
          <ol className="space-y-1">
            <Li>Entre em https://console.neon.tech</Li>
            <Li>Vá em Settings → API Keys → Create API Key</Li>
            <Li>A chave começa com neon_api_...</Li>
            <Li>Envie a chave para a Jasmim: "Crie um banco chamado meu-app"</Li>
          </ol>

          <H2>📦 Instalar dependências</H2>
          <Code copyKey="neon-install">npm install @neondatabase/serverless dotenv</Code>

          <H2>🔌 Arquivo de conexão</H2>
          <Code copyKey="neon-connect">{`// db/neon.js
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function initDb() {
  await sql\`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  \`;
  console.log('✅ Banco inicializado!');
}

module.exports = { sql, initDb };`}</Code>

          <H2>📄 Arquivo .env</H2>
          <Code copyKey="neon-env">{`DATABASE_URL=postgresql://usuario:senha@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
PORT=3000
NODE_ENV=development`}</Code>

          <H2>⚡ Comandos SQL úteis</H2>
          <H3>Criar tabela</H3>
          <Code copyKey="sql-create">{`CREATE TABLE IF NOT EXISTS tarefas (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  concluida BOOLEAN DEFAULT false,
  criado_em TIMESTAMP DEFAULT NOW()
);`}</Code>

          <H3>Inserir dados</H3>
          <Code copyKey="sql-insert">{`INSERT INTO tarefas (titulo) 
VALUES ('Primeira tarefa'), ('Segunda tarefa');`}</Code>

          <H3>Consultar</H3>
          <Code copyKey="sql-select">{`SELECT * FROM tarefas ORDER BY criado_em DESC LIMIT 10;`}</Code>

          <H3>Alterar tabela</H3>
          <Code copyKey="sql-alter">{`ALTER TABLE tarefas ADD COLUMN descricao TEXT;
ALTER TABLE tarefas ADD COLUMN prioridade INTEGER DEFAULT 1;`}</Code>

          <H2>🔐 Com Prisma ORM (recomendado para projetos maiores)</H2>
          <Code copyKey="prisma-install">npm install prisma @prisma/client dotenv
npx prisma init</Code>
          <Code copyKey="prisma-schema">{`// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Tarefa {
  id        Int      @id @default(autoincrement())
  titulo    String
  concluida Boolean  @default(false)
  criadoEm DateTime @default(now())
  @@map("tarefas")
}`}</Code>
          <Code copyKey="prisma-migrate">npx prisma migrate dev --name init
npx prisma studio   # abre interface visual do banco</Code>

          <H2>⚠️ Regras importantes</H2>
          <ul className="space-y-1">
            <Li>NUNCA commite o .env com dados reais no git</Li>
            <Li>SEMPRE crie .gitignore com .env listado</Li>
            <Li>SEMPRE crie .env.example com valores de exemplo</Li>
            <Li>Use sslmode=require para Neon (já vem na connection string)</Li>
          </ul>
        </div>
      ),
    },

    {
      id: "jasmim",
      icon: "🤖",
      title: "Jasmim (IA)",
      content: (
        <div>
          <P>
            <strong className="text-[#7ec87a]">Jasmim</strong> é sua assistente de IA — desenvolvedora
            sênior com autonomia total para criar projetos completos, corrigir erros e configurar
            banco de dados automaticamente.
          </P>

          <H2>💬 Como conversar com a Jasmim</H2>
          <ul className="space-y-1 mb-3">
            <Li>Seja direto: "Crie um CRUD de clientes com Node.js e Neon DB"</Li>
            <Li>Ela gera arquivos completos — você aplica com 1 clique</Li>
            <Li>Ela vê o terminal automaticamente e já prepara a solução para erros</Li>
            <Li>Ela continua sem parar até a tarefa estar 100% concluída</Li>
            <Li>Peça revisões: "Adicione autenticação JWT nesse projeto"</Li>
          </ul>

          <H2>🎯 O que a Jasmim faz sem precisar de permissão</H2>
          <ul className="space-y-1 mb-3">
            <Li>Criar projeto do zero (qualquer linguagem/framework)</Li>
            <Li>Instalar dependências (npm, pip, qualquer gerenciador)</Li>
            <Li>Criar e modificar qualquer arquivo</Li>
            <Li>Configurar banco de dados completo (schema, tabelas, migrations)</Li>
            <Li>Adicionar autenticação, rotas, APIs REST</Li>
            <Li>Corrigir erros de compilação automaticamente</Li>
            <Li>Fazer push para GitHub quando você pedir</Li>
          </ul>

          <H2>📋 Exemplos de comandos eficientes</H2>

          <H3>Criar projeto completo</H3>
          <Code copyKey="jasmim-1">"Crie um app de lista de tarefas com React, Node.js/Express, Neon DB PostgreSQL e autenticação JWT. Interface em português."</Code>

          <H3>Configurar banco automaticamente</H3>
          <Code copyKey="jasmim-2">"Minha Neon API Key é neon_api_xxx. Crie um banco chamado meu-app e já configure tudo no projeto."</Code>

          <H3>Corrigir erro</H3>
          <Code copyKey="jasmim-3">"Tem um erro no terminal acima, corrija."</Code>

          <H3>Adicionar funcionalidade</H3>
          <Code copyKey="jasmim-4">"Adicione upload de arquivos PDF nesse projeto usando multer. Salve os arquivos na pasta uploads/."</Code>

          <H3>Refatorar</H3>
          <Code copyKey="jasmim-5">"Reorganize a estrutura de pastas desse projeto seguindo as boas práticas do Express (routes/, controllers/, models/, middleware/)."</Code>

          <H2>🔍 Escopo de arquivo</H2>
          <P>
            No topo do chat, selecione quais arquivos a Jasmim pode ver.
            Quanto mais arquivos você selecionar, melhor ela entende o contexto do projeto.
          </P>

          <H2>📜 Histórico</H2>
          <P>
            O histórico de conversa fica salvo automaticamente. Use o botão 🗑️ para limpar
            e começar uma nova sessão quando mudar de projeto.
          </P>
        </div>
      ),
    },

    {
      id: "github",
      icon: "🐙",
      title: "GitHub",
      content: (
        <div>
          <P>
            Conecte seu repositório GitHub ao SK Code Editor para fazer push, pull e gerenciar
            branches diretamente no editor.
          </P>

          <H2>🔑 Criar Personal Access Token (PAT)</H2>
          <ol className="space-y-2 mb-4">
            {[
              { step: "Acesse", link: "github.com → Settings → Developer Settings" },
              { step: "Vá em", link: "Personal access tokens → Tokens (classic) → Generate new token" },
              { step: "Permissões necessárias:", link: "repo (todas), workflow (se usar Actions)" },
              { step: "Copie o token", link: "começa com ghp_..." },
              { step: "Cole no painel 🐙 do editor", link: "ícone GitHub na barra inferior" },
            ].map(({ step, link }, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-[#7ec87a] font-bold shrink-0">{i + 1}.</span>
                <div className="text-sm text-[#8cba89]">
                  <strong>{step}</strong>{" "}
                  <span className="text-[#6ab4ff]">{link}</span>
                </div>
              </li>
            ))}
          </ol>

          <H2>📦 Operações disponíveis no painel</H2>
          <ul className="space-y-1">
            <Li>Clonar repositório existente para o workspace</Li>
            <Li>Fazer commit e push de arquivos modificados</Li>
            <Li>Pull para atualizar o workspace com o remote</Li>
            <Li>Ver diff dos arquivos modificados</Li>
            <Li>Criar e trocar de branch</Li>
          </ul>

          <H2>🖥️ Git no terminal</H2>
          <Code copyKey="git-full">{`# Configurar identidade (primeira vez)
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"

# Clonar repositório
git clone https://github.com/usuario/repo.git

# Fazer commit e push
git add .
git commit -m "feat: adiciona funcionalidade X"
git push origin main

# Criar e usar nova branch
git checkout -b minha-feature
git push -u origin minha-feature`}</Code>

          <H2>⚠️ Segurança</H2>
          <ul className="space-y-1">
            <Li>NUNCA commite arquivos .env com senhas</Li>
            <Li>Adicione .env ao .gitignore ANTES do primeiro commit</Li>
            <Li>Seu PAT fica criptografado no editor — nunca é exposto</Li>
          </ul>
        </div>
      ),
    },

    {
      id: "preview",
      icon: "👁️",
      title: "Preview ao Vivo",
      content: (
        <div>
          <P>
            O preview ao vivo renderiza HTML, CSS, JS e React diretamente no editor —
            sem precisar abrir o navegador.
          </P>

          <H2>🖥️ Como abrir o preview</H2>
          <ol className="space-y-1 mb-3">
            <Li>Toque no ícone 👁️ na barra inferior</Li>
            <Li>O preview abre mostrando o index.html do projeto atual</Li>
            <Li>Clique em "Tela Cheia" (ícone de expandir) para ver em tela grande</Li>
            <Li>Clique em "Recarregar" para atualizar após mudanças</Li>
          </ol>

          <H2>✅ Para o preview funcionar</H2>
          <ul className="space-y-1 mb-3">
            <Li>O arquivo index.html precisa estar na raiz do projeto</Li>
            <Li>CSS e JS referenciados no HTML são carregados automaticamente</Li>
            <Li>Projetos React/Vite: rode npm run dev no terminal primeiro</Li>
          </ul>

          <H2>🚀 Preview de um projeto Node.js/React</H2>
          <Code copyKey="preview-node">{`# 1. Instale as dependências
npm install

# 2. Rode o servidor de desenvolvimento
npm run dev      # ou: npm start

# 3. O preview vai aparecer na porta configurada`}</Code>

          <H2>📱 Preview responsivo</H2>
          <P>
            Use o botão de dimensões no preview para simular telas de smartphone, tablet
            e desktop sem precisar de DevTools.
          </P>
        </div>
      ),
    },

    {
      id: "importexport",
      icon: "📦",
      title: "Importar / Exportar",
      content: (
        <div>
          <P>
            O SK Code Editor permite importar e exportar projetos como ZIP ou TAR.GZ
            para transferir entre dispositivos ou fazer backup.
          </P>

          <H2>📥 Importar projeto</H2>
          <ul className="space-y-1 mb-3">
            <Li>Toque no ícone 📁 na barra inferior → "Importar ZIP/TAR.GZ"</Li>
            <Li>Selecione o arquivo .zip ou .tar.gz do seu projeto</Li>
            <Li>O editor extrai e carrega todos os arquivos automaticamente</Li>
            <Li>Projetos do VS Code, Replit, Glitch e outros são compatíveis</Li>
          </ul>

          <H2>📤 Exportar projeto</H2>
          <ul className="space-y-1 mb-3">
            <Li>Toque no ícone 📁 → "Exportar como ZIP"</Li>
            <Li>Um arquivo .zip com todos os arquivos é baixado</Li>
            <Li>Use para backup ou para abrir em outro editor</Li>
          </ul>

          <H2>📦 Backup no Google Drive</H2>
          <P>Com Google Drive conectado (ícone ☁️):</P>
          <ul className="space-y-1">
            <Li>Backup automático do projeto atual</Li>
            <Li>Restaurar versões anteriores</Li>
            <Li>Sincronizar entre dispositivos</Li>
          </ul>

          <H2>💡 Dicas</H2>
          <ul className="space-y-1">
            <Li>Antes de importar, o projeto atual fica salvo no histórico</Li>
            <Li>node_modules é ignorado na exportação (muito pesado)</Li>
            <Li>Arquivos .env são incluídos — cuidado ao compartilhar</Li>
            <Li>Para projetos grandes, prefira exportar TAR.GZ (menor)</Li>
          </ul>
        </div>
      ),
    },

    {
      id: "credenciais",
      icon: "🔑",
      title: "Credenciais e API Keys",
      content: (
        <div>
          <P>
            O SK Code Editor usa credenciais para conectar serviços externos.
            Todas são salvas localmente e nunca enviadas para servidores externos.
          </P>

          <H2>🔑 Onde configurar cada credencial</H2>

          <div className="space-y-3 mb-4">
            {[
              { icon: "🤖", name: "API Key de IA (OpenAI, Gemini, Groq...)", where: "Painel da Jasmim → ⚙️ Configurações", detail: "sk- (OpenAI), AIza (Gemini), gsk_ (Groq), sk-ant (Anthropic), xai- (Grok), sk-or- (OpenRouter)" },
              { icon: "🐙", name: "GitHub Personal Access Token", where: "Painel GitHub → Inserir credenciais", detail: "ghp_... (Token clássico, permissões: repo, workflow)" },
              { icon: "🗄️", name: "Connection String do Banco", where: "Painel Banco de Dados → Cole a URL", detail: "postgresql://user:pass@host/db?sslmode=require" },
              { icon: "☁️", name: "Google Drive", where: "Painel Backup → Conectar com Google", detail: "Login OAuth — não requer chave manual" },
            ].map(({ icon, name, where, detail }) => (
              <div key={name} className="bg-[#0d1309] border border-[#2d4a1e] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>{icon}</span>
                  <strong className="text-[#7ec87a] text-sm">{name}</strong>
                </div>
                <div className="text-[#5aab56] text-xs mb-1">📍 {where}</div>
                <div className="text-[#6b8f68] text-xs font-mono">{detail}</div>
              </div>
            ))}
          </div>

          <H2>🔒 Segurança</H2>
          <ul className="space-y-1">
            <Li>Credenciais ficam no localStorage do navegador — só você tem acesso</Li>
            <Li>API keys de IA são enviadas apenas ao backend deste editor (nunca expostas)</Li>
            <Li>Para trocar uma credencial, simplesmente cole a nova no mesmo campo</Li>
            <Li>Para revogar acesso, delete a key no serviço externo (GitHub, OpenAI, etc.)</Li>
          </ul>

          <H2>⚡ Detecção automática de provedor de IA</H2>
          <P>A Jasmim detecta automaticamente qual provedor usar pela sua API key:</P>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["gsk_", "Groq"],
              ["sk-or-", "OpenRouter"],
              ["pplx-", "Perplexity"],
              ["AIza", "Gemini"],
              ["xai-", "Grok (xAI)"],
              ["sk-ant", "Anthropic"],
              ["neon_api_", "Neon DB API"],
              ["sk-", "OpenAI"],
            ].map(([prefix, name]) => (
              <div key={prefix} className="flex items-center gap-2 bg-[#0d1309] border border-[#2d4a1e] rounded p-2">
                <Badge color="green">{prefix}</Badge>
                <span className="text-[#8cba89] text-xs">{name}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    {
      id: "juridico",
      icon: "⚖️",
      title: "Assistente Jurídico",
      content: (
        <div>
          <P>
            O <strong className="text-[#7ec87a]">Assistente Jurídico</strong> (Jamile) é
            especializado em Direito brasileiro — gera peças processuais, analisa ementas e
            responde perguntas jurídicas.
          </P>

          <H2>📋 Abas disponíveis</H2>
          <ul className="space-y-1 mb-3">
            <Li><strong className="text-[#7ec87a]">Processar</strong> — gera petições, contratos, pareceres com base no prompt</Li>
            <Li><strong className="text-[#7ec87a]">Ementas</strong> — biblioteca de ementas jurisprudenciais que alimentam o contexto da IA</Li>
            <Li><strong className="text-[#7ec87a]">Histórico</strong> — últimas 15 gerações, com opção de restaurar e reeditar</Li>
            <Li><strong className="text-[#7ec87a]">Ações</strong> — ações personalizadas que você define e reutiliza</Li>
          </ul>

          <H2>⚡ Nível de Esforço (1–5)</H2>
          <div className="grid grid-cols-5 gap-1 mb-3">
            {[
              ["1", "Rápido", "8k tokens"],
              ["2", "Básico", "16k tokens"],
              ["3", "Normal", "32k tokens"],
              ["4", "Detalhado", "64k tokens"],
              ["5", "Exaustivo", "131k tokens"],
            ].map(([n, label, tokens]) => (
              <div key={n} className="bg-[#0d1309] border border-[#2d4a1e] rounded p-2 text-center">
                <div className="text-[#7ec87a] font-bold text-sm">{n}</div>
                <div className="text-[#8cba89] text-xs">{label}</div>
                <div className="text-[#5aab56] text-xs">{tokens}</div>
              </div>
            ))}
          </div>

          <H2>📝 Verbosidade</H2>
          <ul className="space-y-1 mb-3">
            <Li><strong>Concisa</strong> — peça objetiva, sem redundâncias, mais curta</Li>
            <Li><strong>Completa</strong> — peça completa com fundamentação aprofundada</Li>
          </ul>

          <H2>📚 Ementas (biblioteca jurisprudencial)</H2>
          <P>
            Na aba Ementas, você cadastra suas próprias ementas de jurisprudência.
            Elas são inseridas automaticamente no contexto quando você gera uma peça,
            enriquecendo a fundamentação jurídica da IA.
          </P>
          <ul className="space-y-1 mb-3">
            <Li>Cole a ementa completa no campo de texto</Li>
            <Li>Dê um título para identificar facilmente</Li>
            <Li>Marque as ementas que quer usar antes de gerar a peça</Li>
            <Li>Você pode ter até 50 ementas na biblioteca</Li>
          </ul>

          <H2>🎯 Ações personalizadas</H2>
          <P>
            Na aba Ações, crie prompts reutilizáveis para tipos de peça que você usa
            frequentemente. Exemplos:
          </P>
          <Code copyKey="acao-exemplo">"Elabore uma petição inicial de ação de indenização por danos morais decorrentes de negativação indevida, fundamentada no CDC e CC. Inclua pedido de tutela de urgência para exclusão imediata do nome dos cadastros de restrição ao crédito."</Code>
        </div>
      ),
    },

    {
      id: "meus-projetos",
      icon: "🗂️",
      title: "Meus Projetos",
      content: (() => {
        const tabs = [
          { id: "importar",  label: "Trazer do Replit", icon: "⬇️" },
          { id: "desktop",   label: "App no PC",        icon: "🖥️" },
          { id: "privado",   label: "Instalação Privada", icon: "🔒" },
          { id: "juntar",    label: "Juntar Apps",      icon: "🔗" },
          { id: "orientar",  label: "Me Oriento",       icon: "🧭" },
        ];

        const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
          <li className="flex gap-3 mb-3">
            <span className="bg-[#2d4a1e] text-[#7ec87a] font-bold rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5">{n}</span>
            <span className="text-[#8cba89] text-sm leading-relaxed">{children}</span>
          </li>
        );

        const Alert = ({ color, children }: { color: "green" | "blue" | "yellow" | "red"; children: React.ReactNode }) => {
          const c = {
            green:  "bg-[#0d2210] border-[#2d5a1e] text-[#7ec87a]",
            blue:   "bg-[#0a1530] border-[#1e3d7a] text-[#6ab4ff]",
            yellow: "bg-[#1e1500] border-[#4a3800] text-[#d4aa40]",
            red:    "bg-[#1e0a0a] border-[#5a1e1e] text-[#d47070]",
          }[color];
          return <div className={`border rounded-lg p-3 mb-3 text-sm ${c}`}>{children}</div>;
        };

        const Box = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
          <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-lg p-3 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span>{icon}</span>
              <strong className="text-[#7ec87a] text-sm">{title}</strong>
            </div>
            <p className="text-[#8cba89] text-xs leading-relaxed">{desc}</p>
          </div>
        );

        const tabContent: Record<string, React.ReactNode> = {

          "importar": (
            <div>
              <Alert color="blue">
                ⬇️ <strong>Você não precisa recriar nada.</strong> Seus projetos do Replit chegam aqui prontos — código, arquivos e tudo mais. Escolha o método abaixo.
              </Alert>

              <H2>📦 MÉTODO 1 — Via ZIP (mais fácil)</H2>
              <P>No Replit, qualquer projeto pode ser exportado como ZIP em segundos.</P>
              <ol className="mb-4">
                <Step n={1}>Abra o projeto no <a href="https://replit.com" target="_blank" rel="noopener noreferrer" className="text-[#6ab4ff] underline">Replit</a></Step>
                <Step n={2}>Clique nos <strong>3 pontinhos (⋯)</strong> no topo ou vá em <strong>Files → Download as zip</strong></Step>
                <Step n={3}>Salve o arquivo .zip no celular ou computador</Step>
                <Step n={4}>Aqui no SK Editor, toque no ícone <strong>📁</strong> na barra inferior</Step>
                <Step n={5}>Toque em <strong>"Importar ZIP"</strong> e selecione o arquivo</Step>
                <Step n={6}>✅ O projeto aparece com todos os arquivos prontos para editar</Step>
              </ol>

              <Alert color="green">
                💡 Funciona com qualquer projeto: Node.js, Python, React, HTML puro, qualquer linguagem.
              </Alert>

              <H2>🐙 MÉTODO 2 — Via GitHub (recomendado para manter sincronizado)</H2>
              <P>Se o projeto estiver no GitHub, você clona direto pelo terminal.</P>
              <ol className="mb-4">
                <Step n={1}>No Replit, vá em <strong>Version Control</strong> e conecte ao GitHub se ainda não fez</Step>
                <Step n={2}>Faça push do projeto para o GitHub (botão <strong>Push</strong>)</Step>
                <Step n={3}>Aqui no SK Editor, abra o <strong>Terminal</strong> (ícone 🖥️ na barra inferior)</Step>
                <Step n={4}>
                  Digite o comando para clonar:<br/>
                  <span className="font-mono text-[#a8d5a2] text-xs bg-[#0d1309] px-2 py-1 rounded block mt-1">git clone https://github.com/SEU_USUARIO/NOME_DO_REPO.git</span>
                </Step>
                <Step n={5}>O projeto é baixado completo na pasta do workspace</Step>
                <Step n={6}>No painel de arquivos (📁), navegue até a pasta criada e abra os arquivos</Step>
              </ol>

              <H2>🔑 Para repositórios privados</H2>
              <P>Repositórios privados do GitHub precisam do seu Personal Access Token:</P>
              <Code copyKey="clone-privado">git clone https://SEU_TOKEN@github.com/SEU_USUARIO/REPO_PRIVADO.git</Code>
              <P>Veja a seção <strong>GitHub</strong> deste manual para criar seu token (PAT).</P>

              <H2>📋 Para projetos sem GitHub</H2>
              <ul className="space-y-1 mb-3">
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> Use o Método 1 (ZIP) — funciona sempre, sem precisar de conta GitHub</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> Ou copie e cole os arquivos um por um usando a Jasmim: "Crie um arquivo chamado X com este conteúdo: [cola o código]"</li>
              </ul>
            </div>
          ),

          "desktop": (
            <div>
              <Alert color="green">
                🖥️ <strong>Instalar no PC é a opção mais simples e totalmente privada.</strong> Sem loja, sem conta, sem instalador. Funciona no Windows, Mac e Linux.
              </Alert>

              <H2>🪟 Windows — Chrome ou Edge</H2>
              <ol className="mb-4">
                <Step n={1}>Abra o <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong> no computador</Step>
                <Step n={2}>Acesse a URL do app publicado: <span className="font-mono text-[#a8d5a2] text-xs">https://seu-app.replit.app</span></Step>
                <Step n={3}>Aguarde carregar completamente</Step>
                <Step n={4}>
                  No Chrome: Clique no ícone <strong>⊕</strong> na barra de endereços (lado direito)<br/>
                  No Edge: Clique nos <strong>...</strong> → <strong>"Aplicativos"</strong> → <strong>"Instalar este site como um aplicativo"</strong>
                </Step>
                <Step n={5}>Confirme clicando em <strong>"Instalar"</strong></Step>
                <Step n={6}>✅ O app abre numa janela própria — sem abas, sem barra do navegador. Aparece no menu Iniciar!</Step>
              </ol>

              <H2>🍎 Mac — Chrome ou Safari</H2>
              <ol className="mb-4">
                <Step n={1}>Abra <strong>Google Chrome</strong> no Mac</Step>
                <Step n={2}>Acesse a URL do app</Step>
                <Step n={3}>Clique nos <strong>⋮</strong> → <strong>"Salvar e compartilhar"</strong> → <strong>"Criar atalho..."</strong></Step>
                <Step n={4}>Marque <strong>"Abrir como janela"</strong> e clique em <strong>Criar</strong></Step>
                <Step n={5}>✅ App aparece no Launchpad e no Dock</Step>
              </ol>

              <H2>🐧 Linux — Chrome ou Chromium</H2>
              <ol className="mb-4">
                <Step n={1}>Abra o Chrome/Chromium</Step>
                <Step n={2}>Acesse a URL do app</Step>
                <Step n={3}>Clique no ícone <strong>⊕</strong> na barra de endereços ou nos <strong>⋮</strong> → <strong>"Instalar SK Code Editor..."</strong></Step>
                <Step n={4}>✅ App aparece no menu de aplicativos do sistema</Step>
              </ol>

              <H2>⚙️ O que você ganha com a instalação no PC</H2>
              <div className="grid grid-cols-1 gap-2 mb-4">
                {[
                  ["🪟 Janela própria", "Abre sem abas do navegador — parece um app de verdade"],
                  ["📌 Ícone no menu", "Aparece no menu Iniciar (Windows) ou Launchpad (Mac)"],
                  ["🔕 Sem distração", "Sem as ferramentas do navegador, só o app"],
                  ["🔒 Totalmente privado", "Só você vê — nada vai para nenhuma loja"],
                  ["♻️ Atualização automática", "Quando o app no Replit é atualizado, a instalação já pega a versão nova"],
                ].map(([título, desc]) => (
                  <div key={título as string} className="bg-[#0d1309] border border-[#2d4a1e] rounded p-3">
                    <div className="text-[#7ec87a] text-sm font-semibold">{título}</div>
                    <div className="text-[#6b8f68] text-xs mt-0.5">{desc as string}</div>
                  </div>
                ))}
              </div>

              <H2>🗑️ Como desinstalar</H2>
              <ul className="space-y-1">
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> Windows: Configurações → Aplicativos → encontre o app → Desinstalar</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> Mac: Arraste do Launchpad para a lixeira</li>
                <li className="flex gap-2 text-sm text-[#8cba89]"><span className="text-[#5aab56]">›</span> Ou no Chrome/Edge: acesse a URL → ícone ⊕ → "Desinstalar"</li>
              </ul>
            </div>
          ),

          "privado": (
            <div>
              <Alert color="yellow">
                🔒 <strong>Instalação privada = só você usa, sem passar por loja nenhuma.</strong> Seus dados ficam só no seu dispositivo. Ninguém mais acessa.
              </Alert>

              <H2>📱 Android — APK Privado (sideload)</H2>
              <P>Instalar APK diretamente no celular sem passar pela Play Store:</P>
              <ol className="mb-4">
                <Step n={1}>Gere o APK usando a aba <strong>"Instalar como App → APK Projeto"</strong> ou o PWABuilder.com</Step>
                <Step n={2}>Transfira o .apk para o celular: via <strong>Google Drive, WhatsApp para si mesmo, cabo USB ou email</strong></Step>
                <Step n={3}>No Android vá em <strong>Configurações → Privacidade</strong> (ou Segurança) → ative <strong>"Instalar apps desconhecidos"</strong> para o gerenciador de arquivos</Step>
                <Step n={4}>Abra o gerenciador de arquivos, localize o .apk e toque nele</Step>
                <Step n={5}>Toque em <strong>"Instalar"</strong></Step>
                <Step n={6}>✅ App instalado! Não aparece na Play Store para mais ninguém — é só seu</Step>
              </ol>

              <Alert color="green">
                💡 Você pode compartilhar o .apk com pessoas de confiança via WhatsApp ou Google Drive — elas instalam da mesma forma. Sem publicar em loja nenhuma.
              </Alert>

              <H2>🍎 iPhone/iPad — Opções privadas</H2>
              <Alert color="red">
                ⚠️ A Apple não permite instalar apps fora da App Store sem um processo especial. As opções disponíveis são:
              </Alert>

              <Box
                icon="✅"
                title="Opção 1: PWA via Safari (mais fácil)"
                desc="Acesse a URL no Safari → botão Compartilhar → 'Adicionar à Tela de Início'. Fica no celular como app, privado, sem loja. Limitação: precisa de internet para abrir."
              />
              <Box
                icon="🔧"
                title="Opção 2: TestFlight (distribuição privada oficial da Apple)"
                desc="Você sobe o app no TestFlight (plataforma de testes da Apple) e envia o link só para as pessoas que quiser. Requer conta de desenvolvedor Apple (US$ 99/ano)."
              />
              <Box
                icon="🛠️"
                title="Opção 3: AltStore (sideload sem jailbreak)"
                desc="O AltStore (altstore.io) permite instalar .ipa no iPhone sem jailbreak. Requer um PC/Mac conectado via cabo para renovar a assinatura a cada 7 dias (conta gratuita) ou 1 ano (conta paga AltStore+)."
              />

              <H2>🖥️ Computador — 100% privado</H2>
              <P>A instalação via Chrome/Edge no PC (veja aba "App no PC") é totalmente privada por natureza — nunca vai para nenhuma loja, não aparece em lugar nenhum, só no seu computador. É a opção mais simples para uso pessoal no PC.</P>

              <H2>📋 Resumo: qual usar para uso privado?</H2>
              <div className="space-y-2">
                {[
                  { disp: "Computador (Windows/Mac/Linux)", rec: "Chrome → instalar como app", nota: "✅ Mais fácil, 100% privado" },
                  { disp: "Android", rec: "APK via sideload", nota: "✅ Privado, sem Play Store" },
                  { disp: "iPhone/iPad", rec: "PWA via Safari", nota: "✅ Simples, sem conta Apple" },
                ].map(({ disp, rec, nota }) => (
                  <div key={disp} className="bg-[#0d1309] border border-[#2d4a1e] rounded p-3">
                    <div className="text-[#7ec87a] font-semibold text-sm">{disp}</div>
                    <div className="text-[#8cba89] text-xs mt-0.5">→ {rec}</div>
                    <div className="text-[#5aab56] text-xs mt-0.5">{nota}</div>
                  </div>
                ))}
              </div>
            </div>
          ),

          "juntar": (
            <div>
              <Alert color="blue">
                🔗 <strong>A ideia é simples:</strong> você traz cada app para cá, identifica o que funciona bem em cada um, e a Jasmim une tudo num único projeto — sem reescrever o que já funciona.
              </Alert>

              <H2>📋 Passo a passo para juntar vários apps</H2>
              <ol className="mb-4">
                <Step n={1}>
                  <strong>Liste seus apps e o que cada um faz bem</strong><br/>
                  <span className="text-[#5aab56] text-xs">Ex: "App 1 → login funciona. App 2 → relatórios funcionam. App 3 → chat funciona."</span>
                </Step>
                <Step n={2}>
                  <strong>Importe todos para cá (um por vez)</strong><br/>
                  Use a aba "Trazer do Replit" — ZIP ou GitHub. Anote o nome das pastas.
                </Step>
                <Step n={3}>
                  <strong>Abra a Jasmim (ícone 🤖)</strong><br/>
                  Diga exatamente quais partes funcionam e quais não. Seja específico.
                </Step>
                <Step n={4}>
                  <strong>Diga para a Jasmim o que quer:</strong><br/>
                  <span className="text-[#5aab56] text-xs">"Tenho 3 projetos aqui. O login está em app1/, os relatórios em app2/ e o chat em app3/. Quero um único projeto que use o login do app1, os relatórios do app2 e o chat do app3. Não reescreva — aproveite o código que já funciona."</span>
                </Step>
                <Step n={5}>
                  <strong>A Jasmim vai unir os arquivos</strong><br/>
                  Ela vai analisar os três projetos e criar um novo com as partes funcionando juntas.
                </Step>
                <Step n={6}>
                  <strong>Teste no terminal</strong><br/>
                  Rode o projeto novo: <span className="font-mono text-[#a8d5a2] text-xs">npm install && npm start</span>
                </Step>
                <Step n={7}>
                  <strong>Para qualquer erro, chame a Jasmim:</strong><br/>
                  <span className="text-[#5aab56] text-xs">"Tem um erro no terminal, corrija sem reescrever o que já estava funcionando."</span>
                </Step>
              </ol>

              <H2>💬 Exemplos de como pedir para a Jasmim</H2>

              <H3>Juntar dois apps</H3>
              <Code copyKey="jasmim-juntar-2">"Tenho dois projetos: app-login/ (o login funciona bem) e app-dashboard/ (os gráficos funcionam bem). Una os dois num projeto só chamado meu-app/. Reutilize o código que já existe, não reescreva do zero."</Code>

              <H3>Juntar 3 ou mais</H3>
              <Code copyKey="jasmim-juntar-3">"Tenho 3 apps aqui. Do app1/ aproveite: o sistema de autenticação (arquivo auth.js). Do app2/ aproveite: as rotas de relatório (routes/reports.js). Do app3/ aproveite: o componente de chat (components/Chat.jsx). Crie um único projeto novo unindo essas partes."</Code>

              <H3>Quando só parte funciona</H3>
              <Code copyKey="jasmim-parte">"No app1/, o módulo de login funciona (auth/), mas o de pagamento não. No app2/, o pagamento funciona (payment/), mas o login não. Une o login do app1/ com o pagamento do app2/ num projeto novo."</Code>

              <H2>⚠️ Regra importante</H2>
              <Alert color="yellow">
                ✋ Sempre diga explicitamente para a Jasmim: <strong>"não reescreva o que já funciona, aproveite o código existente"</strong>. Sem isso, ela pode criar uma versão nova do zero. Com essa instrução, ela vai copiar e adaptar o que já está pronto.
              </Alert>
            </div>
          ),

          "orientar": (
            <div>
              <Alert color="green">
                🧭 <strong>Você tem 10+ apps e cada um funciona só em parte.</strong> Aqui está o roteiro completo para se organizar e sair disso.
              </Alert>

              <H2>📊 ETAPA 1 — Mapear o que você tem</H2>
              <P>Antes de qualquer coisa, faça uma lista rápida. Para cada app seu no Replit:</P>
              <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-lg p-4 mb-4">
                <p className="text-[#5aab56] text-xs font-semibold mb-2">MODELO DE MAPEAMENTO</p>
                <Code copyKey="mapeamento">{`App 1 — Nome: ___________
✅ O que funciona bem: ___________
❌ O que não funciona: ___________
🔗 Link no Replit: ___________

App 2 — Nome: ___________
✅ O que funciona bem: ___________
❌ O que não funciona: ___________
🔗 Link no Replit: ___________

(repita para cada app)`}</Code>
              </div>

              <H2>🎯 ETAPA 2 — Definir o app final que você quer</H2>
              <P>Responda: <strong className="text-[#7ec87a]">Qual seria o app perfeito se tudo funcionasse?</strong></P>
              <P>Liste as funcionalidades que você quer no produto final, independente de qual app elas estão hoje. Exemplo:</P>
              <Code copyKey="app-final">{`App Final "Meu Sistema":
- Login de usuário ✅ (já existe no App 1)
- Painel de controle ✅ (já existe no App 3)  
- Relatórios em PDF ✅ (já existe no App 5)
- Chat com IA ✅ (já existe no App 7)
- Cadastro de clientes ❌ (não existe em nenhum, precisa criar)
- Notificações ❌ (não existe em nenhum, precisa criar)`}</Code>

              <H2>📥 ETAPA 3 — Trazer os apps para cá</H2>
              <P>Importe os apps que têm as partes que funcionam (veja a aba "Trazer do Replit"). Você não precisa trazer todos — só os que têm algo útil.</P>

              <H2>🤖 ETAPA 4 — Pedir para a Jasmim montar</H2>
              <P>Cole o mapeamento que você fez na Jasmim e use este prompt:</P>
              <Code copyKey="prompt-organizar">"Vou te passar um mapeamento dos meus apps. Quero que você:
1. Identifique as partes que já funcionam em cada um
2. Crie um único projeto novo aproveitando essas partes
3. Não reescreva o que já está pronto
4. Me diga o que ainda precisa ser criado do zero

Aqui está o mapeamento:
[COLE SEU MAPEAMENTO AQUI]

O app final deve ter: [LISTE AS FUNCIONALIDADES QUE VOCÊ QUER]"</Code>

              <H2>📱 ETAPA 5 — Transformar em app no celular/PC</H2>
              <ol className="mb-4">
                <Step n={1}>Com o projeto único funcionando, publique no Replit (botão Deploy)</Step>
                <Step n={2}>Copie a URL gerada (.replit.app)</Step>
                <Step n={3}>Escolha o método de instalação (PWA, APK ou PC — veja seção "Instalar como App")</Step>
                <Step n={4}>✅ Um app completo, funcionando, privado e no seu dispositivo</Step>
              </ol>

              <H2>🔁 E para os próximos apps?</H2>
              <P>Repita o mesmo processo para qualquer projeto futuro:</P>
              <div className="flex flex-col gap-2">
                {[
                  ["1️⃣", "Cria/importa o projeto aqui"],
                  ["2️⃣", "Desenvolve com a Jasmim até funcionar"],
                  ["3️⃣", "Publica no Replit (Deploy)"],
                  ["4️⃣", "Instala no celular como PWA ou APK"],
                  ["5️⃣", "Usa com privacidade, sem depender do Replit para abrir"],
                ].map(([n, t]) => (
                  <div key={n as string} className="flex items-center gap-3 bg-[#0d1309] border border-[#2d4a1e] rounded p-3">
                    <span className="text-xl shrink-0">{n}</span>
                    <span className="text-[#8cba89] text-sm">{t as string}</span>
                  </div>
                ))}
              </div>

              <Alert color="blue">
                💡 <strong>Dica chave:</strong> quando o app estiver instalado (como PWA ou APK), ele <strong>não depende do Replit para abrir</strong> — ele vai direto para o servidor onde está publicado. O Replit é só onde você cria e edita. O app publicado fica independente.
              </Alert>
            </div>
          ),
        };

        return (
          <div>
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1 flex-wrap">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMergeTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    mergeTab === tab.id
                      ? "bg-[#2d4a1e] text-[#7ec87a] border border-[#5aab56]"
                      : "bg-[#141c0d] text-[#5a7a56] border border-[#2d4a1e] hover:text-[#7ec87a]"
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
            {tabContent[mergeTab]}
          </div>
        );
      })(),
    },
  ];

  const activeSection = sections.find((s) => s.id === active) || sections[0];

  return (
    <div className="flex h-full bg-[#141c0d] text-white overflow-hidden">
      {/* Sidebar de navegação */}
      <div className="w-36 shrink-0 border-r border-[#2d4a1e] flex flex-col py-2 overflow-y-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`flex flex-col items-center gap-1 py-2.5 px-1 text-xs transition-colors ${
              active === s.id
                ? "bg-[#1c2714] text-[#7ec87a] border-r-2 border-[#5aab56]"
                : "text-[#5a7a56] hover:text-[#7ec87a] hover:bg-[#1a2412]"
            }`}
          >
            <span className="text-lg">{s.icon}</span>
            <span className="text-center leading-tight">{s.title}</span>
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#2d4a1e]">
            <span className="text-2xl">{activeSection.icon}</span>
            <h1 className="text-[#7ec87a] font-bold text-lg">{activeSection.title}</h1>
          </div>
          {activeSection.content}
        </div>
      </div>
    </div>
  );
}
