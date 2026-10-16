// Unit test for Text and Textarea question rules
const assert = require('assert');

function evaluateTextRule(question, questionIndex, textRules, globalDefault) {
  if (!question || (question.type !== 'text' && question.type !== 'textarea')) {
    return null;
  }

  const qTitle = (question.title || '').toLowerCase().trim();
  const qIdx = questionIndex + 1; // 1-based index

  let matchedRule = null;
  if (Array.isArray(textRules) && textRules.length > 0) {
    matchedRule = textRules.find(rule => {
      if (rule.matchType === 'index') {
        const ruleIdx = parseInt(rule.matchValue, 10);
        return !isNaN(ruleIdx) && ruleIdx === qIdx;
      }
      if (rule.matchType === 'title' || !rule.matchType) {
        const kw = (rule.matchValue || '').toLowerCase().trim();
        if (!kw) return false;
        try {
          const re = new RegExp(kw, 'i');
          if (re.test(qTitle)) return true;
        } catch (e) {}
        return qTitle.includes(kw);
      }
      return false;
    });
  }

  const ruleToApply = matchedRule || (globalDefault && globalDefault.enabled ? globalDefault : null);
  if (!ruleToApply) return null;

  const mode = ruleToApply.mode || 'fixed';

  if (mode === 'skip') {
    return { action: 'skip', value: '' };
  }

  if (mode === 'fixed') {
    return { action: 'fill', value: ruleToApply.fixedValue || '' };
  }

  if (mode === 'random_list') {
    let list = [];
    if (Array.isArray(ruleToApply.listValues)) {
      list = ruleToApply.listValues;
    } else if (typeof ruleToApply.listValues === 'string') {
      list = ruleToApply.listValues.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (list.length > 0) {
      const chosenText = list[Math.floor(Math.random() * list.length)];
      return { action: 'fill', value: chosenText };
    }
    return { action: 'fill', value: ruleToApply.fixedValue || '' };
  }

  return null;
}

console.log('--- TEST 1: Fixed text mode ---');
const q1 = { id: 0, title: 'Ý kiến đóng góp khác', type: 'textarea' };
const rules1 = [
  {
    type: 'text',
    matchType: 'title',
    matchValue: 'ý kiến',
    mode: 'fixed',
    fixedValue: 'Không có ý kiến gì thêm'
  }
];
const res1 = evaluateTextRule(q1, 0, rules1, null);
assert.strictEqual(res1.action, 'fill');
assert.strictEqual(res1.value, 'Không có ý kiến gì thêm');
console.log('✅ Fixed text mode passed!');

console.log('\n--- TEST 2: Skip mode ---');
const q2 = { id: 1, title: 'Số điện thoại liên hệ (không bắt buộc)', type: 'text' };
const rules2 = [
  {
    type: 'text',
    matchType: 'index',
    matchValue: '2',
    mode: 'skip'
  }
];
const res2 = evaluateTextRule(q2, 1, rules2, null);
assert.strictEqual(res2.action, 'skip');
assert.strictEqual(res2.value, '');
console.log('✅ Skip mode passed!');

console.log('\n--- TEST 3: Random from list mode ---');
const q3 = { id: 2, title: 'Nhận xét về chất lượng sản phẩm', type: 'text' };
const sampleList = [
  'Dịch vụ rất tốt, nhân viên nhiệt tình',
  'Sản phẩm dùng ổn trong tầm giá',
  'Cần cải thiện tốc độ giao hàng',
  'Rất hài lòng với trải nghiệm lần này'
];
const rules3 = [
  {
    type: 'text',
    matchType: 'title',
    matchValue: 'nhận xét',
    mode: 'random_list',
    listValues: sampleList
  }
];

const counts = {};
sampleList.forEach(s => counts[s] = 0);
for (let i = 0; i < 10000; i++) {
  const r = evaluateTextRule(q3, 2, rules3, null);
  assert.strictEqual(r.action, 'fill');
  assert(sampleList.includes(r.value));
  counts[r.value]++;
}
console.log('Distribution across 10,000 runs:');
Object.entries(counts).forEach(([k, v]) => {
  console.log(`  "${k}": ${v} times (${(v / 100).toFixed(1)}%)`);
  assert(v > 2000, 'Each item should be selected roughly 25% of the time');
});
console.log('✅ Random from list mode passed with uniform statistical distribution!');

console.log('\n--- TEST 4: Non-text questions should return null ---');
const qRadio = { id: 3, title: 'Giới tính', type: 'radio', options: ['Nam', 'Nữ'] };
const resRadio = evaluateTextRule(qRadio, 3, rules3, null);
assert.strictEqual(resRadio, null);
console.log('✅ Non-text questions correctly ignored!');

console.log('\n--- TEST 5: Fallback to global default ---');
const qUnmatched = { id: 4, title: 'Ghi chú thêm', type: 'textarea' };
const globalDefault = {
  enabled: true,
  mode: 'fixed',
  fixedValue: 'Dịch vụ tuyệt vời'
};
const resGlobal = evaluateTextRule(qUnmatched, 4, [], globalDefault);
assert.strictEqual(resGlobal.action, 'fill');
assert.strictEqual(resGlobal.value, 'Dịch vụ tuyệt vời');
console.log('✅ Global default fallback passed!');

console.log('\nALL TEXT RULE UNIT TESTS PASSED SUCCESSFULLY! 🚀');
