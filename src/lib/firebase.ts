import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseConfig, getFirestoreDatabaseId } from "./env";

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

/** 瀏覽器端 Firestore 單例（Client SDK） */
export function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("getFirebaseApp() 僅能在 Client Component 使用");
  }
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(getFirebaseConfig());
  }
  return app;
}

export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp(), getFirestoreDatabaseId());
  }
  return db;
}
