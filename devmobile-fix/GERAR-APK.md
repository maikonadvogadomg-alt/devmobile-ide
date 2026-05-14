# Como gerar o APK do DevMobile (instalar no celular sem Expo Go)

## O que você precisa
- Computador ou notebook com internet
- Conta gratuita no Expo (expo.dev)
- Node.js instalado (nodejs.org)

---

## Passo a passo

### 1. Crie sua conta gratuita no Expo
Acesse https://expo.dev e clique em **Sign Up** (é grátis).

### 2. Instale o EAS CLI no computador
Abra o terminal (Prompt de Comando ou PowerShell no Windows) e rode:
```
npm install -g eas-cli
```

### 3. Entre na sua conta Expo
```
eas login
```
Digite seu e-mail e senha do expo.dev.

### 4. Vá até a pasta do DevMobile
```
cd DevMobile-CORRIGIDO
```
(ou onde você descompactou o ZIP)

### 5. Gere o APK na nuvem (GRÁTIS)
```
eas build --platform android --profile preview
```

Responda as perguntas:
- "Would you like to automatically create an EAS project?" → **Y**
- "Generate a new Android Keystore?" → **Y**

O processo leva uns **15 a 20 minutos** na nuvem da Expo.

### 6. Baixe e instale o APK
Quando terminar, o terminal vai mostrar um link para baixar o `.apk`.
Transfira o arquivo para o celular e instale.

> No Android: Configurações → Segurança → Permitir fontes desconhecidas

---

## Plano gratuito da Expo
- 30 builds por mês gratuitamente
- APK gerado na nuvem sem precisar instalar Android Studio
- Não precisa do Replit para nada

---

## Dúvidas?
O APK gerado é um app real, independente, sem precisar de Expo Go nem Replit.
Funciona igual qualquer app instalado da Play Store.
