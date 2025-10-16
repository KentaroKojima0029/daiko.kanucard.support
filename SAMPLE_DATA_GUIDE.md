# サンプルデータ利用ガイド

## 概要

PSA代行サービスのサンプルデータが作成されました。フロントエンド（https://daiko.kanucard.com）と管理者サイト（https://kanucard-daiko-support.onrender.com）の両方でこのデータを利用できます。

## サンプルデータの内容

### 顧客情報
- **氏名**: 山田太郎
- **メール**: sample.customer@example.com
- **電話**: 090-1234-5678
- **ユーザーID**: `718e7800-f34c-46eb-b24e-001431adee92`

### 申込情報
- **申込ID**: `fb61c559-fa20-497c-a0ba-84c553f7a0b9`
- **プラン**: アメリカ・ノーマル
- **ステータス**: 進行中
- **総申告価格**: ¥110,000
- **予想鑑定料**: ¥12,000

### カード情報（3種類、計4枚）
1. **ピカチュウ VMAX CSR**
   - 数量: 1枚
   - 申告価格: ¥50,000
   - 取得価格: ¥45,000

2. **リザードン V SSR**
   - 数量: 1枚
   - 申告価格: ¥30,000
   - 取得価格: ¥28,000

3. **ミュウツー GX**
   - 数量: 2枚
   - 申告価格: ¥15,000
   - 取得価格: ¥13,000

### 進捗状況（6ステップ管理）
- ✅ **ステップ1: 申込受付** - 完了
- ✅ **ステップ2: カード受領・検品** - 完了
- 🔄 **ステップ3: 代行料お支払い** - 進行中（現在ここ）
- ⏳ **ステップ4: PSA鑑定中** - 未実施
- ⏳ **ステップ5: 鑑定料お支払い** - 未実施
- ⏳ **ステップ6: 返送・完了** - 未実施

## フロントエンドでの利用方法

### 1. 進捗確認ページ（https://daiko.kanucard.com/status）

申込IDを使って進捗を確認できます。

**API呼び出し例:**
```javascript
// 申込ID
const applicationId = 'fb61c559-fa20-497c-a0ba-84c553f7a0b9';

// 進捗情報を取得
async function checkProgress() {
    const response = await fetch(
        `https://kanucard-daiko-support.onrender.com/api/public/application/${applicationId}/progress`
    );
    const data = await response.json();

    if (data.success) {
        console.log('顧客名:', data.data.application.customerName);
        console.log('ステータス:', data.data.application.status);
        console.log('進捗ステップ:', data.data.steps);
    }
}

