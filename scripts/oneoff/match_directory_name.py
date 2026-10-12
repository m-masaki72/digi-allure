"""data/digimon_ts_master.csv の directory_name を公式一覧（work/official_index.csv）と名前で突き合わせて埋める。

- 既に directory_name が入っている行は触らない（手入力を優先）
- 一致しなかった行は note に「公式ID未照合」を追記する
- 世代が食い違う一致は note に残す
使い方: python3 -I scripts/oneoff/match_directory_name.py [--dry-run]
"""
import csv
import os
import re
import sys
import tempfile
import unicodedata

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
MASTER = os.path.join(ROOT, "data", "digimon_ts_master.csv")
INDEX = os.path.join(ROOT, "work", "official_index.csv")
UNMATCHED_NOTE = "公式ID未照合"

# Game8 表記の括弧書き → 公式の「：」表記
SUFFIX_MAP = {
    "黒": "ブラック",
    "青": "ブルー",
    "赤": "レッド",
    "白": "ホワイト",
    "緑": "グリーン",
    "金": "ゴールド",
}
# 手動対応（Game8 表記 → 公式 directory_name, 備考）。名前照合で拾えないものを照合結果を見て追記する
MANUAL = {
    "スノーゴブリンモン": ("snowgoburimon", ""),
    "アトラーカブテリモン": ("atlurkabuterimon", ""),
    "メタルグレイモン": ("metalgreymon-v", ""),
    "メタルグレイモン（青）": ("metalgreymon-web", ""),
    "ケルベロモンJM": ("cerberumon_werewolfmode", ""),
    "ガーべモン": ("gerbemon", ""),
    "ルーチェモンFM": ("rucemonfalldownmode", ""),
    "ルーチェモンSM": ("lucemonsatanmode", ""),
    "クロノモンHM": ("chronomon_holy", ""),
    "クロノモンDM": ("chronomon_destroy", ""),
    "ジャスティモン": ("justimon", ""),
    "ケレスモンメディウム": ("ceresmon", "要確認:公式はケレスモンのみ"),
    "ジャンボメガモン": ("jumbogamemon", ""),
    "ドゥフトモンLM": ("duftmonleopardmode", ""),
    "メタルシードモン": ("metalseadramon", ""),
    "バッカスモンDM": ("bacchusmon", "要確認:公式はバッカスモンのみ"),
    "ベルフェモンSM": ("belphemonsleepmode", ""),
    "ベルフェモンRM": ("belphemonragemode", ""),
    "ユノモンHM": ("junomon_hysteric", ""),
    "インペリアルドラモンDM": ("imperialdramondragonmode", ""),
    "インペリアルドラモンFM": ("imperialdramonfightermode", ""),
    "インペリアルドラモンPM": ("imperialdramonpaladinmode", ""),
    "ラピッドモン（アーマー体）": ("rapidmon_gold", ""),
    "マグナガルルモン（分離）": ("magnagarurumon", "要確認:分離形態は公式に個別ページなし"),
    "アルファモン王竜剣": ("alphamon:ouryuken", ""),
    "シャイングレイモンBM": ("shinegreymonburstmode", ""),
    "ユピテルモンWM": ("jupitermmon_wrath", ""),
    "レイヴモンBM": ("ravmonburstmode", ""),
    "ミラージュガオガモンBM": ("miragegaogamon:burstmode", ""),
    "ロゼモンBM": ("rosemonburstmode", ""),
    "デュークモンCM": ("dukemoncrimsonmode", ""),
    "ベルゼブモンBM": ("beelzebumonblastmode", ""),
}


def norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("・", "").replace(" ", "")
    s = s.replace("−", "ー").replace("-", "ー")
    return s


def variants(name):
    yield name
    m =re.match(r"^(.+?)[（(](.+?)[）)]$", name)
    if m:
        base, suf = m.group(1), m.group(2)
        yield f"{base}：{SUFFIX_MAP.get(suf, suf)}"
        yield f"{base}{suf}"
        if suf in ("X抗体", "X"):
            yield f"{base}X抗体"
            yield f"{base}（X抗体）"


def main():
    dry = "--dry-run" in sys.argv
    with open(INDEX, encoding="utf-8") as f:
        index = list(csv.DictReader(f))
    by_id = {r["directory_name"]: r for r in index}
    by_name = {}
    for r in index:
        by_name.setdefault(norm(r["name"]), []).append(r)

    with open(MASTER, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        rows = list(reader)

    matched = unmatched = 0
    for row in rows:
        if row["directory_name"]:
            continue
        hit = None
        notes = [n for n in row["note"].split(" / ") if n and n != UNMATCHED_NOTE]
        if row["name_ja"] in MANUAL:
            dn, memo = MANUAL[row["name_ja"]]
            hit = by_id[dn]
            if memo:
                notes.append(memo)
        else:
            for v in variants(row["name_ja"]):
                cands = by_name.get(norm(v))
                if cands:
                    # 同名が複数あれば世代が一致するものを優先
                    hit = next((c for c in cands if c["level"] == row["level"]), cands[0])
                    break
        if hit:
            row["directory_name"] = hit["directory_name"]
            matched += 1
            if hit["level"] != row["level"]:
                notes.append(f"公式世代={hit['level']}")
        else:
            notes.append(UNMATCHED_NOTE)
            unmatched += 1
            print(f"未照合: {row['game_no']} {row['name_ja']}")
        row["note"] = " / ".join(notes)

    print(f"一致 {matched} / 未照合 {unmatched}", file=sys.stderr)
    if dry:
        return
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(MASTER), suffix=".csv")
    with os.fdopen(fd, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    os.replace(tmp, MASTER)


if __name__ == "__main__":
    main()
