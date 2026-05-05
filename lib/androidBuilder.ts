import JSZip from "jszip";
import type { ProjectFile } from "./archiveApk";

export interface AppConfig {
  appName: string;
  appId: string;
  versionName: string;
  versionCode: number;
  themeColor: string;
  bgColor: string;
  orientation: "portrait" | "landscape" | "any";
  minSdk: number;
}

export const DEFAULT_CFG: AppConfig = {
  appName: "",
  appId: "",
  versionName: "1.0.0",
  versionCode: 1,
  themeColor: "#6366f1",
  bgColor: "#0f172a",
  orientation: "portrait",
  minSdk: 22,
};

export function selectWebFiles(files: ProjectFile[]): {
  files: ProjectFile[];
  fromSubfolder: string | null;
} {
  const strip = (prefix: string) =>
    files
      .filter((f) => {
        const p = f.path.startsWith("/") ? f.path.slice(1) : f.path;
        return (
          p.startsWith(prefix + "/") || p === prefix + "/index.html"
        );
      })
      .map((f) => ({
        ...f,
        path: (
          f.path.startsWith("/") ? f.path.slice(1) : f.path
        ).slice(prefix.length + 1),
      }));

  const distFiles = strip("dist");
  if (
    distFiles.some(
      (f) => f.path === "index.html" || f.path.endsWith("/index.html")
    )
  ) {
    return { files: distFiles, fromSubfolder: "dist" };
  }

  const buildFiles = strip("build");
  if (
    buildFiles.some(
      (f) => f.path === "index.html" || f.path.endsWith("/index.html")
    )
  ) {
    return { files: buildFiles, fromSubfolder: "build" };
  }

  const wwwFiles = strip("www");
  if (wwwFiles.some((f) => f.path === "index.html")) {
    return { files: wwwFiles, fromSubfolder: "www" };
  }

  return { files, fromSubfolder: null };
}

