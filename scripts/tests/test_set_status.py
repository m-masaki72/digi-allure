import contextlib
import io
import os
import tempfile
import unittest
from unittest import mock

import set_status

ORIGINAL = (
    "﻿game_no,name_ja,status,extra\n"
    "1,アグモン,candidate,\"a,b\"\n"
    "2,ガブモン,excluded,\n"
    "3,テイルモン,candidate,x\n"
)


class SetStatusTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.master = os.path.join(tmp.name, "master.csv")
        with open(self.master, "w", encoding="utf-8", newline="") as f:
            f.write(ORIGINAL)
        patcher = mock.patch.object(set_status, "MASTER", self.master)
        patcher.start()
        self.addCleanup(patcher.stop)

    def run_main(self, *args):
        with mock.patch("sys.argv", ["set_status.py", *args]), contextlib.redirect_stdout(io.StringIO()):
            set_status.main()

    def read(self):
        with open(self.master, encoding="utf-8", newline="") as f:
            return f.read()

    def test_updates_only_given_numbers_and_keeps_format(self):
        self.run_main("approved", "1", "3")
        self.assertEqual(self.read(), (
            "﻿game_no,name_ja,status,extra\n"
            "1,アグモン,approved,\"a,b\"\n"
            "2,ガブモン,excluded,\n"
            "3,テイルモン,approved,x\n"
        ))

    def test_unknown_number_aborts_without_writing(self):
        with self.assertRaises(SystemExit):
            self.run_main("approved", "1", "999")
        self.assertEqual(self.read(), ORIGINAL)

    def test_invalid_status_aborts_without_writing(self):
        with self.assertRaises(SystemExit):
            self.run_main("published", "1")
        self.assertEqual(self.read(), ORIGINAL)


if __name__ == "__main__":
    unittest.main()
