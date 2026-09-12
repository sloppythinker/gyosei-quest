const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const metadata=require('../metadata.js');

test('全問題データのIDは一意で出典未確認を明示する',()=>{
  const window={};
  const context=vm.createContext({window});
  for(const file of fs.readdirSync(path.join(__dirname,'../data')).filter(f=>f.endsWith('.js'))) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../data',file),'utf8'),context);
  }
  const questions=Object.entries(window).filter(([key])=>key.startsWith('QUESTIONS_')).flatMap(([,value])=>value);
  assert.ok(questions.length>100);
  const ids=new Set();
  for(const question of questions){
    assert.equal(typeof question.id,'string');
    assert.ok(!ids.has(question.id),`重複ID: ${question.id}`); ids.add(question.id);
    const details=metadata.describe(question);
    assert.ok(details.source.length);
    if(!question.checkedAt) assert.equal(details.checkedAt,'未確認');
  }
});
