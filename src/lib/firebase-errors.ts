/** 將 Firebase / Firestore 錯誤轉成可讀訊息 */
export function formatFirebaseError(err: unknown): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  const message = err instanceof Error ? err.message : String(err);

  if (code === "permission-denied" || message.includes("Missing or insufficient permissions")) {
    return (
      "Firestore 權限被拒（permission-denied）。" +
      "請到 Firebase Console → Firestore → 左上角選「chunhsindata」→ 安全性 → 貼上 firestore.rules → 發布。" +
      "規則必須套用在 chunhsindata，不是 (default)。"
    );
  }

  if (code === "not-found" || message.includes("NOT_FOUND")) {
    return (
      "找不到 Firestore 資料庫。請確認 .env.local 的 NEXT_PUBLIC_FIREBASE_DATABASE_ID=chunhsindata"
    );
  }

  if (message.includes("Firebase 設定不完整")) {
    return message;
  }

  return message || "載入失敗";
}
