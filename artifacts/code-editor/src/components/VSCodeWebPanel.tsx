import { useState, useCallback } from "react";
import { X, Monitor, UploadCloud, ExternalLink, Loader2, AlertCircle, RefreshCw, Github, Zap, Code } from "lucide-react";
import { VirtualFileSystem } from "@/lib/virtual-fs";
import {
  loadGitHubCredentials,
  createRepo,
  pushAllFiles,
  makeRepoPublic,
} from "@/lib/github-service";

interface Props {
  open: boolean;
  onClose: () => void;
  vfs: VirtualFileSystem;
  projectName: string;
}

type Step = "idle" | "pushing" | "done" | "error";

const EDITORS = [
  {
    id: "github",
    label: "GitHub.dev",
    desc: "Editor leve, funciona bem no celular e PC",
    icon: Github,
    color: "#58a6ff",
    buildUrl: (owner: string, repo: string) => `https://github.dev/${owner}/${repo}`,
    emptyUrl: "https://github.dev",
  },
  {
    id: "codespaces",
    label: "GitHub Codespaces",
    desc: "Máquina virtual completa — terminal real, extensões, IA",
    icon: Code,
    color: "#3fb950",
    buildUrl: (owner: string, repo: string) => `https://codespaces.new/${owner}/${repo}`,
    emptyUrl: "https://codespaces.new",
  },
  {
    id: "stackblitz",
    label: "StackBlitz",
    desc: "Node.js no navegador com terminal real",
    icon: Zap,
    color: "#1389fd",
    buildUrl: (owner: string, repo: string) => `https://stackblitz.com/github/${owner}/${repo}`,
    emptyUrl: "https://stackblitz.com",
  },
  {
    id: "vscode",
    label: "VS Code Web",
    desc: "vscode.dev — pode ter limitações no celular",
    icon: Monitor,
    color: "#007acc",
    buildUrl: (owner: string, repo: string) => `https://vscode.dev/github/${owner}/${repo}`,
    emptyUrl: "https://vscode.dev",
  },
];

