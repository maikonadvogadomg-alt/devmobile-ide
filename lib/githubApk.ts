import JSZip from "jszip";
import { Platform } from "react-native";
import type { ProjectFile } from "./archiveApk";

const GH = "https://api.github.com";

function hdrs(token: string): Record<string, string> {
  const base: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) base["Authorization"] = `token ${token}`;
  return base;
}

export interface GhUser {
  login: string;
  name: string;
  avatar_url: string;
}
export interface GhRepo {
  full_name: string;
  name: string;
  description: string;
  default_branch: string;
  private: boolean;
  html_url: string;
  language?: string;
  stargazers_count?: number;
  size?: number;
}

export async function ghGetUser(token: string): Promise<GhUser> {
  const r = await fetch(`${GH}/user`, { headers: hdrs(token) });
  if (!r.ok) throw new Error(`Token inválido: ${r.status}`);
  return r.json();
}

export async function ghListRepos(token: string): Promise<GhRepo[]> {
  const r = await fetch(`${GH}/user/repos?per_page=100&sort=updated`, {
    headers: hdrs(token),
  });
  if (!r.ok) throw new Error(`Erro ao listar repos: ${r.status}`);
  return r.json();
}

async function fetchRepoInfo(
  owner: string,
  repo: string,
  token: string
): Promise<GhRepo> {
  const r = await fetch(`${GH}/repos/${owner}/${repo}`, {
    headers: hdrs(token),
  });
  if (!r.ok) throw new Error(`Repo não encontrado: ${r.status}`);
  return r.json();
}

async function _extractZip(
  zipRes: Response,
  onProgress: (m: string) => void
): Promise<ProjectFile[]> {
  onProgress("Lendo ZIP...");
  const buf = await zipRes.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const entries = Object.entries(zip.files);
  const allFiles = entries.filter(([, v]) => !v.dir).map(([k]) => k);
  const tops = [...new Set(allFiles.map((k) => k.split("/")[0]))];
  const prefix = tops.length === 1 ? tops[0] + "/" : "";

  const files: ProjectFile[] = [];
  let processed = 0;
  for (const [path, entry] of entries) {
    if (entry.dir) continue;
    const rel = prefix ? path.slice(prefix.length) : path;
    if (!rel) continue;
    try {
      const b64 = await entry.async("base64");
      files.push({ path: rel, data: b64 });
    } catch {}
    processed++;
    if (processed % 500 === 0) onProgress(`Extraindo... ${files.length} arquivos`);
  }

  if (files.length === 0) throw new Error("ZIP não contém arquivos.");
  onProgress(`✅ ${files.length} arquivos importados`);
  return files;
}

export async function ghImportRepo(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  onProgress: (msg: string) => void
): Promise<ProjectFile[]> {
  onProgress("Verificando repositório...");
  let defaultBranch = branch;
  try {
    const info = await fetchRepoInfo(owner, repo, token);
    defaultBranch = branch || info.default_branch || "main";
  } catch {}

  onProgress(`Baixando ${owner}/${repo}...`);
  let r = await fetch(`${GH}/repos/${owner}/${repo}/zipball/${defaultBranch}`, {
    headers: hdrs(token),
  });
  if (!r.ok && defaultBranch === "main") {
    r = await fetch(`${GH}/repos/${owner}/${repo}/zipball/master`, {
      headers: hdrs(token),
    });
  }
  if (!r.ok) throw new Error(`Erro ao baixar repositório: ${r.status}`);
  return _extractZip(r, onProgress);
}

export async function ghCreateRepo(
  token: string,
  name: string,
  desc: string,
  isPrivate: boolean
): Promise<{ html_url: string; full_name: string }> {
  const r = await fetch(`${GH}/user/repos`, {
    method: "POST",
    headers: { ...hdrs(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      description: desc,
      private: isPrivate,
      auto_init: true,
    }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(
      (e as Record<string, string>).message || `Erro ao criar: ${r.status}`
    );
  }
  return r.json();
}

export async function ghPushFiles(
  token: string,
  owner: string,
  repo: string,
  files: ProjectFile[],
  message: string,
  onProgress: (msg: string) => void
): Promise<void> {
  const refRes = await fetch(
    `${GH}/repos/${owner}/${repo}/git/refs/heads/main`,
    { headers: hdrs(token) }
  );
  const baseSha = refRes.ok
    ? (await refRes.json()).object?.sha
    : undefined;

  const blobs: { path: string; sha: string }[] = [];
  let done = 0;
  for (const f of files) {
    try {
      const r = await fetch(`${GH}/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        headers: { ...hdrs(token), "Content-Type": "application/json" },
        body: JSON.stringify({ content: f.data, encoding: "base64" }),
      });
      if (r.ok) blobs.push({ path: f.path, sha: (await r.json()).sha });
    } catch {}
    done++;
    if (done % 10 === 0) onProgress(`Enviando ${done}/${files.length}...`);
  }

  const treeRes = await fetch(`${GH}/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { ...hdrs(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      base_tree: baseSha,
      tree: blobs.map((b) => ({
        path: b.path,
        mode: "100644",
        type: "blob",
        sha: b.sha,
      })),
    }),
  });
  if (!treeRes.ok) throw new Error(`Tree: ${treeRes.status}`);
  const treeData = await treeRes.json();

  const commitRes = await fetch(
    `${GH}/repos/${owner}/${repo}/git/commits`,
    {
      method: "POST",
      headers: { ...hdrs(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        tree: treeData.sha,
        ...(baseSha ? { parents: [baseSha] } : {}),
      }),
    }
  );
  if (!commitRes.ok) throw new Error(`Commit: ${commitRes.status}`);
  const commit = await commitRes.json();

  const patchRes = await fetch(
    `${GH}/repos/${owner}/${repo}/git/refs/heads/main`,
    {
      method: "PATCH",
      headers: { ...hdrs(token), "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: true }),
    }
  );
  if (!patchRes.ok) {
    await fetch(`${GH}/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: { ...hdrs(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "refs/heads/main", sha: commit.sha }),
    });
  }
  onProgress("✅ Push concluído!");
}
