"""マスターCSVから公開用データを生成する。

- site/data/digimon.json : 公開サイト用（status=approved のみ）
- site/data/candidates.json : リクエスト画面用（未掲載の名前と世代のみ）
- db/seed.sql            : D1 投入用（全件。公開判定は API 側で status を見る）

使い方: python3 -I -X utf8 scripts/build_data.py
"""
import csv
import json
import os
import tempfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MASTER = os.path.join(ROOT, "data", "digimon_ts_master.csv")
JSON_OUT = os.path.join(ROOT, "site", "data", "digimon.json")
CANDIDATES_OUT = os.path.join(ROOT, "site", "data", "candidates.json")
SEED_OUT = os.path.join(ROOT, "db", "seed.sql")
GAME_ID = "time-stranger"
GAME_TITLE = "デジモンストーリー タイムストレンジャー"

# ファン目線のタグ（公式タイプとは別軸）
TAGS = [
    ("雰囲気", ["お姉さん", "小悪魔", "女王様", "清楚", "ミステリアス", "癒やし", "クール"]),
    ("デザイン", ["露出度高め", "脚線美", "ボディライン", "仮面・目隠し", "ケモ耳", "翼", "和装・巫女"]),
    ("モチーフ", ["天使", "悪魔・堕天使", "魔女", "妖精・植物", "女神", "獣人"]),
]
# Game8 表記 → 公式表記
ATTRIBUTE_MAP = {"アンノウン": "不明"}
# 公式図鑑の画像を直リンク表示する（保存はしない）。権利者から求められたら False にして再ビルド・再デプロイ
OFFICIAL_IMAGES = True
OFFICIAL_IMAGE_URL = "https://digimon.net/cimages/digimon/{}.jpg"


def sql(v):
    if v is None or v == "":
        return "NULL"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def write_atomic(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    os.replace(tmp, path)


def load():
    with open(MASTER, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        if not r["directory_name"]:
            raise SystemExit(f"directory_name が空の行があります: {r['game_no']} {r['name_ja']}")
    # 公式に個別ページがない形態は directory_name が重複するので、game_no が最小の行以外はサイト内IDを分ける
    owner = {}
    for r in sorted(rows, key=lambda r: (int(r["game_no"]) if r["game_no"] else float("inf"), r["game8_id"])):
        owner.setdefault(r["directory_name"], r)
    out = []
    for r in rows:
        official = r["directory_name"]
        sid = official if owner[official] is r else f"{official}--{r['game_no'] or r['game8_id']}"
        image_url, image_source = r.get("image_url") or None, r.get("image_source") or "none"
        # 公式IDを借りている別形態（sid != official）は別の姿が出てしまうので対象外
        if not image_url and OFFICIAL_IMAGES and sid == official:
            image_url, image_source = OFFICIAL_IMAGE_URL.format(official), "official_link"
        out.append({
            "id": sid,
            "official_id": official,
            "no": int(r["game_no"]) if r["game_no"] else None,
            "name": r["name_ja"],
            "name_en": r.get("name_en") or None,
            "level": r["level"],
            "attribute": ATTRIBUTE_MAP.get(r["attribute"], r["attribute"]),
            "type": r["official_type"],
            "status": r["status"],
            "blurb": r.get("my_blurb") or None,
            "image_url": image_url,
            "image_source": image_source,
        })
    return out


def main():
    items = load()
    public = [
        {k: v for k, v in d.items() if k != "status"}
        for d in items if d["status"] == "approved"
    ]
    write_atomic(JSON_OUT, json.dumps(public, ensure_ascii=False, indent=1) + "\n")
    # リクエスト画面用：未掲載のデジモン（ID・名前・世代だけ）。幼年期は掲載対象外
    candidates = [
        {"id": d["id"], "name": d["name"], "level": d["level"]}
        for d in items if d["status"] != "approved" and not d["level"].startswith("幼年期")
    ]
    write_atomic(CANDIDATES_OUT, json.dumps(candidates, ensure_ascii=False) + "\n")

    lines = [
        "-- scripts/build_data.py が生成。手で編集しない",
        f"INSERT INTO games (id, title, released) VALUES ({sql(GAME_ID)}, {sql(GAME_TITLE)}, '2025-10-02')"
        " ON CONFLICT(id) DO UPDATE SET title=excluded.title;",
    ]
    for d in items:
        lines.append(
            "INSERT INTO digimon (id, official_id, name_ja, name_en, level, attribute, official_type, image_url, image_source, status, my_blurb) VALUES ("
            + ", ".join(sql(d[k]) for k in ["id", "official_id", "name", "name_en", "level", "attribute", "type", "image_url", "image_source", "status", "blurb"])
            + ") ON CONFLICT(id) DO UPDATE SET official_id=excluded.official_id, name_ja=excluded.name_ja, name_en=excluded.name_en,"
            " level=excluded.level, attribute=excluded.attribute, official_type=excluded.official_type, image_url=excluded.image_url,"
            " image_source=excluded.image_source, status=excluded.status, my_blurb=excluded.my_blurb;"
        )
        lines.append(
            f"INSERT INTO appearances (digimon_id, game_id, game_no) VALUES ({sql(d['id'])}, {sql(GAME_ID)}, {sql(d['no'])})"
            " ON CONFLICT(digimon_id, game_id) DO UPDATE SET game_no=excluded.game_no;"
        )
        # 既存のレーティングは保持する
        for scope in ("all", GAME_ID):
            lines.append(f"INSERT OR IGNORE INTO ratings (digimon_id, game_scope) VALUES ({sql(d['id'])}, {sql(scope)});")
    # CSV から消えた行は投票が参照しているので削除せず非公開に戻す
    lines.append(f"UPDATE digimon SET status = 'candidate' WHERE id NOT IN ({', '.join(sql(d['id']) for d in items)});")
    for cat, labels in TAGS:
        for label in labels:
            lines.append(f"INSERT INTO tags (label, category) VALUES ({sql(label)}, {sql(cat)}) ON CONFLICT(label) DO UPDATE SET category=excluded.category;")
    write_atomic(SEED_OUT, "\n".join(lines) + "\n")
    print(f"公開 {len(public)} 件 -> {JSON_OUT}\nDB {len(items)} 件 -> {SEED_OUT}")


if __name__ == "__main__":
    main()
