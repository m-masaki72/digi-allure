# digi-allure（デジアリュール — 選ばれし魅惑のデジモン図鑑）

非公式ファンサイト。方針・スキーマ・ロードマップは [docs/HANDOVER.md](docs/HANDOVER.md) を参照。

## 構成

| パス | 内容 |
|---|---|
| `data/digimon_ts_master.csv` | 判定用マスター（タイムストレンジャー登場 465 件） |
| `tools/judge.html` | 掲載判定ツール。ブラウザで直接開く |
| `tools/og.html` | OGP 画像 `site/og.png` の元（Chrome で 1200x630 に撮る。公式画像は使わない） |
| `scripts/build_data.py` | マスター → `site/data/*.json`・`db/seed.sql` を生成 |
| `scripts/set_status.py` | 図鑑No.指定で `status` を書き換える |
| `scripts/oneoff/fetch_official_index.py` | 公式図鑑一覧の「名前 ↔ directory_name」だけを取得（`work/` に出力、Git 管理外） |
| `scripts/oneoff/match_directory_name.py` | マスターの `directory_name` を名前照合で埋める。手動対応は `MANUAL` に追記 |
| `scripts/oneoff/check_web_mentions.py` | ネットで名前が挙がったデジモンとマスターの登場有無・判定状態を突き合わせる（調査用） |

`scripts/oneoff/` は初期データ整備・調査用の単発スクリプトで、定常運用では使わない。

## 公開サイト

Cloudflare Pages（`site/`）＋ Pages Functions（`functions/api/`）＋ D1。

| 画面 | 内容 |
|---|---|
| `#/` | トップ（今月1位または今日の一体、目的別の入口（推し診断・系統・ランキング）、人気投票（今月の投票が10人分未満なら投票の呼びかけと上位3体）、ピックアップ、系統タイル） |
| `#/list`, `#/list/{系統}` | 図鑑一覧（系統・世代・公式タイプ・ファンタグで絞り込み、図鑑No.順／人気順）。ヘッダーの検索窓もここを開く |
| `#/d/{id}` | 詳細（画像の下に推し診断への導線と入手方法、事実情報・管理人コメント・ファンタグ付け・外部リンク（公式図鑑・Game8・pixiv・X）・同じ系統の子） |
| `#/my` | 推し診断の結果（最後に終えた診断の Top5 と、ランキングに入ったかをブラウザの localStorage にだけ保存して表示。スクリーンショットしやすい1枚のカードにまとめ、X には Top5 を本文に入れてシェアする。OGP 画像はサイト共通の `site/og.png`） |
| `#/top5/{id,...}` | シェアされた Top5 の表示 |
| `#/vote` | 推し診断（参考: funny-ai.com のソート。公開中の全員をランダムに並べた4分木の勝ち抜きで、4体から1体を選ぶのをくり返す。1位が決まるとその子を抜いて同じ枝だけ選び直し、5位まで決める。葉の組には3体以上をならして入れ、1問目が2択にならないようにする。58体なら最大33回。「1つ戻る」で取り消せる。途中経過は localStorage に保存して24時間以内なら投票つきで再開できる。終わると Top5 を1回だけ `POST /api/vote` に送り、`#/my` へ移る。`/api/sort` に届かないとき（通信エラー・プレビュー環境）は端末で並べ、投票なしで遊べる。木の処理は `site/js/sort.js` で、サーバーも同じものを使う） |
| `#/ranking` | 月間人気投票（日本時間の暦月ごとにリセット。推し診断の Top5 の得点の合計で並べる）。`#/ranking/all` で通算、`#/ranking/YYYY-MM` で過去月の確定結果 |
| `#/request` | 未掲載デジモンの掲載リクエスト（推しコメントは管理人のみ閲覧） |
| `#/types` | 系統／公式タイプ／属性／ファンタグから探す |

系統は `scripts/build_data.py` の `LINEAGES` で公式タイプからまとめたファン向けの分類（例：天使型・聖獣型 → 天使・聖獣）。CSV に `lineage` 列があり値が入っていれば、その個体だけ上書きする。どの系統にも入らない公開個体は「その他」になり、`build_data.py` が警告を出す。

