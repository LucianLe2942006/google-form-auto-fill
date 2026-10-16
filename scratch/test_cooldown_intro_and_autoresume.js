/**
 * Test Suite for the 3 Critical Logic Fixes:
 * 1. Cooldown Trigger Gatekeeper (Exact endMessage or /formResponse ONLY; never count questions or match loose phrases)
 * 2. Intro Page (0 questions) Auto Next Click (1s delay and click Next button)
 * 3. High Demand Auto-Resume & State Management (isRunning: true/false and retryCount persistence)
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
  ${extractFunction(contentJsCode, 'findNextButton')}
  ${extractFunction(contentJsCode, 'findSubmitButton')}
  ${extractFunction(contentJsCode, 'isFormCompleted')}
  ${extractFunction(contentJsCode, 'detectHighDemandError')}
  ${extractFunction(contentJsCode, 'escapeHtml')}
  ${extractFunction(contentJsCode, 'handleHighDemandRetry')}
  ${extractFunction(contentJsCode, 'initAutoResume')}

  module.exports = {
    findFormButton,
    findNextButton,
    findSubmitButton,
    isFormCompleted,
    detectHighDemandError,
    escapeHtml,
    handleHighDemandRetry,
    initAutoResume
  };
`;

const fakeLocalStorage = {};
let reloadCalled = false;
let currentHref = 'https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform';
let mainWorkflowCalled = false;

const createMockSandbox = () => {
  currentHref = 'https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform';
  mainWorkflowCalled = false;
  reloadCalled = false;

  const sandbox = {
    module: { exports: {} },
    window: {
      location: {
        get href() { return currentHref; },
        set href(val) { currentHref = val; },
        reload: () => { reloadCalled = true; }
      }
    },
    document: {
      title: 'Khảo sát ý kiến người tiêu dùng',
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
    handleMainWorkflow: () => {
      mainWorkflowCalled = true;
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
  console.log('--- TEST SUITE 1: SỬA LỖI COOLDOWN TRIGGER NHẦM ---');
  const sb1 = createMockSandbox();
  const { isFormCompleted } = sb1.module.exports;

  // 1A. Page 1 with 0 questions (intro page) and "Tiếp" button -> MUST BE FALSE
  const mockNextBtn = {
    tagName: 'DIV',
    textContent: 'Tiếp',
    innerText: 'Tiếp',
    getAttribute: (attr) => attr === 'role' ? 'button' : null,
    closest: (sel) => sel.includes('button') ? mockNextBtn : null
  };
  sb1.document.querySelectorAll = (sel) => {
    if (sel.includes('div[role="button"]') || sel.includes('button')) {
      return [mockNextBtn];
    }
    return [];
  };
  assert.strictEqual(isFormCompleted(), false, 'Page with Next button MUST NOT trigger cooldown');

  // 1B. Page with "Xóa hết câu trả lời" button -> MUST BE FALSE
  const mockClearBtn = {
    tagName: 'DIV',
    textContent: 'Xóa hết câu trả lời',
    innerText: 'Xóa hết câu trả lời',
    getAttribute: (attr) => attr === 'role' ? 'button' : null,
    closest: (sel) => null
  };
  sb1.document.querySelectorAll = (sel) => [mockClearBtn];
  assert.strictEqual(isFormCompleted(), false, 'Page with "Xóa hết câu trả lời" MUST NOT trigger cooldown');

  // 1C. Transition state where DOM is temporarily empty (0 questions, no buttons yet) -> MUST BE FALSE
  sb1.document.querySelectorAll = () => [];
  assert.strictEqual(isFormCompleted(), false, 'Temporary empty DOM during transition MUST NOT trigger cooldown');

  // 1D. Final confirmed page via URL (/formResponse) -> MUST BE TRUE
  currentHref = 'https://docs.google.com/forms/u/0/d/e/.../formResponse';
  assert.strictEqual(isFormCompleted(), true, 'URL containing /formResponse MUST be recognized as completed');

  // 1E. Final confirmed page via exact title block text -> MUST BE TRUE
  currentHref = 'https://docs.google.com/forms/d/e/.../viewform';
  const mockConfirmationEl = {
    tagName: 'DIV',
    textContent: 'Câu trả lời của bạn đã được ghi lại.',
    children: []
  };
  sb1.document.querySelectorAll = (sel) => {
    if (sel.includes('div') || sel.includes('span')) return [mockConfirmationEl];
    return [];
  };
  assert.strictEqual(isFormCompleted(), true, 'Exact confirmation phrase element MUST trigger completed');
  console.log('✅ TEST SUITE 1 Passed: Cooldown triggers exclusively on verified form completion!');

  console.log('\n--- TEST SUITE 2: NÚT TIẾP Ở TRANG ĐẦU (0 CÂU HỎI) ---');
  const sb2 = createMockSandbox();
  const { findFormButton, findNextButton } = sb2.module.exports;

  // 2A. findFormButton("Tiếp") finds div[role="button"] with text "Tiếp"
  const formNextDiv = {
    tagName: 'DIV',
    textContent: '  Tiếp  ',
    innerText: 'Tiếp',
    getAttribute: (attr) => attr === 'role' ? 'button' : null,
    closest: (sel) => sel.includes('button') ? formNextDiv : null
  };
  sb2.document.querySelectorAll = () => [mockClearBtn, formNextDiv];
  const foundBtn = findFormButton('Tiếp');
  assert.strictEqual(foundBtn, formNextDiv, 'findFormButton("Tiếp") must match the Next button and ignore Clear button');

  // 2B. findNextButton finds "Next" (English)
  const formNextEn = {
    tagName: 'DIV',
    textContent: 'Next',
    innerText: 'Next',
    getAttribute: (attr) => attr === 'role' ? 'button' : null,
    closest: (sel) => sel.includes('button') ? formNextEn : null
  };
  sb2.document.querySelectorAll = () => [formNextEn];
  const foundNextEn = findNextButton();
  assert.strictEqual(foundNextEn, formNextEn, 'findNextButton must match English "Next" button');
  console.log('✅ TEST SUITE 2 Passed: Google Forms Next buttons accurately located on 0-question pages!');

  console.log('\n--- TEST SUITE 3: QUÁ TẢI (HIGH DEMAND) VÀ AUTO-RESUME SAU RELOAD ---');
  const sb3 = createMockSandbox();
  const { handleHighDemandRetry, initAutoResume } = sb3.module.exports;

  // 3A. Retry 1: When High Demand occurs, increment retryCount, KEEP isRunning = true, trigger reload
  fakeLocalStorage['isRunning'] = true;
  fakeLocalStorage['retryCount'] = 0;
  await handleHighDemandRetry('429 Too Many Requests');
  assert.strictEqual(fakeLocalStorage['retryCount'], 1, 'retryCount should be incremented to 1');
  assert.strictEqual(fakeLocalStorage['isRunning'], true, 'isRunning must remain TRUE after High Demand retry');

  // 3B. Auto-resume on reload: initAutoResume checks { isRunning, retryCount } and calls handleMainWorkflow
  mainWorkflowCalled = false;
  await initAutoResume();
  // Wait short tick for setTimeout inside initAutoResume
  await new Promise(r => setTimeout(r, 20));
  assert.ok(mainWorkflowCalled, 'handleMainWorkflow must be automatically resumed after page reload!');

  // 3C. Retry 2: increment retryCount to 2, isRunning remains true
  await handleHighDemandRetry('503 Service Unavailable');
  assert.strictEqual(fakeLocalStorage['retryCount'], 2, 'retryCount should be incremented to 2');
  assert.strictEqual(fakeLocalStorage['isRunning'], true, 'isRunning must remain TRUE on retry 2');

  // 3D. Retry 3: increment retryCount to 3, isRunning remains true
  await handleHighDemandRetry('High demand detected');
  assert.strictEqual(fakeLocalStorage['retryCount'], 3, 'retryCount should be incremented to 3');
  assert.strictEqual(fakeLocalStorage['isRunning'], true, 'isRunning must remain TRUE on retry 3');

  // 3E. 4th occurrence (limit reached >= 3): GIVE UP! Sets isRunning = false, resets retryCount = 0
  await handleHighDemandRetry('High demand persistent');
  assert.strictEqual(fakeLocalStorage['isRunning'], false, 'isRunning must become FALSE when retry limit is reached');
  assert.strictEqual(fakeLocalStorage['retryCount'], 0, 'retryCount must be reset to 0 when process gives up');

  // 3F. On reload when isRunning = false, auto-resume does NOT run
  mainWorkflowCalled = false;
  await initAutoResume();
  await new Promise(r => setTimeout(r, 20));
  assert.strictEqual(mainWorkflowCalled, false, 'handleMainWorkflow must NOT run when isRunning is false');

  console.log('✅ TEST SUITE 3 Passed: Auto-resume lifecycle, persistence, and give-up conditions fully verified!');
  console.log('\n================================================================');
  console.log('🎉 ALL 3 CRITICAL LOGIC FLOW TESTS PASSED WITH 100% SUCCESS! 🎉');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
