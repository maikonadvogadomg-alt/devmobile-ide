import * as DocumentPicker from "expo-document-picker";
import { Paths, File as FSFile } from "expo-file-system/next";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
import pako from "pako";
import { Platform } from "react-native";

import type { Project, ProjectFile } from "@/context/AppContext";

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    kt: "kotlin", swift: "swift", cs: "csharp", cpp: "cpp", c: "c",
    html: "html", css: "css", scss: "scss", json: "json", yaml: "yaml",
    yml: "yaml", md: "markdown", sql: "sql", sh: "bash", bash: "bash",
    dockerfile: "dockerfile", toml: "toml", xml: "xml", php: "php",
    vue: "vue", svelte: "svelte", txt: "plaintext", gradle: "plaintext",
    properties: "plaintext", dart: "plaintext", ex: "plaintext",
    exs: "plaintext", lua: "plaintext", r: "plaintext", jl: "plaintext",
    scala: "plaintext", clj: "plaintext",
  };
  return map[ext] || "plaintext";
}

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp",
  "pdf", "zip", "tar", "gz", "7z", "rar", "xz", "bz2",
  "mp3", "mp4", "wav", "mov", "avi", "mkv", "flac",
  "ttf", "otf", "woff", "woff2", "eot",
  "exe", "dll", "so", "dylib", "a", "o", "obj",
  "class", "jar", "apk", "ipa", "aab",
  "pyc", "pyo", "wasm",
]);

function isBinaryFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return BINARY_EXTENSIONS.has(ext);
}

// ── Pastas que são lixo de build/deps — ignorar ao importar ─────────────────
const SKIP_DIRS = [
  "node_modules/", ".git/", ".svn/", "dist/", "build/", ".expo/",
  ".expo-shared/", ".cache/", "__pycache__/", ".venv/", "venv/",
  ".next/", ".nuxt/", ".output/", "coverage/", ".nyc_output/",
  ".turbo/", ".vercel/", ".netlify/", "android/", "ios/",
];

const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  ".DS_Store", "Thumbs.db", ".gitkeep",
]);

function shouldSkip(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  for (const dir of SKIP_DIRS) {
    if (lower.startsWith(dir) || lower.includes("/" + dir)) return true;
  }
  const basename = lower.split("/").pop() ?? "";
  return SKIP_FILES.has(basename);
}

function uint8ArrayToString(arr: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arr);
  } catch {
    return new TextDecoder("latin1").decode(arr);
  }
}

// ── Lê arquivo como Uint8Array — SEM base64, evita truncamento do Hermes ─────
async function readFileAsBytes(uri: string): Promise<Uint8Array> {
  // Attempt 1: expo-file-system/next File.bytes() — mais confiável no Android
  try {
    const f = new FSFile(uri);
    return await f.bytes();
  } catch {}

  // Attempt 2: fetch + arrayBuffer
  try {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
  } catch {}

  throw new Error("Não foi possível ler o arquivo. Tente novamente.");
}

// Mantida apenas para arquivos binários individuais (imagem/PDF)
async function readFileAsBase64(uri: string): Promise<string> {
  const bytes = await readFileAsBytes(uri);
  // Converte Uint8Array → base64 em chunks para não travar o Hermes
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ── Remove pasta raiz única do ZIP/TAR ────────────────────────────────────────
function stripTopLevelFolder(files: Record<string, string>): Record<string, string> {
  const keys = Object.keys(files);
  if (keys.length === 0) return files;

  const firstSlash = keys[0].indexOf("/");
  if (firstSlash <= 0) return files;

  const prefix = keys[0].slice(0, firstSlash + 1);
  const allHavePrefix = keys.every(k => k.startsWith(prefix));
  if (!allHavePrefix) return files;

  const topLevel = prefix.slice(0, -1);
  const technicalFolders = ["src", "public", "lib", "dist", "components", "pages", "app"];
  if (technicalFolders.includes(topLevel)) return files;

  const stripped: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    stripped[k.slice(prefix.length)] = v;
  }
  return stripped;
}

// ── TAR parser ────────────────────────────────────────────────────────────────

function readOctal(bytes: Uint8Array, offset: number, length: number): number {
  let s = "";
  for (let i = offset; i < offset + length; i++) {
    if (bytes[i] === 0 || bytes[i] === 0x20) break;
    s += String.fromCharCode(bytes[i]);
  }
  return parseInt(s.trim(), 8) || 0;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  let end = offset;
  while (end < offset + length && bytes[end] !== 0) end++;
  return new TextDecoder("utf-8").decode(bytes.slice(offset, end)).trim();
}

