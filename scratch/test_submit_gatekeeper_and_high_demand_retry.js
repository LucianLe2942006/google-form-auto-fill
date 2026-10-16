/**
 * Unit Test Suite for:
 * 1. Submit Button Detection & Gatekeeper (Must click Submit, Cooldown strictly blocked while Submit button exists)
 * 2. High Demand (Quá tải) Retry Mechanism (Max 3 retries with countdown & give-up state)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const contentJsCode = fs.readFileSync(path.join(__dirname, '..', 'content', 'content.js'), 'utf8');

function extractFunction(code, funcName) {
  let startIdx = code.indexOf(`function ${funcName}`);
  if (startIdx === -1) {
    throw new Error(`Function ${funcName} not found in content.js`);
  }
  if (startIdx >= 6 && code.slice(startIdx - 6, startIdx) === 'async ') {
    startIdx -= 6;
  }
  const paramClose = code.indexOf(')', startIdx);
  const firstBrace = code.indexOf('{', paramClose);
  let depth = 1;
  let endIdx = firstBrace + 1;
  while (depth > 0 && endIdx < code.length) {
    if (code[endIdx] === '{') depth++;
    else if (code[endIdx] === '}') depth--;
    endIdx++;
  }
  return code.slice(startIdx, endIdx);
}

const helperCode = `
  let retryCountdownInterval = null;
  ${extractFunction(contentJsCode, 'isElementVisible')}
  ${extractFunction(contentJsCode, 'isBackButton')}
  ${extractFunction(contentJsCode, 'findFormButton')}
  ${extractFunction(contentJsCode, 'findSubmitButton')}
  ${extractFunction(contentJsCode, 'findNextButton')}
  ${extractFunction(contentJsCode, 'clickSubmitButton')}
  ${extractFunction(contentJsCode, 'isFormCompleted')}
  ${extractFunction(contentJsCode, 'detectHighDemandError')}
  ${extractFunction(contentJsCode, 'escapeHtml')}
  ${extractFunction(contentJsCode, 'handleHighDemandRetry')}

  module.exports = {
    findFormButton,
    findSubmitButton,
    findNextButton,
    clickSubmitButton,
    isFormCompleted,
    detectHighDemandError,
    escapeHtml,
    handleHighDemandRetry
  };
`;

// Mock Storage and Browser Environment
const fakeLocalStorage = {};
let reloadCalled = false;
let currentHref = 'https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform';

const createMockSandbox = () => {
  currentHref = 'https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform';
  const sandbox = {
    module: { exports: {} },
    window: {
      location: {
        get href() { return currentHref; },
        set href(val) { currentHref = val; redirectedUrl = val; },
        reload: () => { reloadCalled = true; }
      }
    },
    document: {
      title: 'Khảo sát ý kiến',
      body: { innerText: '' },
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null
    },
    setTimeout: (fn, ms) => setTimeout(fn, 1),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (fn, ms) => setInterval(fn, 5),
    clearInterval: (id) => clearInterval(id),
    chrome: {
      storage: {
        local: {
          get: (keys, cb) => {
            const res = {};
            keys.forEach(k => { res[k] = fakeLocalStorage[k]; });
            if (cb) cb(res);
            return Promise.resolve(res);
          },
          set: (obj, cb) => {
            Object.assign(fakeLocalStorage, obj);
            if (cb) cb();
            return Promise.resolve();
          },
          remove: (keys, cb) => {
            const arr = Array.isArray(keys) ? keys : [keys];
            arr.forEach(k => delete fakeLocalStorage[k]);
            if (cb) cb();
            return Promise.resolve();
          }
        }
      }
    },
    MouseEvent: function(type, opts) {
      this.type = type;
      this.bubbles = opts?.bubbles;
    },
    showToast: () => {},
    renderRetryBar: () => {},
    removeCooldownBar: () => {},
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(helperCode, sandbox);
  return sandbox;
};

async function runTests() {
  console.log('--- TEST SUITE 1: Submit Button Detection ---');
  const sb1 = createMockSandbox();
  const { findSubmitButton } = sb1.module.exports;

  // Case 1A: Native button with "Gửi"
  const mockGửiBtn = {
    tagName: 'BUTTON',
    textContent: 'Gửi',
    innerText: 'Gửi',
    getAttribute: () => null,
    closest: (sel) => null
  };
  sb1.document.querySelectorAll = (sel) => {
    if (sel.includes('div[role="button"]') || sel.includes('button')) {
      return [mockGửiBtn];
    }
    return [];
  };
  const found1 = findSubmitButton();
  assert.strictEqual(found1, mockGửiBtn, 'Should find native button with "Gửi"');

  // Case 1B: div[role="button"] with "Submit" (case insensitive)
  const mockSubmitDiv = {
    tagName: 'DIV',
    textContent: '  SUBMIT  ',
    innerText: 'SUBMIT',
    getAttribute: (attr) => attr === 'role' ? 'button' : null,
    closest: (sel) => null
  };
  sb1.document.querySelectorAll = () => [mockSubmitDiv];
  const found2 = findSubmitButton();
  assert.strictEqual(found2, mockSubmitDiv, 'Should find div[role="button"] with "SUBMIT"');

  // Case 1C: Nested span inside div[role="button"]
  const parentBtn = {
    tagName: 'DIV',
    textContent: 'Gửi',
    innerText: 'Gửi',
    getAttribute: (attr) => attr === 'role' ? 'button' : null,
    closest: (sel) => sel.includes('button') ? parentBtn : null
  };
  const childSpan = {
    tagName: 'SPAN',
    className: 'NPEfkd',
    textContent: 'Gửi',
    innerText: 'Gửi',
    getAttribute: () => null,
    closest: (sel) => sel.includes('button') ? parentBtn : null
  };
  sb1.document.querySelectorAll = () => [childSpan];
  const found3 = findSubmitButton();
  assert.strictEqual(found3, parentBtn, 'Should resolve closest parent button from inner span');

  // Case 1D: Exclude "Quay lại" (Back) and "Tiếp" (Next)
  const mockBackBtn = {
    tagName: 'BUTTON',
    textContent: 'Quay lại',
    innerText: 'Quay lại',
    getAttribute: () => null,
    closest: () => null
  };
  sb1.document.querySelectorAll = () => [mockBackBtn];
  const found4 = findSubmitButton();
  assert.strictEqual(found4, null, 'Must NOT match "Quay lại" button as submit button');
  console.log('✅ Submit Button Detection passed all cases!');

  console.log('\n--- TEST SUITE 2: Click Submit Event Sequence ---');
  const sb2 = createMockSandbox();
  const { clickSubmitButton } = sb2.module.exports;
  const dispatchedEvents = [];
  let nativeClickCalled = false;
  let childClickCalled = false;

  const childEl = {
    tagName: 'SPAN',
    className: 'NPEfkd',
    dispatchEvent: (ev) => dispatchedEvents.push(`child:${ev.type}`),
    click: () => { childClickCalled = true; }
  };
  const mockTargetSubmit = {
    tagName: 'DIV',
    scrollIntoView: () => {},
    focus: () => {},
    dispatchEvent: (ev) => dispatchedEvents.push(`parent:${ev.type}`),
    click: () => { nativeClickCalled = true; },
    querySelector: (sel) => childEl
  };

  await clickSubmitButton(mockTargetSubmit);
  assert.ok(nativeClickCalled, 'submitBtn.click() must be invoked');
  assert.ok(childClickCalled, 'Child closure element click() must also be invoked');
  assert.ok(dispatchedEvents.includes('parent:mouseover'), 'Must dispatch mouseover');
  assert.ok(dispatchedEvents.includes('parent:mousedown'), 'Must dispatch mousedown');
  assert.ok(dispatchedEvents.includes('parent:mouseup'), 'Must dispatch mouseup');
  assert.ok(dispatchedEvents.includes('parent:click'), 'Must dispatch click event');
  console.log('✅ Click Submit Button event sequence simulation passed!');

  console.log('\n--- TEST SUITE 3: Gatekeeper: Cooldown strictly blocked while Submit button exists ---');
  const sb3 = createMockSandbox();
  const { isFormCompleted } = sb3.module.exports;

  // Even if body text has confirmation phrase, if submitBtn exists -> MUST BE FALSE!
  sb3.document.querySelectorAll = (sel) => {
    if (sel.includes('div[role="button"]') || sel.includes('button')) {
      return [mockGửiBtn];
    }
    return [];
  };
  sb3.document.body.innerText = 'Câu trả lời của bạn đã được ghi lại'; // fake or accidental text
  assert.strictEqual(isFormCompleted(), false, 'GATEKEEPER FAIL: isFormCompleted MUST be false when submit button is still on page!');

  // When submit button is gone AND confirmation phrase is present -> TRUE!
  const mockConfirmDiv = {
    tagName: 'DIV',
    textContent: 'Câu trả lời của bạn đã được ghi lại.',
    children: []
  };
  sb3.document.querySelectorAll = (sel) => {
    if (sel.includes('div') || sel.includes('span')) return [mockConfirmDiv];
    return [];
  };
  assert.strictEqual(isFormCompleted(), true, 'isFormCompleted MUST be true when submit button is gone and confirmation text is present');

  // When URL is /formResponse -> TRUE!
  sb3.window.location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSc.../formResponse';
  assert.strictEqual(isFormCompleted(), true, 'isFormCompleted MUST be true on /formResponse URL');
  console.log('✅ Gatekeeper tests passed: Cooldown is strictly prohibited while Submit button exists!');

  console.log('\n--- TEST SUITE 4: High Demand (Quá tải) Error Detection ---');
  const sb4 = createMockSandbox();
  const { detectHighDemandError } = sb4.module.exports;

  assert.ok(detectHighDemandError('Error 429: Too Many Requests'), 'Should detect 429');
  assert.ok(detectHighDemandError('Hệ thống đang quá tải, vui lòng thử lại sau.'), 'Should detect "quá tải"');
  assert.ok(detectHighDemandError('Google Form: High demand. Please wait.'), 'Should detect "high demand"');
  assert.ok(detectHighDemandError('Lượng truy cập cao đột biến'), 'Should detect "lượng truy cập cao"');
  assert.ok(detectHighDemandError('HTTP 503: Service Unavailable'), 'Should detect 503');
  assert.ok(!detectHighDemandError('Câu trả lời của bạn đã được ghi lại'), 'Normal confirmation must NOT trigger high demand');
  assert.ok(!detectHighDemandError('Vui lòng chọn 1 câu trả lời'), 'Validation notice must NOT trigger high demand');
  console.log('✅ High Demand Error Detection passed all test cases!');

  console.log('\n--- TEST SUITE 5: High Demand Retry Loop (Max 3 retries & Give Up) ---');
  const sb5 = createMockSandbox();
  const { handleHighDemandRetry } = sb5.module.exports;

  // Initial state: retry count = 0
  fakeLocalStorage['formmind_retry_count'] = 0;
  fakeLocalStorage['formmind_form_url'] = 'https://docs.google.com/forms/d/e/test/viewform';

  // 1st failure: retry count should become 1
  await handleHighDemandRetry('429 Too Many Requests');
  assert.strictEqual(fakeLocalStorage['formmind_retry_count'], 1, 'Retry count must increment to 1 on first error');
  assert.strictEqual(fakeLocalStorage['formmind_auto_start_next_run'], true, 'auto_start_next_run must be true');

  // 2nd failure: retry count should become 2
  fakeLocalStorage['formmind_retry_count'] = 1;
  await handleHighDemandRetry('429 Too Many Requests');
  assert.strictEqual(fakeLocalStorage['formmind_retry_count'], 2, 'Retry count must increment to 2 on second error');

  // 3rd failure: retry count reaches limit 3
  fakeLocalStorage['formmind_retry_count'] = 2;
  await handleHighDemandRetry('429 Too Many Requests');
  assert.strictEqual(fakeLocalStorage['formmind_retry_count'], 3, 'Retry count must increment to 3 on third error');

  // 4th failure: gives up! (retry count >= 3)
  fakeLocalStorage['formmind_retry_count'] = 3;
  await handleHighDemandRetry('429 Too Many Requests');
  assert.strictEqual(fakeLocalStorage['formmind_retry_count'], 0, 'Retry count must reset to 0 after giving up');
  assert.strictEqual(fakeLocalStorage['formmind_auto_start_next_run'], undefined, 'auto_start_next_run must be removed when giving up');
  console.log('✅ High Demand Retry Loop passed: 3 retries handled correctly and giving up on 4th!');

  console.log('\n======================================================');
  console.log('🎉 ALL GATEKEEPER & HIGH DEMAND TESTS PASSED 100%! 🎉');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
