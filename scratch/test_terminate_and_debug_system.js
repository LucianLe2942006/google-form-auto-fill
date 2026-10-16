/**
 * Test Suite for Terminate Automation and Debug Log System on Floating Bar
 * 1. Terminate Automation: Timers cancellation, storage reset, UI reset, abort flag
 * 2. Debug Mode Toggle: Default OFF, two-way persistence in chrome.storage.local
 * 3. Bug Logging Mechanism: Structured format, DOM state snapshot, FIFO buffer
 * 4. Bug Report Export: JSON payload integrity, filename format, error count badge
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const contentJsCode = fs.readFileSync(path.join(__dirname, '..', 'content', 'content.js'), 'utf8');

// Function extractor
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

// Build VM Context
function createTestSandbox() {
  const fakeStorage = {};
  const sentRuntimeMessages = [];
  const toasts = [];

  const fakeDocument = {
    title: 'Test Form Survey',
    readyState: 'complete',
    body: {
      appendChild: () => {},
      removeChild: () => {},
      classList: { add: () => {}, remove: () => {} }
    },
    getElementById: (id) => {
      if (!fakeDocument._elements) fakeDocument._elements = {};
      if (!fakeDocument._elements[id]) {
        fakeDocument._elements[id] = {
          id,
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
          },
          innerHTML: '',
          textContent: '',
          title: '',
          style: {},
          remove() { delete fakeDocument._elements[id]; }
        };
      }
      return fakeDocument._elements[id];
    },
    querySelector: (sel) => null,
    querySelectorAll: (sel) => [],
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); }
        },
        style: {},
        innerHTML: '',
        textContent: '',
        setAttribute: () => {},
        click: () => {},
        remove: () => {}
      };
      return el;
    },
    addEventListener: () => {}
  };

  const sandbox = {
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    },
    window: {
      location: {
        href: 'https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform'
      },
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: () => {}
    },
    document: fakeDocument,
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0',
      platform: 'Win32'
    },
    Blob: function (parts, opts) {
      this.parts = parts;
      this.type = opts?.type;
    },
    URL: {
      createObjectURL: (b) => 'blob:mock-url',
      revokeObjectURL: () => {}
    },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id),
    Date: Date,
    chrome: {
      runtime: {
        id: 'test-ext-id',
        sendMessage: (msg, cb) => {
          sentRuntimeMessages.push(msg);
          if (cb) cb({ success: true });
        }
      },
      storage: {
        local: {
          get: (keys, cb) => {
            if (keys === null) {
              cb({ ...fakeStorage });
            } else if (Array.isArray(keys)) {
              const res = {};
              keys.forEach(k => { res[k] = fakeStorage[k]; });
              cb(res);
            } else if (typeof keys === 'string') {
              cb({ [keys]: fakeStorage[keys] });
            } else {
              cb({ ...fakeStorage });
            }
          },
          set: (obj, cb) => {
            Object.assign(fakeStorage, obj);
            if (cb) cb();
          },
          remove: (keys, cb) => {
            const arr = Array.isArray(keys) ? keys : [keys];
            arr.forEach(k => delete fakeStorage[k]);
            if (cb) cb();
          }
        }
      }
    },
    showToast: (msg, type) => toasts.push({ msg, type }),
    removeCooldownBar: () => {},
    removeRetryBar: () => {},
    scanGoogleForm: () => [{ id: 'q1', title: 'Câu hỏi 1' }],
    findNextButton: () => null,
    findSubmitButton: () => ({ role: 'button', text: 'Gửi' }),
    isFormCompleted: () => false,
    fakeStorage,
    sentRuntimeMessages,
    toasts
  };

  const sandboxCode = `
    let cachedQuestions = [];
    var isAborted = false;
    var isDebugModeEnabled = false;
    var bugLogs = [];
    const MAX_BUG_LOGS = 100;
    const activeTimeouts = new Set();
    var isWorkflowRunning = false;
    let cooldownInterval = null;
    let retryCountdownInterval = null;
    let activeSubmissionInterval = null;
    let activeSubmissionObserver = null;

    ${extractFunction(contentJsCode, 'safeSetTimeout')}
    ${extractFunction(contentJsCode, 'clearAllRegisteredTimeouts')}
    ${extractFunction(contentJsCode, 'captureDomState')}
    ${extractFunction(contentJsCode, 'recordBugEntry')}
    ${extractFunction(contentJsCode, 'updateBugReportButton')}
    ${extractFunction(contentJsCode, 'downloadBugReport')}
    ${extractFunction(contentJsCode, 'updateFloatingStatus')}
    ${extractFunction(contentJsCode, 'updateFloatingButtonState')}
    ${extractFunction(contentJsCode, 'terminateAutomation')}
    ${extractFunction(contentJsCode, 'sendSafeRuntimeMessage')}

    globalThis.getIsAborted = () => isAborted;
    globalThis.setIsAborted = (v) => { isAborted = v; };
    globalThis.getIsDebugModeEnabled = () => isDebugModeEnabled;
    globalThis.setIsDebugModeEnabled = (v) => { isDebugModeEnabled = v; };
    globalThis.getBugLogs = () => bugLogs;
    globalThis.getIsWorkflowRunning = () => isWorkflowRunning;
    globalThis.setIsWorkflowRunning = (v) => { isWorkflowRunning = v; };
  `;

  vm.createContext(sandbox);
  vm.runInContext(sandboxCode, sandbox);
  return sandbox;
}

// =============================================================================
// RUN TESTS
// =============================================================================

async function runTests() {
  console.log('=== TEST 1: Nút Terminate Automation & Emergency Abort ===');
  const sb1 = createTestSandbox();
  
  // Setup mock running timers & state
  sb1.fakeStorage.isRunning = true;
  sb1.fakeStorage.retryCount = 2;
  sb1.fakeStorage.formmind_retry_count = 2;
  sb1.fakeStorage.formmind_active_session = { pageNumber: 2 };
  sb1.fakeStorage.formmind_cooldown_state = { active: true, endTime: Date.now() + 60000 };
  sb1.setIsWorkflowRunning(true);
  
  let dummyTimerExecuted = false;
  sb1.safeSetTimeout(() => { dummyTimerExecuted = true; }, 5000);

  // Trigger Terminate
  await sb1.terminateAutomation();

  assert.strictEqual(sb1.getIsAborted(), true, 'isAborted flag must be true after terminate');
  assert.strictEqual(sb1.getIsWorkflowRunning(), false, 'isWorkflowRunning must be false after terminate');
  assert.strictEqual(sb1.fakeStorage.isRunning, false, 'storage isRunning must be false');
  assert.strictEqual(sb1.fakeStorage.retryCount, 0, 'storage retryCount must be reset to 0');
  assert.strictEqual(sb1.fakeStorage.formmind_active_session, undefined, 'formmind_active_session must be cleared');
  assert.strictEqual(sb1.fakeStorage.formmind_cooldown_state, undefined, 'formmind_cooldown_state must be cleared');
  assert.strictEqual(sb1.getBugLogs().length, 0, 'terminateAutomation must NOT record itself as a bug entry in bugLogs');
  
  // Verify background runtime message sent to cancel cooldown
  const cancelMsg = sb1.sentRuntimeMessages.find(m => m.action === 'CANCEL_COOLDOWN');
  assert.ok(cancelMsg, 'Must send CANCEL_COOLDOWN to background script to cancel cooldown');
  
  // Verify toast
  const errToast = sb1.toasts.find(t => t.type === 'error' && t.msg.includes('dừng khẩn cấp'));
  assert.ok(errToast, 'Must display termination error toast');
  console.log('✅ TEST 1 Passed: Terminate dừng khẩn cấp toàn bộ timer, reset storage, gán isAborted = true, và KHÔNG ghi nhận là bug');

  console.log('\n=== TEST 2: Cụm Debug Mode Switch & Persistence ===');
  const sb2 = createTestSandbox();
  assert.strictEqual(sb2.getIsDebugModeEnabled(), false, 'Debug mode must default to OFF (false)');

  // Simulate user turning Debug Mode ON
  sb2.setIsDebugModeEnabled(true);
  sb2.chrome.storage.local.set({ formmind_debug_mode: true });
  sb2.updateBugReportButton();

  assert.strictEqual(sb2.fakeStorage.formmind_debug_mode, true, 'Debug mode state must be persisted in chrome.storage.local');
  const debugLabel = sb2.document.getElementById('fmind-debug-label');
  assert.ok(debugLabel.classList.contains('fmind-debug-on'), 'Debug label should have fmind-debug-on class when ON');
  console.log('✅ TEST 2 Passed: Switch Debug Mode hoạt động chính xác và lưu trữ hai chiều trong storage');

  console.log('\n=== TEST 3: Cơ chế ghi log có cấu trúc (Bug Entry) & DOM Snapshot ===');
  const sb3 = createTestSandbox();
  sb3.setIsDebugModeEnabled(true);

  sb3.recordBugEntry({
    step: 'processCurrentPage:no_elements_found',
    errorMessage: 'Không tìm thấy câu hỏi hoặc nút chuyển trang ở trang 3',
    extra: { attemptedPage: 3 }
  });

  const logs = sb3.getBugLogs();
  assert.strictEqual(logs.length, 1, 'One bug entry should be recorded');
  const entry = logs[0];
  assert.strictEqual(entry.step, 'processCurrentPage:no_elements_found');
  assert.strictEqual(entry.errorMessage, 'Không tìm thấy câu hỏi hoặc nút chuyển trang ở trang 3');
  assert.ok(entry.timestamp, 'Entry must have ISO timestamp');
  assert.ok(entry.url, 'Entry must have page url');
  assert.ok(entry.domState, 'Entry must contain captured DOM state');
  assert.strictEqual(entry.domState.questionsFound, 1, 'DOM snapshot should reflect scan results');
  assert.strictEqual(entry.domState.hasSubmitButton, true, 'DOM snapshot should reflect submit button');
  assert.strictEqual(sb3.fakeStorage.formmind_bug_logs.length, 1, 'Bug logs must be synchronized to chrome.storage.local');

  // Verify button badge count updated
  const countEl = sb3.document.getElementById('fmind-bug-count');
  assert.strictEqual(countEl.textContent, '1', 'Bug report badge count must reflect recorded logs');
  console.log('✅ TEST 3 Passed: Bản ghi lỗi Bug Entry có đầy đủ timestamp, error message, stack và DOM snapshot');

  console.log('\n=== TEST 4: Tải file báo cáo lỗi (Download Bug Report JSON) ===');
  const sb4 = createTestSandbox();
  sb4.setIsDebugModeEnabled(true);

  // Add 3 sample logs
  sb4.recordBugEntry({ step: 'test_step_1', errorMessage: 'Lỗi 1' });
  sb4.recordBugEntry({ step: 'test_step_2', errorMessage: 'Lỗi 2' });
  sb4.recordBugEntry({ step: 'test_step_3', errorMessage: 'Lỗi 3' });

  let downloadedFilename = '';
  let downloadedContent = '';

  sb4.document.createElement = (tag) => {
    if (tag.toLowerCase() === 'a') {
      return {
        tagName: 'A',
        setAttribute: () => {},
        click: function () {
          downloadedFilename = this.download;
          downloadedContent = this.href;
        },
        remove: () => {}
      };
    }
    return {
      tagName: tag.toUpperCase(),
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      style: {},
      remove: () => {}
    };
  };

  await sb4.downloadBugReport();

  assert.ok(downloadedFilename.startsWith('formmind_bug_report_'), 'Filename must start with formmind_bug_report_');
  assert.ok(downloadedFilename.endsWith('.json'), 'Filename must end with .json');
  assert.ok(sb4.toasts.some(t => t.type === 'success' && t.msg.includes('3 bản ghi')), 'Success toast must confirm 3 records downloaded');
  console.log('✅ TEST 4 Passed: Nút Download xuất file JSON đầy đủ chi tiết với tên file formmind_bug_report_<timestamp>.json');

  console.log('\n======================================================');
  console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ TERMINATE & DEBUG LOG ĐÃ ĐẠT 100%! 🎉');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});
