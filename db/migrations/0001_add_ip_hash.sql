-- ip_hash 列がない古い DB 用。db/schema.sql より先に1回だけ流す（列がある DB で流すと duplicate column で止まる）
ALTER TABLE digimon_tags ADD COLUMN ip_hash TEXT;
ALTER TABLE match_votes ADD COLUMN ip_hash TEXT;
ALTER TABLE requests ADD COLUMN ip_hash TEXT;
