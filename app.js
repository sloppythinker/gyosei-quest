"use strict";

const EXAM_DATE = new Date(2026, 10, 8); // 2026-11-08
const SUBJECT_ORDER = ["行政法", "民法", "憲法", "商法・会社法", "基礎知識"];

const ALL_QUESTIONS = [
  ...(window.QUESTIONS_GYOSEIHO || []),
  ...(window.QUESTIONS_GYOSEIHO2 || []),
  ...(window.QUESTIONS_MINPO || []),
  ...(window.QUESTIONS_MINPO2 || []),
  ...(window.QUESTIONS_KENPO || []),
  ...(window.QUESTIONS_SHOHO || []),
  ...(window.QUESTIONS_KISOCHISHIKI || []),
  ...(window.QUESTIONS_BUNSHO || []),
];
const KIJUTSU_CARDS = window.KIJUTSU_CARDS || [];
const SUJI_CARDS = window.SUJI_CARDS || [];
const TASHI_QUESTIONS = window.QUESTIONS_TASHI || [];
const Q_BY_ID = Object.fromEntries(ALL_QUESTIONS.map(q => [q.id, q]));
const TASHI_BY_ID = Object.fromEntries(TASHI_QUESTIONS.map(q => [q.id, q]));
const KIJUTSU_BY_ID = Object.fromEntries(KIJUTSU_CARDS.map(c => [c.id, c]));

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

let timerInterval = null;

function startSession(ids, label, opts = {}) {
  if (ids.length === 0) {
    alert("出題できる問題がありません");
    return;
  }
  session = { ids: opts.noShuffle ? ids : shuffle(ids), idx: 0, correct: 0, wrongIds: [], label, kind: opts.kind || "normal" };
  clearInterval(timerInterval);
  $("quiz-timer").classList.add("hidden");
  if (opts.minutes) {
    session.deadline = Date.now() + opts.minutes * 60000;
    $("quiz-timer").classList.remove("hidden");
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
  }
  showScreen("screen-quiz");
  renderQuestion();
}

