"""ネットで「お色気・女性型」として名前が挙がったデジモンを、マスターの登場有無・判定状態と突き合わせる。
使い方: python3 -I -X utf8 scripts/oneoff/check_web_mentions.py [判定済みCSV]
"""
import csv
import os
import sys
import unicodedata

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
MASTER = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "digimon_ts_master.csv")

# 出典ごとに名前が挙がったデジモン（2026-10-12 調査）
MENTIONS = {
    "inside-games セクシー編(TS)": "ベルスターモン サクヤモン リリスモン マスティモン メルヴァモン ウェヌスモン ケレスモンメディウム ユノモン",
    "TS女性型必殺技まとめ動画": "ウィッチモン ウェヌスモン エンジェウーモン オファニモン カルマーラモン ラーナモン クズハモン サクヤモン ケレスモンメディウム セイレーンモン",
    "ピクシブ百科事典 女性型デジモン": "エンジェウーモン レディーデビモン リリスモン バステモン メルヴァモン オファニモン シューツモン チョ・ハッカイモン サンゾモン キンカクモン",
    "サイスル女性型人気投票": "リリスモン マスティモン リリモン ライラモン ミネルヴァモン サクヤモン クズハモン オファニモン",
    "女性型まとめサイト": "ネフェルティモン ハーピモン サクヤモン ロストモン シスタモンノワール",
    "海外掲示板・Pinterest": "エンジェウーモン レディーデビモン リリスモン リリモン ライラモン ロゼモン ロトスモン サクヤモン クズハモン マスティモン オファニモン バステモン ヴァルキリモン シューツモン フェアリモン シルフィーモン ブラックテイルモン",
    "Steam掲示板": "シスタモンノワール",
}


def norm(s):
    return unicodedata.normalize("NFKC", s).replace("・", "").replace(" ", "")


def main():
    with open(MASTER, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    by = {}
    for r in rows:
        by.setdefault(norm(r["name_ja"]), []).append(r)

    count, src = {}, {}
    for s, names in MENTIONS.items():
        for n in names.split():
            count[n] = count.get(n, 0) + 1
            src.setdefault(n, []).append(s)

    for n in sorted(count, key=lambda k: -count[k]):
        hits = by.get(norm(n), [])
        st = ",".join(f"No.{h['game_no']}:{h['status']}" for h in hits) or "TS未登場"
        print(f"{count[n]}票\t{n}\t{st}\t{' / '.join(src[n])}")


if __name__ == "__main__":
    main()
