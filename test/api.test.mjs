import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scopeOf,
  json,
  fail,
  clientIds,
  ipKey,
  signPair,
  verifyPair,
  eloDelta,
  monthKey,
  dayKey,
  dayStart,
  monthScope,
  isMonthKey,
  monthRange,
  decodeParam,
  newRowId,
  readJSON,
} from "../functions/_lib/api.js";

const env = { VOTE_SECRET: "test-secret" };

test("scopeOf: 未指定は既定スコープ、未知の値は null", () => {
  assert.equal(scopeOf(undefined), "time-stranger");
  assert.equal(scopeOf(""), "time-stranger");
  assert.equal(scopeOf("all"), "all");
  assert.equal(scopeOf("month:2026-10"), null);
});

test("json / fail: ステータス・ヘッダー・本文", async () => {
  const res = json({ a: 1 }, 201);
  assert.equal(res.status, 201);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { a: 1 });

  const err = fail(429, "多すぎます");
  assert.equal(err.status, 429);
  assert.deepEqual(await err.json(), { error: "多すぎます" });
});

test("eloDelta: 同レートなら K/2、勝者と敗者の入れ替えで合計 K", () => {
  assert.equal(eloDelta(1500, 1500), 16);
  assert.equal(eloDelta(1500, 1500, 10), 5);
  assert.ok(Math.abs(eloDelta(1600, 1400) + eloDelta(1400, 1600) - 32) < 1e-9);
  assert.ok(eloDelta(1800, 1200) < 1);
  assert.ok(eloDelta(1200, 1800) > 31);
});

