# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

非公式のお色気デジモン図鑑。画面・API・判定手順は `README.md`、方針・権利まわりは `docs/HANDOVER.md` を読む（HANDOVER の §4・§7 は初期時点の記述で、`directory_name` 未入力・全件 candidate などは現状と異なる）。

## コマンド

ビルドツール・lint・依存パッケージはない。Python は標準ライブラリのみで、`python3 -I -X utf8` で実行する（`-I` ではスクリプトのディレクトリが import 対象にならないので、scripts 間で共通モジュールを作らない）。

```sh
python3 -I -X utf8 scripts/build_data.py                    # CSV → site/data/digimon.json, db/seed.sql
python3 -I -X utf8 scripts/set_status.py approved 314 349   # 図鑑No.指定で status を書き換え
npx wrangler pages dev --port 8788                           # ローカル起動（事前準備は README「ローカルで動かす」）
npx wrangler pages functions build --outdir <tmp>            # Functions のバンドル確認
npx wrangler d1 migrations apply digi-allure --local          # スキーマ適用（db/migrations/）
node --test 'test/*.test.mjs'                                # functions/_lib/api.js のテスト
python3 -I -X utf8 -m unittest discover -s scripts/tests -t scripts   # build_data / set_status のテスト
```

## 全体像

データは一方向に流れる: `data/digimon_ts_master.csv`（唯一の正）→ `scripts/build_data.py` → `site/data/digimon.json`（公開分のみ）と `db/seed.sql`（全件）→ D1。

- `site/data/*.json` と `db/seed.sql` は生成物。手で編集せず、CSV を直して `build_data.py` を再実行する
- CSV を書き換えるツール（`tools/judge.html`・`set_status.py`）は読み込んだヘッダーをそのまま書き戻す。列の追加は安全。ただし `judge.html` は前回開いた CSV を localStorage から復元するので、復元表示のまま書き出すと古いヘッダー・内容で上書きする。最新のマスターを開き直してから書き出す（復元時は日時を表示し、書き出し前に確認する）
- `tools/judge.html` の CSV パーサーは Python の `csv` と同じ解釈にそろえている。変更したら Python の出力と突き合わせる
- 個体ごとの画像は CSV の `image_url` / `image_source` 列で上書きする。空なら公式画像を直リンクする
- サイト内 ID は `directory_name`。同じ値の行が複数あれば game_no 最小の行以外は `{公式ID}--{game_no}` になり、公式画像は自動では付かない（別形態が公式IDを借りているため）
- `seed.sql` は upsert なので、本番に再投入しても票・レーティングは消えない。CSV から消えた ID は削除せず `candidate` に戻す
- 公開されるのは `status = 'approved'` の個体だけ。API 側も `isApproved()`（`functions/_lib/api.js`）で確認している

フロントは `site/` のビルド不要な vanilla JS SPA（hash ルーティング、ES modules）。入口は `site/js/main.js`（ルーター）、画面ごとに `site/js/views/*.js`、共有状態とデータ読み込みは `site/js/state.js`、描画ヘルパは `site/js/ui.js`、fetch は `site/js/api.js`、「あなたのTop5」用の自分の票（localStorage）は `site/js/mine.js`。非同期処理の後は `seq === navSeq` を確かめて古い画面への書き込みを捨てる（`navSeq` は `state.js` の `beginNav()` だけが進める）。

API は `functions/api/` の Pages Functions で、共通処理は `functions/_lib/api.js`（推し診断の並び順の HMAC 署名と Top5 の配点、日替わりソルトのハッシュ、JST の日・月区切り、IPv6 の /64 まとめ）。スキーマは `db/migrations/`（wrangler の D1 マイグレーション）で管理する。

## 制約

- `site/_headers` の CSP が厳しい: インラインの `style` / `<style>` / スクリプト、外部フォントと CDN は使えない。画像は `self`・`data:`・`https://digimon.net` のみ
- Functions は `env.DB`（D1 binding 名 `DB`）と `env.VOTE_SECRET` を参照する。`wrangler d1 create` が出す binding 名の例に書き換えない
- 書き込み API は判定と書き込みを1回の D1 batch に収め、`INSERT ... SELECT ... WHERE 条件` で原子的にする（同時リクエストで上限をすり抜けないため）
- `functions/_lib/` には `onRequest*` を export しない（export するとルートとして公開される）
- `site/js/` は無ハッシュの ES modules なので、`_headers` で `/js/*` に長期キャッシュを付けない（デプロイ直後に新旧モジュールが混ざる）
- POST は `functions/api/_middleware.js` が `Content-Type: application/json` と同一オリジンを要求する
- `VOTE_SECRET` は本番環境にしか登録していない（`wrangler pages secret put` はプレビュー環境を指定できない）。プレビューのデプロイでは `/api/sort` が失敗し、推し診断は投票なしの端末だけのモードになる
- 公式・Game8 の画像や説明文は転載しない（`docs/HANDOVER.md` §3）。公式画像は直リンク表示と出典ラベルだけにする

## 運用

- 個人アカウントで運用している（`user.name=m-masaki72`、remote は `git@github-personal:m-masaki72/digi-allure.git`）
- `git push`・`wrangler pages deploy`・`--remote` 付きの D1 操作は本番に影響するので、ユーザーが実行する
- 公開 URL: https://digi-allure.pages.dev（production ブランチは `master`）
