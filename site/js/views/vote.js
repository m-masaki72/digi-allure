import { api } from "../api.js";
import { SCOPE, state, navSeq } from "../state.js";
import { app, esc, art, meta, toast } from "../ui.js";
import { recordMyVote } from "../mine.js";

// ---------- 推し診断（勝ち残り方式の2択） ----------
export const QUIZ_N = 10;
const SEEN_MAX = 20;
let voteKeyHandler = null;

export function stopVoteKeys() {
  if (voteKeyHandler) {
    document.removeEventListener("keydown", voteKeyHandler);
    voteKeyHandler = null;
  }
}

export async function viewVote() {
  const seq = navSeq;
  document.title = "推し診断 — デジアリュール";
  app.innerHTML = `
    <h1>推し診断：どっちが好み？</h1>
    <p class="lead">直感で選んでください。選んだ子は勝ち残り、次の相手と対決します。${QUIZ_N}問であなたの推しTop5がわかります。<span class="pc-only">キーボードは ← / → で選択、↓ でスキップ。</span></p>
    <div class="quiz-progress"><progress id="gauge" max="${QUIZ_N}" value="0"></progress><span id="count">1 / ${QUIZ_N}問</span></div>
    <div id="pair"><p class="loading">対戦カードを用意しています…</p></div>
    <div class="vote-foot">
      <button id="skip">どちらとも言えない（スキップ）</button>
      <p class="lead small">選んだ結果は、みんなの人気ランキングにも1票として入ります。</p>
    </div>`;
  let pair = null;
  let busy = false;
  let keep = null; // 勝ち残っている子
  let answered = 0;
  const seen = [];

  const choiceHTML = (d, side) => `<button class="choice" data-side="${side}">${art(d)}<div class="body"><div class="name">${esc(d.name)}</div><div class="meta">${meta(d)}</div></div></button>`;

  function showProgress() {
    document.getElementById("gauge").value = answered;
    document.getElementById("count").textContent = `${Math.min(answered + 1, QUIZ_N)} / ${QUIZ_N}問`;
  }

  async function next() {
    busy = true;
    pair = null;
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const q = new URLSearchParams({ scope: SCOPE, seen: seen.join(",") });
        if (keep) q.set("keep", keep);
        const p = await api(`/api/pair?${q}`);
        if (seq !== navSeq) return;
        const a = state.byId.get(p.a), b = state.byId.get(p.b);
        if (!a || !b) continue;
        pair = p;
        for (const id of [p.a, p.b]) if (id !== keep && !seen.includes(id)) seen.push(id);
        seen.splice(0, Math.max(0, seen.length - SEEN_MAX));
        document.getElementById("pair").innerHTML = `<div class="vote">${choiceHTML(a, "a")}<div class="vs">VS</div>${choiceHTML(b, "b")}</div>`;
        return;
      }
      throw new Error("いま表示できる対戦カードがありません。しばらくしてからお試しください");
    } catch (e) {
      if (seq === navSeq) document.getElementById("pair").innerHTML = `<p class="error">${esc(e.message)}</p>`;
    } finally {
      busy = false;
    }
  }

  async function choose(side) {
    if (busy || !pair || seq !== navSeq) return;
    busy = true;
    const winner = pair[side];
    const btns = document.querySelectorAll(".choice");
    btns.forEach((b) => { b.disabled = true; b.classList.toggle("win", b.dataset.side === side); });
    try {
      await api("/api/vote", { method: "POST", body: JSON.stringify({ ...pair, winner }) });
      // 票はサーバーに入ったので、画面を移っていても自分の記録とキャッシュの破棄はやる
      recordMyVote(winner, pair[side === "a" ? "b" : "a"]);
      state.ranking = null;
      state.monthly = null;
      if (seq !== navSeq) return;
      answered++;
      keep = winner;
      showProgress();
    } catch (e) {
      if (seq !== navSeq) return;
      if (e.status === 409) {
        keep = winner; // 投票済みでも好みは分かったので勝ち残りにする
        toast("この組み合わせは今日すでに投票済みです。次の対戦へ進みます");
      } else toast(e.message, true);
    }
    await new Promise((r) => setTimeout(r, 350));
    if (seq !== navSeq) return;
    if (answered >= QUIZ_N) {
      toast("診断完了！結果を発表します");
      location.hash = "#/my";
      return;
    }
    busy = false;
    next();
  }

  document.getElementById("pair").addEventListener("click", (e) => {
    const b = e.target.closest(".choice");
    if (b) choose(b.dataset.side);
  });
  document.getElementById("skip").addEventListener("click", () => !busy && next());
  voteKeyHandler = (e) => {
    if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || e.repeat) return;
    if (e.target.closest?.("input, select, textarea, [contenteditable]")) return;
    if (e.key === "ArrowLeft") choose("a");
    else if (e.key === "ArrowRight") choose("b");
    else if (e.key === "ArrowDown") { e.preventDefault(); if (!busy) next(); }
  };
  document.addEventListener("keydown", voteKeyHandler);
  next();
}
