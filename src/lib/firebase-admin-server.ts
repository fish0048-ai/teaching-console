import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";

function resolveCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    return cert(JSON.parse(json) as Parameters<typeof cert>[0]);
  }

  const keyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    resolve(process.cwd(), "scripts/service-account.json");

  if (!existsSync(keyPath)) {
    throw new Error(
      "找不到 Firebase 服務帳戶金鑰。請設定 GOOGLE_APPLICATION_CREDENTIALS 或 FIREBASE_SERVICE_ACCOUNT_JSON",
    );
  }

  return cert(keyPath);
}

export function getAdminFirestore(): { db: Firestore; databaseId: string } {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("缺少 FIREBASE_PROJECT_ID");
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: resolveCredential(),
      projectId,
    });
  }

  const databaseId =
    process.env.FIREBASE_DATABASE_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID ||
    "chunhsindata";

  return { db: getFirestore(getApp(), databaseId), databaseId };
}
