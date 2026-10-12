import { api } from "../api.js";
import { SCOPE, state, navSeq } from "../state.js";
import { app, esc, art, meta, toast } from "../ui.js";

// ---------- 2択投票 ----------
let voteKeyHandler = null;
let votedCount = 0;

export function stopVoteKeys() {
  if (voteKeyHandler) {
    document.removeEventListener("keydown", voteKeyHandler);
    voteKeyHandler = null;
  }
}

export async function viewVote() {
  const seq = navSeq;
  app.innerHTML = `
    <h1>どっちがお好み？</h1>
    <p class="lead">より魅力的だと思う方を選んでください。結果はレーティング（Elo）でランキングに反映されます。キーボードは ← / → で選択、↓ でスキップ。</p>
    <div id="pair"><p class="loading">対戦カードを用意しています…</p></div>
    <div class="vote-foot">
      <button id="skip">どちらとも言えない（スキップ）</button>
      <a href="#/ranking">ランキングを見る</a>
      <div id="voted">${votedCount ? `この訪問で ${votedCount} 票投じました` : ""}</div>
    </div>`;
  let pair = null;
  let busy = false;

  const choiceHTML = (d, side) => `<button class="choice" data-side="${side}">${art(d)}<div class="body"><div class="name">${esc(d.name)}</div><div class="meta">${meta(d)}</div></div></button>`;

  async function next() {
    busy = true;
    pair = null;
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const p = await api(`/api/pair?scope=${SCOPE}`);
        if (seq !== navSeq) return;
        const a = state.byId.get(p.a), b = state.byId.get(p.b);
        if (!a || !b) continue;
        pair = p;
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
      const res = await api("/api/vote", { method: "POST", body: JSON.stringify({ ...pair, winner }) });
      if (seq !== navSeq) return;
      votedCount++;
      document.getElementById("voted").textContent = `この訪問で ${votedCount} 票投じました`;
      toast(`${state.byId.get(winner).name} に投票しました（+${res.delta.toFixed(1)}）`);
      state.ranking = null;
      state.monthly = null;
    } catch (e) {
      if (seq !== navSeq) return;
      if (e.status === 409) toast("この組み合わせは今日すでに投票済みです。次の対戦へ進みます");
      else toast(e.message, true);
    }
    await new Promise((r) => setTimeout(r, 350));
    if (seq !== navSeq) return;
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
