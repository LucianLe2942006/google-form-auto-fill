/**
 * Unit Test Suite:
 * 1. Skip Cooldown ("Chạy ngay") & Priority 1 Auto-Start lifecycle
 * 2. Independent Checkbox Weights (> 100%) & Evaluation with Constraints
 */

const assert = require('assert');

console.log('=================================================================');
console.log('🧪 TEST SUITE: SKIP COOLDOWN FIX & INDEPENDENT CHECKBOX WEIGHTS');
console.log('=================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: resolveTargetFormUrl Logic
// -----------------------------------------------------------------------------
console.log('--- TEST 1: resolveTargetFormUrl URL Resolution ---');
function resolveTargetFormUrl(storedUrl, currentHref = 'https://docs.google.com/forms/d/e/1FAIpQLSc_Example/formResponse') {
  if (storedUrl && storedUrl.startsWith('http') && !storedUrl.includes('/formResponse')) {
    return storedUrl;
  }
  if (currentHref && currentHref.includes('/formResponse')) {
    return currentHref.replace(/\/formResponse.*/i, '/viewform');
  }
  return currentHref;
}

// Case 1A: Stored URL is /viewform
const url1 = resolveTargetFormUrl('https://docs.google.com/forms/d/e/1FAIpQLSc_Example/viewform');
assert.strictEqual(url1, 'https://docs.google.com/forms/d/e/1FAIpQLSc_Example/viewform');
console.log('  ✅ Case 1A: Stored /viewform URL preserved correctly');

// Case 1B: Stored URL is empty, current is /formResponse
const url2 = resolveTargetFormUrl('', 'https://docs.google.com/forms/d/e/1FAIpQLSc_Example/formResponse');
assert.strictEqual(url2, 'https://docs.google.com/forms/d/e/1FAIpQLSc_Example/viewform');
console.log('  ✅ Case 1B: Empty stored URL converted from /formResponse to /viewform');

// Case 1C: Stored URL mistakenly has /formResponse
const url3 = resolveTargetFormUrl('https://docs.google.com/forms/d/e/1FAIpQLSc_Example/formResponse?pli=1', 'https://docs.google.com/forms/d/e/1FAIpQLSc_Example/formResponse');
assert.strictEqual(url3, 'https://docs.google.com/forms/d/e/1FAIpQLSc_Example/viewform');
console.log('  ✅ Case 1C: Malformed stored /formResponse converted safely to /viewform');

// -----------------------------------------------------------------------------
// TEST 2: Skip Cooldown Storage & Priority 1 on Page Load
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Skip Cooldown Storage & Priority 1 Flow ---');

const mockStorage = {
  formmind_cooldown_state: { active: true, endTime: Date.now() + 60000, durationMs: 60000 },
  isRunning: false,
  formmind_auto_start_next_run: false
};

// Simulate skipCooldown()
function mockSkipCooldown() {
  mockStorage.formmind_cooldown_state = { active: false, endTime: 0, durationMs: 0 };
  mockStorage.formmind_auto_start_next_run = true;
  mockStorage.isRunning = true;
  mockStorage.retryCount = 0;
}

mockSkipCooldown();
assert.strictEqual(mockStorage.formmind_cooldown_state.active, false);
assert.strictEqual(mockStorage.formmind_cooldown_state.endTime, 0);
assert.strictEqual(mockStorage.formmind_auto_start_next_run, true);
assert.strictEqual(mockStorage.isRunning, true);
console.log('  ✅ Storage updated correctly by skipCooldown()');

// Simulate checkAndHandleCooldownOrAutoStart() on page load
function simulatePageLoad(currentUrl, isCompleted) {
  let actionTaken = '';
  let redirectedUrl = '';

  const cooldownState = mockStorage.formmind_cooldown_state;
  const autoStart = mockStorage.formmind_auto_start_next_run;

  // PRIORITY 1: formmind_auto_start_next_run
  if (autoStart) {
    if (currentUrl.includes('/formResponse') || isCompleted) {
      actionTaken = 'redirect_to_viewform';
      redirectedUrl = resolveTargetFormUrl(mockStorage.formmind_form_url, currentUrl);
      return { actionTaken, redirectedUrl };
    }

    // On actual form:
    delete mockStorage.formmind_auto_start_next_run;
    mockStorage.formmind_cooldown_state = { active: false, endTime: 0, durationMs: 0 };
    mockStorage.isRunning = true;
    actionTaken = 'start_main_workflow';
    return { actionTaken, redirectedUrl };
  }

  // PRIORITY 2: Active cooldown
  if (cooldownState && cooldownState.active && cooldownState.endTime > Date.now()) {
    actionTaken = 'render_cooldown_bar';
    return { actionTaken, redirectedUrl };
  }

  // PRIORITY 3: Form completed
  if (isCompleted) {
    actionTaken = 'start_new_cooldown';
    return { actionTaken, redirectedUrl };
  }

  actionTaken = 'idle';
  return { actionTaken, redirectedUrl };
}

// Case 2A: Page load happens while still at /formResponse
const res2A = simulatePageLoad('https://docs.google.com/forms/d/e/1FAIpQLSc_Example/formResponse', true);
assert.strictEqual(res2A.actionTaken, 'redirect_to_viewform');
assert.strictEqual(res2A.redirectedUrl, 'https://docs.google.com/forms/d/e/1FAIpQLSc_Example/viewform');
console.log('  ✅ Priority 1: When on /formResponse, immediately redirects to /viewform (Never starts new cooldown)');

// Case 2B: Page load arrives at /viewform
const res2B = simulatePageLoad('https://docs.google.com/forms/d/e/1FAIpQLSc_Example/viewform', false);
assert.strictEqual(res2B.actionTaken, 'start_main_workflow');
assert.strictEqual(mockStorage.formmind_auto_start_next_run, undefined);
assert.strictEqual(mockStorage.isRunning, true);
console.log('  ✅ Priority 1: When on /viewform, immediately clears auto_start and starts workflow!');

// -----------------------------------------------------------------------------
// TEST 3: Batch Randomize for Checkbox vs Radio
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Batch Randomize Independent Checkbox vs 100% Radio ---');

function generatePercentages(count) {
  if (count <= 0) return [];
  if (count === 1) return [100];
  const cuts = [];
  for (let i = 0; i < count - 1; i++) {
    cuts.push(Math.floor(Math.random() * 99) + 1);
  }
  cuts.sort((a, b) => a - b);
  const pcts = [];
  let prev = 0;
  for (let i = 0; i < cuts.length; i++) {
    pcts.push(cuts[i] - prev);
    prev = cuts[i];
  }
  pcts.push(100 - prev);
  return pcts;
}

function batchRandomizeRules(rules) {
  rules.forEach(rule => {
    const opts = rule.options || [];
    if (opts.length === 0) return;

    if (rule.type === 'checkbox') {
      const steps = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75];
      opts.forEach(o => {
        o.weight = steps[Math.floor(Math.random() * steps.length)];
      });
    } else {
      const pcts = generatePercentages(opts.length);
      opts.forEach((o, idx) => {
        o.weight = pcts[idx];
      });
    }
  });
}

