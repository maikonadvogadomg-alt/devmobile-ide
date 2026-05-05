import { getApiStrategy, getLocalPreviewPort } from "./runtimeMode";

export function canUseInlineHtmlPreview(): boolean {
  return true;
}

export function getServerPreviewUrl(): string | null {
  const strategy = getApiStrategy();
  const previewPort = getLocalPreviewPort();

  if (strategy === "local-device" || strategy === "termux") {
    return `http://127.0.0.1:${previewPort}`;
  }

  return null;
}