function parseTar(data: Uint8Array): Array<{ name: string; content: Uint8Array }> {
  const files: Array<{ name: string; content: Uint8Array }> = [];
  let offset = 0;
  let longName: string | null = null;

  while (offset + 512 <= data.length) {
    const header = data.slice(offset, offset + 512);
    const isZero = header.every((b) => b === 0);
    if (isZero) break;

    const typeFlag = String.fromCharCode(header[156]);
    let name = readString(header, 0, 100);
    const prefix = readString(header, 345, 155);
    if (prefix && typeFlag !== "L") name = prefix + "/" + name;

    const size = readOctal(header, 124, 12);
    const blocks = Math.ceil(size / 512);

    offset += 512;
    const contentBytes = data.slice(offset, offset + size);
    offset += blocks * 512;

    if (typeFlag === "L") {
      longName = uint8ArrayToString(contentBytes).replace(/\0+$/, "");
      continue;
    }
    if (longName) { name = longName; longName = null; }

    if (typeFlag === "5" || typeFlag === "3" || typeFlag === "4" || typeFlag === "6") continue;
    if (!name || name.endsWith("/")) continue;
    if (name.startsWith(".__") || name.includes("/__MACOSX") || name.includes(".DS_Store")) continue;
    if (name.includes("PaxHeader")) continue;

    if (size > 0) {
      files.push({ name, content: contentBytes });
    }
  }
  return files;
}

// ── Importar arquivo único ────────────────────────────────────────────────────

export async function importSingleFile(): Promise<ProjectFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const filename = asset.name || "arquivo.txt";

  if (isBinaryFile(filename)) {
    const b64 = await readFileAsBase64(asset.uri);
    const ext = filename.split(".").pop()?.toLowerCase() || "bin";
    const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
      ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : ext === "svg" ? "image/svg+xml" :
      ext === "pdf" ? "application/pdf" : "application/octet-stream";
    return {
      id: generateId(), name: filename, path: filename,
      content: `data:${mime};base64,${b64}`, language: "plaintext",
    };
  }

  let content = "";
  try {
    content = await new FSFile(asset.uri).text();
  } catch {
    try {
      const response = await fetch(asset.uri);
      content = await response.text();
    } catch {
      const bytes = await readFileAsBytes(asset.uri);
      content = uint8ArrayToString(bytes);
    }
  }

  return {
    id: generateId(), name: filename, path: filename,
    content, language: detectLanguage(filename),
  };
}

// ── ZIP import ────────────────────────────────────────────────────────────────
// CORREÇÃO PRINCIPAL: lê como Uint8Array direto (não mais base64 string)
// O Hermes (motor JS do Android) trunca strings > ~16MB → base64 corrompido
// → apenas 10 de 200 arquivos apareciam. Agora lê binário direto: sem truncamento.

export async function importZip(
  onProgress?: (cur: number, total: number, phase: string) => void
): Promise<Omit<Project, "id" | "createdAt" | "updatedAt"> | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const filename = asset.name || "projeto.zip";

  onProgress?.(2, 100, "Lendo arquivo...");

  // ✅ CORREÇÃO: lê como bytes binários — sem base64, sem truncamento do Hermes
  let fileBytes: Uint8Array;
  try {
    fileBytes = await readFileAsBytes(asset.uri);
  } catch (e: any) {
    throw new Error(`Não foi possível ler o arquivo: ${e?.message}`);
  }

  onProgress?.(8, 100, "Abrindo ZIP...");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(fileBytes.buffer as ArrayBuffer);
  } catch (e: any) {
    throw new Error(`Arquivo não é um ZIP válido: ${e?.message}`);
  }

  // Coleta entradas válidas, filtrando node_modules e lixo de build
  const entries: Array<[string, JSZip.JSZipObject]> = [];
  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    if (relativePath.startsWith("__MACOSX")) return;
    if (relativePath.includes(".DS_Store")) return;
    if (relativePath.endsWith(".gitkeep")) return;
    if (shouldSkip(relativePath)) return;
    entries.push([relativePath, zipEntry]);
  });

  const total = entries.length;
  onProgress?.(10, 100, `Extraindo 0 / ${total.toLocaleString("pt-BR")} arquivos...`);

  const rawFiles: Record<string, string> = {};
  let done = 0;

  for (const [relativePath, zipEntry] of entries) {
    try {
      if (isBinaryFile(relativePath)) {
        const b64 = await zipEntry.async("base64");
        const ext = relativePath.split(".").pop()?.toLowerCase() || "bin";
        const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
          ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : ext === "svg" ? "image/svg+xml" :
          ext === "ico" ? "image/x-icon" : ext === "pdf" ? "application/pdf" :
          ext === "woff" ? "font/woff" : ext === "woff2" ? "font/woff2" : ext === "ttf" ? "font/ttf" :
          "application/octet-stream";
        rawFiles[relativePath] = `data:${mime};base64,${b64}`;
      } else {
        rawFiles[relativePath] = await zipEntry.async("string");
      }
    } catch {
      // ignora arquivos que falharam
    }
    done++;
    if (done % 50 === 0 || done === total) {
      const pct = 10 + Math.floor((done / total) * 85);
      onProgress?.(pct, 100, `Extraindo ${done.toLocaleString("pt-BR")} / ${total.toLocaleString("pt-BR")} arquivos...`);
    }
  }

  if (Object.keys(rawFiles).length === 0) {
    throw new Error("O ZIP está vazio ou todos os arquivos são binários/node_modules.");
  }

  const strippedFiles = stripTopLevelFolder(rawFiles);

  const files: ProjectFile[] = Object.entries(strippedFiles).map(([path, content]) => {
    const fname = path.split("/").pop() || path;
    return { id: generateId(), name: fname, path, content, language: detectLanguage(fname) };
  });

  files.sort((a, b) => (a.path || a.name).localeCompare(b.path || b.name));

  return {
    name: filename.replace(/\.(zip)$/i, "") || "Projeto Importado",
    description: `Importado de ${filename} — ${files.length} arquivo(s)`,
    files,
  };
}

