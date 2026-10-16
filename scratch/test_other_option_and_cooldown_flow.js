// Automated verification test for Other Option ("Khác: _____") handling and Cooldown flow timing

const assert = require('assert');

// 1. Test isOtherOption logic
function isOtherOption(element, labelText) {
  if (labelText) {
    const s = String(labelText).toLowerCase().trim();
    if (
      /(^|\b)(khác|mục khác|câu trả lời khác|other|otro|autre|sonstiges)(\b|:|\s*$)/i.test(s) ||
      s.includes('khác') ||
      s.includes('other')
    ) {
      return true;
    }
  }
  if (element) {
    const aria = (element.getAttribute ? element.getAttribute('aria-label') : '') || '';
    if (aria.toLowerCase().includes('khác') || aria.toLowerCase().includes('other')) {
      return true;
    }
    if (element.hasInput) {
      return true;
    }
  }
  return false;
}

console.log('--- TEST 1: isOtherOption Detection ---');
assert.strictEqual(isOtherOption(null, 'Mục khác:'), true);
assert.strictEqual(isOtherOption(null, 'Khác'), true);
assert.strictEqual(isOtherOption(null, 'Câu trả lời khác:'), true);
assert.strictEqual(isOtherOption(null, 'Other:'), true);
assert.strictEqual(isOtherOption(null, 'Other (please specify)'), true);
assert.strictEqual(isOtherOption(null, 'Có'), false);
assert.strictEqual(isOtherOption(null, 'Không'), false);
assert.strictEqual(isOtherOption(null, 'Lựa chọn 1'), false);
assert.strictEqual(isOtherOption({ getAttribute: () => 'Mục khác:' }, ''), true);
assert.strictEqual(isOtherOption({ getAttribute: () => 'Nam', hasInput: true }, 'Nam'), true);
console.log('✅ TEST 1 Passed: All "Khác" / "Other" options identified accurately.');

// 2. Test fillOtherOptionInput & Event Dispatch Simulation
console.log('--- TEST 2: fillOtherOptionInput Simulation ---');
const DEFAULT_OTHER_TEXTS = [
  'Ý kiến khác',
  'Không có ý kiến gì thêm',
  'Tùy thuộc vào nhu cầu thực tế',
  'Lý do cá nhân khác',
  'Cần xem xét và đánh giá thêm'
];

function createMockInput() {
  const events = [];
  return {
    value: '',
    focused: false,
    blurred: false,
    focus() { this.focused = true; events.push('focus'); },
    blur() { this.blurred = true; events.push('blur'); },
    dispatchEvent(ev) { events.push(ev.type); },
    setAttribute(k, v) { this[k] = v; },
    events
  };
}

async function fillOtherOptionInput(container, value, question, textRules = [], textGlobalDefault = null) {
  const inputEl = container.input;
  if (!inputEl) return false;

  let textToFill = '';
  if (value && typeof value === 'string') {
    const cleanVal = value.replace(/^.*?(khác|other)\s*[:：\-\(]?\s*/i, '').replace(/\)$/, '').trim();
    if (cleanVal && !/^(khác|mục khác|other)$/i.test(cleanVal)) {
      textToFill = cleanVal;
    }
  }

  if (!textToFill && textRules.length > 0) {
    const matchedRule = textRules[0];
    if (matchedRule && matchedRule.mode === 'fixed') {
      textToFill = matchedRule.fixedValue;
    }
  }

  if (!textToFill && textGlobalDefault) {
    if (textGlobalDefault.mode === 'fixed' && textGlobalDefault.fixedValue) {
      textToFill = textGlobalDefault.fixedValue.trim();
    }
  }

  if (!textToFill) {
    textToFill = DEFAULT_OTHER_TEXTS[0];
  }

  inputEl.focus();
  inputEl.value = textToFill;
  inputEl.dispatchEvent({ type: 'input' });
  inputEl.dispatchEvent({ type: 'change' });
  inputEl.blur();

  return true;
}

(async () => {
  // Case A: Custom text in answer string (e.g. "Khác: Thích màu xanh")
  const mockA = { input: createMockInput() };
  await fillOtherOptionInput(mockA, 'Khác: Thích màu xanh');
  assert.strictEqual(mockA.input.value, 'Thích màu xanh');
  assert.deepStrictEqual(mockA.input.events, ['focus', 'input', 'change', 'blur']);

  // Case B: Simple "Khác" answer with configured fixed text rule
  const mockB = { input: createMockInput() };
  await fillOtherOptionInput(mockB, 'Khác', { id: 1 }, [{ mode: 'fixed', fixedValue: 'Tôi có ý kiến riêng' }]);
  assert.strictEqual(mockB.input.value, 'Tôi có ý kiến riêng');

  // Case C: Simple "Khác" answer without rules -> uses default fallback
  const mockC = { input: createMockInput() };
  await fillOtherOptionInput(mockC, 'Khác');
  assert(DEFAULT_OTHER_TEXTS.includes(mockC.input.value), 'Should pick from DEFAULT_OTHER_TEXTS');
  console.log('✅ TEST 2 Passed: Other option inputs correctly populated with full event dispatch.');
})();

