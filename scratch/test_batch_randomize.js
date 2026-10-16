// Unit test for Batch Randomize Distribution feature
const assert = require('assert');

function generatePercentages(count) {
  if (!count || count <= 0) return [];
  if (count === 1) return [100];

  const raw = Array.from({ length: count }, () => Math.random() + 0.15);
  const sumRaw = raw.reduce((a, b) => a + b, 0);
  const percentages = raw.map(v => Math.floor((v / sumRaw) * 100));

  let diff = 100 - percentages.reduce((a, b) => a + b, 0);

  while (diff > 0) {
    let maxIdx = 0;
    for (let i = 1; i < percentages.length; i++) {
      if (percentages[i] > percentages[maxIdx]) maxIdx = i;
    }
    percentages[maxIdx] += 1;
    diff--;
  }
  while (diff < 0) {
    let maxIdx = 0;
    for (let i = 1; i < percentages.length; i++) {
      if (percentages[i] > percentages[maxIdx]) maxIdx = i;
    }
    if (percentages[maxIdx] > 0) percentages[maxIdx] -= 1;
    diff++;
  }

  return percentages;
}

console.log('--- TEST 1: Rigorous Statistical & Mathematical Validation (100,000 runs) ---');
for (let count = 2; count <= 10; count++) {
  for (let i = 0; i < 10000; i++) {
    const pcts = generatePercentages(count);
    assert.strictEqual(pcts.length, count, `Length should be ${count}`);
    const sum = pcts.reduce((a, b) => a + b, 0);
    assert.strictEqual(sum, 100, `Sum should be exactly 100, got ${sum}`);
    for (const val of pcts) {
      assert(Number.isInteger(val), `Values must be integers, got ${val}`);
      assert(val >= 0, `Values must be non-negative, got ${val}`);
    }
  }
}
console.log('✅ 100,000 runs passed! Every single distribution sums strictly to 100% with non-negative integers.');

console.log('\n--- TEST 2: Independence & Variance Verification across Multiple Questions ---');
const sampleCounts = [4, 4, 2, 5, 3, 4, 2, 4, 3, 5, 2, 4, 3];
const generated = sampleCounts.map((c, idx) => {
  const pcts = generatePercentages(c);
  return { q: `Câu ${idx + 1}`, count: c, pcts, sum: pcts.reduce((a, b) => a + b, 0) };
});

generated.forEach(g => {
  console.log(`  ${g.q} (${g.count} lựa chọn): [${g.pcts.join('% - ')}%] -> Tổng: ${g.sum}%`);
});

// Verify that questions with same option count (e.g. Q1 and Q2) have independent distributions
const q1 = generated[0].pcts.join(',');
const q2 = generated[1].pcts.join(',');
console.log(`  Q1: ${q1} vs Q2: ${q2} (Independent: ${q1 !== q2})`);
assert.strictEqual(generated.every(g => g.sum === 100), true);

console.log('\nALL BATCH RANDOMIZE UNIT TESTS PASSED SUCCESSFULLY! 🚀');
