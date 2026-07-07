"use strict";

const SRS = (() => {
  const KEY = "gyosei-progress-v1";
  const INTERVALS = [1, 3, 7, 14, 30, 60];

  let store = load();

  function load() {
    let s;
    try {
      s = JSON.parse(localStorage.getItem(KEY));
    } catch { /* 破損時は初期化 */ }
    s = s || {};
    return { q: s.q || {}, days: s.days || {}, settings: s.settings || {}, mocks: s.mocks || [], marks: s.marks || {} };
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(store));
  }

  function todayStr(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function getState(id) {
    return store.q[id] || null;
  }

  function grade(id, correct) {
    const s = store.q[id] || { lvl: -1, due: todayStr(), c: 0, w: 0 };
    if (correct) {
      s.c++;
      s.lvl = Math.min(s.lvl + 1, INTERVALS.length - 1);
      s.due = todayStr(INTERVALS[s.lvl]);
    } else {
      s.w++;
      s.lvl = -1;
      s.due = todayStr(1);
    }
    s.last = todayStr();
    store.q[id] = s;
    store.days[todayStr()] = (store.days[todayStr()] || 0) + 1;
    save();
  }

  function dueIds(allIds) {
    const t = todayStr();
    return allIds.filter(id => store.q[id] && store.q[id].due <= t);
  }

  function newIds(allIds) {
    return allIds.filter(id => !store.q[id]);
  }

  function weakIds(allIds) {
    return allIds.filter(id => {
      const s = store.q[id];
      if (!s) return false;
      const total = s.c + s.w;
      return s.w > 0 && (s.c / total) < 0.6;
    });
  }

  function answeredToday() {
    return store.days[todayStr()] || 0;
  }

  function streak() {
    let n = 0;
    for (let i = 0; ; i++) {
      const d = todayStr(-i);
      if (store.days[d]) n++;
      else if (i === 0) continue; // 今日未学習でも連続は昨日から数える
      else break;
    }
    return n;
  }

  function dayCount(dateStr) {
    return store.days[dateStr] || 0;
  }

  function subjectStats(questions) {
    const stats = {};
    for (const q of questions) {
      if (!stats[q.subject]) stats[q.subject] = { c: 0, w: 0, seen: 0, total: 0 };
      stats[q.subject].total++;
      const s = store.q[q.id];
      if (s) {
        stats[q.subject].seen++;
        stats[q.subject].c += s.c;
        stats[q.subject].w += s.w;
      }
    }
    return stats;
  }

  function getSetting(key, fallback) {
    return store.settings[key] !== undefined ? store.settings[key] : fallback;
  }

  function setSetting(key, value) {
    store.settings[key] = value;
    save();
  }

  function addMock(rec) {
    store.mocks.push(rec);
    if (store.mocks.length > 50) store.mocks = store.mocks.slice(-50);
    save();
  }

  function mocks() {
    return store.mocks;
  }

  function toggleMark(id) {
    if (store.marks[id]) delete store.marks[id];
    else store.marks[id] = 1;
    save();
    return !!store.marks[id];
  }

  function isMarked(id) {
    return !!store.marks[id];
  }

  function markedIds() {
    return Object.keys(store.marks);
  }

  function exportData() {
    return JSON.stringify(store);
  }

  function importData(json) {
    try {
      const s = JSON.parse(json);
      if (!s || typeof s.q !== "object" || typeof s.days !== "object") return false;
      store = { q: s.q, days: s.days, settings: s.settings || {}, mocks: s.mocks || [], marks: s.marks || {} };
      save();
      return true;
    } catch {
      return false;
    }
  }

  function reset() {
    store = { q: {}, days: {}, settings: store.settings, mocks: [], marks: {} };
    save();
  }

  return { grade, getState, dueIds, newIds, weakIds, answeredToday, streak, dayCount, subjectStats, getSetting, setSetting, addMock, mocks, toggleMark, isMarked, markedIds, exportData, importData, reset, todayStr };
})();
