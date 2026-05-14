# DevMobile — Plano de Arquitetura Local
**Versão 2.6.0 | Documento principal de referência**

---

## OBJETIVO PRINCIPAL

O DevMobile é um IDE completo que roda **diretamente no celular**.
Todos os dados são salvos **no próprio celular** (AsyncStorage).
O app **não depende do servidor Replit** para funcionar — o Replit é apenas ambiente de desenvolvimento.

---

## ONDE OS DADOS SÃO SALVOS

**Tudo fica salvo no celular, dentro do app, em AsyncStorage:**

| O que | Chave no AsyncStorage |
|---|---|
| Projetos + arquivos | `@devmobile/projects` |
| Provedores de IA | `@devmobile/ai_providers` |
| Config Git/GitHub | `@devmobile/git_configs` |
| Configurações | `@devmobile/settings` |
| Memória da Jasmim | `@devmobile/ai_memory` |
| Projeto/arquivo ativos | `@devmobile/active_project_id` |

Salvamento automático: a cada 1,5 segundos durante digitação + imediatamente ao trocar de arquivo + imediatamente ao fechar/minimizar o app (`AppState`).

---

## MODOS DE OPERAÇÃO

### Modo LOCAL (padrão — sem nenhum servidor)
O que funciona SEM o servidor Replit:
- Editor de código completo (com syntax highlight)
- Todos os projetos e arquivos
- Gerenciador de projetos
- GitHub / GitLab (clone, push, pull) — API direto do GitHub, sem backend
- Assistente de IA Jasmim — com qualquer provedor configurado
- IA Gratuita (Gemini Cortesia) — sem precisar de chave
- Tarefas (Taski)
- Checkpoints / histórico
- Exportar ZIP
- Importar ZIP / TAR / arquivos
- Preview HTML local
- Playground HTML
- Manual completo

### Modo REMOTO (opcional — com servidor)
Funciona APENAS se houver servidor configurado (Replit ativo, ou Termux local):
- Terminal Linux real
- Preview de servidor (Node.js / Python rodando)
- VS Code (code-server) via WebView
- Upload/download de arquivos para o servidor
- Banco de dados remoto (Neon/PostgreSQL)

---

## CONFIGURAÇÃO DE PORTAS

```
Porta local padrão (API/terminal): 8080
Porta code-server (VS Code):       3001
Porta preview:                     8080

URL local (Termux ou API no celular):
  http://127.0.0.1:8080

URL auto-detectada pelo app (prioridade):
  1. EXPO_PUBLIC_API_BASE_URL  (env var fixa — se definida)
  2. customServerUrl           (configurado nas settings do app)
  3. http://localhost:8080     (Termux local — ping automático)
  4. https://<EXPO_PUBLIC_DOMAIN> (servidor Replit — fallback)
  5. vazio                     (modo offline puro)
```

**IMPORTANTE:** A porta correta para o servidor local é **8080**, não 18115.
O arquivo `runtimeMode.ts` foi corrigido para usar 8080 como padrão.

---

## EDITORES E VISUALIZADORES (funcionam sem o servidor Replit)

### Editor local embutido
- Componente `CodeEditor.tsx`
- Syntax highlighting para JS, TS, Python, HTML, CSS, JSON, etc.
- Auto-save robusto (1,5s + troca de arquivo + background)
- **Roda 100% local, sem nenhum servidor**

### VS Code Web (via WebView — sem instalar nada)
- URL: `https://github.dev/{usuario}/{repo}`
- Roda no navegador/WebView do celular
- Requer internet (acessa github.dev), mas NÃO requer o servidor Replit
- Disponível na aba "Push para GitHub" após enviar o projeto

### StackBlitz (via WebView — sem instalar nada)
- URL: `https://stackblitz.com/github/{usuario}/{repo}`
- VS Code + Node.js + npm rodando no navegador
- Requer internet, NÃO requer o servidor Replit

### Gitpod (via WebView — sem instalar nada)
- URL: `https://gitpod.io/#https://github.com/{usuario}/{repo}`
- Terminal Linux completo (50h grátis/mês)
- Requer internet, NÃO requer o servidor Replit

### code-server real (VS Code completo — requer servidor local)
- Precisa do processo `code-server` rodando localmente
- No Replit: roda na porta 3001, proxied pelo api-server
- No celular: possível via Termux (futuro)
- Sem processo servindo = sem code-server. Não tem como contornar.

---

## TERMINAL

### Sem servidor (modo atual no APK)
- Mostra banner "Sem servidor"
- Permite digitar e copiar comandos (para colar no Termux separado)
- Não trava nem mostra tela vermelha

### Com servidor Termux (futuro)
- Instalar Termux pelo F-Droid (NÃO pela Play Store — versão desatualizada)
- Configurar servidor local na porta 8080
- O app detecta automaticamente via ping em `localhost:8080`

### Com servidor Replit (desenvolvimento)
- URL: `https://<seu-domínio>.replit.dev`
- Configurar em Settings > URL do servidor customizado

---

## GITHUB / REPOSITÓRIO (funciona sem o servidor Replit)

O GitHub é chamado **diretamente** pelo app, sem passar pelo backend:
- Clone público/privado → `api.github.com` direto
- Push → `api.github.com` direto
- GitHub Pages → `api.github.com` direto
- Arquivos binários → armazenados como base64

Token necessário apenas para repos privados e para push/Pages.

---

## ARQUIVOS CRÍTICOS

```
artifacts/mobile/
├── context/AppContext.tsx        — persistência, projetos, arquivos, save
├── components/CodeEditor.tsx     — editor local, auto-save robusto
├── hooks/useApiBase.ts           — URL da API (local/remoto/offline)
├── services/apiBase.ts           — lógica de URL por estratégia
├── services/runtimeMode.ts       — portas e modo de operação (PORTA: 8080)
├── services/githubService.ts     — GitHub direto (sem backend)
├── components/Terminal.tsx       — terminal (graceful sem servidor)
├── components/PreviewPanel.tsx   — preview (graceful sem servidor)
├── components/VSCodeView.tsx     — code-server WebView
├── app/(tabs)/plugins.tsx        — plugins (modo simulação sem servidor)
├── app/(tabs)/settings.tsx       — configurações locais
└── app.json                      — v2.6.0, versionCode 34, owner maikon1
```

---

## RESULTADO ESPERADO DO APK

- App abre sem depender do servidor Replit
- Editor funciona 100% offline
- Projetos e arquivos salvos no celular (não somem ao fechar)
- GitHub funciona direto (clone, push, Pages)
- Terminal mostra aviso elegante quando sem servidor
- VS Code / StackBlitz / Gitpod abrem no navegador após push para GitHub
- IA funciona com provedor configurado (Gemini Cortesia é gratuito sem chave)

---

## BUILD EAS

```bash
cd artifacts/mobile
EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 \
  eas build --platform android --profile preview --non-interactive --no-wait
```

Conta: maikon1 (meulegale1@gmail.com)
Projeto EAS: 494d3229-54ec-4f5e-842e-93cc706a6b21
Acompanhar: https://expo.dev/accounts/maikon1/projects/app-ide/builds
