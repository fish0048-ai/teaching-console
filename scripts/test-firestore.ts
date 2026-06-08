/**
 * Firebase 連線診斷（本機執行）
 * npm run test:firebase
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

config({ path: resolve(process.cwd(), ".env.import") });
config({ path: resolve(process.cwd(), ".env.local") });

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "chunhsin-b2a9d";

const dbId =
  process.env.FIREBASE_DATABASE_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID ||
  "chunhsindata";

async function tryDatabase(name: string) {
  const db = getFirestore(getApp(), name);
  const groups = await db.collection("groups").limit(3).get();
  return { name, groupCount: groups.size, ids: groups.docs.map((d) => d.id) };
}

async function main() {
  console.log("=== Firebase 診斷 ===");
  console.log("Project ID:", projectId);
  console.log("Database ID (設定):", dbId);

  const keyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    resolve(process.cwd(), "scripts/service-account.json");

  if (getApps().length === 0) {
    initializeApp({ credential: cert(keyPath), projectId });
  }

  for (const name of [dbId, "(default)", "chunhsindata"]) {
    try {
      const r = await tryDatabase(name);
      console.log(`\n✓ 資料庫「${r.name}」可連線`);
      console.log(`  groups 數量: ${r.groupCount}`, r.ids.length ? `→ ${r.ids.join(", ")}` : "(空)");
      if (r.groupCount > 0) {
        const gid = r.ids[0]!;
        const students = await getFirestore(getApp(), name)
          .collection("groups")
          .doc(gid)
          .collection("students")
          .limit(5)
          .get();
        console.log(`  學生範例 (${gid}):`, students.docs.map((d) => d.data().name).join(", ") || "(空)");
      }
    } catch (err) {
      console.log(`\n✗ 資料庫「${name}」失敗:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\n--- 前端 .env.local 檢查 ---");
  const keys = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_DATABASE_ID",
  ] as const;
  for (const k of keys) {
    const v = process.env[k];
    console.log(`${k}: ${v ? (k.includes("KEY") ? v.slice(0, 8) + "..." : v) : "❌ 未設定"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
