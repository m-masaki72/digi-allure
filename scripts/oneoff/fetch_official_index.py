"""公式図鑑の一覧（名前 ↔ directory_name）だけを取得して work/official_index.csv に保存する。

一覧画面が使う request.php をページ送りで読むだけ。詳細ページ・画像・説明文は取得しない。
サーバー負荷を避けるため 1 リクエストごとに待機する。
"""
import csv
import json
import os
import sys
import tempfile
import time
import urllib.parse
import urllib.request

URL = "https://digimon.net/reference/request.php"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "work", "official_index.csv")
WAIT_SEC = 2.0
MAX_PAGES = 60


def fetch(offset):
    q = urllib.parse.urlencode({"next": offset} if offset else {})
    req = urllib.request.Request(
        f"{URL}?{q}",
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://digimon.net/reference/",
            "User-Agent": "digi-allure-index-check/0.1 (personal fan project)",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    rows, seen, offset = [], set(), 0
    for page in range(MAX_PAGES):
        data = fetch(offset)
        if not data or not data.get("rows"):
            break
        new = 0
        for r in data["rows"]:
            if r["directory_name"] in seen:
                continue
            seen.add(r["directory_name"])
            rows.append({"directory_name": r["directory_name"], "name": r["name"], "level": r["level"]})
            new += 1
        print(f"page {page}: offset={offset} +{new} total={len(rows)}", file=sys.stderr)
        nxt = data.get("next")
        if not nxt or new == 0 or nxt == offset:
            break
        offset = nxt
        time.sleep(WAIT_SEC)

    out = os.path.abspath(OUT)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(out), suffix=".csv")
    with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["directory_name", "name", "level"])
        w.writeheader()
        w.writerows(rows)
    os.replace(tmp, out)
    print(f"saved {len(rows)} -> {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