checkProgress();
```

**レスポンス例:**
```json
{
    "success": true,
    "data": {
        "application": {
            "id": "fb61c559-fa20-497c-a0ba-84c553f7a0b9",
            "status": "in_progress",
            "createdAt": "2025-10-14T10:03:00.000Z",
            "customerName": "山田太郎"
        },
        "planInfo": {
            "country": "usa",
            "planType": "normal"
        },
        "steps": {
            "step1": {
                "status": "completed",
                "date": "2025-10-14T10:03:00.000Z",
                "notes": "申込を受け付けました"
            },
            "step2": {
                "status": "completed",
                "date": "2025-10-14T10:03:01.000Z",
                "notes": "カード3種類、合計4枚を受領しました。状態確認完了。"
            },
            "step3": {
                "status": "current",
                "date": "2025-10-14T10:03:02.000Z",
                "notes": "代行料 ¥12,000 のお支払いをお待ちしております。"
            },
            "step4": {
                "status": "pending",
                "date": "2025-10-14T10:03:03.000Z",
                "notes": ""
            },
            "step5": {
                "status": "pending",
                "date": "2025-10-14T10:03:04.000Z",
                "notes": ""
            },
            "step6": {
                "status": "pending",
                "date": "2025-10-14T10:03:05.000Z",
                "notes": ""
            }
        }
    }
}
```

### 2. フォーム送信（https://daiko.kanucard.com/form）

フォームから新しい申込を送信すると、自動的にデータベースに保存されます。

**API呼び出し例:**
```javascript
async function submitForm(formData) {
    const response = await fetch(
        'https://kanucard-daiko-support.onrender.com/api/public/form-submit',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contactName: 'テスト太郎',
                contactEmail: 'test@example.com',
                contactBody: 'PSA鑑定をお願いします',
                plan: 'ノーマル アメリカ',
                items: [
                    {
                        itemName: 'ピカチュウ',
                        quantity: 1,
                        declaredValue: 10000,
                        acquisitionValue: 9000
                    }
                ],
                totalDeclaredValue: 10000,
                estimatedGradingFee: 3000
            })
        }
    );

    const data = await response.json();

    if (data.success) {
        console.log('申込ID:', data.data.applicationId);
        console.log('ユーザーID:', data.data.userId);
        // この申込IDで進捗確認が可能
    }
}
```

## 管理者サイトでの利用方法

### 管理者ダッシュボード
**URL**: https://kanucard-daiko-support.onrender.com

### 主な機能
1. **申込一覧**: 全ての申込を確認
   - `GET /api/applications`

2. **進捗管理**: 各ステップの更新
   - `PUT /api/progress/:applicationId/step/:stepId`

3. **メッセージ管理**: 顧客とのコミュニケーション
   - `GET /api/messages`
   - `POST /api/messages`

4. **統計情報**: ダッシュボード用の統計
   - `GET /api/statistics`

### 進捗更新の例
```javascript
// ステップ4を「進行中」に更新
async function updateStep4() {
    const response = await fetch(
        'https://kanucard-daiko-support.onrender.com/api/progress/fb61c559-fa20-497c-a0ba-84c553f7a0b9/step/step4',
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'current',
                notes: 'PSAに提出しました。鑑定開始予定日: 2025年11月1日'
            })
        }
    );

    const data = await response.json();
    console.log(data);
}
```

## データフロー図

```
┌─────────────────────────────────────────────────────────────┐
│              フロントエンド (daiko.kanucard.com)            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  /form                        /status                        │
│  フォーム送信                   進捗確認                      │
│     │                            │                           │
│     │ POST                       │ GET                       │
│     │                            │                           │
└─────┼────────────────────────────┼───────────────────────────┘
      │                            │
      ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│       バックエンドAPI (kanucard-daiko-support.onrender.com) │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  /api/public/form-submit    /api/public/application/:id/    │
│  (POST)                      progress (GET)                  │
│     │                            │                           │
│     │                            │                           │
│     ▼                            ▼                           │
│  ┌──────────────────────────────────────────┐               │
│  │      SQLite データベース (psa_system.db)  │               │
│  │  ・users (ユーザー)                       │               │
│  │  ・psa_requests (申込)                    │               │
│  │  ・cards (カード情報)                     │               │
│  │  ・progress_tracking (進捗)               │               │
│  │  ・messages (メッセージ)                  │               │
│  └──────────────────────────────────────────┘               │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ 管理者ダッシュボード │
                    │  (編集・更新)      │
                    └─────────────────┘
```

## 新しいファイル作成の必要性

**❌ 不要です！**

既存のシステムで完全に対応可能です：

1. **データベース**: SQLiteで一元管理（既存）
2. **API**: 公開APIで利用者・管理者の両方に対応（既存）
3. **認証**: 現在は認証なし（将来追加予定）

## サンプルデータの再作成

必要に応じて、いつでもサンプルデータを再作成できます：

```bash
cd /Users/ajitama/kanucard-daiko-support
node create-sample-data.js
```

## 本番環境（Render）への反映

### 1. GitHubにプッシュ
```bash
git add .
git commit -m "Add sample data creation script"
git push origin main
```

### 2. Renderで自動デプロイ
- プッシュ後、自動的にデプロイされます

### 3. 本番環境でサンプルデータ作成
Renderのコンソールで実行：
```bash
node create-sample-data.js
```

または、管理者ダッシュボードから手動でサンプルデータを作成することもできます。

## トラブルシューティング

### Q: サンプルデータが見つからない
**A**: `create-sample-data.js` を再実行してください

### Q: APIがエラーを返す
**A**: 申込IDが正しいか確認してください。また、CORSエラーの場合はサーバーのCORS設定を確認してください。

### Q: 進捗が更新されない
**A**: データベースの接続を確認してください。Renderの場合、ログを確認してください。

## 追加のサンプルデータ作成

さらにサンプルデータが必要な場合は、`create-sample-data.js` を参考に追加のスクリプトを作成できます。

---

**作成日**: 2025年10月14日
**最終更新**: サンプルデータ作成完了
