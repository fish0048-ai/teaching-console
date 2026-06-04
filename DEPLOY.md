# Vercel 線上部署指南

## 一、推送 GitHub

在 `f:\location\teaching-console` 執行：

```powershell
git add .
git commit -m "feat: Firebase B 路線主控台初版"
```

到 https://github.com/new 建立 repo **teaching-console**（Private 建議），然後：

```powershell
git remote add origin https://github.com/你的帳號/teaching-console.git
git push -u origin master
```

若 `master` 推送失敗，可改 `main`：

```powershell
git branch -M main
git push -u origin main
```

---

## 二、Vercel 匯入專案

1. 開啟 https://vercel.com/new  
2. **Import Git Repository** → 選 `teaching-console`  
3. Framework Preset：**Next.js**（自動偵測）  
4. Root Directory：`.`（預設即可）  
5. **先不要按 Deploy** → 展開 **Environment Variables**

---

## 三、設定環境變數（Production + Preview 都加）

從本機 `.env.local` 複製以下變數到 Vercel：

| 變數名稱 | 說明 |
|---------|------|
| `NEXT_PUBLIC_APP_ENV` | Production 填 `production`，Preview 可填 `development` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `chunhsin-b2a9d.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `chunhsin-b2a9d` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `chunhsin-b2a9d.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 數字 ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Web App ID |
| `NEXT_PUBLIC_FIREBASE_DATABASE_ID` | `chunhsindata` |

**不要**上傳 `service-account.json` 或 `.env.import`（僅本機匯入用）。

---

## 四、部署

按 **Deploy**，約 1～2 分鐘後會得到：

```
https://teaching-console-xxx.vercel.app
```

---

## 五、部署後檢查

1. 開啟 `/seating` → 應看到 Firestore 學生名單  
2. 開啟 `/` 儀表板 → 顯示分組／題數統計  
3. 左側應顯示 **PROD · Firebase** 或 **DEV · Firebase**（依 `NEXT_PUBLIC_APP_ENV`）

若空白或報錯：

- 確認 Vercel 八個 `NEXT_PUBLIC_*` 都已設定  
- 確認 `DATABASE_ID` 是 `chunhsindata`（不是 App ID）  
- Firebase Console → Firestore **安全性** 規則已發布且允許 read  

---

## 六、Firebase 授權網域（選用）

若之後啟用 Firebase Auth，到：

**Firebase Console → 建置 → Authentication → Settings → Authorized domains**

加入：`你的專案.vercel.app`

目前僅 Firestore 讀取，通常不必設定。

---

## 七、後續更新流程

```powershell
git add .
git commit -m "更新說明"
git push
```

Vercel 會自動重新部署（Preview 與 Production）。
