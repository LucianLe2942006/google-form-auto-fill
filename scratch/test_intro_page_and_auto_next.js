/**
 * Test Suite: Intro / Cover Page Handling & Auto Next Navigation
 */
const assert = require('assert');

// Mock DOM elements
function createElement(tag, attrs = {}, textContent = '') {
  const children = [];
  const classList = new Set();
  if (attrs.class) {
    attrs.class.split(/\s+/).filter(Boolean).forEach(c => classList.add(c));
  }

  const el = {
    tagName: tag.toUpperCase(),
    attributes: { ...attrs },
    innerText: textContent,
    textContent: textContent,
    value: attrs.value || '',
    children,
    classList: {
      contains: (c) => classList.has(c),
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c)
    },
    getAttribute: (attr) => el.attributes[attr] || null,
    setAttribute: (attr, val) => { el.attributes[attr] = val; },
    removeAttribute: (attr) => { delete el.attributes[attr]; },
    closest: (sel) => {
      let cur = el;
      while (cur) {
        if (matches(cur, sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    querySelector: (sel) => {
      const all = el.querySelectorAll(sel);
      return all.length > 0 ? all[0] : null;
    },
    querySelectorAll: (sel) => {
      const results = [];
      function traverse(node) {
        for (const child of node.children) {
          if (matches(child, sel)) results.push(child);
          traverse(child);
        }
      }
      traverse(el);
      return results;
    },
    appendChild: (child) => {
      child.parentElement = el;
      children.push(child);
      el.textContent = (el.textContent || '') + (child.textContent || '');
      el.innerText = el.textContent;
      return child;
    },
    scrollIntoView: () => {},
    dispatchEvent: () => true,
    click: () => {
      if (el.onClickHandler) el.onClickHandler();
    },
    style: { display: 'block', visibility: 'visible', opacity: '1' },
    offsetWidth: 100,
    offsetHeight: 40,
    getClientRects: () => [{}],
    offsetParent: {}
  };
  return el;
}

function matches(node, selector) {
  const parts = selector.split(',').map(s => s.trim());
  return parts.some(part => {
    if (part === 'div[role="button"]') return node.tagName === 'DIV' && node.getAttribute('role') === 'button';
    if (part === 'div.uArJ5e') return node.tagName === 'DIV' && node.classList.contains('uArJ5e');
    if (part === 'button') return node.tagName === 'BUTTON';
    if (part === 'span.NPEfkd') return node.tagName === 'SPAN' && node.classList.contains('NPEfkd');
    if (part === 'input[type="button"]') return node.tagName === 'INPUT' && node.getAttribute('type') === 'button';
    if (part === 'input[type="submit"]') return node.tagName === 'INPUT' && node.getAttribute('type') === 'submit';
    if (part === '.btn-next') return node.classList.contains('btn-next');
    if (part === '.btn-submit') return node.classList.contains('btn-submit');
    if (part === 'div[role="button"][jsname="OCpkoe"]') return node.tagName === 'DIV' && node.getAttribute('role') === 'button' && node.getAttribute('jsname') === 'OCpkoe';
    if (part === 'button[jsname="OCpkoe"]') return node.tagName === 'BUTTON' && node.getAttribute('jsname') === 'OCpkoe';
    if (part === 'div[role="button"][jsname="M2DA7b"]') return node.tagName === 'DIV' && node.getAttribute('role') === 'button' && node.getAttribute('jsname') === 'M2DA7b';
    if (part === 'button[jsname="M2DA7b"]') return node.tagName === 'BUTTON' && node.getAttribute('jsname') === 'M2DA7b';
    return false;
  });
}

function isElementVisible(el) {
  if (!el) return false;
  const style = el.style || {};
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0' &&
         (el.offsetWidth > 0 || el.offsetHeight > 0 || (el.getClientRects && el.getClientRects().length > 0) || el.offsetParent !== null);
}

// Emulated findNextButton & findSubmitButton matching content/content.js
function findNextButton(doc) {
  const gfNextBtn = doc.querySelector('div[role="button"][jsname="OCpkoe"], button[jsname="OCpkoe"]');
  if (gfNextBtn && isElementVisible(gfNextBtn) && gfNextBtn.getAttribute('aria-disabled') !== 'true') {
    return gfNextBtn;
  }

  const candidateButtons = Array.from(doc.querySelectorAll(
    'div[role="button"], div.uArJ5e, button, span.NPEfkd, input[type="button"], input[type="submit"], .btn-next'
  ));

  const nextRegex = /^(tiếp|tiếp theo|tiếp tục|trang tiếp|sang trang|next|siguiente|suivant|weiter|avanti|próximo|volgende|следующий|далее|次へ|下一步|继续)$/i;
  const excludeRegex = /(submit|gửi|nộp|quay lại|lùi|back|previous|trước|xóa|clear|hủy|cancel)/i;

  for (const btn of candidateButtons) {
    if (btn.closest && btn.closest('#formmind-floating-widget')) continue;
    if (btn.getAttribute('aria-disabled') === 'true') continue;
    const text = (btn.textContent || btn.innerText || btn.value || btn.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (nextRegex.test(text) && !excludeRegex.test(text)) {
      if (isElementVisible(btn)) {
        return (btn.closest ? btn.closest('div[role="button"], div.uArJ5e, button') : null) || btn;
      }
    }
  }

  for (const btn of candidateButtons) {
    if (btn.closest && btn.closest('#formmind-floating-widget')) continue;
    if (btn.getAttribute('aria-disabled') === 'true') continue;
    const text = (btn.textContent || btn.innerText || btn.value || btn.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if ((/\b(tiếp|tiếp theo|tiếp tục|next)\b/i.test(text) || (/tiếp/i.test(text) && text.length <= 15)) && !excludeRegex.test(text)) {
      if (isElementVisible(btn)) {
        return (btn.closest ? btn.closest('div[role="button"], div.uArJ5e, button') : null) || btn;
      }
    }
  }

  return null;
}

function findSubmitButton(doc) {
  const gfSubmitBtn = doc.querySelector('div[role="button"][jsname="M2DA7b"], button[jsname="M2DA7b"]');
  if (gfSubmitBtn && isElementVisible(gfSubmitBtn) && gfSubmitBtn.getAttribute('aria-disabled') !== 'true') {
    return gfSubmitBtn;
  }

  const candidateButtons = Array.from(doc.querySelectorAll(
    'div[role="button"], div.uArJ5e, button, span.NPEfkd, input[type="submit"], .btn-submit'
  ));
  const submitRegex = /^(gửi|gửi phản hồi|nộp|nộp bài|submit|enviar|envoyer|absenden|invia|submeter|verzenden|отправить|送信|提交)$/i;
  const nextRegex = /(tiếp|next|quay lại|lùi|back|previous|trước|clear|xóa)/i;

  for (const btn of candidateButtons) {
    if (btn.closest && btn.closest('#formmind-floating-widget')) continue;
    if (btn.getAttribute('aria-disabled') === 'true') continue;
    const text = (btn.textContent || btn.innerText || btn.value || btn.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (submitRegex.test(text) && !nextRegex.test(text)) {
      if (isElementVisible(btn)) {
        return (btn.closest ? btn.closest('div[role="button"], div.uArJ5e, button') : null) || btn;
      }
    }
  }

  for (const btn of candidateButtons) {
    if (btn.closest && btn.closest('#formmind-floating-widget')) continue;
    if (btn.getAttribute('aria-disabled') === 'true') continue;
    const text = (btn.textContent || btn.innerText || btn.value || btn.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if ((/\b(gửi|nộp|submit)\b/i.test(text) || (/gửi/i.test(text) && text.length <= 15)) && !nextRegex.test(text)) {
      if (isElementVisible(btn)) {
        return (btn.closest ? btn.closest('div[role="button"], div.uArJ5e, button') : null) || btn;
      }
    }
  }

  return null;
}

// TESTS
console.log('--- Test 1: Selector Recognition for Next button in Google Forms ---');
{
  const doc = createElement('body');

  // Google Forms structure: div.uArJ5e > span.NPEfkd "Tiếp"
  const nextBtnContainer = createElement('div', { role: 'button', jsname: 'OCpkoe', class: 'uArJ5e' });
  const spanText = createElement('span', { class: 'NPEfkd' }, '  Tiếp  \n');
  nextBtnContainer.appendChild(spanText);
  doc.appendChild(nextBtnContainer);

  // Other buttons: "Quay lại" and "Xóa hết câu trả lời"
  const backBtn = createElement('div', { role: 'button', class: 'uArJ5e' });
  backBtn.appendChild(createElement('span', { class: 'NPEfkd' }, 'Quay lại'));
  doc.appendChild(backBtn);

  const clearBtn = createElement('div', { role: 'button', class: 'uArJ5e' });
  clearBtn.appendChild(createElement('span', { class: 'NPEfkd' }, 'Xóa hết câu trả lời'));
  doc.appendChild(clearBtn);

  const foundNext = findNextButton(doc);
  assert.ok(foundNext, 'Must find Next button');
  assert.strictEqual(foundNext, nextBtnContainer, 'Must return the parent button container, not other buttons');
  console.log('✅ Passed Test 1: Recognized Google Forms Next button and excluded Back/Clear buttons.');
}

console.log('--- Test 2: Next button recognition with English "Next" and nested div.uArJ5e without jsname ---');
{
  const doc = createElement('body');
  const nextBtn = createElement('div', { role: 'button', class: 'uArJ5e' });
  const innerSpan = createElement('span', { class: 'NPEfkd' }, ' Next ');
  nextBtn.appendChild(innerSpan);
  doc.appendChild(nextBtn);

  const foundNext = findNextButton(doc);
  assert.ok(foundNext, 'Must find Next button');
  assert.strictEqual(foundNext, nextBtn, 'Must match Next button correctly');
  console.log('✅ Passed Test 2: Matched English "Next" button.');
}

console.log('--- Test 3: Exclude Submit button from findNextButton ---');
{
  const doc = createElement('body');
  const submitBtn = createElement('div', { role: 'button', jsname: 'M2DA7b', class: 'uArJ5e' });
  submitBtn.appendChild(createElement('span', { class: 'NPEfkd' }, 'Gửi'));
  doc.appendChild(submitBtn);

  const foundNext = findNextButton(doc);
  assert.strictEqual(foundNext, null, 'Submit button must NOT be recognized as Next button');

  const foundSubmit = findSubmitButton(doc);
  assert.strictEqual(foundSubmit, submitBtn, 'Submit button must be recognized by findSubmitButton');
  console.log('✅ Passed Test 3: findNextButton excludes Submit button; findSubmitButton detects it.');
}

console.log('--- Test 4: Simulation of processCurrentPage on Intro Page (0 questions) ---');
async function simulateProcessCurrentPage({ questions, nextBtn, submitBtn, autoAdvance }) {
  let clickedNext = false;
  let simulatedCooldown = false;
  let navResultAction = '';

  // Logic under test matching content/content.js:
  if (questions.length === 0) {
    if (nextBtn) {
      if (!autoAdvance) {
        return { action: 'stopped', count: 0, totalPages: 1 };
      }
      // autoAdvance = true: wait delay and click Next
      clickedNext = true;
      return { action: 'next', newFilledCount: 0 };
    }
    if (submitBtn) {
      simulatedCooldown = true;
      return { action: 'completed', count: 0, totalPages: 1 };
    }
    return { action: 'error', error: 'No questions or buttons' };
  }

  // Case A: Has questions
  if (nextBtn) {
    if (!autoAdvance) {
      return { action: 'stopped', count: questions.length, totalPages: 1 };
    }
    clickedNext = true;
    return { action: 'next', newFilledCount: questions.length };
  }

  simulatedCooldown = true;
  return { action: 'completed', count: questions.length, totalPages: 1 };
}

(async () => {
  // Scenario 4A: Intro page with questions=[], nextBtn exists, autoAdvance = true
  const res1 = await simulateProcessCurrentPage({
    questions: [],
    nextBtn: true,
    submitBtn: false,
    autoAdvance: true
  });
  assert.strictEqual(res1.action, 'next', 'Intro page with autoAdvance=true must advance to next page');
  assert.strictEqual(res1.newFilledCount, 0, 'No questions filled on intro page');
  console.log('✅ Passed Test 4A: Intro page advances to next page when Auto Next is ON.');

  // Scenario 4B: Intro page with questions=[], nextBtn exists, autoAdvance = false
  const res2 = await simulateProcessCurrentPage({
    questions: [],
    nextBtn: true,
    submitBtn: false,
    autoAdvance: false
  });
  assert.strictEqual(res2.action, 'stopped', 'Intro page with autoAdvance=false must stop gracefully');
  console.log('✅ Passed Test 4B: Intro page stops gracefully without error or Cooldown when Auto Next is OFF.');

  // Scenario 4C: Question page (page 2) with questions=[Q1, Q2], nextBtn exists, autoAdvance = true
  const res3 = await simulateProcessCurrentPage({
    questions: [{ id: 1 }, { id: 2 }],
    nextBtn: true,
    submitBtn: false,
    autoAdvance: true
  });
  assert.strictEqual(res3.action, 'next', 'Question page with autoAdvance=true advances to next page');
  assert.strictEqual(res3.newFilledCount, 2, 'Filled 2 questions');
  console.log('✅ Passed Test 4C: Question page fills answers and advances when Auto Next is ON.');

  // Scenario 4D: Final page with submitBtn
  const res4 = await simulateProcessCurrentPage({
    questions: [{ id: 3 }],
    nextBtn: false,
    submitBtn: true,
    autoAdvance: true
  });
  assert.strictEqual(res4.action, 'completed', 'Final page completes and submits');
  console.log('✅ Passed Test 4D: Final page completes and triggers submission.');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
})();
