# 教學主控台（B 路線 · 開發版）

Next.js + Firebase + Vercel + GitHub。  
**與 GAS 穩定版（Google 協作平台）完全隔離**，不讀寫既有試算表。

Firebase 專案：`chunhsin-b2a9d`

---

## 目錄結構

```
teaching-console/
├── .env.example              # 前端 Firebase 設定範本
├── .env.import.example       # 匯入腳本設定範本
├── firestore.rules
├── scripts/
│   ├── import-to-firestore.ts
│   └── sample-data/import.json
└── src/
    ├── app/                  # App Router 頁面
    ├── components/           # UI 元件
    ├── hooks/                # useStudents, useAsyncQuery
    ├── lib/
    │   ├── firebase.ts       # Client SDK 初始化
    │   └── env.ts
    ├── services/             # Firestore 資料邏輯（只讀）
    └── types/                # 型別定義
```

---

## 快速開始

### 1. 環境變數

```bash
cp .env.example .env.local
# 到 Firebase Console → 專案設定 → 一般 → 您的應用程式 → 設定
# 複製 Web API Key、App ID 等填入 .env.local
```

### 2. 部署 Firestore 規則（可選）

```bash
firebase deploy --only firestore:rules
```

或在 Console 貼上 `firestore.rules` 內容。

### 3. 匯入測試資料

```bash
cp .env.import.example .env.import
# 下載服務帳戶 JSON → scripts/service-account.json

npm run import:firestore
```

### 4. 啟動本機

```bash
npm run dev
```

開啟 http://localhost:3000 → **座位表** 可看到 Firestore 學生名單。

---

## GitHub 獨立 Repo

```bash
cd f:\location\teaching-console
git remote add origin https://github.com/你的帳號/teaching-console.git
git push -u origin master
```

Vercel：Import 此 repo，設定 Production 環境變數（`NEXT_PUBLIC_*`）。

---

## 與 A 版（穩定版）的隔離

| 項目 | A 版 | B 版（本專案） |
|------|------|----------------|
| 後端 | GAS + Sheets | Firebase Firestore |
| 程式 | `f:\location\apps-script` | `f:\location\teaching-console` |
| 部署 | clasp / 協作平台 | GitHub → Vercel |
| 資料 | 試算表 ID | Firestore 集合 |

匯入腳本僅讀取本機 JSON，**不呼叫 GAS、不修改試算表**。

---

## 後續擴充（尚未實作）

- [ ] 加分寫入 Firestore
- [ ] Auth 登入（教師帳號）
- [ ] 題庫 Word 匯入 → Firestore
- [ ] prod Firebase 專案 + Vercel Production