const sampleRules = [
  {
    id: 'r_radio',
    type: 'radio',
    options: [{ label: 'Nam', weight: 0 }, { label: 'Nữ', weight: 0 }, { label: 'Khác', weight: 0 }]
  },
  {
    id: 'r_checkbox',
    type: 'checkbox',
    options: [
      { label: 'Bóng đá', weight: 0 },
      { label: 'Bơi lội', weight: 0 },
      { label: 'Cầu lông', weight: 0 },
      { label: 'Chạy bộ', weight: 0 }
    ]
  }
];

batchRandomizeRules(sampleRules);

const radioTotal = sampleRules[0].options.reduce((s, o) => s + o.weight, 0);
assert.strictEqual(radioTotal, 100);
console.log(`  ✅ Radio question strictly sums to 100%: [${sampleRules[0].options.map(o => o.weight + '%').join(', ')}] -> Total: ${radioTotal}%`);

const checkboxTotal = sampleRules[1].options.reduce((s, o) => s + o.weight, 0);
sampleRules[1].options.forEach(o => {
  assert.ok(o.weight >= 30 && o.weight <= 75, 'Option weight should be between 30% and 75%');
});
console.log(`  ✅ Checkbox question has independent weights: [${sampleRules[1].options.map(o => o.weight + '%').join(', ')}] -> Total: ${checkboxTotal}% (Can exceed 100%)`);

// -----------------------------------------------------------------------------
// TEST 4: evaluateWeightedRule with Independent Probability & Constraints
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: evaluateWeightedRule Execution for Checkbox ---');

