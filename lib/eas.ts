const GQL = "https://api.expo.dev/graphql";

async function gql<T = unknown>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "expo-client-info": '{"appVersion":"14.4.2","appName":"eas-cli"}',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

export interface EasUser {
  id: string;
  username: string;
  primaryAccount: { id: string; name: string };
}

export async function easGetMe(token: string): Promise<EasUser> {
  const data = await gql<{ me: EasUser }>(
    token,
    `query Me { me { id username primaryAccount { id name } } }`
  );
  if (!data?.me) throw new Error("Token inválido ou sem permissão");
  return data.me;
}

export interface EasApp {
  id: string;
  slug: string;
  name: string;
  fullName: string;
}

export async function easEnsureApp(
  token: string,
  accountName: string,
  slug: string,
  name: string
): Promise<EasApp> {
  try {
    const data = await gql<{ app: { byFullName: EasApp } }>(
      token,
      `query GetApp($name: String!) { app { byFullName(fullName: $name) { id slug name fullName } } }`,
      { name: `${accountName}/${slug}` }
    );
    if (data?.app?.byFullName?.id) return data.app.byFullName;
  } catch {}

  const data = await gql<{ app: { createApp: EasApp } }>(
    token,
    `mutation CreateApp($input: AppInput!) {
       app { createApp(appInput: $input) { id slug name fullName } }
     }`,
    { input: { accountName, projectName: slug } }
  );
  return data.app.createApp;
}

export interface UploadUrl {
  url: string;
  headers: Array<{ key: string; value: string }>;
  bucketKey: string;
}

export async function easGetUploadUrl(token: string): Promise<UploadUrl> {
  const data = await gql<{ buildJob: { getUploadUrl: UploadUrl } }>(
    token,
    `mutation GetUploadUrl { buildJob { getUploadUrl(platform: ANDROID) { url headers { key value } bucketKey } } }`
  );
  return data.buildJob.getUploadUrl;
}

export async function easUploadTarball(
  uploadUrl: UploadUrl,
  base64Zip: string
): Promise<void> {
  const binary = Uint8Array.from(atob(base64Zip), (c) => c.charCodeAt(0));
  const headers: Record<string, string> = { "Content-Type": "application/zip" };
  for (const h of uploadUrl.headers) headers[h.key] = h.value;
  const res = await fetch(uploadUrl.url, { method: "PUT", headers, body: binary });
  if (!res.ok) throw new Error(`Upload falhou: HTTP ${res.status}`);
}

export interface EasBuild {
  id: string;
  status: string;
  artifacts?: { buildUrl?: string } | null;
  expirationDate?: string | null;
  updatedAt?: string | null;
}

export async function easCreateBuild(
  token: string,
  appId: string,
  bucketKey: string,
  cfg: { appId: string; versionName: string; versionCode: number; minSdk: number }
): Promise<EasBuild> {
  const data = await gql<{ buildJob: { createAndroidBuild: { build: EasBuild } } }>(
    token,
    `mutation CreateBuild($appId: String!, $job: BuildJobInput!) {
       buildJob {
         createAndroidBuild(appId: $appId, job: $job) {
           build { id status artifacts { buildUrl } }
         }
       }
     }`,
    {
      appId,
      job: {
        platform: "ANDROID",
        artifactPath: "android/app/build/outputs/apk/**/*.apk",
        projectArchive: { type: "S3", bucketKey },
        projectRootDirectory: ".",
        builderEnvironment: { image: "default" },
        cache: { clear: false },
        secrets: {},
        gradleCommand: ":app:assembleDebug",
        releaseChannel: "default",
        buildType: "apk",
        applicationArchivePath:
          "android/app/build/outputs/apk/debug/app-debug.apk",
      },
    }
  );
  return data.buildJob.createAndroidBuild.build;
}

export async function easGetBuild(
  token: string,
  buildId: string
): Promise<EasBuild> {
  const data = await gql<{ builds: { byId: EasBuild } }>(
    token,
    `query GetBuild($id: ID!) {
       builds { byId(buildId: $id) { id status artifacts { buildUrl } updatedAt } }
     }`,
    { id: buildId }
  );
  return data.builds.byId;
}
