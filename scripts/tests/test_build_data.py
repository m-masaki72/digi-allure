import contextlib
import csv
import io
import json
import os
import tempfile
import unittest
from unittest import mock

import build_data

FIELDS = ["game_no", "name_ja", "level", "attribute", "official_type", "directory_name",
          "status", "note", "game8_id", "image_url", "image_source"]


def row(no, name, dn, status="candidate", level="成熟期", game8_id=""):
    return {"game_no": no, "name_ja": name, "level": level, "attribute": "データ", "official_type": "",
            "directory_name": dn, "status": status, "note": "", "game8_id": game8_id or f"g{no}",
            "image_url": "", "image_source": ""}


class BuildDataTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        d = self.tmp.name
        self.paths = {k: os.path.join(d, f) for k, f in
                      [("MASTER", "master.csv"), ("JSON_OUT", "digimon.json"),
                       ("CANDIDATES_OUT", "candidates.json"), ("SEED_OUT", "seed.sql")]}
        for k, p in self.paths.items():
            patcher = mock.patch.object(build_data, k, p)
            patcher.start()
            self.addCleanup(patcher.stop)

    def build(self, rows):
        with open(self.paths["MASTER"], "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
            w.writeheader()
            w.writerows(rows)
        with contextlib.redirect_stdout(io.StringIO()):
            build_data.main()

    def read_json(self, key):
        with open(self.paths[key], encoding="utf-8") as f:
            return json.load(f)

    def read_seed(self):
        with open(self.paths["SEED_OUT"], encoding="utf-8") as f:
            return f.read().splitlines()

    def ids_by_no(self):
        return {d["no"]: d["id"] for d in build_data.load()}

    def test_lowest_game_no_owns_official_id(self):
        rows = [row("20", "B", "shared"), row("3", "A", "shared"), row("7", "C", "solo")]
        self.build(rows)
        self.assertEqual(self.ids_by_no(), {20: "shared--20", 3: "shared", 7: "solo"})

    def test_id_assignment_is_order_independent(self):
        rows = [row("20", "B", "shared"), row("3", "A", "shared"), row("11", "D", "shared")]
        self.build(rows)
        first = self.ids_by_no()
        self.build(list(reversed(rows)))
        self.assertEqual(self.ids_by_no(), first)
        self.assertEqual(first[3], "shared")

    def test_empty_game_no_never_owns_when_numbered_row_exists(self):
        self.build([row("", "Z", "shared", game8_id="g999"), row("50", "A", "shared")])
        ids = {d["name"]: d["id"] for d in build_data.load()}
        self.assertEqual(ids, {"A": "shared", "Z": "shared--g999"})

    def test_empty_directory_name_is_rejected(self):
        with open(self.paths["MASTER"], "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
            w.writeheader()
            w.writerows([row("1", "A", "a"), row("2", "B", "")])
        with self.assertRaises(SystemExit) as cm:
            build_data.load()
        self.assertIn("directory_name", str(cm.exception))

    def test_seed_demotes_rows_missing_from_csv(self):
        self.build([row("3", "A", "shared", status="approved"), row("20", "B", "shared")])
        seed = self.read_seed()
        update = [l for l in seed if l.startswith("UPDATE digimon SET status = 'candidate'")]
        self.assertEqual(update, ["UPDATE digimon SET status = 'candidate' WHERE id NOT IN ('shared', 'shared--20');"])
        last_digimon_insert = max(i for i, l in enumerate(seed) if l.startswith("INSERT INTO digimon "))
        self.assertGreater(seed.index(update[0]), last_digimon_insert)

    def test_public_and_candidates_split(self):
        self.build([
            row("1", "Approved", "a", status="approved"),
            row("2", "Candidate", "b"),
            row("3", "Excluded", "c", status="excluded"),
            row("4", "Baby", "d", level="幼年期Ⅰ"),
        ])
        public = self.read_json("JSON_OUT")
        self.assertEqual([d["name"] for d in public], ["Approved"])
        self.assertNotIn("status", public[0])
        candidates = self.read_json("CANDIDATES_OUT")
        self.assertEqual(candidates, [
            {"id": "b", "name": "Candidate", "level": "成熟期"},
            {"id": "c", "name": "Excluded", "level": "成熟期"},
        ])

    def test_lineage_from_official_type_and_csv_override(self):
        typed = lambda r, t: {**r, "official_type": t}
        rows = [
            typed(row("1", "Angel", "a", status="approved"), "大天使型"),
            {**typed(row("2", "Override", "b", status="approved"), "大天使型"), "lineage": "魔女・魔人"},
            typed(row("3", "Unknown", "c", status="approved"), "謎型"),
            {**typed(row("4", "Typo", "d", status="approved"), "大天使型"), "lineage": "天使･聖獣"},
        ]
        with open(self.paths["MASTER"], "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS + ["lineage"], lineterminator="\n")
            w.writeheader()
            w.writerows(rows)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            build_data.main()
        public = {d["name"]: d for d in self.read_json("JSON_OUT")}
        self.assertEqual(public["Angel"]["lineage"], "天使・聖獣")
        self.assertEqual(public["Override"]["lineage"], "魔女・魔人")
        self.assertEqual(public["Unknown"]["lineage"], build_data.OTHER_LINEAGE)
        self.assertIn("謎型", out.getvalue())
        self.assertIn("天使･聖獣", out.getvalue())  # 表記ゆれは警告する
        self.assertNotIn("Override", out.getvalue())
        self.assertEqual(public["Angel"]["game8_id"], "g1")

    def test_lineage_column_is_optional(self):
        self.build([{**row("1", "A", "a", status="approved"), "official_type": "魔王型"}])
        self.assertEqual(self.read_json("JSON_OUT")[0]["lineage"], "魔王・堕天使")


if __name__ == "__main__":
    unittest.main()
