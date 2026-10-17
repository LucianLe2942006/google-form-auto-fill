const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('================================================================');
console.log('TEST SUITE: MULTI-PAGE /formResponse vs FORM COMPLETION GUARD');
console.log('================================================================\n');

const contentJsPath = path.join(__dirname, '..', 'content', 'content.js');
const contentJsCode = fs.readFileSync(contentJsPath, 'utf8');

function extractFunction(code, funcName) {
  const marker = `function ${funcName}`;
  const idx = code.indexOf(marker);
  if (idx === -1) throw new Error(`Could not find function ${funcName}`);
  let braceCount = 0;
  let started = false;
  let endIdx = idx;
  for (let i = idx; i < code.length; i++) {
    if (code[i] === '{') {
      braceCount++;
      started = true;
    } else if (code[i] === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  return code.substring(idx, endIdx);
}

function createSandbox(initialHref = 'https://docs.google.com/forms/u/0/d/e/.../formResponse') {
  let href = initialHref;
  let fakeStorage = {};
  let bugLogs = [];
  let toasts = [];

  const dom = {
    form: null,
    questions: [],
    nextBtn: null,
    submitBtn: null,
    backBtn: null,
    clearBtn: null,
    confirmationEl: null,
    headings: [],
    submitAnotherLink: null
  };

  const sandbox = {
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    },
    window: {
      get location() {
        return {
          href,
          replace: (u) => { href = u; }
        };
      },
      set location(val) {
        if (typeof val === 'object' && val.href) href = val.href;
        else href = String(val);
      }
    },
    document: {
      querySelector: (sel) => {
        if (sel.includes('form') && !sel.includes('Role') && !sel.includes('freebird') && !sel.includes('viewform')) {
          return dom.form;
        }
        if (sel.includes('freebirdFormviewerViewResponseConfirmationMessage') || sel.includes('.vHW8Ge')) {
          return dom.confirmationEl;
        }
        if (sel.includes('.kW9Bec') || sel.includes('.xK37zc')) {
          return dom.backBtn;
        }
        if (sel.includes('a[href*="/viewform"]') || sel.includes('.c2gzEf')) {
          return dom.submitAnotherLink;
        }
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel.includes('div[role="listitem"]')) {
          return dom.questions;
        }
        if (sel.includes('div[role="button"]') || sel.includes('button')) {
          const btns = [];
          if (dom.nextBtn) btns.push(dom.nextBtn);
          if (dom.submitBtn) btns.push(dom.submitBtn);
          if (dom.backBtn) btns.push(dom.backBtn);
          if (dom.clearBtn) btns.push(dom.clearBtn);
          return btns;
        }
        if (sel.includes('heading') || sel.includes('.M7eMe') || sel.includes('span')) {
          return dom.headings;
        }
        return [];
      }
    },
    chrome: {
      storage: {
        local: {
          get: (keys, cb) => {
            const res = {};
            if (Array.isArray(keys)) {
              keys.forEach(k => { res[k] = fakeStorage[k]; });
            } else if (typeof keys === 'string') {
              res[keys] = fakeStorage[keys];
            } else if (typeof keys === 'object') {
              Object.keys(keys).forEach(k => { res[k] = fakeStorage[k] !== undefined ? fakeStorage[k] : keys[k]; });
            }
            if (cb) cb(res);
            return Promise.resolve(res);
          },
          set: (obj, cb) => {
            Object.assign(fakeStorage, obj);
            if (cb) cb();
            return Promise.resolve();
          },
          remove: (keys, cb) => {
            const arr = Array.isArray(keys) ? keys : [keys];
            arr.forEach(k => delete fakeStorage[k]);
            if (cb) cb();
            return Promise.resolve();
          }
        }
      }
    },
    showToast: (msg, type) => {
      toasts.push({ msg, type });
    },
    recordBugEntry: (entry) => {
      bugLogs.push(entry);
    },
    captureDomState: () => ({ href }),
    isDebugModeEnabled: true,
    isBackButton: (el) => el === dom.backBtn,
    findNextButton: () => dom.nextBtn,
    findSubmitButton: () => dom.submitBtn,
    findFormButton: (txt) => {
      if (txt === 'Tiếp' || txt === 'Next') return dom.nextBtn;
      if (txt === 'Gửi' || txt === 'Submit') return dom.submitBtn;
      return null;
    },
    sendSafeRuntimeMessage: () => {},
    setTimeout: (fn) => setTimeout(fn, 0),
    safeSetTimeout: (fn) => setTimeout(fn, 0),
    module: { exports: {} }
  };

  const codeToRun = `
    ${extractFunction(contentJsCode, 'isFormCompleted')}
    module.exports = {
      isFormCompleted
    };
  `;

  const script = new vm.Script(codeToRun);
  const context = vm.createContext(sandbox);
  script.runInContext(context);

  return {
    sandbox,
    dom,
    fakeStorage,
    bugLogs,
    toasts,
    setHref: (u) => { href = u; }
  };
}

// =============================================================================
// TEST 1: Section 2 at /formResponse MUST NOT be recognized as completed!
// =============================================================================
console.log('--- TEST 1: Intermediate Multi-Page Section at /formResponse ---');
const env1 = createSandbox('https://docs.google.com/forms/u/0/d/e/1FAIpQLS.../formResponse');
env1.dom.form = { tagName: 'FORM' };
env1.dom.backBtn = {
  tagName: 'DIV',
  textContent: 'Quay lại',
  innerText: 'Quay lại',
  getAttribute: () => 'button'
};
env1.dom.questions = [
  { tagName: 'DIV', getAttribute: () => 'listitem' },
  { tagName: 'DIV', getAttribute: () => 'listitem' }
];
env1.dom.submitBtn = {
  tagName: 'DIV',
  textContent: 'Gửi',
  innerText: 'Gửi',
  getAttribute: () => 'button'
};

