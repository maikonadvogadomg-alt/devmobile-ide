# SK Code Editor — Instalar no Celular como APK

## Método recomendado: GitHub gera o APK automaticamente

Este repositório já tem tudo configurado. Quando você fizer upload para o GitHub, ele:
1. Publica o site no GitHub Pages (endereço gratuito)
2. Gera o APK Android automaticamente — sem precisar de Android Studio, sem instalar nada

---

## Passo a passo completo

### 1. Criar conta e repositório no GitHub

1. Acesse https://github.com e crie uma conta gratuita
2. Clique em **"New repository"** (botão verde no canto superior direito)
3. Nome: `sk-code-editor` (sem espaços)
4. Marque **Public** — obrigatório para GitHub Pages grátis
5. Clique em **"Create repository"**

### 2. Fazer upload dos arquivos

Na tela do repositório recém-criado:
1. Clique em **"uploading an existing file"**
2. Arraste TODOS os arquivos desta pasta para o navegador
3. Clique em **"Commit changes"**

### 3. Ativar GitHub Pages

1. Clique em **Settings** (engrenagem no menu do repositório)
2. Menu lateral esquerdo: **Pages**
3. Em "Source", selecione **GitHub Actions**
4. Salve

### 4. Aguardar o build (3-5 minutos)

1. Clique na aba **Actions** do repositório
2. Você verá dois processos rodando:
   - **"Build e Deploy no GitHub Pages"** — publica o site
   - **"Build APK Android (TWA)"** — gera o APK
3. Aguarde o ícone verde ✅ aparecer nos dois

### 5. Baixar o APK

Após o build concluir:
1. Clique no workflow **"Build APK Android (TWA)"**
2. Clique no build mais recente
3. Lá embaixo, em **Artifacts**, clique em **"SK-Code-Editor-APK"**
4. Baixe e descompacte — dentro estará o arquivo `.apk`

### 6. Instalar no Android

1. Transfira o `.apk` para o celular (por cabo, WhatsApp, Google Drive...)
2. Abra o arquivo no celular
3. Se aparecer aviso: Configurações → Segurança → **Fontes desconhecidas** → permitir
4. Instale — o app aparece na tela inicial

---

## Gerar o APK novamente (quando quiser atualizar)

1. Acesse seu repositório no GitHub
2. Clique na aba **Actions**
3. Clique em **"Build APK Android (TWA)"**
4. Clique em **"Run workflow"** → **"Run workflow"**
5. Aguarde e baixe o novo APK

---

## O que funciona sem servidor (offline)

- ✅ Editor Monaco — JavaScript, Python, HTML, CSS, TypeScript...
- ✅ Importar/Exportar ZIP e TAR.GZ
- ✅ Importar repositório público do GitHub sem token
- ✅ GitHub — clonar, criar repo, enviar arquivos
- ✅ Publicar no GitHub Pages (ativa direto pela API)
- ✅ IA Campo Livre com sua chave — Groq grátis, Gemini, OpenRouter, Claude
- ✅ Abrir no VSCode Web (vscode.dev)
- ✅ Checkpoint, Tarefas, Plano do Projeto

## O que precisa de servidor

- ⚠️ Jasmim sem chave (IA gratuita do servidor Replit)
- ⚠️ Terminal Real (execução de comandos bash)

---

## Chaves de IA gratuitas para usar offline

| Provedor | Link | Chave começa com |
|----------|------|-----------------|
| **Groq** (recomendado, rápido) | console.groq.com | gsk_ |
| **Gemini** | aistudio.google.com | AIza |
| **OpenRouter** | openrouter.ai | sk-or- |
| **Claude** | console.anthropic.com | sk-ant |

---

## Link do GitHub Pages após publicar

`https://SEU_USUARIO.github.io/sk-code-editor/`

Com esse link você também pode gerar APK pelo PWABuilder:
https://www.pwabuilder.com → cole o link → Package for stores → Android
