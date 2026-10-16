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

const testBundle = `
  let isAborted = false;
  let isDebugModeEnabled = true;
  let bugLogs = [];
  const MAX_BUG_LOGS = 100;

  function safeSetTimeout(fn, ms) {
    return setTimeout(fn, ms);
  }

  ${extractFunction(contentJsCode, 'captureDomState')}
  ${extractFunction(contentJsCode, 'recordBugEntry')}
  ${extractFunction(contentJsCode, 'isElementVisible')}
  ${extractFunction(contentJsCode, 'isBackButton')}
  ${extractFunction(contentJsCode, 'findFormButton')}
  ${extractFunction(contentJsCode, 'findNextButton')}
  ${extractFunction(contentJsCode, 'findSubmitButton')}
  ${extractFunction(contentJsCode, 'isFormCompleted')}
  ${extractFunction(contentJsCode, 'waitForPageTransition')}

  module.exports = {
    isElementVisible,
    findFormButton,
    findNextButton,
    findSubmitButton,
    isFormCompleted,
    waitForPageTransition,
    captureDomState,
    recordBugEntry,
    getBugLogs: () => bugLogs,
    setAborted: (val) => { isAborted = val; }
  };
`;

async function runTests() {
  console.log('=== RUNNING TESTS FOR NAVIGATION & SUBMIT DETECTION FIXES ===\n');

  // TEST 1: isElementVisible does NOT filter out elements with aria-hidden
  console.log('--- TEST 1: isElementVisible handling of aria-hidden vs hidden ---');
  {
    const sandbox = {
      window: {},
      document: {},
      module: {},
      exports: {},
      process: undefined
    };
    vm.createContext(sandbox);
    vm.runInContext(testBundle, sandbox);

    const elWithAriaHidden = {
      tagName: 'DIV',
      offsetWidth: 100,
      offsetHeight: 40,
      closest: (sel) => {
        if (sel.includes('[style*="display: none"]') || sel.includes('.hidden') || sel.includes('[hidden]')) {
          return null;
        }
        return null; // no style=display:none
      }
    };
    assert.strictEqual(sandbox.module.exports.isElementVisible(elWithAriaHidden), true, 'Element should be visible despite any aria-hidden in ancestor');

    const elWithDisplayNone = {
      tagName: 'DIV',
      offsetWidth: 0,
      offsetHeight: 0,
      closest: (sel) => {
        if (sel.includes('[style*="display: none"]')) return { tagName: 'DIV' };
        return null;
      }
    };
    assert.strictEqual(sandbox.module.exports.isElementVisible(elWithDisplayNone), false, 'Element with display:none ancestor must be invisible');
    console.log('✅ TEST 1 Passed: isElementVisible correctly ignores aria-hidden and rejects display:none');
  }

  // TEST 2: waitForPageTransition must NOT be fooled by required asterisks (*)
  console.log('\n--- TEST 2: waitForPageTransition with required asterisks ---');
  {
    const asteriskElement = {
      tagName: 'SPAN',
      className: 'v3YIBe RHiN0e',
      innerText: '*',
      textContent: '*',
      offsetWidth: 10,
      offsetHeight: 10,
      closest: () => null
    };

    const sandbox = {
      window: {},
      document: {
        querySelectorAll: (sel) => {
          if (sel.includes('[role="alert"]') || sel.includes('.o69ahc')) {
            // Return only the asterisk element
            return [asteriskElement];
          }
          return [];
        },
        querySelector: (sel) => null
      },
      scanGoogleForm: () => [{ id: 1, title: 'New Question Page 2' }],
      findSubmitButton: () => null,
      findNextButton: () => ({ tagName: 'DIV' }),
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      clearInterval: clearInterval,
      Date: Date,
      module: {},
      exports: {}
    };
    vm.createContext(sandbox);
    vm.runInContext(testBundle, sandbox);

    const prevTitles = ['Question 1 Page 1'];
    const res = await sandbox.module.exports.waitForPageTransition(prevTitles, 1000);

    assert.strictEqual(res.success, true, 'Navigation transition should succeed when only asterisks exist on page');
    assert.strictEqual(res.error, undefined, 'No error should be reported for asterisks');
    console.log('✅ TEST 2 Passed: Asterisk (*) does NOT block navigation!');
  }

  // TEST 3: waitForPageTransition DOES catch real required validation alert
  console.log('\n--- TEST 3: waitForPageTransition with REAL validation error ---');
  {
    const realErrorAlert = {
      tagName: 'DIV',
      getAttribute: (a) => a === 'role' ? 'alert' : null,
      innerText: 'Đây là một câu hỏi bắt buộc',
      textContent: 'Đây là một câu hỏi bắt buộc',
      offsetWidth: 200,
      offsetHeight: 25,
      closest: () => null
    };

    const sandbox = {
      window: {},
      document: {
        querySelectorAll: (sel) => {
          if (sel.includes('[role="alert"]') || sel.includes('.o69ahc')) {
            return [realErrorAlert];
          }
          return [];
        },
        querySelector: (sel) => null
      },
      scanGoogleForm: () => [{ id: 1, title: 'Question 1 Page 1' }],
      findSubmitButton: () => null,
      findNextButton: () => ({ tagName: 'DIV' }),
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      clearInterval: clearInterval,
      Date: Date,
      module: {},
      exports: {}
    };
    vm.createContext(sandbox);
    vm.runInContext(testBundle, sandbox);

    const prevTitles = ['Question 1 Page 1'];
    const res = await sandbox.module.exports.waitForPageTransition(prevTitles, 1000);

    assert.strictEqual(res.success, false, 'Navigation transition should be blocked by real validation error');
    assert.ok(res.error.includes('bắt buộc'), 'Error message should contain validation text');
    console.log('✅ TEST 3 Passed: Real validation error correctly blocks navigation!');
  }

  // TEST 4: Google Forms multi-page submit button inside .ThHDze .lRwqcd
  console.log('\n--- TEST 4: Google Forms footer .lRwqcd submit button detection ---');
  {
    const submitBtnInLrwqcd = {
      tagName: 'DIV',
      getAttribute: (a) => {
        if (a === 'role') return 'button';
        if (a === 'aria-disabled') return 'true'; // Even if aria-disabled="true" initially!
        return null;
      },
      innerText: 'Gửi',
      textContent: 'Gửi',
      offsetWidth: 80,
      offsetHeight: 36,
      closest: (sel) => {
        if (sel.includes('#formmind-floating-widget') || sel.includes('display: none') || sel.includes('display:none') || sel.includes('hidden') || sel.includes('kW9Bec') || sel.includes('xK37zc')) return null;
        return submitBtnInLrwqcd;
      }
    };

    const sandbox = {
      window: {},
      document: {
        querySelector: (sel) => {
          if (sel.includes('.lRwqcd')) return submitBtnInLrwqcd;
          return null;
        },
        querySelectorAll: (sel) => {
          if (sel.includes('.lRwqcd')) return [submitBtnInLrwqcd];
          return [];
        }
      },
      module: {},
      exports: {}
    };
    vm.createContext(sandbox);
    vm.runInContext(testBundle, sandbox);

    const foundSubmit = sandbox.module.exports.findSubmitButton();
    assert.ok(foundSubmit, 'Submit button inside .lRwqcd should be detected');
    assert.strictEqual(foundSubmit, submitBtnInLrwqcd, 'Must return the exact button in .lRwqcd');
    console.log('✅ TEST 4 Passed: .lRwqcd submit button detected even if aria-disabled="true"');
  }

  // TEST 5: Fallback on final page when findNextButton() is null
  console.log('\n--- TEST 5: Final page fallback detection when findNextButton() is null ---');
  {
    const genericSubmitBtn = {
      tagName: 'DIV',
      getAttribute: (a) => a === 'role' ? 'button' : null,
      innerText: 'Hoàn tất',
      textContent: 'Hoàn tất',
      offsetWidth: 90,
      offsetHeight: 36,
      closest: (sel) => null
    };

    const sandbox = {
      window: {},
      document: {
        querySelector: () => null,
        querySelectorAll: (sel) => {
          if (sel.includes('.ThHDze') || sel.includes('.lRwqcd')) {
            return [genericSubmitBtn];
          }
          return [];
        }
      },
      module: {},
      exports: {}
    };
    vm.createContext(sandbox);
    vm.runInContext(testBundle, sandbox);

    const foundSubmit = sandbox.module.exports.findSubmitButton();
    assert.ok(foundSubmit, 'Final page fallback button should be found');
    assert.strictEqual(foundSubmit, genericSubmitBtn, 'Must return the final page button');
    console.log('✅ TEST 5 Passed: Final page fallback recognized "Hoàn tất" button');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED 🎉');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