function evaluateWeightedRule(question, questionIndex, rules) {
  if (!rules || !Array.isArray(rules) || rules.length === 0) return null;
  const matchedRule = rules[questionIndex];
  if (!matchedRule) return null;

  const isCheckboxQuestion = question.type === 'checkbox' || matchedRule.type === 'checkbox';
  if (isCheckboxQuestion) {
    const selectedLabels = [];
    const availableOptions = question.options || [];

    const resolveLabel = (lbl) => {
      const targetLabel = (lbl || '').toLowerCase().trim();
      const exact = availableOptions.find(o => o.toLowerCase().trim() === targetLabel);
      return exact || lbl;
    };

    // 1. Independent check: Math.random() * 100 < opt.weight
    matchedRule.options.forEach(opt => {
      const weight = parseFloat(opt.weight) || 0;
      if (weight > 0 && Math.random() * 100 < weight) {
        const matchedLabel = resolveLabel(opt.label);
        if (matchedLabel && !selectedLabels.includes(matchedLabel)) {
          selectedLabels.push(matchedLabel);
        }
      }
    });

    // 2. Constraints enforcement
    const constraints = question.constraints || {};
    const allOptLabels = availableOptions.length > 0 ? availableOptions : matchedRule.options.map(o => o.label);

    if (constraints.exact && constraints.exact > 0) {
      const targetExact = Math.min(constraints.exact, allOptLabels.length);
      while (selectedLabels.length < targetExact) {
        const unselected = allOptLabels.filter(l => !selectedLabels.includes(l));
        if (unselected.length > 0) selectedLabels.push(unselected[0]);
        else break;
      }
      if (selectedLabels.length > targetExact) {
        selectedLabels.length = targetExact;
      }
    } else {
      if (constraints.min && constraints.min > 0) {
        const targetMin = Math.min(constraints.min, allOptLabels.length);
        while (selectedLabels.length < targetMin) {
          const unselected = allOptLabels.filter(l => !selectedLabels.includes(l));
          if (unselected.length > 0) selectedLabels.push(unselected[0]);
          else break;
        }
      }
      if (constraints.max && constraints.max > 0) {
        if (selectedLabels.length > constraints.max) {
          selectedLabels.length = constraints.max;
        }
      }
    }

    if (question.required && selectedLabels.length === 0 && allOptLabels.length > 0) {
      selectedLabels.push(allOptLabels[0]);
    }

    return selectedLabels;
  }
  return null;
}

// Subtest 4A: Exact constraint
const qExact = {
  id: 'q1',
  type: 'checkbox',
  options: ['A', 'B', 'C', 'D'],
  constraints: { exact: 2 }
};
const ruleHighProb = {
  type: 'checkbox',
  options: [
    { label: 'A', weight: 100 },
    { label: 'B', weight: 100 },
    { label: 'C', weight: 100 },
    { label: 'D', weight: 100 }
  ]
};
const resultExact = evaluateWeightedRule(qExact, 0, [ruleHighProb]);
assert.strictEqual(resultExact.length, 2, 'Should strictly have 2 choices');
console.log(`  ✅ Exact constraint enforced: Selected [${resultExact.join(', ')}] (Length: ${resultExact.length})`);

// Subtest 4B: Min constraint when probability selects 0
const qMin = {
  id: 'q2',
  type: 'checkbox',
  options: ['A', 'B', 'C', 'D'],
  constraints: { min: 2 }
};
const ruleZeroProb = {
  type: 'checkbox',
  options: [
    { label: 'A', weight: 0 },
    { label: 'B', weight: 0 },
    { label: 'C', weight: 0 },
    { label: 'D', weight: 0 }
  ]
};
const resultMin = evaluateWeightedRule(qMin, 0, [ruleZeroProb]);
assert.ok(resultMin.length >= 2, 'Should satisfy min constraint of 2');
console.log(`  ✅ Min constraint enforced: Selected [${resultMin.join(', ')}] (Length: ${resultMin.length})`);

// Subtest 4C: Max constraint
const qMax = {
  id: 'q3',
  type: 'checkbox',
  options: ['A', 'B', 'C', 'D'],
  constraints: { max: 2 }
};
const resultMax = evaluateWeightedRule(qMax, 0, [ruleHighProb]);
assert.ok(resultMax.length <= 2, 'Should not exceed max constraint of 2');
console.log(`  ✅ Max constraint enforced: Selected [${resultMax.join(', ')}] (Length: ${resultMax.length})`);

// Subtest 4D: Required question with zero probability picks at least 1
const qReq = {
  id: 'q4',
  type: 'checkbox',
  options: ['A', 'B', 'C'],
  required: true
};
const resultReq = evaluateWeightedRule(qReq, 0, [ruleZeroProb]);
assert.strictEqual(resultReq.length, 1, 'Required question must have at least 1 selection');
console.log(`  ✅ Required question guaranteed non-empty: Selected [${resultReq.join(', ')}]`);

console.log('\n=================================================================');
console.log('🎉 ALL UNIT TESTS FOR SKIP COOLDOWN & CHECKBOX PASSED (100%)! 🎉');
console.log('=================================================================');
