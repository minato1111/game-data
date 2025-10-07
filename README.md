# Rise of Kingdoms スコアデータ管理システム

Rise of Kingdomsのスコアデータを整理、分析するためのWebアプリケーションです。

## 機能

### 1. データ一覧
- Master_Data.csvの全データを一覧表示
- 期間フィルター（直近7日、30日、全期間、カスタム期間）
- 表示件数の選択（50件、100件、200件、全件）
- 各項目での並び替え（昇順/降順）
- 名前・IDでの検索機能

### 2. 比較データ
- 期間を指定してプレイヤーの成長を比較
- Power増加量と成長率の表示
- ランキング形式での表示
- 検索・フィルター機能

### 3. 上位300人統計
- Power上位300人のデータをグラフで可視化
- 折れ線グラフ・棒グラフの切り替え
- 複数の指標から選択可能
  - Power
  - T4kill
  - T5kill
  - Total kill points
  - Dead Troops
  - Troops Power

### 4. 個人分析用
- 個別プレイヤーのデータ推移をグラフで表示
- 名前またはIDで検索
- 各指標の時系列変化を確認

### 5. KVKノルマ
- プレイヤーのKVKノルマ達成状況を確認
- 9/24から最新データまでの進捗表示
- Power帯別のノルマ基準に基づく達成率表示
- 撃破ノルマと戦死ノルマをメーター表示

### 6. 問い合わせ先
- Twitter: https://x.com/boo_vazi
- Discord: https://discord.gg/Tkh6eUw37x

## セットアップ

### 必要なファイル
1. `index.html` - メインHTMLファイル
2. `styles.css` - スタイルシート
3. `script.js` - JavaScript機能
4. `Master_Data.csv` - スコアデータ（必須）
5. `lJOc64cA_400x400.jpg` - アイコン画像

### Master_Data.csvの形式
CSVファイルは以下の列を含む必要があります：

```csv
no,date,id,name,power,alliance,t4kill,t5kill,totalkill,dead,troopspower
1,2024-09-24,12345,Player1,50000000,Alliance1,1000000,500000,1500000,10000,5000000
```

#### 列の説明
- `no`: 通し番号
- `date`: 日付（YYYY-MM-DD形式）
- `id`: プレイヤーID
- `name`: プレイヤー名
- `power`: Power値
- `alliance`: 同盟名
- `t4kill`: T4撃破数
- `t5kill`: T5撃破数
- `totalkill`: 総撃破ポイント
- `dead`: 戦死兵数
- `troopspower`: 兵力

## GitHubでの公開方法

### 1. リポジトリの作成
```bash
cd "C:\Users\tak12\Desktop\VSCode 保存フォルダ\99.作業用\ROK Data"
git init
git add .
git commit -m "Initial commit: ROK Data Management System"
```

### 2. GitHubにプッシュ
1. GitHubで新しいリポジトリを作成
2. 以下のコマンドを実行：

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 3. GitHub Pagesの設定
1. GitHubリポジトリの「Settings」を開く
2. 左サイドバーから「Pages」を選択
3. Source で「main」ブランチを選択
4. 「Save」をクリック
5. 数分後、`https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/` でアクセス可能

## 使用方法

### ローカルで使用する場合
1. すべてのファイルを同じフォルダに配置
2. `Master_Data.csv`を同じフォルダに配置
3. `index.html`をブラウザで開く

### Web上で使用する場合
1. GitHub Pagesで公開後、URLにアクセス
2. Master_Data.csvが正しく配置されていることを確認

## 注意事項
- CSVファイルは UTF-8 エンコーディングで保存してください
- 数値にカンマが含まれている場合も正しく処理されます
- ブラウザの開発者ツールでエラーが出る場合は、CSVファイルのパスを確認してください

## 技術スタック
- HTML5
- CSS3
- JavaScript (ES6+)
- Chart.js（グラフ描画）
- PapaParse（CSV解析）

## ライセンス
このプロジェクトはオープンソースです。

## サポート
問題や質問がある場合は、以下までお問い合わせください：
- Twitter: https://x.com/boo_vazi
- Discord: https://discord.gg/Tkh6eUw37x
