# お色気デジモン図鑑 引継書

作成日: 2026-10-12（claude.ai での検討内容を Claude Code へ引き継ぐためのメモ）

## 1. プロジェクト概要

- **何を作るか**：デジモンの「お色気枠」に絞ったファン図鑑サービス。
- **きっかけ**：森が『デジモンストーリー タイムストレンジャー』をプレイ中、ゲームに登場するお色気枠のデジモンを一覧で見たくなった。同じ需要を持つユーザーにも広げる。
- **構成要素**
  - 事実データ（名前・世代・属性・タイプ・登場作品）
  - 森のおすすめコメント
  - ユーザー投票（当初は2択投票による Elo ランキング。現在は4択の推し診断の Top5 に配点する方式。README 参照）とタグ付け
- **最初のスコープ**：タイムストレンジャー登場デジモンに限定して小さく出す。

## 2. 決定済みの方針

| 項目 | 決定内容 |
|---|---|
| トーン | 「お色気枠ファン図鑑」。セクシー／フェチ寄りのファン投票までとし、露骨なアダルトにはしない |
| 画像 | 公式・Game8 の画像は複製しない。公式図鑑の画像を出典ラベル付きで直リンク表示するか、自作イラスト・AI 生成画像を使う（README 参照） |
| AI生成画像 | 掲載する場合は必ず「非公式ファンアート（AI生成）」と表示する |
| テキスト | 公式図鑑の説明文は転載しない。紹介文は森が自分の言葉で書く（`my_blurb`） |
| 掲載判定 | お色気枠かどうかの判定はすべて森が行う。全件 `candidate` で投入し、`approved` になったものだけを公開する |
| 掲載ルール | 幼年期などの子どもっぽいデザインのデジモンは対象外とする |
| データ管理 | マスターは CSV（Git 管理）。DB はそこから生成する |
| 公式表記 | 公式図鑑（digimon.net/reference）の ID・表記・分類に合わせる |

## 3. 権利まわりの注意

- **公式サイト**（digimon.net）のフッターには、画像・文章・データの無断転用・転載を断る旨が書かれている。図鑑全件のスクレイピングや、画像・説明文の転載はしない。
- **Game8** にも、掲載データ・画像の無断使用・転載を断る旨の記載がある。Game8 から取得したデータは「ゲームに登場するか」と「ゲーム内図鑑No.」の確認、および判定作業用に限る。進化条件の表など Game8 の編集物は持ち込まない。公開サイトには、承認済みの事実情報とリンクだけを出す。
- デジモン専用の二次創作ガイドラインは見つかっていない。サイト上に「非公式ファンサイト」であることを明記する。
- 広告は一般向けの範囲にとどめる（AdSense 想定）。アダルト系アフィリエイトとの組み合わせは避ける。

## 4. データ（引き渡しファイル）

### `digimon_ts_master.csv`（判定用マスター）

- 465件。UTF-8（BOM付き）。
- 出典：Game8 のタイムストレンジャー攻略、世代別デジモン一覧（成長期／成熟期／完全体／究極体／超究極体／アーマー体／ハイブリッド体）と、登場デジモン一覧。
- 列：

| 列 | 内容 |
|---|---|
| `game_no` | ゲーム内図鑑No. |
| `name_ja` | 名前（Game8 表記。公式表記との照合は未実施） |
| `level` | 世代（公式表記に寄せて 幼年期Ⅰ／Ⅱ に正規化済み） |
| `attribute` | 属性（Game8 表記。「アンノウン」は公式では「不明」に相当） |
| `official_type` | タイプ（Game8 表記） |
| `directory_name` | 公式図鑑の ID。**全件空欄、要入力** |
| `status` | `candidate` / `approved` / `excluded`。現在は全件 `candidate` |
| `note` | 要確認事項 |
| `game8_id` | Game8 の個別ページID（`https://game8.jp/digimonstory-ts/{game8_id}`）。判定作業用。公開 JSON には詳細ページの「入手方法・進化（Game8）」リンク用にだけ入れる（Game8 のデータ・文章は載せない） |

### 既知の欠落・要確認

- **No.306、No.458〜467** は Game8 の一覧に載っていない。ゲーム内で確認して補完する。
- **ベオウルフモン**（game8_id 726822）は、進化先として名前が出てくるだけで、番号・属性・世代は不明。No.306 の可能性が高いが未確認。
- **No.473 ワーガルルモン（黒）**：Game8 では究極体と表記されているが、同ページのコメント欄で誤りが指摘されている。
- **No.422 ラピッドモン（アーマー体）**：究極体の番号帯にあるが、世代はアーマー体。

## 5. 公式図鑑の構造（digimon.net/reference）

- 個別ページ：`https://digimon.net/reference/detail.php?directory_name={id}`。`directory_name` が実質的な公式ID。
- 絞り込みの軸：五十音、レベル、属性、タイプ。
  - レベル：幼年期Ⅰ／幼年期Ⅱ／成長期／成熟期／完全体／究極体／アーマー体／ハイブリッド体／クロスウォーズ／不明
  - 属性：ワクチン／データ／ウィルス／フリー／ヴァリアブル／不明／NO DATA
  - タイプ：約150種類
- 多言語版あり（`reference_en` など）。同じ `directory_name` で引けるかは未確認。
- 公式画像は `https://digimon.net/cimages/digimon/{directory_name}.jpg`（保存せず直リンク表示）。

## 6. DB スキーマ案（Cloudflare D1 / SQLite 想定）

