import { Router } from "express";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../lib/logger";

const router = Router();

const EDITOR_ROOT = join(process.cwd(), "artifacts/code-editor");
const DIST_DIR    = join(EDITOR_ROOT, "dist/public");

// Lê todos os arquivos de um diretório recursivamente
function readAllFiles(dir: string, base = ""): { path: string; buf: Buffer }[] {
  const results: { path: string; buf: Buffer }[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel  = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      results.push(...readAllFiles(full, rel));
    } else {
      results.push({ path: rel, buf: readFileSync(full) });
    }
  }
  return results;
}

// Chama a API do GitHub com o token do usuário
async function ghApi(
  token: string,
  path: string,
  opts: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string> | undefined),
    },
  });
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ─── POST /api/pages/deploy (SSE) ─────────────────────────────────────────────
// Faz build do editor e publica no GitHub Pages do usuário.
// Body: { token, username, repoName }
// Resposta: SSE com { type: "log"|"done"|"error", msg?, url? }
router.post("/pages/deploy", async (req, res) => {
  const { token, username, repoName } = req.body as {
    token?: string; username?: string; repoName?: string;
  };

  if (!token || !username || !repoName) {
    res.status(400).json({ error: "token, username e repoName são obrigatórios." });
    return;
  }

  // Segurança: valida repoName com allowlist estrita (evita injeção de comando)
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(repoName)) {
    res.status(400).json({ error: "repoName inválido. Use apenas letras, números, hífens, underscores e pontos." });
    return;
  }

  // SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  type FlushableRes = typeof res & { flush?: () => void };
  const sseRes = res as FlushableRes;
  const send = (type: "log" | "done" | "error", msg: string, url?: string) => {
    try { res.write(`data: ${JSON.stringify({ type, msg, url })}\n\n`); sseRes.flush?.(); } catch { /* ok */ }
  };

  try {
    // 1. Build
    send("log", "🔨 Compilando o editor (pode demorar 1-2 min)…");
    const basePath = `/${repoName}/`;
    try {
      execSync(`pnpm --filter @workspace/code-editor build`, {
        cwd: process.cwd(),
        timeout: 180_000,
        stdio: "pipe",
        env: { ...process.env, BASE_PATH: basePath, NODE_ENV: "production" },
      });
    } catch (buildErr: any) {
      send("error", `Erro no build: ${buildErr.stderr?.toString?.().slice(0, 500) || buildErr.message}`);
      res.end(); return;
    }
    send("log", "✅ Build concluído! Lendo arquivos…");

    // 2. Lê arquivos do build
    const files = readAllFiles(DIST_DIR);
    if (!files.length) {
      send("error", "Nenhum arquivo gerado pelo build.");
      res.end(); return;
    }
    send("log", `📦 ${files.length} arquivos prontos. Verificando repositório GitHub…`);

    // 3. Cria o repositório se não existir
    const { status: repoStatus, body: repoBody } = await ghApi(token, `/repos/${username}/${repoName}`);
    if (repoStatus === 404) {
      send("log", `📁 Criando repositório ${repoName}…`);
      const { status: createStatus, body: createBody } = await ghApi(token, "/user/repos", {
        method: "POST",
        body: JSON.stringify({ name: repoName, description: "SK Code Editor — GitHub Pages", private: false, auto_init: true }),
      });
      if (createStatus !== 201) {
        send("error", `Erro ao criar repositório: ${createBody.message || createStatus}`);
        res.end(); return;
      }
      // Aguarda GitHub inicializar o repo
      await new Promise(r => setTimeout(r, 3000));
    } else if (repoStatus !== 200) {
      send("error", `Erro ao verificar repositório: ${repoBody.message || repoStatus}`);
      res.end(); return;
    } else {
      send("log", `📁 Repositório ${repoName} encontrado.`);
    }

    // 4. Garante que o branch gh-pages existe (cria a partir do main/master se não)
    const { status: branchStatus } = await ghApi(token, `/repos/${username}/${repoName}/branches/gh-pages`);
    if (branchStatus === 404) {
      send("log", "🌿 Criando branch gh-pages…");
      // Pega SHA do default branch
      const { body: repoInfo } = await ghApi(token, `/repos/${username}/${repoName}`);
      const defaultBranch = repoInfo.default_branch || "main";
      const { body: branchInfo } = await ghApi(token, `/repos/${username}/${repoName}/branches/${defaultBranch}`);
      const sha = branchInfo?.commit?.sha;
      if (!sha) {
        send("error", "Não foi possível obter o SHA do branch principal.");
        res.end(); return;
      }
      await ghApi(token, `/repos/${username}/${repoName}/git/refs`, {
        method: "POST",
        body: JSON.stringify({ ref: "refs/heads/gh-pages", sha }),
      });
      await new Promise(r => setTimeout(r, 1000));
    }

    // 5. Envia os arquivos para gh-pages (em paralelo, lotes de 3)
    send("log", `📤 Enviando ${files.length} arquivos para o GitHub…`);
    let done = 0;
    const BATCH = 3;
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH);
      await Promise.all(batch.map(async ({ path: filePath, buf }) => {
        const isText = /\.(html|js|css|json|txt|svg|xml|map|ts|md|ico)$/i.test(filePath);
        const content = isText
          ? Buffer.from(buf).toString("base64")
          : buf.toString("base64");

        // Verifica SHA existente
        let sha: string | undefined;
        try {
          const { body: existing } = await ghApi(token, `/repos/${username}/${repoName}/contents/${filePath}?ref=gh-pages`);
          if (existing?.sha) sha = existing.sha;
        } catch { /* não existe ainda */ }

        const body: Record<string, any> = {
          message: `Deploy SK Editor — ${filePath}`,
          content,
          branch: "gh-pages",
        };
        if (sha) body.sha = sha;

        await ghApi(token, `/repos/${username}/${repoName}/contents/${filePath}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        done++;
      }));
      if (done % 15 === 0 || done === files.length) {
        send("log", `📤 ${done}/${files.length} arquivos enviados…`);
      }
    }

    // 6. Habilita GitHub Pages
    send("log", "🌐 Habilitando GitHub Pages…");
    await ghApi(token, `/repos/${username}/${repoName}/pages`, {
      method: "POST",
      body: JSON.stringify({ source: { branch: "gh-pages", path: "/" } }),
    });

    const pageUrl = `https://${username}.github.io/${repoName}/`;
    send("log", "✅ Pronto! GitHub Pages habilitado.");
    send("done", `Publicado em ${pageUrl}`, pageUrl);
  } catch (err: any) {
    logger.error({ err }, "Erro no pages/deploy");
    send("error", `Erro inesperado: ${err.message}`);
  } finally {
    try { res.end(); } catch { /* ok */ }
  }
});

export default router;