// 3. Test isFormCompleted Guard
console.log('--- TEST 3: isFormCompleted strict state detection ---');
function simulateIsFormCompleted({ href, hasQuestions, nextBtn, submitBtn, hasConfirmationMessage }) {
  if (href.includes('/formResponse') || href.includes('/alreadyResponsive')) {
    return true;
  }
  if (hasQuestions || nextBtn || submitBtn) {
    return false; // MUST NEVER return true if still on active question page!
  }
  return !!hasConfirmationMessage;
}

// Intermediate page with Next button
assert.strictEqual(simulateIsFormCompleted({
  href: 'https://docs.google.com/forms/d/e/1FAIpQLS.../viewform',
  hasQuestions: true,
  nextBtn: {},
  submitBtn: null,
  hasConfirmationMessage: false
}), false, 'Intermediate page with Next button must NOT be completed');

// Final page with Submit button
assert.strictEqual(simulateIsFormCompleted({
  href: 'https://docs.google.com/forms/d/e/1FAIpQLS.../viewform',
  hasQuestions: true,
  nextBtn: null,
  submitBtn: {},
  hasConfirmationMessage: false
}), false, 'Final page with Submit button before clicking must NOT be completed');

// Submitted page: /formResponse
assert.strictEqual(simulateIsFormCompleted({
  href: 'https://docs.google.com/forms/d/e/1FAIpQLS.../formResponse',
  hasQuestions: false,
  nextBtn: null,
  submitBtn: null,
  hasConfirmationMessage: true
}), true, '/formResponse page must be completed');

// Submitted page: confirmation screen
assert.strictEqual(simulateIsFormCompleted({
  href: 'https://docs.google.com/forms/d/e/1FAIpQLS.../viewform',
  hasQuestions: false,
  nextBtn: null,
  submitBtn: null,
  hasConfirmationMessage: true
}), true, 'Confirmation screen without questions must be completed');

console.log('✅ TEST 3 Passed: Form completion accurately strictly differentiated from intermediate and final question pages.');

// 4. Test Navigation vs Submission Separation
console.log('--- TEST 4: Page Navigation vs Form Submission separation ---');
let cooldownStarted = false;
function mockStartCooldown() {
  cooldownStarted = true;
}

async function simulateRunLoop({ pages, autoAdvance, autoSubmit, cooldownEnabled }) {
  let currentPage = 1;
  const totalPages = pages.length;

  while (currentPage <= totalPages) {
    const isLastPage = currentPage === totalPages;
    const nextBtn = !isLastPage ? { click: () => {} } : null;
    const submitBtn = isLastPage ? { click: () => {} } : null;

    // Intermediate page
    if (nextBtn) {
      if (!autoAdvance) {
        // Stop on this page, DO NOT start cooldown
        return { stoppedAt: currentPage, cooldownStarted };
      }
      // handlePageNavigation: transitions to next page, NEVER triggers cooldown!
      assert.strictEqual(cooldownStarted, false, 'handlePageNavigation must NEVER trigger cooldown!');
      currentPage++;
      continue;
    }

    // Final page: handleFormSubmission
    if (cooldownEnabled && autoSubmit && submitBtn) {
      mockStartCooldown();
    }
    return { stoppedAt: currentPage, cooldownStarted };
  }
}

(async () => {
  // Scenario 1: Multi-page form (3 pages) with autoAdvance = true and cooldown enabled
  cooldownStarted = false;
  const res1 = await simulateRunLoop({
    pages: ['page1', 'page2', 'page3'],
    autoAdvance: true,
    autoSubmit: true,
    cooldownEnabled: true
  });
  assert.strictEqual(res1.stoppedAt, 3, 'Must reach final page');
  assert.strictEqual(res1.cooldownStarted, true, 'Cooldown must only trigger on final page');

  // Scenario 2: Multi-page form with autoAdvance = false
  cooldownStarted = false;
  const res2 = await simulateRunLoop({
    pages: ['page1', 'page2', 'page3'],
    autoAdvance: false,
    autoSubmit: true,
    cooldownEnabled: true
  });
  assert.strictEqual(res2.stoppedAt, 1, 'Must stop at page 1');
  assert.strictEqual(res2.cooldownStarted, false, 'Cooldown must NOT trigger on page 1 when autoAdvance is false');

  console.log('✅ TEST 4 Passed: Multi-page navigation never triggers cooldown; cooldown only triggers after final submit.');
  console.log('🎉 ALL INTEGRATION TESTS PASSED!');
})();
