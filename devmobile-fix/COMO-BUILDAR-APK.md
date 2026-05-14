# Como Gerar o APK do DevMobile com EAS Build

## Pré-requisitos

1. Conta no Expo (https://expo.dev) — owner: `maikonrocha`
2. EAS CLI instalado: `npm install -g eas-cli`
3. Node.js 20+
4. Conectado à internet

---

## Passo a Passo: Gerar APK

### 1. Entrar na conta Expo
```bash
eas login
# Email: (sua conta Expo)
# Senha: (sua senha)
```

### 2. Instalar dependências
```bash
cd DevMobile  # pasta do projeto
npm install   # ou pnpm install
```

### 3. Gerar APK (perfil "preview")
```bash
eas build --platform android --profile preview
```

- O EAS vai subir o código para os servidores Expo
- A build demora ~10-20 minutos
- Ao final, aparece um link para baixar o `.apk`

### 4. Baixar e instalar no celular
- Acesse o link gerado (ou veja em https://expo.dev/accounts/maikonrocha/projects)
- Baixe o `.apk` no celular
- Habilite "Instalar de fontes desconhecidas" nas configurações
- Instale o APK

---

## Perfis de Build

| Perfil | Formato | Uso |
|--------|---------|-----|
| `preview` | APK | Testes no celular (recomendado) |
| `production` | AAB | Publicar na Play Store |
| `development` | APK | Desenvolvimento com DevClient |

---

## Configuração do Servidor (Opcional)

O DevMobile funciona **100% sem servidor** com:
- JavaScript local via Hermes Engine (`js> código`)
- SQLite local no celular (`sql> query`)
- Editor de código completo offline

Se quiser conectar um servidor para `npm install`, `node`, `python`:
1. Abra o app → ⚙️ Configurações
2. Seção "Servidor API"
3. Cole a URL do seu servidor (ex: VPS, Railway, Render)
4. Salvar e testar conexão

O app nunca ficará vinculado ao Replit — use qualquer servidor.

---

## Informações do Projeto

- **Package:** `com.devmobile.ide`
- **Expo Owner:** `maikonrocha`
- **Project ID:** `13df5db9-8f1a-421b-aadc-976799facd31`
- **SDK:** Expo 54
- **Versão:** 2.7.7 (versionCode: 42)
