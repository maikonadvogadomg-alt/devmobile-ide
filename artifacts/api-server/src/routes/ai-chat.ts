import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

router.get("/ai/chat", (_req, res) => {
  res.status(405).json({ error: "Use POST" });
});
router.head("/ai/chat", (_req, res) => {
  res.status(405).end();
});

router.post("/ai/chat", async (req, res) => {
  const controller = new AbortController();
  const TIMEOUT_MS = 110_000;
  const timeoutId = setTimeout(() => controller.abort(new Error("upstream-timeout")), TIMEOUT_MS);

  // Listen on res.close (not req.close) — req.close fires when the body is consumed
  const onClientClose = () => {
    if (!res.writableEnded) controller.abort(new Error("client-closed"));
  };
  res.on("close", onClientClose);

  const cleanup = () => {
    clearTimeout(timeoutId);
    res.off("close", onClientClose);
  };

  try {
    const { messages, system, stream } = req.body as {
      messages: { role: string; content: string }[];
      system?: string;
      stream?: boolean;
    };

    const baseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
    const apiKey  = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

    if (!baseUrl || !apiKey) {
      cleanup();
      res.status(503).json({ error: "Serviço de IA integrado não configurado. Configure uma chave de API nas configurações." });
      return;
    }

    const useStream = Boolean(stream);

    const finalMessages = [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages,
    ];

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4",
        messages: finalMessages,
        max_completion_tokens: 32768,
        stream: useStream,
      }),
      signal: controller.signal,
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      let errMsg = errText.slice(0, 400);
      try { const j = JSON.parse(errText); errMsg = j.error?.message ?? errMsg; } catch {}
      cleanup();
      res.status(aiRes.status).json({ error: errMsg });
      return;
    }

    if (useStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const bodyReader = aiRes.body!.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await bodyReader.read();
            if (done) break;
            res.write(value);
          }
        } catch {
          // client disconnected or stream error
        } finally {
          res.end();
          cleanup();
        }
      };
      pump();
      res.on("close", () => bodyReader.cancel().catch(() => {}));
      return;
    }

    const data = await aiRes.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    cleanup();
    res.json({ content });
  } catch (err) {
    cleanup();
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort = msg.includes("aborted") || msg.includes("upstream-timeout") || msg.includes("client-closed");

    if (isAbort && !res.headersSent) {
      logger.warn({ err: msg }, "Chat IA cancelado/timeout");
      res.status(504).json({
        error: "A IA demorou demais pra responder (mais de 110s). Tente uma pergunta mais curta ou tente de novo.",
      });
      return;
    }

    logger.error({ err }, "Erro no chat de IA");
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
});

export default router;
