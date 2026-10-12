# digi-allure（お色気デジモン図鑑）

非公式ファンサイト。方針・スキーマ・ロードマップは [docs/HANDOVER.md](docs/HANDOVER.md) を参照。

## 構成

| パス | 内容 |
|---|---|
| `data/digimon_ts_master.csv` | 判定用マスター（タイムストレンジャー登場 465 件） |
| `tools/judge.html` | 掲載判定ツール。ブラウザで直接開く |
| `scripts/fetch_official_index.py` | 公式図鑑一覧の「名前 ↔ directory_name」だけを取得（`work/` に出力、Git 管理外） |
| `scripts/match_directory_name.py` | マスターの `directory_name` を名前照合で埋める。手動対応は `MANUAL` に追記 |

## 公開サイト

Cloudflare Pages（`site/`）＋ Pages Functions（`functions/api/`）＋ D1。

| 画面 | 内容 |
|---|---|
| `#/` | 図鑑一覧（世代・公式タイプ・ファンタグで絞り込み、図鑑No.順／人気順） |
| `#/d/{id}` | 詳細（事実情報・管理人コメント・ファンタグ付け・公式図鑑リンク） |
| `#/vote` | 2択投票（Elo, K=32。片方は対戦数の少ない個体から選ぶ） |
| `#/ranking` | 月間人気投票（日本時間の暦月ごとにリセット）。`#/ranking/all` で通算、`#/ranking/YYYY-MM` で過去月の確定結果 |
| `#/request` | 未掲載デジモンの掲載リクエスト（推しコメントは管理人のみ閲覧） |
| `#/types` | 公式タイプ／属性／ファンタグから探す |

| API | 内容 |
|---|---|
| `GET /api/pair` | 対戦カード（署名トークン付き。配ったペア以外には投票できない） |
| `POST /api/vote` | 投票。同じ人・同じペアは1日1回、1分30票まで |
| `GET /api/ranking?month=current\|YYYY-MM` / `?scope=` | 月間／通算ランキング（1票が通算と今月の両方に入る） |
| `GET/POST /api/requests` | リクエスト集計・送信。同じ人・同じデジモンは1日1回、1時間10件まで |
| `GET /api/tags`, `GET/POST /api/tags/{id}` | タグ一覧・付ける／外す |

公開判定は `status = 'approved'` のみ。画像は公式図鑑の画像を直リンク表示（保存しない・出典ラベル付き）。`scripts/build_data.py` の `OFFICIAL_IMAGES = False` で属性色のカード枠に戻せる。CSVに `image_url` と `image_source` を入れた個体はそちらを優先（AI生成は自動でラベル表示）。

リクエストのコメント確認: `npx wrangler d1 execute digi-allure --remote --command "SELECT d.name_ja, r.comment, r.created_at FROM requests r JOIN digimon d ON d.id = r.digimon_id ORDER BY r.created_at DESC LIMIT 50"`

### ローカルで動かす

```sh
python3 -I -X utf8 scripts/build_data.py          # CSV → site/data/digimon.json, db/seed.sql
printf 'VOTE_SECRET=%s\n' "$(openssl rand -hex 32)" > .dev.vars
npx wrangler d1 execute digi-allure --local --file db/schema.sql
npx wrangler d1 execute digi-allure --local --file db/seed.sql
npx wrangler pages dev --port 8788                 # http://127.0.0.1:8788
```

### 本番デプロイ（未実施）

```sh
npx wrangler d1 create digi-allure                 # 出力された database_id を wrangler.toml に書く
npx wrangler d1 execute digi-allure --remote --file db/schema.sql
npx wrangler d1 execute digi-allure --remote --file db/seed.sql
npx wrangler pages project create digi-allure
npx wrangler pages secret put VOTE_SECRET --project-name digi-allure
npx wrangler pages deploy
```

判定を変えたら `build_data.py` → `seed.sql` を再投入（レーティングは保持される）→ 再デプロイ。

## 判定の流れ

1. `tools/judge.html` をブラウザで開き、`data/digimon_ts_master.csv` をドロップ
2. `A` 承認 / `X` 除外 / `U` 未判定 / `J`・`K` 移動。途中経過は localStorage に自動保存
3. 名前・タイプで明らかに対象外のものは、絞り込み → 「表示中を一括除外」で先に落とすと楽
4. 「CSV書き出し」→ `data/digimon_ts_master.csv` を上書きしてコミット

公式画像は `https://digimon.net/cimages/digimon/{directory_name}.jpg` をホットリンク表示するだけで、保存はしない。

## directory_name の照合メモ

- 公式に個別ページがない形態は近いIDを入れて `note` に「要確認」を記載（ケレスモンメディウム、バッカスモンDM、マグナガルルモン（分離））
- 「超究極体」はゲーム独自の世代。公式では究極体のため `note` に `公式世代=` を記録
