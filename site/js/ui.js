import { state } from "./state.js";

const IMAGE_CREDIT = { official_link: "画像：デジモン図鑑（公式）", ai_generated: "非公式ファンアート（AI生成）", original_art: "ファンアート" };
export const app = document.getElementById("app");

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let toastTimer;
export function toast(message, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = `show${isError ? " err" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ""), 1800);
}

const glyphHTML = (name, level) => `<span class="glyph">${esc([...name][0])}</span><span class="lv">${esc(level)}</span>`;

// 画像の出典ラベル（画像がない・出典の種類が不明なら ""）
export const creditOf = (d) => (d.image_url && d.image_source !== "none" && IMAGE_CREDIT[d.image_source]) || "";

export function art(d) {
  if (d.image_url && d.image_source !== "none") {
    const credit = creditOf(d);
    return `<div class="art" data-attr="${esc(d.attribute)}" data-id="${esc(d.id)}"><img src="${esc(d.image_url)}" alt="${esc(d.name)}" loading="lazy">${credit ? `<span class="credit">${esc(credit)}</span>` : ""}</div>`;
  }
  return `<div class="art" data-attr="${esc(d.attribute)}" aria-hidden="true">${glyphHTML(d.name, d.level)}</div>`;
}
// 画像が読めない（直リンク拒否など）ときは属性色の枠に戻す
document.addEventListener("error", (e) => {
  const box = e.target.closest?.(".art[data-id]");
  const d = box && state.byId.get(box.dataset.id);
  if (d) box.innerHTML = glyphHTML(d.name, d.level);
}, true);
export const detailHref = (d) => `#/d/${encodeURIComponent(d.id)}`;
export const lineageHref = (name) => `#/list/${encodeURIComponent(name)}`;
// keyOf(d) ごとの [キー, 個体の配列]（keyOf は配列も返せる）。体数の多い順（同数は名前順）
export function groupBy(keyOf) {
  const m = new Map();
  for (const d of state.list) for (const k of [].concat(keyOf(d))) {
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(d);
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0]), "ja"));
}
export const lineageGroups = () => groupBy((d) => d.lineage);
// 図鑑カード。body はカード下部に入れる HTML（呼び出し側でエスケープ済みのもの）
export const cardHTML = (d, body) => `<a class="card" href="${detailHref(d)}">
  ${art(d)}
  <div class="body">${body}</div>
</a>`;
export const meta = (d) => `${esc(d.level)}・${esc(d.attribute)}・${esc(d.type)}`;
export const monthLabel = (m) => `${Number(m.slice(0, 4))}年${Number(m.slice(5))}月`;
