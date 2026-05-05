import JSZip from "jszip";

const GH_API = "https://api.github.com";

const BINARY_EXTS = new Set([
  "png","jpg","jpeg","gif","webp","ico","bmp",
  "pdf","zip","tar","gz","7z","rar","xz","bz2",
  "mp3","mp4","wav","mov","avi","mkv","flac",
  "ttf","otf","woff","woff2","eot","exe","dll",
  "so","dylib","class","jar","apk","ipa","aab",
  "pyc","wasm","bin","dat","db","sqlite",
]);

function isBinary(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return BINARY_EXTS.has(ext);
}

function mimeForExt(ext: string): string {
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    ico: "image/x-icon", pdf: "application/pdf",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf",
  };
  return map[ext] || "application/octet-stream";
}

async function ghFetch(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${GH_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  return res;
}

export interface GHUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface GHRepo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  updated_at: string;
  default_branch: string;
  owner: { login: string };
  html_url: string;
}

export interface ClonedFile {
  path: string;
  content: string;
}

export async function getUser(token: string): Promise<GHUser> {
  const res = await ghFetch("/user", token);
  if (!res.ok) throw new Error(`Token inválido (${res.status})`);
  return res.json();
}

export async function listRepos(token: string): Promise<GHRepo[]> {
  const all: GHRepo[] = [];
  let page = 1;
  while (true) {
    const res = await ghFetch(
      `/user/repos?affiliation=owner&sort=updated&per_page=100&page=${page}`,
      token
    );
    if (!res.ok) break;
    const data: GHRepo[] = await res.json();
    if (!data.length) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return all;
}

export async function cloneRepo(
  token: string,
  owner: string,
  repo: string,
  branch?: string,
  onProgress?: (current: number, total: number, phase: string) => void
): Promise<{ files: ClonedFile[]; fetched: number; skipped: number }> {
  onProgress?.(0, 100, "Conectando ao repositório...");

  const repoRes = await ghFetch(`/repos/${owner}/${repo}`, token);
  if (!repoRes.ok) throw new Error(`Repositório não encontrado (${repoRes.status})`);
  const repoData: GHRepo = await repoRes.json();
  const defaultBranch = branch || repoData.default_branch || "main";

  // Download ZIP usando fetch + arrayBuffer — funciona em todas as plataformas
  // ArrayBuffer não é limitado pelo truncamento de 16 MB do Hermes (que afeta só strings)
  onProgress?.(5, 100, `Baixando ${owner}/${repo}...`);

  const zipApiUrl = `${GH_API}/repos/${owner}/${repo}/zipball/${defaultBranch}`;
  const authHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let zipData: ArrayBuffer;
  try {
    const zipRes = await fetch(zipApiUrl, { headers: authHeaders });
    if (!zipRes.ok) {
      throw new Error(`Falha ao baixar repositório (${zipRes.status}). Verifique o token e tente novamente.`);
    }
    onProgress?.(20, 100, "Recebendo dados...");
    zipData = await zipRes.arrayBuffer();
  } catch (e: any) {
    if (e?.message?.includes("status")) throw e;
    throw new Error(`Erro de rede ao baixar repositório: ${e?.message || String(e)}`);
  }

  onProgress?.(40, 100, "Descompactando arquivos...");
  const zip = await JSZip.loadAsync(zipData);

  const allEntries: Array<[string, any]> = Object.entries(zip.files);
  const fileEntries = allEntries.filter(([, e]) => !e.dir);

  const validEntries: Array<{ relativePath: string; entry: any }> = [];
  for (const [fullPath, entry] of fileEntries) {
    const parts = (fullPath as string).split("/");
    const relativePath = parts.slice(1).join("/");
    if (!relativePath || relativePath.endsWith(".gitkeep")) continue;
    if (relativePath.includes("__MACOSX") || relativePath.includes(".DS_Store")) continue;
    validEntries.push({ relativePath, entry });
  }

  const BATCH = 200;
  const files: ClonedFile[] = [];
  let skipped = 0;
  let processed = 0;

  for (let i = 0; i < validEntries.length; i += BATCH) {
    const batch = validEntries.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async ({ relativePath, entry }) => {
        try {
          if (isBinary(relativePath)) {
            const ext = relativePath.split(".").pop()?.toLowerCase() || "bin";
            const b64: string = await entry.async("base64");
            return { path: relativePath, content: `data:${mimeForExt(ext)};base64,${b64}` } as ClonedFile;
          } else {
            const content: string = await entry.async("text");
            if (content.includes("\x00")) return null;
            return { path: relativePath, content } as ClonedFile;
          }
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (r) files.push(r);
      else skipped++;
    }
    processed += batch.length;
    const pct = 40 + Math.floor((processed / validEntries.length) * 60);
    onProgress?.(pct, 100, `Extraindo ${processed.toLocaleString()} / ${validEntries.length.toLocaleString()} arquivos...`);
  }

  return { files, fetched: files.length, skipped };
}

export async function clonePublicUrl(
  url: string,
  token?: string,
  onProgress?: (current: number, total: number, phase: string) => void
): Promise<{ files: ClonedFile[]; fetched: number; skipped: number; repoName: string }> {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
  if (!match) throw new Error("URL inválida. Use: https://github.com/usuario/repositorio");
  const [, owner, repo] = match;
  const result = await cloneRepo(token || "", owner, repo, undefined, onProgress);
  return { ...result, repoName: `${owner}/${repo}` };
}

export async function createRepo(
  token: string,
  name: string,
  description: string,
  isPrivate: boolean
): Promise<GHRepo> {
  const res = await ghFetch("/user/repos", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.message || `Falha ao criar repositório (${res.status})`);
  }
  return res.json();
}

async function getDefaultBranch(token: string, owner: string, repo: string): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}`, token);
  if (!res.ok) throw new Error(`Repositório "${owner}/${repo}" não encontrado.`);
  const data: GHRepo = await res.json();
  return data.default_branch || "main";
}

async function getLatestCommitSha(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, token);
  if (!res.ok) throw new Error(`Branch "${branch}" não encontrada.`);
  const data = await res.json();
  return data.object.sha;
}

export async function pushFiles(
  token: string,
  owner: string,
  repo: string,
  files: Array<{ path: string; content: string }>,
  message: string,
  branch?: string,
  onProgress?: (cur: number, total: number, phase: string) => void
): Promise<{ pushed: number; total: number; repoUrl: string }> {
  const actualBranch = branch || (await getDefaultBranch(token, owner, repo));
  const latestSha = await getLatestCommitSha(token, owner, repo, actualBranch);

  const validFiles = files.filter(
    (f) => f.path && !f.path.endsWith(".gitkeep")
  );
  const total = validFiles.length;

  const CHUNK = 10;
  const treeNodes: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  let done = 0;

  for (let i = 0; i < validFiles.length; i += CHUNK) {
    const chunk = validFiles.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map(async (f) => {
        const isB64 = f.content.startsWith("data:");
        const blobContent = isB64 ? f.content.split(",")[1] || "" : f.content;
        const encoding = isB64 ? "base64" : "utf-8";
        const res = await ghFetch(`/repos/${owner}/${repo}/git/blobs`, token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: blobContent, encoding }),
        });
        if (!res.ok) throw new Error(`Falha ao criar blob: ${f.path}`);
        const data = await res.json();
        return { path: f.path.replace(/^\//, ""), mode: "100644", type: "blob", sha: data.sha };
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") treeNodes.push(r.value as any);
    }
    done += chunk.length;
    onProgress?.(done, total, `Enviando arquivos ${done}/${total}...`);
  }

  onProgress?.(total, total, "Criando commit...");

  const treeRes = await ghFetch(`/repos/${owner}/${repo}/git/trees`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: latestSha, tree: treeNodes }),
  });
  if (!treeRes.ok) throw new Error("Falha ao criar árvore de arquivos");
  const treeData = await treeRes.json();

  const commitRes = await ghFetch(`/repos/${owner}/${repo}/git/commits`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      tree: treeData.sha,
      parents: [latestSha],
    }),
  });
  if (!commitRes.ok) throw new Error("Falha ao criar commit");
  const commitData = await commitRes.json();

  const refRes = await ghFetch(
    `/repos/${owner}/${repo}/git/refs/heads/${actualBranch}`,
    token,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commitData.sha }),
    }
  );
  if (!refRes.ok) throw new Error("Falha ao atualizar referência do branch");

  return {
    pushed: treeNodes.length,
    total: files.length,
    repoUrl: `https://github.com/${owner}/${repo}`,
  };
}

