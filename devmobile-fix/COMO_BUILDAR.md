# 📱 DevMobile — Como Gerar o APK

## Opção 1 — EAS Build (Expo Application Services) ✅ Recomendado

### Pré-requisitos
- Conta gratuita em https://expo.dev
- Node.js 20+ instalado
- `npm install -g eas-cli`

### Passos

```bash
# 1. Instalar dependências
npm install

# 2. Login no EAS
eas login

# 3. Configurar projeto (apenas primeira vez)
eas build:configure

# 4. Build APK (para testar — modo preview)
eas build --platform android --profile preview

# 5. Build AAB (para publicar na Play Store)
eas build --platform android --profile production
```

O APK/AAB fica disponível para download no painel do EAS em ~10 minutos.

---

## Opção 2 — Capacitor (build local) ✅ Para quem tem Android Studio

### Pré-requisitos
- Node.js 20+
- Android Studio + SDK instalado
- Java 17+

```bash
# 1. Instalar dependências
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Build web
npx expo export -p web

# 3. Inicializar Capacitor (apenas primeira vez)
npx cap init DevMobile com.devmobile.ide --web-dir dist

# 4. Adicionar plataforma Android
npx cap add android

# 5. Sincronizar assets
npx cap sync android

# 6. Abrir no Android Studio para gerar APK
npx cap open android
# No Android Studio: Build → Generate Signed APK
```

---

## Opção 3 — GitHub Actions (build automático no GitHub)

O arquivo `.github/workflows/build-apk-eas.yml` já está configurado.

### Configurar secrets no GitHub:
- `EXPO_TOKEN` → https://expo.dev/accounts/[user]/settings/access-tokens

### Fazer o build:
- Push para o branch `main` aciona o build automaticamente
- Ou vá em Actions → Build APK (EAS) → Run workflow

---

## Opção 4 — Build local com Gradle (sem EAS)

O arquivo `.github/workflows/build-apk-local.yml` usa Capacitor + Gradle localmente.

```bash
# Requer Android SDK configurado com ANDROID_HOME
npm run build:apk  # se configurado no package.json
```

---

## 🔧 Configuração antes de buildar

1. Copie `.env.example` para `.env`
2. Preencha as chaves de IA que desejar
3. Configure `EXPO_PUBLIC_DOMAIN` se usar servidor
4. Para Neon DB: preencha `DATABASE_URL`

---

## 📦 Estrutura de rotas diretas (sem servidor Replit)

O app funciona 100% offline. As IAs chamam diretamente os provedores:

| Provedor | Detecção | Endpoint direto |
|---|---|---|
| Google Gemini | `AIza...` | `generativelanguage.googleapis.com` |
| Groq | `gsk_...` | `api.groq.com/openai/v1` |
| OpenAI | `sk-...` | `api.openai.com/v1` |
| Anthropic | `sk-ant-...` | `api.anthropic.com/v1` |
| OpenRouter | `sk-or-...` | `openrouter.ai/api/v1` |
| Perplexity | `pplx-...` | `api.perplexity.ai` |
| xAI/Grok | `xai-...` | `api.x.ai/v1` |
| DeepSeek | `sk-...` (deepseek) | `api.deepseek.com/v1` |

Todos os dados ficam localmente no dispositivo via AsyncStorage + SQLite.