export default function VSCodeWebPanel({ open, onClose, vfs, projectName }: Props) {
  const creds = loadGitHubCredentials();
  const hasToken = !!creds.token;

  const [selectedEditor, setSelectedEditor] = useState("github");
  const [repoName, setRepoName] = useState(
    projectName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "meu-projeto"
  );
  const [step, setStep] = useState<Step>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [openedUrl, setOpenedUrl] = useState("");
  const [error, setError] = useState("");

  const editor = EDITORS.find(e => e.id === selectedEditor) || EDITORS[0];
  const addLog = (msg: string) => setLogs(l => [...l, msg]);

  const handlePushAndOpen = useCallback(async () => {
    const repo = repoName.trim() || "meu-projeto";
    setStep("pushing");
    setLogs(["🚀 Iniciando envio para o GitHub…"]);
    setError("");
    setOpenedUrl("");

    try {
      const owner = creds.username;
      addLog(`👤 Conta: ${owner}`);

      addLog(`📁 Criando repositório "${repo}"…`);
      try {
        await createRepo(creds, repo, `${projectName} — SK Code Editor`, false);
        addLog("✅ Repositório criado.");
      } catch (e: any) {
        if (e.message?.includes("422") || e.message?.includes("already exists") || e.message?.includes("name already exists")) {
          addLog("ℹ️ Repositório já existe — usando existente.");
        } else throw e;
      }

      await makeRepoPublic(creds, owner, repo);

      const files = vfs.toJSON();
      const count = Object.keys(files).length;
      addLog(`📤 Enviando ${count} arquivo(s)…`);
      await pushAllFiles(creds, owner, repo, files, `${projectName} — SK Code Editor`);
      addLog("✅ Projeto enviado!");

      const url = editor.buildUrl(owner, repo);
      addLog(`💻 Abrindo: ${url}`);
      setOpenedUrl(url);
      setStep("done");
      window.open(url, "_blank");
    } catch (e: any) {
      setError(e.message || String(e));
      setStep("error");
    }
  }, [creds, repoName, vfs, projectName, editor]);

  if (!open) return null;

  const EditorIcon = editor.icon;

  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/70" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
        <div className="bg-[#0d1117] border-t border-[#30363d] rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
          {/* Drag handle */}
          <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-[#30363d] rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#21262d] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#58a6ff22] flex items-center justify-center">
                <Code size={16} className="text-[#58a6ff]" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-white">Editar no Navegador</p>
                <p className="text-[11px] text-gray-500">{projectName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500">
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-4 space-y-4">

              {/* Dica mobile */}
              <div className="px-3 py-3 bg-yellow-500/8 border border-yellow-500/20 rounded-xl space-y-1">
                <p className="text-[12px] font-bold text-yellow-300">💡 Dica para celular</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  O vscode.dev mudou recentemente e pode não funcionar bem no celular.
                  Recomendamos o <span className="text-[#58a6ff] font-bold">GitHub.dev</span> ou o <span className="text-[#1389fd] font-bold">StackBlitz</span>.
                </p>
              </div>

              {/* Escolha de editor */}
              <div className="space-y-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Escolha o Editor</p>
                {EDITORS.map(ed => {
                  const Icon = ed.icon;
                  const sel = selectedEditor === ed.id;
                  return (
                    <button
                      key={ed.id}
                      onClick={() => setSelectedEditor(ed.id)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors text-left"
                      style={{
                        backgroundColor: sel ? ed.color + "22" : "#161b22",
                        borderColor: sel ? ed.color + "88" : "#30363d",
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: ed.color + "22" }}>
                        <Icon size={15} style={{ color: ed.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold" style={{ color: sel ? ed.color : "white" }}>{ed.label}</p>
                        <p className="text-[10px] text-gray-500">{ed.desc}</p>
                      </div>
                      {sel && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ed.color }} />}
                    </button>
                  );
                })}
              </div>

              {!hasToken ? (
                <div className="space-y-3">
                  <div className="px-3 py-3 bg-yellow-500/8 border border-yellow-500/20 rounded-xl">
                    <p className="text-[12px] font-bold text-yellow-300 mb-1">⚠️ GitHub não configurado</p>
                    <p className="text-[11px] text-gray-400">Conecte o GitHub em Menu → GitHub para abrir com o projeto completo.</p>
                  </div>
                  <a
                    href={editor.emptyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-4 py-3.5 border rounded-xl hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: editor.color + "22", borderColor: editor.color + "44" }}
                  >
                    <EditorIcon size={16} style={{ color: editor.color }} />
                    <span className="text-[14px] font-bold" style={{ color: editor.color }}>Abrir {editor.label} (sem projeto)</span>
                  </a>
                </div>
              ) : step === "idle" ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Nome do Repositório</label>
                    <input
                      value={repoName}
                      onChange={e => setRepoName(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                      className="w-full px-3 py-2.5 bg-[#161b22] border border-gray-700/50 rounded-xl text-sm text-gray-300 outline-none focus:border-blue-500/50"
                    />
                    <p className="text-[10px] text-gray-600">github.com/{creds.username}/{repoName}</p>
                  </div>

                  <div className="px-3 py-3 bg-[#161b22] border border-[#30363d] rounded-xl space-y-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">O que vai acontecer:</p>
                    {[
                      "Cria ou usa o repositório GitHub",
                      `Envia todos os ${Object.keys(vfs.toJSON()).length} arquivo(s)`,
                      `Abre o ${editor.label} com tudo dentro`,
                    ].map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: editor.color + "22", color: editor.color }}>{i + 1}</span>
                        <span className="text-[12px] text-gray-400">{t}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handlePushAndOpen}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 text-white rounded-xl font-bold text-[15px] transition-opacity hover:opacity-90"
                    style={{ backgroundColor: editor.color }}
                  >
                    <UploadCloud size={17} />
                    Enviar e Abrir no {editor.label}
                  </button>

                  <a
                    href={editor.emptyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-[11px] text-gray-600 hover:text-gray-400 transition-colors py-1"
                  >
                    Abrir {editor.label} sem enviar →
                  </a>
                </div>
              ) : step === "pushing" ? (
                <div className="space-y-3">
                  <div className="bg-black/60 border border-gray-700/40 rounded-xl p-3 max-h-52 overflow-y-auto font-mono">
                    {logs.map((l, i) => <p key={i} className="text-[11px] leading-relaxed" style={{ color: editor.color }}>{l}</p>)}
                    <div className="flex items-center gap-2 mt-1">
                      <Loader2 size={11} className="animate-spin" style={{ color: editor.color }} />
                      <span className="text-[11px]" style={{ color: editor.color + "88" }}>Enviando…</span>
                    </div>
                  </div>
                </div>
              ) : step === "done" ? (
                <div className="space-y-3">
                  <div className="px-3 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <p className="text-[12px] font-bold text-green-400 mb-1">✅ Projeto enviado e aberto!</p>
                    <p className="text-[11px] text-gray-400">O {editor.label} foi aberto. Se não abriu, clique abaixo.</p>
                  </div>
                  <div className="bg-black/60 border border-gray-700/40 rounded-xl p-3 max-h-32 overflow-y-auto font-mono">
                    {logs.map((l, i) => <p key={i} className="text-[11px] text-green-400 leading-relaxed">{l}</p>)}
                  </div>
                  {openedUrl && (
                    <a
                      href={openedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-3 px-4 py-3 border rounded-xl transition-opacity hover:opacity-80"
                      style={{ backgroundColor: editor.color + "22", borderColor: editor.color + "44" }}
                    >
                      <EditorIcon size={16} style={{ color: editor.color, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold" style={{ color: editor.color }}>Abrir {editor.label}</p>
                        <p className="text-[10px] text-gray-500 truncate">{openedUrl}</p>
                      </div>
                      <ExternalLink size={13} className="text-gray-600 shrink-0" />
                    </a>
                  )}
                  <button onClick={() => { setStep("idle"); setLogs([]); }} className="w-full text-center text-[11px] text-gray-600 hover:text-gray-400 py-1">
                    <RefreshCw size={11} className="inline mr-1" />Usar outro repositório
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                    <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[12px] text-red-400 leading-relaxed">{error}</p>
                  </div>
                  <a
                    href={editor.emptyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 border rounded-xl text-[13px] font-bold transition-opacity hover:opacity-80"
                    style={{ backgroundColor: editor.color + "22", borderColor: editor.color + "44", color: editor.color }}
                  >
                    <ExternalLink size={14} />Abrir {editor.label} assim mesmo
                  </a>
                  <button onClick={() => setStep("idle")} className="w-full text-center text-[11px] text-gray-600 hover:text-gray-400 py-1">
                    Tentar novamente
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
