"use strict";

const EXAM_DATE = new Date(2026, 10, 8); // 2026-11-08
const SUBJECT_ORDER = ["行政法", "民法", "憲法", "商法・会社法", "基礎知識"];

const ALL_QUESTIONS = [
  ...(window.QUESTIONS_GYOSEIHO || []),
  ...(window.QUESTIONS_MINPO || []),
  ...(window.QUESTIONS_KENPO || []),
  ...(window.QUESTIONS_SHOHO || []),
  ...(window.QUESTIONS_KISOCHISHIKI || []),
];
const KIJUTSU_CARDS = window.KIJUTSU_CARDS || [];
const Q_BY_ID = Object.fromEntries(ALL_QUESTIONS.map(q => [q.id, q]));

const $ = id => document.getElementById(id);

/* ---------- 画面切替 ---------- */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.screen === id));
  if (id === "screen-home") renderHome();
  if (id === "screen-stats") renderStats();
  if (id === "screen-cards") renderCards();
}

document.querySelectorAll(".tab").forEach(t =>
  t.addEventListener("click", () => showScreen(t.dataset.screen)));

/* ---------- 設定 ---------- */
function enabledSubjects() {
  return SRS.getSetting("subjects", ["行政法", "民法", "憲法"]);
}
function enabledQuestions() {
  const subs = enabledSubjects();
  return ALL_QUESTIONS.filter(q => subs.includes(q.subject));
}
function newPerDay() {
  return SRS.getSetting("newPerDay", 20);
}

/* ---------- ホーム ---------- */
function renderHome() {
  const days = Math.max(0, Math.ceil((EXAM_DATE - new Date().setHours(0, 0, 0, 0)) / 86400000));
  $("countdown").innerHTML = `試験まで <strong>${days}</strong> 日`;

  const ids = enabledQuestions().map(q => q.id);
  const due = SRS.dueIds(ids).length;
  const fresh = Math.min(SRS.newIds(ids).length, newPerDay());
  const done = SRS.answeredToday();
  const goal = due + fresh;

  $("norma-review").textContent = due;
  $("norma-new").textContent = fresh;
  $("norma-done").textContent = done;
  $("streak").textContent = SRS.streak();
  const pct = goal > 0 ? Math.min(100, Math.round(done / goal * 100)) : 100;
  $("norma-progress").style.width = pct + "%";
  $("norma-status").textContent = goal === 0 ? "今日の問題はありません" :
    done >= goal ? "🎉 今日のノルマ達成!" : `あと ${Math.max(0, goal - done)} 問でノルマ達成`;

  const grid = $("subject-buttons");
  grid.innerHTML = "";
  for (const sub of SUBJECT_ORDER) {
    const qs = ALL_QUESTIONS.filter(q => q.subject === sub);
    if (qs.length === 0) continue;
    const seen = qs.filter(q => SRS.getState(q.id)).length;
    const btn = document.createElement("button");
    btn.className = "subject-btn";
    btn.innerHTML = `${sub}<small>${seen} / ${qs.length} 問学習済み</small>`;
    btn.addEventListener("click", () => startSubjectSession(sub));
    grid.appendChild(btn);
  }
}

/* ---------- セッション構築 ---------- */
let session = null;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickNew(ids, n) {
  // importance 3を優先しつつシャッフル
  const qs = ids.map(id => Q_BY_ID[id]);
  const hi = shuffle(qs.filter(q => q.importance >= 3));
  const lo = shuffle(qs.filter(q => q.importance < 3));
  return [...hi, ...lo].slice(0, n).map(q => q.id);
}

function startSession(ids, label) {
  if (ids.length === 0) {
    alert("出題できる問題がありません");
    return;
  }
  session = { ids: shuffle(ids), idx: 0, correct: 0, wrongIds: [], label };
  showScreen("screen-quiz");
  renderQuestion();
}

function startToday() {
  const ids = enabledQuestions().map(q => q.id);
  const due = SRS.dueIds(ids);
  const fresh = pickNew(SRS.newIds(ids), newPerDay());
  startSession([...due, ...fresh], "今日の学習");
}

