"""マスターの status を図鑑No.指定で書き換える。
使い方: python3 -I -X utf8 scripts/set_status.py approved 314 349 ...
"""
import csv
import os
import sys
import tempfile

MASTER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "digimon_ts_master.csv")
STATUSES = ("candidate", "approved", "excluded")


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in STATUSES:
        sys.exit(__doc__)
    status, nos = sys.argv[1], set(sys.argv[2:])
    with open(MASTER, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fields, rows = reader.fieldnames, list(reader)
    for r in rows:
        if r["game_no"] in nos:
            print(f"No.{r['game_no']} {r['name_ja']}: {r['status']} -> {status}")
            r["status"] = status
            nos.discard(r["game_no"])
    if nos:
        sys.exit(f"見つからない図鑑No.: {sorted(nos)}")
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(MASTER), suffix=".csv")
    with os.fdopen(fd, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    os.replace(tmp, MASTER)


if __name__ == "__main__":
    main()
