# SK Code Editor — Pacote para Gerar APK

## O que é este pacote

Este é o SK Code Editor — um app de desenvolvimento com IA (Jasmim), terminal, editor de código, backup no Google Drive e integração com GitHub.

O app já está compilado e pronto. Você só precisa convertê-lo para APK.

---

## Como gerar o APK (método mais fácil — gratuito)

1. Acesse: **https://www.pwabuilder.com/**
2. No campo "Enter the URL to your PWA", cole:
   **https://maikonadvogadomg-alt.github.io/skeditor-apk/**
3. Clique em **Start** (aguarde alguns segundos)
4. Clique em **Android** → **Generate Package**
5. Faça download do APK
6. Instale no celular (ative "Fontes desconhecidas" nas configurações)

---

## Como hospedar localmente (se quiser outro domínio)

Estes arquivos formam um site estático. Você pode hospedar em:
- GitHub Pages (gratuito)
- Netlify (gratuito)
- Vercel (gratuito)
- Qualquer servidor web (Apache, Nginx, etc.)

Basta fazer upload de todos os arquivos desta pasta para a raiz do servidor.

---

## Como gerar APK com estes arquivos (método alternativo)

Se quiser gerar o APK localmente usando Capacitor ou TWA:

### Com PWABuilder CLI:
```
npm install -g @pwabuilder/cli
pwabuilder https://seu-dominio.com/
```

### Com Capacitor:
```
npm install @capacitor/core @capacitor/android
npx cap init "SK Code Editor" com.skeditor.app
npx cap add android
cp -r ./* android/app/src/main/assets/public/
npx cap run android
```

---

## Sobre a IA (Jasmim)

Na primeira vez que abrir o app e usar a IA:
1. O app vai pedir uma chave Gemini gratuita
2. Obtenha em: **https://aistudio.google.com/apikey**
3. Cole a chave (começa com `AIza...`)
4. Salva uma vez — funciona para sempre

A IA funciona 100% sem o servidor do Replit.

---

## Contato

Projeto de Saulo Kenji — SK Code Editor
Versão: standalone (sem dependências do Replit)
Build: 2025-05-08