export interface PagesInfo {
  url: string;
  status: string;
  source: { branch: string; path: string };
}

export async function enablePages(
  token: string,
  owner: string,
  repo: string,
  branch = "main",
  path: "/" | "/docs" = "/"
): Promise<PagesInfo> {
  const body = JSON.stringify({ source: { branch, path } });
  let res = await ghFetch(`/repos/${owner}/${repo}/pages`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (res.status === 409 || res.status === 422) {
    res = await ghFetch(`/repos/${owner}/${repo}/pages`, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
    });
  }
  if (!res.ok && res.status !== 201) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.message || `Falha ao ativar GitHub Pages (${res.status})`);
  }
  const data = await res.json().catch(() => ({}));
  const pagesUrl: string = (data as any)?.html_url || `https://${owner}.github.io/${repo}/`;
  return {
    url: pagesUrl,
    status: (data as any)?.status || "building",
    source: { branch, path },
  };
}

export async function getPagesStatus(
  token: string,
  owner: string,
  repo: string
): Promise<PagesInfo | null> {
  const res = await ghFetch(`/repos/${owner}/${repo}/pages`, token);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  return {
    url: data.html_url || `https://${owner}.github.io/${repo}/`,
    status: data.status || "unknown",
    source: data.source || { branch: "main", path: "/" },
  };
}

export async function makeRepoPublic(
  token: string,
  owner: string,
  repo: string
): Promise<void> {
  const res = await ghFetch(`/repos/${owner}/${repo}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ private: false }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.message || `Não foi possível tornar o repositório público (${res.status})`);
  }
}