// ── TAR.GZ / TAR import ───────────────────────────────────────────────────────
// CORREÇÃO: mesmo fix — lê como bytes direto, sem base64 intermediário

export async function importTar(
  onProgress?: (cur: number, total: number, phase: string) => void
): Promise<Omit<Project, "id" | "createdAt" | "updatedAt"> | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const filename = asset.name || "arquivo";
  const isGzip = /\.(tar\.gz|tgz|taz)$/i.test(filename);
  const isTar = /\.(tar)$/i.test(filename) || isGzip;

  if (!isTar) {
    throw new Error("Selecione um arquivo .tar, .tar.gz, .tgz ou .taz");
  }

  onProgress?.(3, 100, "Lendo arquivo...");

  // ✅ CORREÇÃO: bytes direto, sem base64
  let rawBytes: Uint8Array;
  try {
    rawBytes = await readFileAsBytes(asset.uri);
  } catch (e: any) {
    throw new Error(`Não foi possível ler o arquivo: ${e?.message}`);
  }

  if (isGzip) {
    onProgress?.(15, 100, "Descomprimindo .tar.gz...");
    try {
      rawBytes = pako.inflate(rawBytes);
    } catch {
      try {
        rawBytes = pako.ungzip(rawBytes);
      } catch (e: any) {
        throw new Error(`Falha ao descomprimir .tar.gz: ${e?.message}`);
      }
    }
  }

  onProgress?.(30, 100, "Analisando estrutura TAR...");
  const tarFiles = parseTar(rawBytes);

  if (tarFiles.length === 0) {
    throw new Error("Nenhum arquivo encontrado no TAR.");
  }

  onProgress?.(35, 100, `Convertendo ${tarFiles.length.toLocaleString("pt-BR")} arquivos...`);

  const projectFiles: ProjectFile[] = tarFiles
    .filter(f => !shouldSkip(f.name))
    .map((f, idx) => {
      if (idx % 200 === 0) {
        const pct = 35 + Math.floor((idx / tarFiles.length) * 60);
        onProgress?.(pct, 100, `Processando ${idx.toLocaleString("pt-BR")} / ${tarFiles.length.toLocaleString("pt-BR")} arquivos...`);
      }
      const fname = f.name.split("/").pop() || f.name;
      let content: string;
      if (isBinaryFile(f.name)) {
        // Chunks de 8192 para não travar o Hermes
        const CHUNK = 8192;
        let binary = "";
        for (let i = 0; i < f.content.length; i += CHUNK) {
          binary += String.fromCharCode(...f.content.subarray(i, i + CHUNK));
        }
        const b64 = btoa(binary);
        const ext = fname.split(".").pop()?.toLowerCase() || "bin";
        const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
          ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : ext === "svg" ? "image/svg+xml" :
          "application/octet-stream";
        content = `data:${mime};base64,${b64}`;
      } else {
        try { content = uint8ArrayToString(f.content); }
        catch { return null; }
      }
      return {
        id: generateId(), name: fname, path: f.name, content,
        language: detectLanguage(fname),
      } as ProjectFile;
    })
    .filter((f): f is ProjectFile => f !== null);

  if (projectFiles.length === 0) {
    throw new Error("O TAR está vazio ou corrompido.");
  }

  projectFiles.sort((a, b) => (a.path || a.name).localeCompare(b.path || b.name));
  const projectName = filename.replace(/\.(tar\.gz|tgz|taz|tar)$/i, "") || "Projeto TAR";

  return {
    name: projectName,
    description: `Importado de ${filename} — ${projectFiles.length} arquivo(s)`,
    files: projectFiles,
  };
}

// ── ZIP export ────────────────────────────────────────────────────────────────

export async function exportZip(project: Project): Promise<boolean> {
  try {
    const zip = new JSZip();

    for (const file of project.files) {
      const filePath = (file.path || file.name).replace(/^\//, "");
      if (filePath.endsWith(".gitkeep")) continue;
      zip.file(filePath, file.content || "");
    }

    const safeName = project.name.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
    const filename = `${safeName}.zip`;

    if (Platform.OS === "web") {
      const blobData = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(blobData);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    }

    // Android/iOS: usa expo-file-system/next
    const uint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const zipFile = new FSFile(Paths.cache, filename);
    zipFile.write(uint8);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(zipFile.uri, {
        mimeType: "application/zip",
        dialogTitle: `Exportar ${project.name}`,
        UTI: "public.zip-archive",
      });
      return true;
    }
    return false;
  } catch (e) {
    console.error("Erro ao exportar ZIP:", e);
    return false;
  }
}