export async function buildAndroidZip(
  cfg: AppConfig,
  allFiles: ProjectFile[],
  source: string
): Promise<string> {
  const zip = new JSZip();
  const pkgParts = cfg.appId.split(".");
  const appNameSafe = cfg.appName.replace(/[^a-zA-Z0-9]/g, "");
  const screen =
    cfg.orientation === "portrait"
      ? "portrait"
      : cfg.orientation === "landscape"
      ? "landscape"
      : "unspecified";

  const { files, fromSubfolder } = selectWebFiles(allFiles);
  const hasIndexHtml = files.some(
    (f) =>
      f.path === "index.html" ||
      f.path.replace(/^\//, "") === "index.html"
  );

  zip.file(
    "README.md",
    `# ${cfg.appName} — Projeto Android (Pure WebView)\n` +
      `## Origem: ${source}\n` +
      (fromSubfolder ? `## Arquivos da pasta: ${fromSubfolder}/\n` : "") +
      `## Como compilar\n` +
      `### Opção 1 — GitHub Actions (automático, gratuito)\n` +
      `1. Faça push deste projeto para o GitHub\n` +
      `2. O workflow .github/workflows/build-apk.yml roda automaticamente\n` +
      `3. Baixe o APK em: Repositório → Actions → último build → Artifacts\n\n` +
      `### Opção 2 — Android Studio\n` +
      `1. Extraia este ZIP\n` +
      `2. Android Studio → File → Open → pasta android/\n` +
      `3. Build → Build APK(s)\n` +
      `4. APK: android/app/build/outputs/apk/debug/app-debug.apk\n\n` +
      `## Config\n` +
      `- Package: ${cfg.appId}\n` +
      `- Versão: ${cfg.versionName} (${cfg.versionCode})\n` +
      `- Android mínimo: ${cfg.minSdk}+\n` +
      `- Arquivos web: ${files.length}\n` +
      (hasIndexHtml
        ? ""
        : "\n⚠️ AVISO: index.html não encontrado nos arquivos importados!\n")
  );

  const android = zip.folder("android")!;

  android.file(
    "build.gradle",
    `buildscript {
    repositories { google(); mavenCentral() }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.2'
        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.10'
    }
}
allprojects { repositories { google(); mavenCentral() } }`
  );

  android.file(
    "settings.gradle",
    `rootProject.name = '${appNameSafe}'\ninclude ':app'`
  );

  android.file(
    "gradle.properties",
    "android.useAndroidX=true\nandroid.enableJetifier=true\norg.gradle.jvmargs=-Xmx2048m\nandroid.nonTransitiveRClass=false"
  );

  const app = android.folder("app")!;

  app.file(
    "build.gradle",
    `apply plugin: 'com.android.application'
apply plugin: 'kotlin-android'

android {
    namespace '${cfg.appId}'
    compileSdk 34
    defaultConfig {
        applicationId '${cfg.appId}'
        minSdk ${cfg.minSdk}
        targetSdk 34
        versionCode ${cfg.versionCode}
        versionName '${cfg.versionName}'
    }
    buildTypes {
        debug { debuggable true }
        release { minifyEnabled false }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = '17' }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.7.0'
    implementation 'androidx.webkit:webkit:1.11.0'
    implementation 'com.google.android.material:material:1.12.0'
    implementation 'androidx.coordinatorlayout:coordinatorlayout:1.2.0'
}`
  );

  const main = app.folder("src")!.folder("main")!;

  main.file(
    "AndroidManifest.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>
  <application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:theme="@style/AppTheme"
    android:usesCleartextTraffic="true"
    android:hardwareAccelerated="true">
    <activity
      android:name=".MainActivity"
      android:label="@string/app_name"
      android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
      android:screenOrientation="${screen}"
      android:launchMode="singleTask"
      android:theme="@style/AppTheme.NoActionBar"
      android:exported="true"
      android:windowSoftInputMode="adjustResize">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
  </application>
</manifest>`
  );

  const res = main.folder("res")!;

  res.folder("values")!.file(
    "strings.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="app_name">${cfg.appName}</string>
</resources>`
  );

  res.folder("values")!.file(
    "styles.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="AppTheme" parent="Theme.MaterialComponents.DayNight.DarkActionBar">
    <item name="colorPrimary">${cfg.themeColor}</item>
    <item name="colorPrimaryDark">${cfg.bgColor}</item>
    <item name="colorAccent">${cfg.themeColor}</item>
    <item name="android:windowBackground">${cfg.bgColor}</item>
  </style>
  <style name="AppTheme.NoActionBar" parent="AppTheme">
    <item name="windowActionBar">false</item>
    <item name="windowNoTitle">true</item>
    <item name="android:windowFullscreen">false</item>
    <item name="android:windowDrawsSystemBarBackgrounds">true</item>
    <item name="android:statusBarColor">${cfg.bgColor}</item>
    <item name="android:navigationBarColor">${cfg.bgColor}</item>
  </style>
</resources>`
  );

  let javaDir = main.folder("java")!;
  for (const part of pkgParts) javaDir = javaDir.folder(part)!;

  javaDir.file(
    "MainActivity.java",
    `package ${cfg.appId};

import android.annotation.SuppressLint;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.ConsoleMessage;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private static final String ASSET_HOST = "appassets.androidplatform.net";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        );

        webView = new WebView(this);
        webView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
        setContentView(webView);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .setDomain(ASSET_HOST)
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setSupportZoom(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setTextZoom(100);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (url.getHost() != null && url.getHost().equals(ASSET_HOST)) return false;
                try {
                    android.content.Intent intent = new android.content.Intent(
                        android.content.Intent.ACTION_VIEW, url);
                    startActivity(intent);
                } catch (Exception ignored) {}
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) { return true; }
        });

        webView.loadUrl("https://" + ASSET_HOST + "/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() { super.onPause(); if (webView != null) webView.onPause(); }

    @Override
    protected void onResume() { super.onResume(); if (webView != null) webView.onResume(); }

    @Override
    protected void onDestroy() { if (webView != null) { webView.destroy(); webView = null; } super.onDestroy(); }
}`
  );

  const assets = main.folder("assets")!;
  for (const f of files) {
    const cleanPath = f.path.startsWith("/") ? f.path.slice(1) : f.path;
    if (cleanPath) assets.file(cleanPath, f.data, { base64: true });
  }

  const apkName = cfg.appName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const ghWorkflows = zip.folder(".github")!.folder("workflows")!;
  ghWorkflows.file(
    "build-apk.yml",
    `name: 🤖 Build APK — ${cfg.appName}

on:
  push:
    branches: [main, master]
  workflow_dispatch:

jobs:
  build:
    name: Build Debug APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Java 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Cache Gradle
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: gradle-\${{ runner.os }}-\${{ hashFiles('android/**/*.gradle*') }}

      - name: Install Gradle 8.4
        run: |
          wget -q https://services.gradle.org/distributions/gradle-8.4-bin.zip
          unzip -q gradle-8.4-bin.zip -d /opt/gradle
          echo "/opt/gradle/gradle-8.4/bin" >> $GITHUB_PATH

      - name: Build Debug APK
        working-directory: android
        run: gradle assembleDebug --no-daemon --stacktrace

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: ${apkName}-debug
          path: android/app/build/outputs/apk/debug/app-debug.apk
          retention-days: 30
`
  );

  const gradleWrapper = android.folder("gradle")!.folder("wrapper")!;
  gradleWrapper.file(
    "gradle-wrapper.properties",
    `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.4-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists`
  );

  return zip.generateAsync({
    type: "base64",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
