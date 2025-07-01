# 顧客管理システム

Google Drive APIと連携した、ブラウザベースの顧客管理システムです。

## 機能

- 📒 連絡先管理（基本情報、分類、詳細情報、契約情報）
- 🗓️ ミーティング記録（Markdown対応、ToDo管理）
- 📁 ファイル管理（顔写真、名刺、添付ファイル）
- 🔍 検索・フィルタリング機能
- 📊 カード／リスト表示切替
- 🔄 インポート／エクスポート機能
- 🌙 ダークモードデザイン
- 📱 レスポンシブ対応

## フォルダ構成

```
顧客管理システム/
├── index.html          # メインHTML
├── js/                 # JavaScriptモジュール
│   ├── auth.js        # 認証・Google API管理
│   ├── contacts.js    # 連絡先管理
│   ├── meetings.js    # ミーティング管理
│   ├── drive.js       # Google Drive操作
│   ├── ui.js          # UI制御
│   └── utils.js       # ユーティリティ関数
└── README.md          # このファイル
```

## セットアップ手順

### 1. Google Cloud Consoleでのプロジェクト設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成
3. 以下のAPIを有効化：
   - Google Drive API
   - Google Identity Services

### 2. OAuth 2.0クライアントIDの作成

1. 「APIとサービス」→「認証情報」へ移動
2. 「認証情報を作成」→「OAuth クライアント ID」を選択
3. アプリケーションの種類：「ウェブアプリケーション」を選択
4. 承認済みのJavaScriptオリジンに以下を追加：
   - `http://localhost:8000`（ローカル開発用）
   - `https://[あなたのGitHubユーザー名].github.io`（本番用）
5. クライアントIDをコピー

### 3. APIキーの作成

1. 「認証情報を作成」→「APIキー」を選択
2. APIキーをコピー
3. 必要に応じてキーの制限を設定

### 4. コードの設定

`js/auth.js`の以下の部分を更新：

```javascript
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com'; // 取得したクライアントID
const API_KEY = 'YOUR_API_KEY'; // 取得したAPIキー
```

### 5. GitHub Pagesへのデプロイ

1. GitHubで新しいリポジトリを作成
2. ファイルをアップロード：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/[ユーザー名]/[リポジトリ名].git
   git push -u origin main
   ```
3. Settings → Pages → Source で「Deploy from a branch」を選択
4. Branch: main、Folder: / (root) を選択して Save
5. 数分後、`https://[ユーザー名].github.io/[リポジトリ名]/`でアクセス可能

### 6. ローカル開発

ローカルで開発する場合は、HTTPSサーバーが必要です：

```bash
# Python 3の場合
python -m http.server 8000

# Node.jsの場合（http-serverをインストール）
npm install -g http-server
http-server -p 8000
```

## 使い方

1. 「Googleでログイン」ボタンをクリックして認証
2. 初回ログイン時に自動的にDrive上にフォルダとファイルが作成されます
3. 「新規登録」から連絡先を追加
4. 各連絡先をクリックして詳細編集やミーティング記録を追加

## データ構造

### contacts.json
```json
[
  {
    "id": "contact_xxx",
    "name": "山田太郎",
    "company": "株式会社サンプル",
    "email": "yamada@example.com",
    "types": ["見込み客"],
    "affiliations": ["東京"],
    "contractStatus": "prospecting",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### meetings.json
```json
[
  {
    "id": "meeting_xxx",
    "contactId": "contact_xxx",
    "date": "2024-01-01T10:00",
    "content": "## 議題\n- サービス説明",
    "todos": [
      {
        "done": false,
        "text": "資料送付",
        "due": "2024-01-05"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### options.json
```json
{
  "types": ["見込み客", "既存顧客", "パートナー", "サプライヤー"],
  "affiliations": ["東京", "大阪", "名古屋", "福岡", "その他"],
  "contractStatuses": ["商談中", "契約", "失注"]
}
```

## セキュリティ上の注意

- CLIENT_IDとAPI_KEYは公開リポジトリにコミットしないでください
- 本番環境では、APIキーに適切な制限（HTTPリファラーなど）を設定してください
- Google Drive APIのスコープは必要最小限に設定しています

## トラブルシューティング

### ログインできない
- CLIENT_IDが正しく設定されているか確認
- 承認済みのJavaScriptオリジンにURLが追加されているか確認

### データが保存されない
- Google Drive APIが有効になっているか確認
- ブラウザのコンソールでエラーを確認

### ファイルアップロードができない
- ファイルサイズが大きすぎないか確認（推奨: 10MB以下）
- ネットワーク接続を確認

## ライセンス

MIT License