import JSZip from "jszip";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

const GH_API = "https://api.github.com";

const BINARY_EXTS = new Set([
  "png","jpg","jpeg","gif","webp","ico","bmp","svg",
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
  const mimeForExt = (ext: string) =>
    ext === "png" ? "image/png" :
    ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
    ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" :
    ext === "svg" ? "image/svg+xml" : ext === "ico" ? "image/x-icon" :
    ext === "pdf" ? "application/pdf" : ext === "woff" ? "font/woff" :
    ext === "woff2" ? "font/woff2" : ext === "ttf" ? "font/ttf" :
    "application/octet-stream";

  // Passo 1: obter branch padrão
  onProgress?.(0, 100, "Conectando ao repositório...");
  const repoRes = await ghFetch(`/repos/${owner}/${repo}`, token);
  if (!repoRes.ok) throw new Error(`Repositório não encontrado (${repoRes.status})`);
  const repoData: GHRepo = await repoRes.json();
  const defaultBranch = branch || repoData.default_branch || "main";

  // Passo 2: baixar o repo INTEIRO como ZIP — 1 requisição, sem limite de arquivos
  // Suporta 38.000+ arquivos sem rate limiting (sem chamadas individuais por blob)
  onProgress?.(5, 100, `Baixando ${owner}/${repo} como ZIP...`);

  const zipApiUrl = `${GH_API}/repos/${owner}/${repo}/zipball/${defaultBranch}`;
  const authHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let zip: any;

  if (Platform.OS !== "web" && FileSystem.cacheDirectory) {
    // No APK: download para disco, depois lê como Blob via XHR.
    // NÃO usamos readAsStringAsync(base64) — o Hermes trunca strings
    // maiores que ~16 MB, então ZIPs grandes chegam corrompidos/incompletos.
    // XHR com responseType="blob" lê o arquivo binário completo sem limite.
    const tmpUri = `${FileSystem.cacheDirectory}devmobile_clone_${Date.now()}.zip`;
    const dlResult = await FileSystem.downloadAsync(zipApiUrl, tmpUri, {
      headers: authHeaders,
    });
    if (dlResult.status !== 200) {
      await FileSystem.deleteAsync(tmpUri, { idempotent: true }).catch(() => {});
      throw new Error(`Falha ao baixar repositório ZIP (${dlResult.status})`);
    }
    onProgress?.(30, 100, "Lendo ZIP do disco...");
    const blob: Blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", tmpUri, true);
      xhr.responseType = "blob";
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 0) resolve(xhr.response as Blob);
        else reject(new Error(`XHR status ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("XHR error ao ler ZIP do disco"));
      xhr.send();
    });
    await FileSystem.deleteAsync(tmpUri, { idempotent: true }).catch(() => {});
    onProgress?.(38, 100, "Descompactando arquivos...");
    zip = await JSZip.loadAsync(blob);
  } else {
    // Na web (PWA/browser): GitHub zipball redireciona para CDN que bloqueia CORS.
    // Usamos a GitHub Trees API que tem CORS correto para browsers.
    onProgress?.(10, 100, "Buscando lista de arquivos...");

    async function fetchTree(treeSha: string): Promise<Array<{ path: string; type: string; size: number; url: string }>> {
      const r = await ghFetch(`/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, token);
      if (!r.ok) throw new Error(`Erro ao buscar árvore (${r.status})`);
      const d = await r.json();
      return d.tree || [];
    }

    const commitRes = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`, token);
    if (!commitRes.ok) throw new Error(`Branch ${defaultBranch} não encontrada`);
    const commitData = await commitRes.json();
    const treeSha: string = commitData.object.sha;

    onProgress?.(15, 100, "Baixando estrutura do repositório...");
    const treeItems = await fetchTree(treeSha);
    const fileItems = treeItems.filter((i) => i.type === "blob" && i.size < 2_000_000);
    const total = fileItems.length;

    // Baixa arquivos em lotes paralelos
    const BATCH = 20;
    const files: ClonedFile[] = [];
    let skipped = 0;
    let processed = 0;

    for (let i = 0; i < fileItems.length; i += BATCH) {
      const batch = fileItems.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          try {
            const ext = item.path.split(".").pop()?.toLowerCase() || "";
            const r = await ghFetch(`/repos/${owner}/${repo}/contents/${item.path}?ref=${defaultBranch}`, token);
            if (!r.ok) return null;
            const d = await r.json();
            if (!d.content) return null;
            const raw = d.content.replace(/\n/g, "");
            if (isBinary(item.path)) {
              const mime =
                ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
                ext === "svg" ? "image/svg+xml" : ext === "gif" ? "image/gif" :
                ext === "webp" ? "image/webp" : "application/octet-stream";
              return { path: item.path, content: `data:${mime};base64,${raw}` } as ClonedFile;
            } else {
              const text = atob(raw);
              if (text.includes("\x00")) return null;
              return { path: item.path, content: text } as ClonedFile;
            }
          } catch {
            return null;
          }
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) files.push(r.value);
        else skipped++;
      }
      processed += batch.length;
      const pct = 15 + Math.floor((processed / total) * 85);
      onProgress?.(pct, 100, `Baixando ${processed.toLocaleString()} / ${total.toLocaleString()} arquivos...`);
    }

    return { files, fetched: files.length, skipped };
  }

  const allEntries: Array<[string, any]> = Object.entries(zip.files);
  const fileEntries = allEntries.filter(([, e]) => !e.dir);
  const total = fileEntries.length;

  // Filtra e resolve caminhos antes de extrair
  const validEntries: Array<{ relativePath: string; entry: any }> = [];
  for (const [fullPath, entry] of fileEntries) {
    const parts = (fullPath as string).split("/");
    const relativePath = parts.slice(1).join("/");
    if (!relativePath || relativePath.endsWith(".gitkeep")) continue;
    if (relativePath.includes("__MACOSX") || relativePath.includes(".DS_Store")) continue;
    validEntries.push({ relativePath, entry });
  }

  // Extração paralela em lotes — processa 200 arquivos ao mesmo tempo
  // (muito mais rápido que serial — 40.000 arquivos em segundos)
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

async function createBlob(
  token: string,
  owner: string,
  repo: string,
  content: string
): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/blobs`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, encoding: "utf-8" }),
  });
  if (!res.ok) throw new Error("Falha ao criar blob");
  const data = await res.json();
  return data.sha;
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

  // Criar blobs em lotes de 10 para evitar rate limit
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
    onProgress?.(done, total, `Enviando blobs ${done}/${total}...`);
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
  // Primeiro tenta PATCH (já existe), depois POST (não existe)
  const body = JSON.stringify({ source: { branch, path } });
  let res = await ghFetch(`/repos/${owner}/${repo}/pages`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (res.status === 409 || res.status === 422) {
    // Já existe — atualiza
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

// ── Repo tree (list all files recursively) ────────────────────────────────
export async function getRepoTree(
  token: string,
  owner: string,
  repo: string,
  branch = "HEAD"
): Promise<Array<{ path: string; type: string; size?: number }>> {
  const res = await ghFetch(
    `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.message || `Não foi possível listar arquivos (${res.status})`);
  }
  const data = await res.json();
  // data.tree contains all blobs and trees
  return (data.tree || []).filter((item: any) => item.type === "blob");
}

// ── Get single file content (text) ───────────────────────────────────────
export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/contents/${path}`, token);
  if (!res.ok) {
    throw new Error(`Arquivo não encontrado: ${path} (${res.status})`);
  }
  const data = await res.json();
  if (data.encoding === "base64" && data.content) {
    return atob(data.content.replace(/\n/g, ""));
  }
  return data.content || "";
}
