-- docs/HANDOVER.md のスキーマ案をベースにしたもの
-- 差分: digimon.official_id を追加（公式に個別ページがない形態は id と公式IDが一致しないため）

CREATE TABLE IF NOT EXISTS digimon (
  id            TEXT PRIMARY KEY,   -- サイト内ID（基本は公式 directory_name）
  official_id   TEXT,               -- 公式 directory_name（公式URLの組み立て用）
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

CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, title TEXT NOT NULL, released TEXT);

CREATE TABLE IF NOT EXISTS appearances (
  digimon_id TEXT REFERENCES digimon(id),
  game_id    TEXT REFERENCES games(id),
  game_no    INTEGER,
  how_to_get TEXT,
  spoiler    INTEGER DEFAULT 0,
  PRIMARY KEY (digimon_id, game_id)
);

CREATE TABLE IF NOT EXISTS curator_picks (
  digimon_id TEXT PRIMARY KEY REFERENCES digimon(id),
  rank INTEGER, comment TEXT NOT NULL, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY, label TEXT UNIQUE NOT NULL, category TEXT);

CREATE TABLE IF NOT EXISTS digimon_tags (
  digimon_id TEXT REFERENCES digimon(id),
  tag_id     INTEGER REFERENCES tags(id),
  voter_hash TEXT, created_at TEXT,
  PRIMARY KEY (digimon_id, tag_id, voter_hash)
);

CREATE TABLE IF NOT EXISTS match_votes (
  id INTEGER PRIMARY KEY,
  winner_id TEXT REFERENCES digimon(id),
  loser_id  TEXT REFERENCES digimon(id),
  game_scope TEXT,
  voter_hash TEXT, created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_match_votes_voter ON match_votes (voter_hash, created_at);

CREATE TABLE IF NOT EXISTS ratings (
  digimon_id TEXT REFERENCES digimon(id),
  game_scope TEXT,
  elo REAL DEFAULT 1500, matches INTEGER DEFAULT 0,
  PRIMARY KEY (digimon_id, game_scope)
);