function startWeak() {
  const ids = enabledQuestions().map(q => q.id);
  startSession(SRS.weakIds(ids).slice(0, 50), "弱点復習");
}

function startSubjectSession(subject) {
  const ids = ALL_QUESTIONS.filter(q => q.subject === subject).map(q => q.id);
  const due = SRS.dueIds(ids);
  const fresh = pickNew(SRS.newIds(ids), newPerDay());
  const pool = [...due, ...fresh];
  startSession(pool.length ? pool : shuffle(ids).slice(0, 20), subject);
}

/* ---------- 演習 ---------- */
function renderQuestion() {
  const q = Q_BY_ID[session.ids[session.idx]];
  $("quiz-progress").textContent = `${session.idx + 1} / ${session.ids.length}`;
  $("quiz-topic").textContent = `${q.subject}・${q.topic}`;
  $("question-text").textContent = q.question;
  $("explanation-card").classList.add("hidden");

  const area = $("answer-area");
  area.innerHTML = "";
  if (q.type === "ox") {
    const row = document.createElement("div");
    row.className = "ox-row";
    for (const [label, val] of [["○", true], ["✕", false]]) {
      const b = document.createElement("button");
      b.className = "ox-btn " + (val ? "maru" : "batsu");
      b.textContent = label;
      b.addEventListener("click", () => answer(q, val === q.answer));
      row.appendChild(b);
    }
    area.appendChild(row);
  } else {
    q.choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "choice-btn";
      b.innerHTML = `<span class="choice-no">${i + 1}</span>${escapeHtml(c)}`;
      b.addEventListener("click", () => {
        area.querySelectorAll(".choice-btn").forEach((x, xi) => {
          x.disabled = true;
          if (xi === q.answer) x.classList.add("correct");
          else if (xi === i) x.classList.add("wrong");
        });
        answer(q, i === q.answer, true);
      });
      area.appendChild(b);
    });
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function answer(q, correct, keepChoices = false) {
  SRS.grade(q.id, correct);
  if (correct) session.correct++;
  else session.wrongIds.push(q.id);
  if (!keepChoices) $("answer-area").innerHTML = "";

  const v = $("verdict");
  v.textContent = correct ? "正解!" : "不正解";
  v.className = "verdict " + (correct ? "ok" : "ng");
  let exp = q.explanation;
  if (q.type === "ox") exp = `正解は「${q.answer ? "○" : "✕"}」\n${exp}`;
  else exp = `正解は「${q.answer + 1}」\n${exp}`;
  $("explanation-text").textContent = exp;
  $("explanation-card").classList.remove("hidden");
  $("btn-next").textContent = session.idx + 1 >= session.ids.length ? "結果を見る" : "次の問題へ";
  $("explanation-card").scrollIntoView({ behavior: "smooth", block: "end" });
}

$("btn-next").addEventListener("click", () => {
  session.idx++;
  if (session.idx >= session.ids.length) showResult();
  else renderQuestion();
});

$("btn-quit").addEventListener("click", () => {
  if (confirm("演習を中断しますか?(回答済みの記録は保存されます)")) showScreen("screen-home");
});

function showResult() {
  const total = session.ids.length;
  const pct = Math.round(session.correct / total * 100);
  $("result-score").textContent = `${pct}%`;
  $("result-detail").textContent = `${session.label}: ${total}問中 ${session.correct}問正解`;
  $("btn-retry-wrong").classList.toggle("hidden", session.wrongIds.length === 0);
  showScreen("screen-result");
}

$("btn-result-home").addEventListener("click", () => showScreen("screen-home"));
$("btn-retry-wrong").addEventListener("click", () => startSession(session.wrongIds, "間違い直し"));
$("btn-start-today").addEventListener("click", startToday);
$("btn-weak").addEventListener("click", startWeak);

