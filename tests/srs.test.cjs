const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function boot() {
  let saved = null;
  let fail = false;
  const context = vm.createContext({ localStorage: {
    getItem: () => saved,
    setItem: (_, value) => { if (fail) throw new Error('quota'); saved = value; },
  } });
  vm.runInContext(readFileSync(join(__dirname, '../srs.js'), 'utf8'), context);
  return { api: vm.runInContext('SRS', context), failSave: () => { fail = true; } };
}

test('不正なバックアップを拒否して学習記録を保持する', () => {
  const { api } = boot();
  api.grade('q1', true);
  const before = api.exportData();
  for (const value of [
    { q: null, days: {} }, { q: [], days: {} },
    { q: {}, days: {}, mocks: {} }, { q: {}, days: { '2026-09-12': 'bad' } },
    { q: { q1: { lvl: 99, c: 0, w: 0, due: 'bad' } }, days: {} },
  ]) {
    assert.equal(api.importData(JSON.stringify(value)), false);
    assert.equal(api.exportData(), before);
  }
});

test('保存が失敗した復元ではメモリ内の記録も保持する', () => {
  const { api, failSave } = boot();
  api.grade('q1', true);
  const before = api.exportData();
  failSave();
  assert.equal(api.importData('{"q":{},"days":{}}'), false);
  assert.equal(api.exportData(), before);
});

test('書き出した学習記録を復元して学習を継続できる', () => {
  const source = boot().api;
  source.grade('q1', true);
  source.toggleMark('q1');
  const target = boot().api;
  assert.equal(target.importData(source.exportData()), true);
  target.grade('q1', false);
  assert.equal(target.getState('q1').w, 1);
  assert.equal(target.isMarked('q1'), true);
});

test('同じ問題IDの本文・出典更新は学習履歴を変更しない', () => {
  const {api}=boot();
  const question={id:'q1',question:'旧本文',source:'旧出典'};
  api.grade(question.id,true); api.toggleMark(question.id);
  const before=api.exportData();
  Object.assign(question,{question:'更新本文',source:'確認済みの出典',version:'2'});
  assert.equal(api.exportData(),before);
  assert.equal(api.getState(question.id).c,1);
  assert.equal(api.isMarked(question.id),true);
});