| API | 内容 |
|---|---|
| `GET /api/sort` | 推し診断の並び順（公開中の全員をランダムに並べたもの、署名トークン付き・有効24時間） |
| `POST /api/vote` | 推し診断の結果の投票。`{ scope, ids, exp, token, history }` を受け、`history`（診断で選んだ子のすべて）をサーバーで再生して、最後まで終えた診断の Top5 に 1位10点・2位5点・3位3点・4位2点・5位1点を入れる（`top5_votes`）。配った並び1つにつき1回、IPあたり1分3回・1日20回まで |
| `GET /api/ranking?month=current\|YYYY-MM` / `?scope=` | 月間／通算ランキング（得点・1位の回数・Top5 入りの回数と、投票の人数 `votes`。1回の投票が通算と今月の両方に入る） |
| `GET/POST /api/requests` | リクエスト集計・送信。同じ回線（IP）・同じデジモンは1日1回、IPあたり1時間10件まで |
| `GET /api/tags`, `GET/POST /api/tags/{id}` | タグ一覧・付ける／外す。同じ回線（IP）・同じタグは1日1回、付ける・外す操作はIPあたり1分60件・1日300件まで |

投票者の識別は日本時間の日替わりソルト（`VOTE_SECRET` から HMAC で導出）のハッシュのみ（生IPは保存しない。IPv6 は /64 単位）。ソルトは日付から決まるので、`VOTE_SECRET` と DB の両方を持つ人は IPv4 を総当たりして元の IP を割り出せる（匿名化ではなく仮名化）。`voter_hash`（IP+UA）は「自分が付けたタグ」の判定、`ip_hash`（IPのみ）は不正対策の集計に使う。IPを大量に用意する相手は防げない（許容）。

公開判定は `status = 'approved'` のみ。画像は公式図鑑の画像を直リンク表示（保存しない・出典ラベル付き）。`scripts/build_data.py` の `OFFICIAL_IMAGES = False` で属性色のカード枠に戻せる。CSVに `image_url` と `image_source` を入れた個体はそちらを優先（AI生成は自動でラベル表示）。

リクエストのコメント確認: `npx wrangler d1 execute digi-allure --remote --command "SELECT d.name_ja, r.comment, r.created_at FROM requests r JOIN digimon d ON d.id = r.digimon_id ORDER BY r.created_at DESC LIMIT 50"`

### ローカルで動かす

```sh
python3 -I -X utf8 scripts/build_data.py          # CSV → site/data/digimon.json, db/seed.sql
printf 'VOTE_SECRET=%s\n' "$(openssl rand -hex 32)" > .dev.vars
npx wrangler d1 migrations apply digi-allure --local
npx wrangler d1 execute digi-allure --local --file db/seed.sql
npx wrangler pages dev --port 8788                 # http://127.0.0.1:8788
```

### 本番デプロイ

```sh
npx wrangler d1 create digi-allure                 # 出力された database_id を wrangler.toml に書く
npx wrangler d1 migrations apply digi-allure --remote
npx wrangler d1 execute digi-allure --remote --file db/seed.sql
npx wrangler pages project create digi-allure
npx wrangler pages secret put VOTE_SECRET --project-name digi-allure
npx wrangler pages deploy
```

判定を変えたら `build_data.py` → `seed.sql` を再投入（票は保持される）→ 再デプロイ。

スキーマは `db/migrations/`（wrangler の D1 マイグレーション）で管理する。変更は `npx wrangler d1 migrations create digi-allure <名前>` で新しいファイルを作って書き、`migrations apply --local` で確かめてから `--remote` で適用する（デプロイより先に）。適用済みかどうかは D1 の `d1_migrations` テーブルに記録される。適用済みのファイルは書き換えない。古いローカル DB は `.wrangler/state` を消して作り直す。

### テスト

```sh
node --test 'test/*.test.mjs'                                           # functions/_lib/api.js の純粋関数
python3 -I -X utf8 -m unittest discover -s scripts/tests -t scripts     # build_data / set_status
```

## 判定の流れ

1. `tools/judge.html` をブラウザで開き、`data/digimon_ts_master.csv` をドロップ
2. `A` 承認 / `X` 除外 / `U` 未判定 / `J`・`K` 移動。途中経過は localStorage に自動保存
3. 名前・タイプで明らかに対象外のものは、絞り込み → 「表示中を一括除外」で先に落とすと楽
4. 「CSV書き出し」→ `data/digimon_ts_master.csv` を上書きしてコミット

公式画像は `https://digimon.net/cimages/digimon/{directory_name}.jpg` をホットリンク表示するだけで、保存はしない。

## directory_name の照合メモ

- 公式に個別ページがない形態は近いIDを入れて `note` に「要確認」を記載（ケレスモンメディウム、バッカスモンDM、マグナガルルモン（分離））
- 「超究極体」はゲーム独自の世代。公式では究極体のため `note` に `公式世代=` を記録