/* ---------- 記述カード ---------- */
let cardIdx = 0;
function renderCards() {
  const box = $("cards-container");
  if (KIJUTSU_CARDS.length === 0) {
    box.innerHTML = `<div class="empty-note">記述対策カードは10月の学習フェーズで追加予定です。<br>まずは択一の演習を進めましょう。</div>`;
    return;
  }
  cardIdx = Math.min(cardIdx, KIJUTSU_CARDS.length - 1);
  const c = KIJUTSU_CARDS[cardIdx];
  box.innerHTML = `
    <div class="card kijutsu-card">
      <div class="card-title">${escapeHtml(c.subject)}・${escapeHtml(c.topic)} (${cardIdx + 1}/${KIJUTSU_CARDS.length})</div>
      <div class="kijutsu-q">${escapeHtml(c.question)}</div>
      <div class="kijutsu-a hidden" id="kijutsu-answer">${escapeHtml(c.answer)}</div>
      <button class="big-btn primary" id="btn-card-show">答えを見る</button>
      <div class="kijutsu-nav">
        <button class="big-btn" id="btn-card-prev">← 前へ</button>
        <button class="big-btn" id="btn-card-next">次へ →</button>
      </div>
    </div>`;
  $("btn-card-show").addEventListener("click", () => {
    $("kijutsu-answer").classList.remove("hidden");
    $("btn-card-show").classList.add("hidden");
  });
  $("btn-card-prev").addEventListener("click", () => {
    cardIdx = (cardIdx - 1 + KIJUTSU_CARDS.length) % KIJUTSU_CARDS.length;
    renderCards();
  });
  $("btn-card-next").addEventListener("click", () => {
    cardIdx = (cardIdx + 1) % KIJUTSU_CARDS.length;
    renderCards();
  });
}

/* ---------- 統計・設定 ---------- */
function renderStats() {
  const stats = SRS.subjectStats(ALL_QUESTIONS);
  const box = $("stats-subjects");
  box.innerHTML = "";
  for (const sub of SUBJECT_ORDER) {
    const s = stats[sub];
    if (!s) continue;
    const total = s.c + s.w;
    const pct = total > 0 ? Math.round(s.c / total * 100) : 0;
    box.insertAdjacentHTML("beforeend", `
      <div class="stat-row">
        <div class="stat-name">${sub}</div>
        <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
        <div class="stat-pct">正答率${pct}% (${s.seen}/${s.total}問)</div>
      </div>`);
  }

  // ヒートマップ(直近35日、週始まりに揃える)
  const heat = $("heatmap");
  heat.innerHTML = "";
  const today = SRS.todayStr();
  for (let i = 34; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const n = SRS.dayCount(ds);
    const lvl = n === 0 ? "" : n < 10 ? "h1" : n < 30 ? "h2" : "h3";
    const cell = document.createElement("div");
    cell.className = `heat-cell ${lvl} ${ds === today ? "today" : ""}`;
    cell.textContent = d.getDate();
    cell.title = `${ds}: ${n}問`;
    heat.appendChild(cell);
  }

  // 設定
  $("setting-new-per-day").value = String(newPerDay());
  const subBox = $("setting-subjects");
  subBox.innerHTML = "";
  const enabled = enabledSubjects();
  for (const sub of SUBJECT_ORDER) {
    if (!ALL_QUESTIONS.some(q => q.subject === sub)) continue;
    const label = document.createElement("label");
    label.className = "setting-check";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = enabled.includes(sub);
    cb.addEventListener("change", () => {
      const next = SUBJECT_ORDER.filter(s2 =>
        s2 === sub ? cb.checked :
        (subBox.querySelector(`input[data-sub="${s2}"]`)?.checked ?? enabled.includes(s2)));
      SRS.setSetting("subjects", next);
    });
    cb.dataset.sub = sub;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(sub));
    subBox.appendChild(label);
  }
}

$("setting-new-per-day").addEventListener("change", e => {
  SRS.setSetting("newPerDay", Number(e.target.value));
});

$("btn-reset").addEventListener("click", () => {
  if (confirm("学習履歴をすべて削除します。よろしいですか?")) {
    SRS.reset();
    renderStats();
    alert("リセットしました");
  }
});

/* ---------- 起動 ---------- */
renderHome();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
