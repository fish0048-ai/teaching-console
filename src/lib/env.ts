export type AppEnv = "development" | "production";

export function getAppEnv(): AppEnv {
  const env = process.env.NEXT_PUBLIC_APP_ENV;
  return env === "production" ? "production" : "development";
}

export function isProduction(): boolean {
  return getAppEnv() === "production";
}

export function getFirebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(
      `Firebase 設定不完整，請檢查 .env.local：${missing.join(", ")}`,
    );
  }

  return config as Required<typeof config>;
}

/** Firestore 資料庫 ID（Console 顯示名稱，非 default 時必填） */
export function getFirestoreDatabaseId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "chunhsindata";
}
