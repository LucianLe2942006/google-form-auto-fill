// FormMind - Automation Features Test Suite

const assert = require('assert');

// 1. parseTimeToMs
function parseTimeToMs(value, unit = 'm') {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return 0;
  switch (unit) {
    case 's': return Math.round(num * 1000);
    case 'm': return Math.round(num * 60 * 1000);
    case 'h': return Math.round(num * 3600 * 1000);
    default: return Math.round(num * 60 * 1000);
  }
}

// 2. formatMsToTime
function formatMsToTime(ms) {
  if (!ms || ms <= 0) return '00:00:00';
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  const pad = n => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

// 3. weightedRandom
function weightedRandom(options) {
  if (!options || !Array.isArray(options) || options.length === 0) return null;
  const valid = options.filter(o => typeof o.weight === 'number' && o.weight > 0);
  if (valid.length === 0) {
    return options[Math.floor(Math.random() * options.length)];
  }
  const totalWeight = valid.reduce((sum, o) => sum + o.weight, 0);
  let random = Math.random() * totalWeight;
  for (const opt of valid) {
    if (random < opt.weight) {
      return opt;
    }
    random -= opt.weight;
  }
  return valid[valid.length - 1];
}

// 4. evaluateWeightedRule
function evaluateWeightedRule(question, questionIndex, rules) {
  if (!rules || !Array.isArray(rules) || rules.length === 0) return null;
  const qTitle = (question.title || '').toLowerCase().trim();
  const qIdx = questionIndex + 1; // 1-based index

  const matchedRule = rules.find(rule => {
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

  if (!matchedRule || !matchedRule.options || matchedRule.options.length === 0) {
    return null;
  }

  const picked = weightedRandom(matchedRule.options);
  if (!picked) return null;

  const targetLabel = (picked.label || '').toLowerCase().trim();
  const availableOptions = question.options || [];

  if (availableOptions.length > 0) {
    let exact = availableOptions.find(o => o.toLowerCase().trim() === targetLabel);
    if (exact) return exact;

    let sub = availableOptions.find(o => 
      o.toLowerCase().trim().includes(targetLabel) || targetLabel.includes(o.toLowerCase().trim())
    );
    if (sub) return sub;

    const letterMatch = picked.label.match(/^[A-Z]$/i);
    if (letterMatch) {
      const charIdx = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
      if (charIdx >= 0 && charIdx < availableOptions.length) {
        return availableOptions[charIdx];
      }
    }
    const numIdx = parseInt(picked.label, 10);
    if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= availableOptions.length) {
      return availableOptions[numIdx - 1];
    }
  }

  return picked.label;
}

console.log('--- TEST 1: parseTimeToMs & formatMsToTime ---');
assert.strictEqual(parseTimeToMs('10', 's'), 10000);
assert.strictEqual(parseTimeToMs('1.5', 'm'), 90000);
assert.strictEqual(parseTimeToMs('2', 'h'), 7200000);
assert.strictEqual(parseTimeToMs('0.5', 'h'), 1800000);
console.log('✅ parseTimeToMs passed!');

assert.strictEqual(formatMsToTime(10000), '00:10');
assert.strictEqual(formatMsToTime(90000), '01:30');
assert.strictEqual(formatMsToTime(3665000), '01:01:05');
console.log('✅ formatMsToTime passed!');

console.log('\n--- TEST 2: weightedRandom Statistical Distribution ---');
const testOptions = [
  { label: 'A', weight: 50 },
  { label: 'B', weight: 30 },
  { label: 'C', weight: 15 },
  { label: 'D', weight: 5 }
];

const counts = { A: 0, B: 0, C: 0, D: 0 };
const iterations = 50000;
for (let i = 0; i < iterations; i++) {
  const chosen = weightedRandom(testOptions);
  counts[chosen.label]++;
}

const pctA = (counts.A / iterations) * 100;
const pctB = (counts.B / iterations) * 100;
const pctC = (counts.C / iterations) * 100;
const pctD = (counts.D / iterations) * 100;

console.log(`Distribution over ${iterations} runs:`);
console.log(`  A (target 50%): ${pctA.toFixed(2)}%`);
console.log(`  B (target 30%): ${pctB.toFixed(2)}%`);
console.log(`  C (target 15%): ${pctC.toFixed(2)}%`);
console.log(`  D (target 5%):  ${pctD.toFixed(2)}%`);

assert(Math.abs(pctA - 50) < 1.5, `A deviation too high: ${pctA}`);
assert(Math.abs(pctB - 30) < 1.5, `B deviation too high: ${pctB}`);
assert(Math.abs(pctC - 15) < 1.5, `C deviation too high: ${pctC}`);
assert(Math.abs(pctD - 5) < 1.0, `D deviation too high: ${pctD}`);
console.log('✅ weightedRandom statistical distribution passed within tight confidence interval!');

console.log('\n--- TEST 3: evaluateWeightedRule Matching ---');
const sampleRules = [
  {
    id: 'rule_1',
    matchType: 'title',
    matchValue: 'giới tính',
    options: [
      { label: 'Nam', weight: 60 },
      { label: 'Nữ', weight: 40 }
    ]
  },
  {
    id: 'rule_2',
    matchType: 'index',
    matchValue: '3',
    options: [
      { label: 'Rất hài lòng', weight: 100 }
    ]
  }
];

const q1 = {
  id: 101,
  title: 'Vui lòng cho biết giới tính của bạn:',
  type: 'radio',
  options: ['Nam', 'Nữ', 'Khác']
};

const resultQ1 = evaluateWeightedRule(q1, 0, sampleRules);
console.log('Q1 matched result:', resultQ1);
assert(resultQ1 === 'Nam' || resultQ1 === 'Nữ');

const q2 = {
  id: 102,
  title: 'Bạn đang bao nhiêu tuổi?',
  type: 'radio',
  options: ['Dưới 18', '18 - 25', 'Trên 25']
};
const resultQ2 = evaluateWeightedRule(q2, 1, sampleRules); // index 1 -> Q2, no rule for Q2
console.log('Q2 matched result (should be null):', resultQ2);
assert.strictEqual(resultQ2, null);

const q3 = {
  id: 103,
  title: 'Mức độ hài lòng chung:',
  type: 'radio',
  options: ['Rất không hài lòng', 'Bình thường', 'Rất hài lòng']
};
const resultQ3 = evaluateWeightedRule(q3, 2, sampleRules); // index 2 -> Q3, matches rule_2
console.log('Q3 matched result:', resultQ3);
assert.strictEqual(resultQ3, 'Rất hài lòng');

console.log('✅ evaluateWeightedRule matching passed!');
console.log('\nALL UNIT TESTS PASSED SUCCESSFULLY! 🚀');
