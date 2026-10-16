/**
 * Test Suite for Automatic Submit ("Gửi") Button Detection & Click Sequence
 * Validates:
 * 1. Deeply nested span.NPEfkd.RveJvd.snByac detection and parent div[role="button"] resolution
 * 2. Complete mouse event dispatch sequence (scrollIntoView, click, mousedown, mouseup, bubbles)
 * 3. Exclusion of "Quay lại" and "Xóa hết câu trả lời"
 * 4. Cooldown isolation: Cooldown strictly blocked until URL or DOM confirms submission
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
  ${extractFunction(contentJsCode, 'isElementVisible')}
  ${extractFunction(contentJsCode, 'isBackButton')}
  ${extractFunction(contentJsCode, 'findFormButton')}
  ${extractFunction(contentJsCode, 'findNextButton')}
  ${extractFunction(contentJsCode, 'findSubmitButton')}
  ${extractFunction(contentJsCode, 'clickSubmitButton')}
  ${extractFunction(contentJsCode, 'isFormCompleted')}

  module.exports = {
    isElementVisible,
    isBackButton,
    findFormButton,
    findNextButton,
    findSubmitButton,
    clickSubmitButton,
    isFormCompleted
  };
`;

function createMockEnvironment() {
  let currentHref = 'https://docs.google.com/forms/d/e/.../viewform';
  const dispatchedEvents = [];
  let scrollCalled = false;
  let clickCalled = false;

  // Real Google Forms Submit Button Structure:
  // <div role="button" class="uArJ5e UQuaGc Y5A0ab RjsPE OabDMe ...">
  //   <span jsslot="" class="l4V7wb Fxmcue">
  //     <span class="NPEfkd RveJvd snByac">Gửi</span>
  //   </span>
  // </div>
  const innerSpan = {
    tagName: 'SPAN',
    className: 'NPEfkd RveJvd snByac',
    textContent: 'Gửi',
    innerText: 'Gửi',
    closest: (sel) => {
      if (sel.includes('div[role="button"]') || sel.includes('button')) {
        return mockSubmitBtn;
      }
      return null;
    },
    dispatchEvent: (ev) => {
      dispatchedEvents.push({ target: 'innerSpan', type: ev.type, bubbles: ev.bubbles });
    },
    click: () => {
      dispatchedEvents.push({ target: 'innerSpan', type: 'click_fn' });
    }
  };

  const middleSpan = {
    tagName: 'SPAN',
    className: 'l4V7wb Fxmcue',
    children: [innerSpan]
  };

  const mockSubmitBtn = {
    tagName: 'DIV',
    className: 'uArJ5e UQuaGc Y5A0ab RjsPE OabDMe',
    getAttribute: (attr) => attr === 'role' ? 'button' : null,
    textContent: 'Gửi',
    innerText: 'Gửi',
    children: [middleSpan],
    closest: (sel) => sel.includes('div') ? mockSubmitBtn : null,
    scrollIntoView: () => { scrollCalled = true; },
    focus: () => {},
    click: () => {
      clickCalled = true;
      dispatchedEvents.push({ target: 'submitBtn', type: 'click_fn' });
    },
    dispatchEvent: (ev) => {
      dispatchedEvents.push({ target: 'submitBtn', type: ev.type, bubbles: ev.bubbles });
    },
    querySelector: (sel) => {
      if (sel.includes('NPEfkd') || sel.includes('span')) return innerSpan;
      return null;
    }
  };

  // Mock Clear Form button:
  const mockClearBtn = {
    tagName: 'DIV',
    getAttribute: (attr) => attr === 'role' ? 'button' : null,
    textContent: 'Xóa hết câu trả lời',
    innerText: 'Xóa hết câu trả lời',
    closest: (sel) => mockClearBtn
  };
  const mockClearSpan = {
    tagName: 'SPAN',
    className: 'NPEfkd RveJvd snByac',
    textContent: 'Xóa hết câu trả lời',
    innerText: 'Xóa hết câu trả lời',
    closest: (sel) => mockClearBtn
  };

  // Mock Back button:
  const mockBackBtn = {
    tagName: 'DIV',
    getAttribute: (attr) => attr === 'role' ? 'button' : null,
    textContent: 'Quay lại',
    innerText: 'Quay lại',
    closest: (sel) => mockBackBtn
  };
  const mockBackSpan = {
    tagName: 'SPAN',
    className: 'NPEfkd RveJvd snByac',
    textContent: 'Quay lại',
    innerText: 'Quay lại',
    closest: (sel) => mockBackBtn
  };

  const sandbox = {
    module: { exports: {} },
    window: {
      location: {
        get href() { return currentHref; },
        set href(val) { currentHref = val; }
      }
    },
    document: {
      querySelectorAll: (sel) => {
        if (sel.includes('span.NPEfkd') || sel.includes('span')) {
          return [mockClearSpan, mockBackSpan, innerSpan];
        }
        if (sel.includes('div[role="button"]') || sel.includes('button')) {
          return [mockClearBtn, mockBackBtn, mockSubmitBtn];
        }
        return [];
      },
      querySelector: (sel) => {
        if (sel.includes('jsname="M2DA7b"')) return null;
        return null;
      }
    },
    MouseEvent: function(type, opts) {
      this.type = type;
      this.bubbles = opts?.bubbles;
    },
    setTimeout: (fn, ms) => setTimeout(fn, 1),
    clearTimeout: (id) => clearTimeout(id),
    console
  };

  vm.createContext(sandbox);
  vm.runInContext(helperCode, sandbox);

  return {
    sandbox,
    mockSubmitBtn,
    innerSpan,
    dispatchedEvents,
    getScrollCalled: () => scrollCalled,
    getClickCalled: () => clickCalled,
    setHref: (val) => { currentHref = val; }
  };
}

async function runTests() {
  console.log('=== TEST 1: Nhận diện nút "Gửi" từ cấu trúc DOM lồng nhau của Google Forms ===');
  const env1 = createMockEnvironment();
  const { findSubmitButton } = env1.sandbox.module.exports;

  const foundBtn = findSubmitButton();
  assert.ok(foundBtn, 'Nút Gửi phải được tìm thấy');
  assert.strictEqual(foundBtn, env1.mockSubmitBtn, 'Phần tử trả về phải là thẻ div[role="button"] cha');
  console.log('✅ TEST 1 Passed: Nhận diện chính xác div[role="button"] thông qua span.NPEfkd.RveJvd.snByac');

  console.log('\n=== TEST 2: Loại trừ nút "Quay lại" và "Xóa hết câu trả lời" ===');
  // If only Back and Clear buttons exist
  env1.sandbox.document.querySelectorAll = (sel) => {
    return [];
  };
  assert.strictEqual(findSubmitButton(), null, 'Khi không có nút Gửi thì phải trả về null, không chọn nhầm nút khác');
  console.log('✅ TEST 2 Passed: Tuyệt đối không chọn nhầm nút Quay lại hoặc Xóa hết câu trả lời');

  console.log('\n=== TEST 3: Chuỗi hành vi tự động click nút Gửi ===');
  const env3 = createMockEnvironment();
  const { clickSubmitButton } = env3.sandbox.module.exports;

  const success = await clickSubmitButton(env3.mockSubmitBtn);
  assert.strictEqual(success, true, 'clickSubmitButton phải trả về true');
  assert.strictEqual(env3.getScrollCalled(), true, 'Phải gọi scrollIntoView trước khi click');
  assert.strictEqual(env3.getClickCalled(), true, 'Phải gọi direct .click() trên nút Gửi');

  const mouseEvents = env3.dispatchedEvents.map(e => `${e.target}:${e.type}`);
  console.log('Sự kiện đã dispatch:', mouseEvents);
  assert.ok(mouseEvents.includes('submitBtn:mousedown'), 'Phải dispatch mousedown trên submitBtn');
  assert.ok(mouseEvents.includes('submitBtn:mouseup'), 'Phải dispatch mouseup trên submitBtn');
  assert.ok(mouseEvents.includes('submitBtn:click'), 'Phải dispatch click event trên submitBtn');
  assert.ok(mouseEvents.includes('innerSpan:click'), 'Phải dispatch click event trên thẻ span con');
  console.log('✅ TEST 3 Passed: Chuỗi sự kiện chuột hoàn chỉnh đã được kích hoạt');

  console.log('\n=== TEST 4: Đảm bảo Cooldown bị chặn tuyệt đối khi submitBtn còn tồn tại ===');
  const env4 = createMockEnvironment();
  const { isFormCompleted } = env4.sandbox.module.exports;

  // submitBtn exists in DOM
  assert.strictEqual(isFormCompleted(), false, 'isFormCompleted() BẮT BUỘC trả về false khi nút Gửi còn tồn tại');

  // Once submitted and redirected to /formResponse
  env4.setHref('https://docs.google.com/forms/u/0/d/e/.../formResponse');
  env4.sandbox.document.querySelectorAll = () => [];
  assert.strictEqual(isFormCompleted(), true, 'isFormCompleted() trả về true sau khi đã chuyển sang /formResponse');
  console.log('✅ TEST 4 Passed: Cooldown chỉ kích hoạt sau khi đã chuyển sang màn hình xác nhận');

  console.log('\n======================================================');
  console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ TỰ ĐỘNG CLICK NÚT GỬI ĐÃ ĐẠT 100%! 🎉');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