test("ipKey: IPv4 はそのまま、IPv6 は /64 に丸める", () => {
  assert.equal(ipKey("203.0.113.5"), "203.0.113.5");
  assert.equal(ipKey("local"), "local");
  assert.equal(ipKey("::ffff:203.0.113.5"), "203.0.113.5");
  assert.equal(ipKey("2001:db8:1:2:3:4:5:6"), "2001:db8:1:2::/64");
  assert.equal(ipKey("2001:DB8:0001:0002:ffff::1"), "2001:db8:1:2::/64");
  assert.equal(ipKey("2001:db8:1:2::"), "2001:db8:1:2::/64");
  assert.equal(ipKey("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(ipKey("fe80::1%eth0"), "fe80:0:0:0::/64");
  assert.equal(ipKey("::1"), "0:0:0:0::/64");
});

test("ipKey: 同じ /64 の別アドレスは同じキー、別の /64 は別キー", () => {
  assert.equal(ipKey("2001:db8:a:b::1"), ipKey("2001:db8:a:b:dead:beef:0:2"));
  assert.notEqual(ipKey("2001:db8:a:b::1"), ipKey("2001:db8:a:c::1"));
});

test("ipKey: 解釈できない IPv6 は小文字化してそのまま返す", () => {
  assert.equal(ipKey("ZZZZ::1"), "zzzz::1");
  assert.equal(ipKey("2001:db8:1"), "2001:db8:1");
});

test("monthKey / dayKey: 日本時間の 0 時で切り替わる", () => {
  const before = new Date("2026-09-30T14:59:59.999Z");
  const after = new Date("2026-09-30T15:00:00.000Z");
  assert.equal(monthKey(before), "2026-09");
  assert.equal(monthKey(after), "2026-10");
  assert.equal(dayKey(before), "2026-09-30");
  assert.equal(dayKey(after), "2026-10-01");
});

test("dayStart: 日本時間のその日の 0 時を UTC で返す", () => {
  assert.equal(dayStart(new Date("2026-10-12T01:00:00Z")), "2026-10-11T15:00:00.000Z");
  assert.equal(dayStart(new Date("2026-10-12T14:59:59.999Z")), "2026-10-11T15:00:00.000Z");
  assert.equal(dayStart(new Date("2026-10-12T15:00:00Z")), "2026-10-12T15:00:00.000Z");
});

test("monthRange: 日本時間の暦月の [開始, 終了) を UTC で返す", () => {
  assert.deepEqual(monthRange("2026-10"), ["2026-09-30T15:00:00.000Z", "2026-10-31T15:00:00.000Z"]);
  assert.deepEqual(monthRange("2026-12"), ["2026-11-30T15:00:00.000Z", "2026-12-31T15:00:00.000Z"]);
  assert.deepEqual(monthRange("2027-01"), ["2026-12-31T15:00:00.000Z", "2027-01-31T15:00:00.000Z"]);
  const [start, end] = monthRange(monthKey(new Date("2026-02-15T00:00:00Z")));
  assert.equal(monthKey(new Date(start)), "2026-02");
  assert.equal(monthKey(new Date(Date.parse(end) - 1)), "2026-02");
  assert.equal(monthKey(new Date(end)), "2026-03");
});

test("monthScope / isMonthKey", () => {
  assert.equal(monthScope("2026-10"), "month:2026-10");
  assert.equal(isMonthKey("2026-10"), true);
  assert.equal(isMonthKey("2026-12"), true);
  assert.equal(isMonthKey("2026-00"), false);
  assert.equal(isMonthKey("2026-13"), false);
  assert.equal(isMonthKey("2026-1"), false);
  assert.equal(isMonthKey("2026-10-01"), false);
  assert.equal(isMonthKey(202610), false);
});

test("decodeParam: 不正なパーセントエンコードは null", () => {
  assert.equal(decodeParam("garudamon"), "garudamon");
  assert.equal(decodeParam("%E3%82%AB"), "カ");
  assert.equal(decodeParam("%E3%82"), null);
  assert.equal(decodeParam("%"), null);
});

test("newRowId: 1 以上の安全な整数", () => {
  for (let i = 0; i < 100; i++) {
    const id = newRowId();
    assert.ok(Number.isSafeInteger(id) && id >= 1);
  }
});

test("readJSON: 壊れた JSON は null", async () => {
  const post = (body) => new Request("http://localhost/", { method: "POST", body });
  assert.deepEqual(await readJSON(post('{"a":1}')), { a: 1 });
  assert.equal(await readJSON(post("{")), null);
});

test("signPair / verifyPair: 署名したペアだけ通る", async () => {
  const { exp, token } = await signPair(env, "time-stranger", "a", "b");
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.ok(exp > Date.now());

  const pair = { scope: "time-stranger", a: "a", b: "b", exp, token };
  assert.equal(await verifyPair(env, pair), true);
  assert.equal(await verifyPair(env, { ...pair, a: "b", b: "a" }), false);
  assert.equal(await verifyPair(env, { ...pair, scope: "all" }), false);
  assert.equal(await verifyPair(env, { ...pair, exp: exp + 1 }), false);
  assert.equal(await verifyPair(env, { ...pair, token: token.replace(/^./, (c) => (c === "0" ? "1" : "0")) }), false);
  assert.equal(await verifyPair(env, { ...pair, token: token.slice(1) }), false);
  assert.equal(await verifyPair(env, { ...pair, token: undefined }), false);
  assert.equal(await verifyPair({ VOTE_SECRET: "other" }, pair), false);
});

test("verifyPair: 期限切れは不正", async (t) => {
  const { exp, token } = await signPair(env, "all", "a", "b");
  t.mock.timers.enable({ apis: ["Date"], now: exp + 1 });
  assert.equal(await verifyPair(env, { scope: "all", a: "a", b: "b", exp, token }), false);
});

test("VOTE_SECRET 未設定はエラー", async () => {
  await assert.rejects(signPair({}, "all", "a", "b"), /VOTE_SECRET/);
});

test("clientIds: ip は IP だけ、voter は IP+UA で決まる", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-12T03:00:00Z") });
  const req = (ip, ua) => new Request("http://localhost/", { headers: { "CF-Connecting-IP": ip, "User-Agent": ua } });
  const a = await clientIds(req("203.0.113.5", "UA-1"), env);
  const b = await clientIds(req("203.0.113.5", "UA-2"), env);
  const c = await clientIds(req("203.0.113.6", "UA-1"), env);
  assert.match(a.voter, /^[0-9a-f]{32}$/);
  assert.match(a.ip, /^[0-9a-f]{32}$/);
  assert.equal(a.ip, b.ip);
  assert.notEqual(a.voter, b.voter);
  assert.notEqual(a.ip, c.ip);

  const v6a = await clientIds(req("2001:db8:a:b::1", "UA"), env);
  const v6b = await clientIds(req("2001:db8:a:b::2", "UA"), env);
  assert.deepEqual(v6a, v6b);
});

test("clientIds: 日付が変わるとハッシュも変わる", async (t) => {
  const request = new Request("http://localhost/", { headers: { "CF-Connecting-IP": "203.0.113.5" } });
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-12T14:59:59.999Z") });
  const before = await clientIds(request, env);
  t.mock.timers.setTime(Date.parse("2026-10-12T15:00:00.000Z"));
  const after = await clientIds(request, env);
  assert.notEqual(before.ip, after.ip);
  assert.notEqual(before.voter, after.voter);
});
