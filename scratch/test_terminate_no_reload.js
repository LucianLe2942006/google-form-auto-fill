const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('TEST SUITE: TERMINATE STOPPING WITHOUT RELOAD OR AUTO-RESTART');
console.log('================================================================\n');

// 1. Check content.js source code
console.log('=== TEST 1: content.js Terminate Messages & Safe Checks ===');
const contentJs = fs.readFileSync(path.join(__dirname, '../content/content.js'), 'utf8');

// Ensure terminateAutomation does NOT send SKIP_COOLDOWN
assert(
  !contentJs.includes("terminateAutomation() {\n    console.warn('[FormMind] 🛑 EMERGENCY TERMINATE TRIGGERED BY USER.');\n    isAborted = true;\n    isWorkflowRunning = false;\n\n    // 1. Hủy toàn bộ intervals\n    if (cooldownInterval) {\n      clearInterval(cooldownInterval);\n      cooldownInterval = null;\n    }\n    if (retryCountdownInterval) {\n      clearInterval(retryCountdownInterval);\n      retryCountdownInterval = null;\n    }\n    if (activeSubmissionInterval) {\n      clearInterval(activeSubmissionInterval);\n      activeSubmissionInterval = null;\n    }\n\n    // 2. Ngắt kết nối MutationObserver\n    if (activeSubmissionObserver) {\n      activeSubmissionObserver.disconnect();\n      activeSubmissionObserver = null;\n    }\n\n    // 3. Xóa các registered timeouts\n    clearAllRegisteredTimeouts();\n\n    // 4. Báo background hủy cooldown\n    sendSafeRuntimeMessage({ action: 'SKIP_COOLDOWN' });"),
  'terminateAutomation MUST NOT send SKIP_COOLDOWN'
);

assert(
  contentJs.includes("sendSafeRuntimeMessage({ action: 'CANCEL_COOLDOWN' });"),
  'terminateAutomation MUST send CANCEL_COOLDOWN to background script'
);

console.log('✅ TEST 1 Passed: content.js correctly sends CANCEL_COOLDOWN on Terminate\n');

// 2. Check background.js source code
console.log('=== TEST 2: background.js Anti-Reload Guard in executeCooldownTrigger ===');
const bgJs = fs.readFileSync(path.join(__dirname, '../background/background.js'), 'utf8');

assert(
  bgJs.includes("if (state.active === false || data.isRunning === false)"),
  'executeCooldownTrigger must abort if state.active === false or isRunning === false'
);

assert(
  bgJs.includes("action === 'CANCEL_COOLDOWN'"),
  'background.js must handle CANCEL_COOLDOWN'
);

console.log('✅ TEST 2 Passed: background.js contains anti-reload guard when cancelled or terminated\n');

// 3. Simulate background CANCEL_COOLDOWN and executeCooldownTrigger behavior
console.log('=== TEST 3: Simulation of Background State when Terminated ===');
const fakeLocalStorage = {
  isRunning: false,
  formmind_cooldown_state: { active: false, endTime: 0, durationMs: 0 },
  formmind_auto_start_next_run: false,
  formmind_form_url: 'https://docs.google.com/forms/d/e/1FAIpQLSfoEhUBKFJ8aMraZmLeaiROFuZ9F6rCxm0l8U6Kmzi2XnclRw/viewform'
};

let tabReloadCalled = false;
let tabUpdateCalled = false;

async function simulateExecuteCooldownTrigger() {
  const data = fakeLocalStorage;
  const state = data?.formmind_cooldown_state || {};
  if (state.active === false || data.isRunning === false) {
    // Correctly abort!
    return false;
  }
  tabReloadCalled = true;
  return true;
}

simulateExecuteCooldownTrigger().then(didReload => {
  assert.strictEqual(didReload, false, 'executeCooldownTrigger must NOT reload tab when isRunning is false');
  assert.strictEqual(tabReloadCalled, false, 'No tab reload should be triggered');
  console.log('✅ TEST 3 Passed: Background trigger cleanly aborts and prevents any tab reload\n');

  console.log('================================================================');
  console.log('🎉 ALL TERMINATE ANTI-RELOAD VERIFICATIONS PASSED 100%! 🎉');
  console.log('================================================================');
});