function updateTimer() {
  const rest = Math.max(0, session.deadline - Date.now());
  const m = Math.floor(rest / 60000);
  const s = Math.floor(rest % 60000 / 1000);
  const el = $("quiz-timer");
  el.textContent = `${m}:${String(s).padStart(2, "0")}`;
  el.classList.toggle("urgent", rest < 5 * 60000);
  if (rest <= 0) {
    clearInterval(timerInterval);
    alert("時間切れです。ここまでの解答で採点します。");
    showResult();
  }
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

function startTashi() {
  const ids = TASHI_QUESTIONS.map(q => q.id);
  const due = SRS.dueIds(ids);
  const fresh = shuffle(SRS.newIds(ids));
  const pool = [...due, ...fresh].slice(0, 8);
  startSession(pool.length ? pool : shuffle(ids).slice(0, 8), "多肢選択式", { kind: "tashi" });
}

function startKijutsu() {
  const ids = KIJUTSU_CARDS.map(c => c.id);
  const due = SRS.dueIds(ids);
  const fresh = shuffle(SRS.newIds(ids));
  const pool = [...due, ...fresh].slice(0, 5);
  startSession(pool.length ? pool : shuffle(ids).slice(0, 5), "記述式演習", { kind: "kijutsu" });
}

// 基礎知識は文章理解2問を保証(本試験の足切り対策と同じ構成比)
const MOCK_PLAN = [["行政法", 19], ["民法", 9], ["憲法", 5], ["商法・会社法", 5], ["基礎知識", 2], ["文章理解", 2]];

function startMock() {
  const ids = [];
  for (const [sub, n] of MOCK_PLAN) {
    const pool = shuffle(ALL_QUESTIONS.filter(q => q.type === "choice5" &&
      (sub === "文章理解" ? q.topic === "文章理解" : q.subject === sub && q.topic !== "文章理解")));
    ids.push(...pool.slice(0, n).map(q => q.id));
  }
  if (!confirm(`本試験形式の五肢択一 ${ids.length}問を通しで解きます(1問3分・計${ids.length * 3}分)。途中で解説は表示されません。開始しますか?`)) return;
  startSession(ids, "模試", { kind: "mock", minutes: ids.length * 3, noShuffle: true });
}

function startWeakTopics() {
  const weak = weakTopics().slice(0, 3).map(t => t.key);
  if (weak.length === 0) {
    alert("まだ弱点を判定できる回答数がありません(単元ごとに5問以上解くと表示されます)");
    return;
  }
  const pool = enabledQuestions().filter(q => weak.includes(q.subject + "・" + q.topic)).map(q => q.id);
  const wrongFirst = [...SRS.weakIds(pool), ...SRS.dueIds(pool), ...shuffle(SRS.newIds(pool))];
  startSession([...new Set(wrongFirst)].slice(0, 20), "弱点単元");
}

function weakTopics() {
  const acc = {};
  for (const q of ALL_QUESTIONS) {
    const s = SRS.getState(q.id);
    if (!s) continue;
    const key = q.subject + "・" + q.topic;
    if (!acc[key]) acc[key] = { key, c: 0, w: 0 };
    acc[key].c += s.c;
    acc[key].w += s.w;
  }
  return Object.values(acc)
    .filter(t => t.c + t.w >= 5)
    .map(t => ({ ...t, rate: t.c / (t.c + t.w) }))
    .sort((a, b) => a.rate - b.rate);
}

/* ---------- 演習 ---------- */
function renderQuestion() {
  const id = session.ids[session.idx];
  const q = Q_BY_ID[id] || TASHI_BY_ID[id] || KIJUTSU_BY_ID[id];
  $("quiz-progress").textContent = `${session.idx + 1} / ${session.ids.length}`;
  $("quiz-topic").textContent = `${q.subject}・${q.topic}`;
  $("explanation-card").classList.add("hidden");

  if (session.kind === "tashi") {
    renderTashi(q);
    return;
  }
  if (session.kind === "kijutsu") {
    renderKijutsu(q);
    return;
  }
  $("question-text").textContent = q.question;

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
        if (session.kind === "mock") {
          answerMock(q, i === q.answer);
          return;
        }
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

function answerMock(q, correct) {
  SRS.grade(q.id, correct);
  if (correct) session.correct++;
  else session.wrongIds.push(q.id);
  session.idx++;
  if (session.idx >= session.ids.length) showResult();
  else renderQuestion();
}

/* ---------- 多肢選択 ---------- */
const BLANK_KEYS = ["ア", "イ", "ウ", "エ"];

function renderTashi(q) {
  const sel = [null, null, null, null];
  let cur = 0;
  const area = $("answer-area");

  function drawPassage() {
    let html = escapeHtml(q.passage);
    BLANK_KEYS.forEach((k, i) => {
      const label = sel[i] === null ? k : escapeHtml(q.words[sel[i]]);
      html = html.replace(`[${k}]`,
        `<span class="blank ${i === cur ? "current" : ""}" data-blank="${i}">${label}</span>`);
    });
    $("question-text").innerHTML = html;
    $("question-text").querySelectorAll(".blank").forEach(el =>
      el.addEventListener("click", () => { cur = Number(el.dataset.blank); drawAll(); }));
  }

  function drawChips() {
    area.innerHTML = `<div class="tashi-hint">空欄[${BLANK_KEYS[cur] || "-"}]に入る語句を選んでください</div>`;
    const grid = document.createElement("div");
    grid.className = "word-grid";
    q.words.forEach((w, i) => {
      const b = document.createElement("button");
      b.className = "word-chip";
      b.textContent = w;
      b.disabled = sel.includes(i);
      b.addEventListener("click", () => {
        sel[cur] = i;
        const next = sel.indexOf(null);
        cur = next === -1 ? cur : next;
        if (!sel.includes(null)) gradeTashi();
        else drawAll();
      });
      grid.appendChild(b);
    });
    area.appendChild(grid);
  }

  function drawAll() { drawPassage(); drawChips(); }

  function gradeTashi() {
    let hit = 0;
    let html = escapeHtml(q.passage);
    BLANK_KEYS.forEach((k, i) => {
      const ok = sel[i] === q.answers[i];
      if (ok) hit++;
      const chosen = escapeHtml(q.words[sel[i]]);
      const right = escapeHtml(q.words[q.answers[i]]);
      html = html.replace(`[${k}]`,
        ok ? `<span class="blank ok">${right}</span>`
           : `<span class="blank ng">${chosen}</span><span class="blank ok">${right}</span>`);
    });
    $("question-text").innerHTML = html;
    area.innerHTML = "";
    const correct = hit >= 3; // 4空欄中3つ以上で合格扱い(本試験でも部分点あり)
    SRS.grade(q.id, correct);
    if (correct) session.correct++;
    else session.wrongIds.push(q.id);
    const v = $("verdict");
    v.textContent = `${hit} / 4 正解${correct ? "!" : ""}`;
    v.className = "verdict " + (correct ? "ok" : "ng");
    $("explanation-text").textContent = q.explanation;
    $("explanation-card").classList.remove("hidden");
    $("btn-next").textContent = session.idx + 1 >= session.ids.length ? "結果を見る" : "次の問題へ";
    $("explanation-card").scrollIntoView({ behavior: "smooth", block: "end" });
  }

  drawAll();
}

/* ---------- 記述式入力演習 ---------- */
function renderKijutsu(q) {
  $("question-text").textContent = q.question;
  const area = $("answer-area");
  area.innerHTML = "";

  const ta = document.createElement("textarea");
  ta.className = "kijutsu-input";
  ta.placeholder = "40字程度で解答を入力(キーワードで自動採点されます)";
  const counter = document.createElement("div");
  counter.className = "kijutsu-counter";
  counter.textContent = "0字";
  ta.addEventListener("input", () => {
    const len = ta.value.replace(/\s/g, "").length;
    counter.textContent = `${len}字`;
    counter.classList.toggle("over", len > 50);
  });
  const btn = document.createElement("button");
  btn.className = "big-btn primary";
  btn.textContent = "採点する";
  btn.addEventListener("click", () => {
    const input = ta.value.replace(/\s/g, "");
    const groups = q.keywords || [];
    let hit = 0;
    const lines = groups.map(g => {
      const ok = g.some(w => input.includes(w));
      if (ok) hit++;
      return `${ok ? "○" : "✕"} ${g[0]}`;
    });
    const correct = groups.length > 0 && hit / groups.length >= 2 / 3;
    SRS.grade(q.id, correct);
    if (correct) session.correct++;
    else session.wrongIds.push(q.id);
    ta.disabled = true;
    btn.disabled = true;
    const v = $("verdict");
    v.textContent = `キーワード ${hit} / ${groups.length}${correct ? " 合格!" : ""}`;
    v.className = "verdict " + (correct ? "ok" : "ng");
    $("explanation-text").textContent = `【採点キーワード】\n${lines.join("\n")}\n\n${q.answer}`;
    $("explanation-card").classList.remove("hidden");
    $("btn-next").textContent = session.idx + 1 >= session.ids.length ? "結果を見る" : "次の問題へ";
    $("explanation-card").scrollIntoView({ behavior: "smooth", block: "end" });
  });

  area.appendChild(ta);
  area.appendChild(counter);
  area.appendChild(btn);
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
  if (confirm("演習を中断しますか?(回答済みの記録は保存されます)")) {
    clearInterval(timerInterval);
    $("quiz-timer").classList.add("hidden");
    showScreen("screen-home");
  }
});

function showResult() {
  clearInterval(timerInterval);
  $("quiz-timer").classList.add("hidden");
  const total = session.ids.length;
  const pct = Math.round(session.correct / total * 100);
  if (session.kind === "mock") {
    $("result-score").textContent = `${session.correct * 4}点`;
    $("result-detail").textContent = `模試(五肢択一${total}問・${total * 4}点満点): ${session.correct}問正解 (${pct}%)\n本試験の択一は6割前後の正答が合格ライン`;
    SRS.addMock({ d: SRS.todayStr(), s: session.correct * 4, t: total * 4 });
  } else {
    $("result-score").textContent = `${pct}%`;
    $("result-detail").textContent = `${session.label}: ${total}問中 ${session.correct}問正解`;
  }
  $("btn-retry-wrong").classList.toggle("hidden", session.wrongIds.length === 0);
  showScreen("screen-result");
}

$("btn-result-home").addEventListener("click", () => showScreen("screen-home"));
$("btn-retry-wrong").addEventListener("click", () => startSession(session.wrongIds, "間違い直し"));
$("btn-start-today").addEventListener("click", startToday);
$("btn-weak").addEventListener("click", startWeak);
$("btn-tashi").addEventListener("click", startTashi);
$("btn-kijutsu").addEventListener("click", startKijutsu);
$("btn-mock").addEventListener("click", startMock);
$("btn-weak-topic").addEventListener("click", startWeakTopics);

/* ---------- 暗記カード(記述・数字) ---------- */
let cardIdx = 0;
let activeDeck = "kijutsu";

document.querySelectorAll(".deck-btn").forEach(b =>
  b.addEventListener("click", () => {
    activeDeck = b.dataset.deck;
    cardIdx = 0;
    document.querySelectorAll(".deck-btn").forEach(x =>
      x.classList.toggle("active", x.dataset.deck === activeDeck));
    renderCards();
  }));

function renderCards() {
  const box = $("cards-container");
  const deck = activeDeck === "suji" ? SUJI_CARDS : KIJUTSU_CARDS;
  if (deck.length === 0) {
    box.innerHTML = `<div class="empty-note">このカードデッキは準備中です。<br>まずは択一の演習を進めましょう。</div>`;
    return;
  }
  cardIdx = Math.min(cardIdx, deck.length - 1);
  const c = deck[cardIdx];
  box.innerHTML = `
    <div class="card kijutsu-card">
      <div class="card-title">${escapeHtml(c.subject)}・${escapeHtml(c.topic)} (${cardIdx + 1}/${deck.length})</div>
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
    cardIdx = (cardIdx - 1 + deck.length) % deck.length;
    renderCards();
  });
  $("btn-card-next").addEventListener("click", () => {
    cardIdx = (cardIdx + 1) % deck.length;
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

  // 単元別弱点
  const topicBox = $("stats-topics");
  const topics = weakTopics();
  if (topics.length === 0) {
    topicBox.innerHTML = `<div class="empty-note" style="padding:10px">単元ごとに5問以上解くと弱点が表示されます</div>`;
  } else {
    topicBox.innerHTML = "";
    for (const t of topics.slice(0, 8)) {
      const pct = Math.round(t.rate * 100);
      topicBox.insertAdjacentHTML("beforeend", `
        <div class="stat-row">
          <div class="stat-name" style="width:11em">${escapeHtml(t.key)}</div>
          <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%; ${pct < 60 ? "background:var(--wrong)" : ""}"></div></div>
          <div class="stat-pct">${pct}% (${t.c + t.w}回)</div>
        </div>`);
    }
  }

  // 模試の得点推移(直近10回、60%=合格ライン相当で色分け)
  const mockBox = $("stats-mocks");
  const mocks = SRS.mocks();
  if (mocks.length === 0) {
    mockBox.innerHTML = `<div class="empty-note" style="padding:10px">模試モードを解くと得点の推移が表示されます</div>`;
  } else {
    mockBox.innerHTML = "";
    for (const m of mocks.slice(-10)) {
      const pct = Math.round(m.s / m.t * 100);
      mockBox.insertAdjacentHTML("beforeend", `
        <div class="stat-row">
          <div class="stat-name" style="width:7em">${m.d.slice(5).replace("-", "/")}</div>
          <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%; ${pct < 60 ? "background:var(--wrong)" : "background:var(--correct)"}"></div></div>
          <div class="stat-pct">${m.s}/${m.t}点 (${pct}%)</div>
        </div>`);
    }
    mockBox.insertAdjacentHTML("beforeend", `<div class="norma-status">緑=正答率60%以上(合格ライン相当)</div>`);
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

$("btn-export").addEventListener("click", async () => {
  const data = SRS.exportData();
  try {
    await navigator.clipboard.writeText(data);
    alert("進捗データをクリップボードにコピーしました。\nメモ帳アプリ等に貼り付けて保存してください。");
  } catch {
    prompt("コピーに失敗しました。以下を全選択してコピーしてください", data);
  }
});

$("btn-import").addEventListener("click", () => {
  const text = prompt("バックアップしたデータを貼り付けてください\n(現在の進捗は上書きされます)");
  if (!text) return;
  if (SRS.importData(text)) {
    alert("復元しました");
    renderStats();
  } else {
    alert("復元に失敗しました。データの形式が正しくありません。");
  }
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
