import pako from "pako";
import JSZip from "jszip";

export interface ProjectFile {
  path: string;
  data: string;
  isBinary?: boolean;
  size?: number;
}

const BINARY_EXTS = new Set([
  "png","jpg","jpeg","gif","webp","bmp","ico","tiff",
  "mp3","mp4","wav","ogg","webm","flac","aac","m4a",
  "ttf","woff","woff2","eot","otf",
  "zip","tar","gz","tgz","jar","war","apk","aab","aar",
  "class","dex","so","dylib","dll","exe","bin",
  "pdf","doc","docx","xls","xlsx","ppt","pptx",
  "db","sqlite","sqlite3","dat","pyc","o","a",
  "mov","avi","mkv","flv","wmv",
]);

export function isBinaryPath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return BINARY_EXTS.has(ext);
}

function uint8ToBase64(arr: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < arr.length; i += CHUNK) {
    const slice = arr.subarray(i, i + CHUNK);
    let s = "";
    for (let j = 0; j < slice.length; j++) s += String.fromCharCode(slice[j]);
    parts.push(s);
  }
  try {
    return btoa(parts.join(""));
  } catch {
    return "";
  }
}

function cleanBase64(b64: string): string {
  return b64.replace(/[\r\n\s]/g, "");
}

function base64ToUint8Array(b64: string): Uint8Array {
  const clean = cleanBase64(b64);
  let binary: string;
  try {
    binary = atob(clean);
  } catch {
    return new Uint8Array(0);
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function readString(buf: Uint8Array, offset: number, len: number): string {
  let s = "";
  for (let i = offset; i < offset + len; i++) {
    if (buf[i] === 0) break;
    s += String.fromCharCode(buf[i]);
  }
  return s;
}

function parseTar(buffer: ArrayBuffer): ProjectFile[] {
  const bytes = new Uint8Array(buffer);
  const files: ProjectFile[] = [];
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.slice(offset, offset + 512);
    const name = readString(header, 0, 100).trim();
    const prefix = readString(header, 345, 155).trim();
    const fullName = prefix ? `${prefix}/${name}` : name;
    if (!fullName || fullName === "./" || fullName === ".") {
      offset += 512;
      continue;
    }
    const sizeStr = readString(header, 124, 12).trim();
    const size = sizeStr ? parseInt(sizeStr, 8) : 0;
    const typeFlag = String.fromCharCode(header[156]);
    offset += 512;
    if ((typeFlag === "0" || typeFlag === "\0" || typeFlag === "") && size > 0) {
      const chunk = bytes.slice(offset, offset + size);
      const cleanPath = fullName.replace(/^\.\//, "").replace(/^[^/]+\//, "");
      if (cleanPath) {
        const binary = isBinaryPath(cleanPath);
        let data = "";
        if (!binary) {
          try { data = uint8ToBase64(chunk); } catch { data = ""; }
        } else {
          try { data = uint8ToBase64(chunk); } catch { data = ""; }
        }
        files.push({ path: cleanPath, data, isBinary: binary, size });
      }
    }
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

export async function extractArchive(
  base64Input: string,
  fileName: string
): Promise<ProjectFile[]> {
  const bytes = base64ToUint8Array(base64Input);
  if (bytes.length === 0) throw new Error("Arquivo inválido ou vazio");
  const buffer = bytes.buffer as ArrayBuffer;
  const name = fileName.toLowerCase();

  if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) {
    let decompressed: ArrayBuffer;
    try {
      decompressed = pako.ungzip(bytes).buffer as ArrayBuffer;
    } catch {
      try {
        decompressed = pako.inflate(bytes).buffer as ArrayBuffer;
      } catch (e) {
        throw new Error("Não foi possível descompactar o arquivo: " + String(e));
      }
    }
    return parseTar(decompressed);
  }

  if (name.endsWith(".tar")) return parseTar(buffer);

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    throw new Error("Arquivo ZIP inválido: " + String(e));
  }
  const entries = Object.entries(zip.files);
  const keys = entries.filter(([, v]) => !v.dir).map(([k]) => k);

  const isAndroid = keys.some(
    (k) =>
      k.endsWith("build.gradle") ||
      k.endsWith("build.gradle.kts") ||
      k.endsWith("settings.gradle") ||
      k.endsWith("AndroidManifest.xml") ||
      k.endsWith("gradlew") ||
      k.includes("gradle/wrapper/")
  );

  let prefix = "";
  if (!isAndroid) {
    const distMatch = keys.find((k) =>
      /^[^/]+\/(dist|build|www|out)\//i.test(k)
    );
    if (distMatch) {
      const m = distMatch.match(/^([^/]+\/(dist|build|www|out)\/)/i);
      if (m) prefix = m[1];
    } else {
      const tops = [...new Set(keys.map((k) => k.split("/")[0]))];
      if (tops.length === 1) prefix = tops[0] + "/";
    }
  } else {
    const tops = [...new Set(keys.map((k) => k.split("/")[0]))];
    if (tops.length === 1) {
      const singleTop = tops[0] + "/";
      const hasAndroidStructure = keys.some(
        (k) =>
          k.startsWith(singleTop) &&
          (k.includes("/app/src/") || k.includes("/gradle/"))
      );
      if (hasAndroidStructure) prefix = singleTop;
    }
  }

  const result: ProjectFile[] = [];
  for (const [path, entry] of entries) {
    if (entry.dir) continue;
    const rel = prefix ? path.replace(prefix, "") : path;
    if (!rel) continue;
    const binary = isBinaryPath(rel);
    try {
      const b64 = await entry.async("base64");
      const sizeBytes = entry._data?.uncompressedSize ?? 0;
      result.push({ path: rel, data: b64, isBinary: binary, size: sizeBytes });
    } catch {
      result.push({ path: rel, data: "", isBinary: binary, size: 0 });
    }
  }
  return result;
}

export function guessConfig(
  files: ProjectFile[],
  fallbackName: string
): { name: string; id: string } {
  let name = fallbackName
    .replace(/\.(zip|tar\.gz|tgz|tar)$/i, "")
    .replace(/[_-]/g, " ");
  let id =
    "com.meuapp." +
    fallbackName
      .replace(/\.(zip|tar\.gz|tgz|tar)$/i, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();

  function decode(f: ProjectFile): string {
    if (!f.data || f.isBinary) return "";
    try {
      const clean = cleanBase64(f.data);
      const raw = atob(clean);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch {
      return "";
    }
  }

  const pkgFile = files.find(
    (f) => f.path === "package.json" || f.path.endsWith("/package.json")
  );
  if (pkgFile?.data) {
    try {
      const pkg = JSON.parse(decode(pkgFile));
      if (pkg.name) {
        name = pkg.name;
        id =
          "com.meuapp." +
          pkg.name.replace(/[^a-z0-9]/gi, "").toLowerCase();
      }
    } catch {}
  }

  const capFile = files.find((f) =>
    /capacitor\.config\.(ts|js|json)$/.test(f.path)
  );
  if (capFile?.data) {
    const txt = decode(capFile);
    const idM = txt.match(/appId\s*[:=]\s*['"`]([^'"`]+)['"`]/);
    const nmM = txt.match(/appName\s*[:=]\s*['"`]([^'"`]+)['"`]/);
    if (idM) id = idM[1];
    if (nmM) name = nmM[1];
  }

  const appJson = files.find(
    (f) => f.path === "app.json" || f.path.endsWith("/app.json")
  );
  if (appJson?.data) {
    try {
      const j = JSON.parse(decode(appJson));
      const expo = j.expo ?? j;
      if (expo.name) name = expo.name;
      if (expo.android?.package) id = expo.android.package;
    } catch {}
  }

  const manifest = files.find((f) =>
    f.path.endsWith("AndroidManifest.xml")
  );
  if (manifest?.data) {
    const txt = decode(manifest);
    const m = txt.match(/package\s*=\s*["']([^"']+)["']/);
    if (m) id = m[1];
    const lm = txt.match(/android:label\s*=\s*["']([^"'@]+)["']/);
    if (lm) name = lm[1];
  }

  return { name: name || fallbackName, id };
}

export function decodeFileToText(f: ProjectFile): string {
  if (!f.data) return "(arquivo vazio)";
  if (f.isBinary || isBinaryPath(f.path)) {
    const kb = f.size ? ` · ${(f.size / 1024).toFixed(1)} KB` : "";
    return `[Arquivo binário${kb} — não pode ser visualizado como texto]`;
  }
  try {
    const clean = cleanBase64(f.data);
    let raw: string;
    try {
      raw = atob(clean);
    } catch {
      return "(erro ao decodificar: base64 inválido)";
    }
    let nonPrint = 0;
    const checkLen = Math.min(raw.length, 512);
    for (let i = 0; i < checkLen; i++) {
      const c = raw.charCodeAt(i);
      if (c < 9 || (c > 13 && c < 32) || c === 127) nonPrint++;
    }
    if (checkLen > 0 && nonPrint / checkLen > 0.1) {
      const kb = f.size ? ` · ${(f.size / 1024).toFixed(1)} KB` : "";
      return `[Arquivo binário${kb} — conteúdo não textual]`;
    }
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "(erro ao decodificar arquivo)";
  }
}