```sql
CREATE TABLE digimon (
  id            TEXT PRIMARY KEY,   -- 公式 directory_name
  name_ja       TEXT NOT NULL,
  name_en       TEXT,
  level         TEXT,
  attribute     TEXT,
  official_type TEXT,
  image_url     TEXT,
  image_source  TEXT CHECK (image_source IN ('official_link','ai_generated','original_art','none')),
  status        TEXT NOT NULL DEFAULT 'candidate'
                CHECK (status IN ('candidate','approved','excluded')),
  status_note   TEXT,
  my_blurb      TEXT
);

CREATE TABLE games (id TEXT PRIMARY KEY, title TEXT NOT NULL, released TEXT);

CREATE TABLE appearances (
  digimon_id TEXT REFERENCES digimon(id),
  game_id    TEXT REFERENCES games(id),     -- 'time-stranger'
  game_no    INTEGER,                       -- ゲーム内図鑑No.
  how_to_get TEXT,
  spoiler    INTEGER DEFAULT 0,
  PRIMARY KEY (digimon_id, game_id)
);

CREATE TABLE curator_picks (
  digimon_id TEXT PRIMARY KEY REFERENCES digimon(id),
  rank INTEGER, comment TEXT NOT NULL, updated_at TEXT
);

CREATE TABLE tags (id INTEGER PRIMARY KEY, label TEXT UNIQUE NOT NULL, category TEXT);

CREATE TABLE digimon_tags (
  digimon_id TEXT REFERENCES digimon(id),
  tag_id     INTEGER REFERENCES tags(id),
  voter_hash TEXT, created_at TEXT,
  PRIMARY KEY (digimon_id, tag_id, voter_hash)
);

CREATE TABLE match_votes (
  id INTEGER PRIMARY KEY,
  winner_id TEXT REFERENCES digimon(id),
  loser_id  TEXT REFERENCES digimon(id),
  game_scope TEXT,                          -- 'all' | 'time-stranger'
  voter_hash TEXT, created_at TEXT
);

CREATE TABLE ratings (
  digimon_id TEXT REFERENCES digimon(id),
  game_scope TEXT,
  elo REAL DEFAULT 1500, matches INTEGER DEFAULT 0,
  PRIMARY KEY (digimon_id, game_scope)
);
```

### 設計メモ

- **公開の関門**：投票・ランキング・一覧に出すのは `status = 'approved'` のものだけ。ユーザーからの追加リクエストは `candidate` に積むだけで、森の判定を経ないと公開されない。
- **公式URL**：`id` から組み立てるので、カラムとしては持たない。
- **2つの分類軸**：公式の分類は `official_type`（堕天使型・妖精型など）、ファン目線の分類は `tags` に分ける。
- **スコープ別ランキング**：`game_scope` ごとに独立させる。最初は `time-stranger` だけで出す。
- **投票者の識別**：`voter_hash` は IP＋UA に日替わりソルトをかけたハッシュ。生のIPは保存しない。Cloudflare のレート制限と併用する。
- **Elo**：K=32 程度の標準式。対戦ペアは `matches` の少ない個体を優先して選ぶ。
- **画像表示**：`image_source = 'ai_generated'` のときは「非公式ファンアート（AI生成）」のラベルを必ず出す。
- **流用**：Moeter（2択診断サービス）の投票基盤が流用できる可能性あり。

## 7. 判定ツール（次の作業）

claude.ai 上で Artifact 版を試作したが、外部画像を表示できないためローカルHTML版に切り替える。コードは引き継がないので、以下の仕様で作り直す。

### 仕様

- 単体の `.html` ファイルで、ローカルのブラウザで開く。サーバー不要。
- `digimon_ts_master.csv` を読み込む（ファイル選択、またはドラッグ＆ドロップ）。
- カードを一覧表示する。各カードの内容：
  - 図鑑No.、名前、世代・属性・タイプ
  - **公式図鑑の画像プレビュー**（`directory_name` から公式画像URLを組み立ててホットリンク表示。ローカル保存はしない）
  - Game8 個別ページへのリンク（画像が出ない場合の確認用）
- 判定操作：
  - 「承認」「除外」ボタン。もう一度押すと未判定に戻る
  - キーボード：`A` 承認 / `X` 除外 / `U` 未判定に戻す / `J`・`K` で前後移動
- 絞り込み：世代チップ、属性、判定状態（初期値は「未判定のみ」）、名前・タイプ検索、「幼年期を隠す」トグル（初期オン）。
- 進捗表示：判定済み数、承認数、除外数、未判定数、バー表示。
- 保存：途中経過は localStorage。最終的には `status` を反映したCSVを書き出して、マスターを更新する。

### 前提作業

画像を表示するには、先に `directory_name` を埋める必要がある。

1. 公式図鑑の個別ページを1つ開き、画像のURLパターンを調べる。
2. 公式図鑑の一覧から名前で突き合わせて、`directory_name` を埋める。
   - 公式の注意書きがあるため、全件を一括スクレイピングしない。一覧ページから名前とIDの対応を確認する程度にとどめる。
   - 突き合わせできなかったものは `note` に残す。
3. 判定作業の手順は2通り考えられる。
   - 全件を画像付きで判定する。
   - 先に名前とタイプで明らかに対象外のものを除外し、残りだけ画像付きで見る（手間が少ない）。

## 8. その後のロードマップ

1. 判定完了 → `approved` 分の `directory_name` と表記を公式と照合する
2. 森のおすすめコメントを CSV の `my_blurb` 列（未作成。追加して書く）に書く。`build_data.py` が詳細画面の紹介文に反映する
3. 画面構成を決める：一覧／詳細／2択投票／ランキング／タイプから探す
4. 実装：静的サイト（Cloudflare Pages）＋投票API（Workers + D1）
5. 公開：タイムストレンジャー限定版 → 反応を見て全作品（`all` スコープ）へ拡大
