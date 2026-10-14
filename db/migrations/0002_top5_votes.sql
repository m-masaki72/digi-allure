-- 推し診断の Top5 投票。1回の診断の結果を順位ごとに1行ずつ入れる（1位10点・2位5点・3位3点・4位2点・5位1点）
-- 人気ランキングはこの表の得点の合計で決める（ratings の Elo と match_votes は以前の2択の記録として残す）
CREATE TABLE IF NOT EXISTS top5_votes (
  vote_id    INTEGER NOT NULL,
  rank       INTEGER NOT NULL,
  digimon_id TEXT REFERENCES digimon(id),
  points     INTEGER NOT NULL,
  game_scope TEXT,
  sort_token TEXT,   -- GET /api/sort が配った並びの署名。並び1つにつき投票は1回
  voter_hash TEXT, ip_hash TEXT, created_at TEXT,
  PRIMARY KEY (vote_id, rank)
);
CREATE INDEX IF NOT EXISTS idx_top5_votes_ip ON top5_votes (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_top5_votes_scope ON top5_votes (game_scope, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_top5_votes_token ON top5_votes (sort_token, rank);