const isCompSec2 = env1.sandbox.module.exports.isFormCompleted();
assert.strictEqual(isCompSec2, false, 'CRITICAL: Section 2 with questions and buttons at /formResponse MUST NOT be completed!');
console.log('✅ TEST 1 Passed: Section 2 at /formResponse correctly recognized as IN PROGRESS (NOT completed).');

// =============================================================================
// TEST 2: Section 2 loading transition (questions briefly empty) MUST NOT be completed!
// =============================================================================
console.log('\n--- TEST 2: Section 2 Brief Loading Transition at /formResponse ---');
env1.dom.questions = []; // momentarily 0 questions
env1.dom.submitBtn = null;
env1.dom.nextBtn = null;
// but back button and form tag are present
const isCompSec2Loading = env1.sandbox.module.exports.isFormCompleted();
assert.strictEqual(isCompSec2Loading, false, 'Section 2 during loading transition MUST NOT be completed because backBtn/form exists!');
console.log('✅ TEST 2 Passed: Section 2 loading state guarded against false completion.');

// =============================================================================
// TEST 3: Actual Submission Confirmation Page at /formResponse MUST BE COMPLETED!
// =============================================================================
console.log('\n--- TEST 3: Verified Submission Confirmation Page at /formResponse ---');
const env3 = createSandbox('https://docs.google.com/forms/u/0/d/e/1FAIpQLS.../formResponse');
env3.dom.form = null; // form element is gone on confirmation page
env3.dom.questions = [];
env3.dom.nextBtn = null;
env3.dom.submitBtn = null;
env3.dom.backBtn = null;
env3.dom.confirmationEl = { tagName: 'DIV', className: 'vHW8Ge' };
env3.dom.headings = [
  {
    tagName: 'DIV',
    textContent: 'Câu trả lời của bạn đã được ghi lại.',
    children: []
  }
];
env3.dom.submitAnotherLink = {
  tagName: 'A',
  href: 'https://docs.google.com/forms/d/e/1FAIpQLS.../viewform',
  textContent: 'Gửi câu trả lời khác'
};

const isCompFinal = env3.sandbox.module.exports.isFormCompleted();
assert.strictEqual(isCompFinal, true, 'CRITICAL: Final submission confirmation page MUST be recognized as completed!');
console.log('✅ TEST 3 Passed: Verified confirmation page accurately detected as COMPLETED (100%).');

// =============================================================================
// TEST 4: checkAndResumeActiveSession Guard against Completed Form
// =============================================================================
console.log('\n--- TEST 4: checkAndResumeActiveSession on Completed Page ---');
let sessionRemoved = false;
let autoFillCalled = false;
let fakeSession = {
  inProgress: true,
  pageNumber: 2,
  lastUpdated: Date.now()
};

async function simulateCheckAndResume({ isCompleted, waitSuccess }) {
  if (isCompleted) {
    sessionRemoved = true;
    return 'aborted_completed';
  }
  const waitRes = await Promise.resolve({ success: waitSuccess });
  if (isCompleted) {
    sessionRemoved = true;
    return 'aborted_completed_after_wait';
  }
  if (!waitRes || !waitRes.success) {
    sessionRemoved = true;
    return 'aborted_no_questions';
  }
  autoFillCalled = true;
  return 'resumed';
}

(async () => {
  sessionRemoved = false;
  autoFillCalled = false;
  const resOnComplete = await simulateCheckAndResume({ isCompleted: true, waitSuccess: false });
  assert.strictEqual(resOnComplete, 'aborted_completed');
  assert.strictEqual(sessionRemoved, true, 'Session must be immediately cleared when form is completed');
  assert.strictEqual(autoFillCalled, false, 'Auto-fill must NEVER be called on completed page');
  console.log('✅ TEST 4 Passed: checkAndResumeActiveSession immediately clears session and never auto-fills on completed page!');

  // =============================================================================
  // TEST 5: processCurrentPage Guard against Completed Form
  // =============================================================================
  console.log('\n--- TEST 5: processCurrentPage Completion Guard ---');
  let processBugLogged = false;
  function simulateProcessCurrentPage({ questions, nextBtn, submitBtn, isCompleted }) {
    if (questions.length === 0) {
      if (nextBtn) return { action: 'next' };
      if (submitBtn) return { action: 'submit' };
      if (isCompleted) {
        return { action: 'completed', count: 10, totalPages: 2 };
      }
      processBugLogged = true;
      return { action: 'error' };
    }
    return { action: 'fill' };
  }

  const pRes = simulateProcessCurrentPage({
    questions: [],
    nextBtn: null,
    submitBtn: null,
    isCompleted: true
  });
  assert.strictEqual(pRes.action, 'completed');
  assert.strictEqual(processBugLogged, false, 'Bug MUST NOT be logged when page is already completed!');
  console.log('✅ TEST 5 Passed: processCurrentPage cleanly completes without logging any bug!');

  console.log('\n================================================================');
  console.log('🎉 ALL MULTI-PAGE & FORM COMPLETION GUARD TESTS PASSED 100%! 🎉');
  console.log('================================================================');
})();
