# digi-allure（お色気デジモン図鑑）

非公式ファンサイト。方針・スキーマ・ロードマップは [docs/HANDOVER.md](docs/HANDOVER.md) を参照。

## 構成

| パス | 内容 |
|---|---|
| `data/digimon_ts_master.csv` | 判定用マスター（タイムストレンジャー登場 465 件） |
| `tools/judge.html` | 掲載判定ツール。ブラウザで直接開く |
| `scripts/fetch_official_index.py` | 公式図鑑一覧の「名前 ↔ directory_name」だけを取得（`work/` に出力、Git 管理外） |
| `scripts/match_directory_name.py` | マスターの `directory_name` を名前照合で埋める。手動対応は `MANUAL` に追記 |

## 判定の流れ

1. `tools/judge.html` をブラウザで開き、`data/digimon_ts_master.csv` をドロップ
2. `A` 承認 / `X` 除外 / `U` 未判定 / `J`・`K` 移動。途中経過は localStorage に自動保存
3. 名前・タイプで明らかに対象外のものは、絞り込み → 「表示中を一括除外」で先に落とすと楽
4. 「CSV書き出し」→ `data/digimon_ts_master.csv` を上書きしてコミット

公式画像は `https://digimon.net/cimages/digimon/{directory_name}.jpg` をホットリンク表示するだけで、保存はしない。

## directory_name の照合メモ

- 公式に個別ページがない形態は近いIDを入れて `note` に「要確認」を記載（ケレスモンメディウム、バッカスモンDM、マグナガルルモン（分離））
- 「超究極体」はゲーム独自の世代。公式では究極体のため `note` に `公式世代=` を記録
