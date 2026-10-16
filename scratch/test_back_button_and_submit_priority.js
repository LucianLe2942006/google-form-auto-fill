/**
 * Unit Test Suite:
 * Sửa triệt để lỗi bấm nhầm nút "Quay lại" (Back) thay vì nút "Gửi" (Submit) trên Google Forms
 */

const assert = require('assert');

console.log('======================================================================');
console.log('🧪 TEST SUITE: GOOGLE FORMS BACK BUTTON EXCLUSION & SUBMIT PRIORITY');
console.log('======================================================================\n');

// Mock DOM Node implementation for testing
class MockElement {
  constructor({ tag = 'div', className = '', attributes = {}, textContent = '', children = [] } = {}) {
    this.tagName = tag.toUpperCase();
    this.className = className;
    this.attributes = attributes;
    this.textContent = textContent;
    this.innerText = textContent;
    this.children = [];
    this.parentElement = null;
    this.style = {};

    children.forEach(child => this.appendChild(child));
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  closest(selector) {
    const classes = selector.split(',').map(s => s.trim().replace(/^\./, ''));
    let curr = this;
    while (curr) {
      const currClasses = (curr.className || '').split(/\s+/);
      if (classes.some(cls => currClasses.includes(cls))) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matches(child, selector)) {
          results.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  scrollIntoView() { this.scrolled = true; }
  dispatchEvent(evt) { this.lastEvent = evt.type; }
  click() { this.clicked = true; }
}

function matches(el, selector) {
  if (selector.includes(',')) {
    return selector.split(',').some(s => matches(el, s.trim()));
  }
  const parts = selector.trim().split(/\s+/);
  if (parts.length === 1) {
    const sel = parts[0];
    let tag = '';
    let rest = sel;
    const tagMatch = sel.match(/^([a-zA-Z0-9]+)/);
    if (tagMatch) {
      tag = tagMatch[1];
      rest = sel.slice(tag.length);
    }
    if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    if (!rest) return true;
    if (rest.startsWith('.')) {
      const cls = rest.replace(/^\./, '');
      return (el.className || '').split(/\s+/).includes(cls);
    }
    if (rest.includes('[') && rest.includes(']')) {
      const attrMatch = rest.match(/\[([a-zA-Z0-9_-]+)="?([^"\]]+)"?\]/);
      if (attrMatch) {
        const [, attr, val] = attrMatch;
        return el.getAttribute(attr) === val;
      }
    }
    return false;
  } else if (parts.length === 2) {
    const [ancestorSel, targetSel] = parts;
    if (matches(el, targetSel)) {
      let p = el.parentElement;
      while (p) {
        if (matches(p, ancestorSel)) return true;
        p = p.parentElement;
      }
    }
    return false;
  }
  return false;
}

// -----------------------------------------------------------------------------
// Functions under test
// -----------------------------------------------------------------------------
function isBackButton(el) {
  if (!el) return false;
  // 1. Kiểm tra container đặc trưng của nút Quay lại trong Google Forms (.kW9Bec hoặc .xK37zc)
  if (el.closest && el.closest('.kW9Bec, .xK37zc')) return true;

  // 2. Chuẩn hóa chuỗi (Unicode NFC) để không bị lỗi ký tự tiếng Việt có dấu
  const rawText = (
    el.innerText || 
    el.textContent || 
    (typeof el.getAttribute === 'function' ? el.getAttribute('aria-label') : '') || 
    ''
  ).normalize('NFC').trim().toLowerCase();

  const backKeywords = [
    'quay lại', 'quay lai', 'lùi', 'lui', 'back', 'previous',
    'trước', 'truoc', 'trở lại', 'tro lai', 'trở về', 'tro ve'
  ];

  return backKeywords.some(kw => rawText === kw || rawText.startsWith(kw));
}

function isElementVisible(el) {
  return el && el.style.display !== 'none';
}

function findSubmitButton(mockDoc) {
  const submitKeywords = [
    'gửi', 'submit', 'nộp', 'nộp bài', 'gửi phản hồi', 'gửi biểu mẫu',
    'submit response', 'submit form', 'hoàn tất', 'hoàn thành', 'send', 'finish'
  ];

  const isSubmitText = (text) => {
    if (!text) return false;
    const clean = text.normalize('NFC').trim().toLowerCase();
    return submitKeywords.some(kw => clean === kw || clean.startsWith(kw));
  };

  // 1. ƯU TIÊN SỐ 1: Nút nằm trong container hành động chuyển tiếp/gửi (.lRwqcd)
  const lRwqcdBtns = Array.from(mockDoc.querySelectorAll('.lRwqcd div[role="button"], .lRwqcd button'));
  for (const btn of lRwqcdBtns) {
    if (isBackButton(btn)) continue; // TUYỆT ĐỐI BỎ QUA NẾU LÀ NÚT QUAY LẠI

    const btnText = (btn.innerText || btn.textContent || (typeof btn.getAttribute === 'function' ? btn.getAttribute('aria-label') : '') || '').normalize('NFC').trim().toLowerCase();
    if (isSubmitText(btnText) && isElementVisible(btn)) {
      return btn;
    }
  }

  // 2. Quét tất cả các thẻ span hiển thị chữ "Gửi" / "Submit"
  const candidateSpans = Array.from(mockDoc.querySelectorAll(
    'span.NPEfkd, span.VfPpkd-vQzf8d, div[role="button"] span, button span'
  ));
  for (const span of candidateSpans) {
    const text = (span.textContent || span.innerText || '').normalize('NFC').trim().toLowerCase();
    if (isSubmitText(text)) {
      const parentBtn = (span.closest && span.closest('div[role="button"], button')) || span;
      if (!isBackButton(parentBtn) && isElementVisible(parentBtn)) {
        return parentBtn;
      }
    }
  }

  // 3. Quét tất cả các nút có jsname nhưng PHẢI LỌC BỎ nút Quay lại
  const submitJsnames = ['M2DA7b', 'QR6bsb', 'GeGHKb', 'X5DuWc'];
  for (const jsn of submitJsnames) {
    const buttons = Array.from(mockDoc.querySelectorAll(`div[role="button"][jsname="${jsn}"], button[jsname="${jsn}"]`));
    for (const btn of buttons) {
      if (isBackButton(btn)) continue; // Bỏ qua ngay lập tức

      const fullText = (btn.textContent || btn.innerText || '').normalize('NFC').trim().toLowerCase();
      if (isSubmitText(fullText) && isElementVisible(btn)) {
        return btn;
      }
    }
  }

  // 4. Cứu cánh ở trang cuối cùng: Nếu không còn nút Tiếp
  for (const btn of lRwqcdBtns) {
    if (!isBackButton(btn) && isElementVisible(btn)) {
      return btn;
    }
  }

  return null;
}

function findNextButton(mockDoc) {
  const isSubmitText = (txt) => {
    if (!txt) return false;
    const clean = txt.normalize('NFC').trim().toLowerCase();
    const submitKeywords = [
      'gửi', 'submit', 'nộp', 'nộp bài', 'gửi phản hồi', 'gửi biểu mẫu',
      'submit response', 'submit form', 'hoàn tất', 'hoàn thành', 'send', 'finish'
    ];
    return submitKeywords.some(kw => clean === kw || clean.startsWith(kw));
  };

  const lRwqcdBtns = Array.from(mockDoc.querySelectorAll('.lRwqcd div[role="button"], .lRwqcd button'));
  for (const btn of lRwqcdBtns) {
    if (isBackButton(btn)) continue;

    const btnText = (btn.innerText || btn.textContent || (typeof btn.getAttribute === 'function' ? btn.getAttribute('aria-label') : '') || '').normalize('NFC').trim().toLowerCase();
    if (isSubmitText(btnText)) continue;

    if (/^(tiếp|next|tiếp tục|tiếp theo)/i.test(btnText) && isElementVisible(btn)) {
      return btn;
    }
  }

  const jsnameBtn = mockDoc.querySelector('div[role="button"][jsname="OCpkoe"], button[jsname="OCpkoe"]');
  if (jsnameBtn && !isBackButton(jsnameBtn) && isElementVisible(jsnameBtn)) {
    const jText = (jsnameBtn.innerText || jsnameBtn.textContent || '').normalize('NFC').trim().toLowerCase();
    if (!isSubmitText(jText)) {
      return jsnameBtn;
    }
  }

  return null;
}

async function clickSubmitButton(submitBtn, mockDoc) {
  if (!submitBtn) return false;

  // CHỐT CHẶN AN TOÀN
  if (isBackButton(submitBtn)) {
    const realSubmitBtn = mockDoc.querySelector('.lRwqcd div[role="button"], .lRwqcd button');
    if (realSubmitBtn && !isBackButton(realSubmitBtn)) {
      submitBtn = realSubmitBtn;
    } else {
      return false;
    }
  }

  submitBtn.click();
  return true;
}

// -----------------------------------------------------------------------------
// TEST 1: isBackButton checks
// -----------------------------------------------------------------------------
console.log('--- TEST 1: isBackButton Detection ---');

// Case 1A: Inside .kW9Bec container
const backContainer = new MockElement({ className: 'kW9Bec' });
const btnInsideBack = new MockElement({ tag: 'div', attributes: { role: 'button', jsname: 'M2DA7b' }, textContent: '' });
backContainer.appendChild(btnInsideBack);
assert.strictEqual(isBackButton(btnInsideBack), true, 'Button inside .kW9Bec must be identified as Back button');
console.log('  ✅ Case 1A: Element inside .kW9Bec correctly detected as Back button');

// Case 1B: Inside .xK37zc container
const backContainer2 = new MockElement({ className: 'xK37zc' });
const btnInsideBack2 = new MockElement({ tag: 'button', textContent: 'Prev' });
backContainer2.appendChild(btnInsideBack2);
assert.strictEqual(isBackButton(btnInsideBack2), true, 'Button inside .xK37zc must be identified as Back button');
console.log('  ✅ Case 1B: Element inside .xK37zc correctly detected as Back button');

// Case 1C: Vietnamese decomposed Unicode text "Quay lại"
const btnUnicode = new MockElement({ textContent: 'Quay la\u0323i' }); // NFD accent
assert.strictEqual(isBackButton(btnUnicode), true, 'Decomposed unicode "Quay lại" must be detected as Back button');
console.log('  ✅ Case 1C: Unicode normalization correctly matches Vietnamese diacritics');

// Case 1D: "Gửi" button must NOT be Back button
const submitBtnEl = new MockElement({ textContent: 'Gửi' });
assert.strictEqual(isBackButton(submitBtnEl), false);
console.log('  ✅ Case 1D: "Gửi" button is NOT a Back button');

// -----------------------------------------------------------------------------
// TEST 2: Multi-Page Final Page (Both "Quay lại" and "Gửi" exist)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Multi-Page Final Page Submit Selection ---');

// Setup Google Forms realistic final page footer:
// .ThHDze
//   .kW9Bec -> div[role="button"][jsname="M2DA7b"] (Quay lại)
//   .lRwqcd -> div[role="button"][jsname="M2DA7b"] (Gửi)
const pageRoot = new MockElement({ className: 'ThHDze' });

const backWrap = new MockElement({ className: 'kW9Bec' });
const backBtn = new MockElement({
  tag: 'div',
  attributes: { role: 'button', jsname: 'M2DA7b' },
  textContent: 'Quay lại',
  children: [new MockElement({ tag: 'span', className: 'NPEfkd', textContent: 'Quay lại' })]
});
backWrap.appendChild(backBtn);

const submitWrap = new MockElement({ className: 'lRwqcd' });
const realSubmitBtn = new MockElement({
  tag: 'div',
  attributes: { role: 'button', jsname: 'M2DA7b' },
  textContent: 'Gửi',
  children: [new MockElement({ tag: 'span', className: 'NPEfkd', textContent: 'Gửi' })]
});
submitWrap.appendChild(realSubmitBtn);

pageRoot.appendChild(backWrap);
pageRoot.appendChild(submitWrap);

// Query Submit Button
const detectedSubmit = findSubmitButton(pageRoot);
assert.strictEqual(detectedSubmit, realSubmitBtn, 'findSubmitButton MUST select the "Gửi" button in .lRwqcd');
assert.notStrictEqual(detectedSubmit, backBtn, 'findSubmitButton MUST NEVER select the "Quay lại" button in .kW9Bec');
console.log('  ✅ findSubmitButton correctly picked "Gửi" (.lRwqcd) and rejected "Quay lại" (.kW9Bec)');

// Query Next Button on Final Page
const detectedNext = findNextButton(pageRoot);
assert.strictEqual(detectedNext, null, 'findNextButton MUST return null on the final page (does NOT pick Back or Submit)');
console.log('  ✅ findNextButton correctly returns null on final page');

// -----------------------------------------------------------------------------
// TEST 3: Intermediate Page (Both "Quay lại" and "Tiếp" exist)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Intermediate Page Next Button Selection ---');

const page2Root = new MockElement({ className: 'ThHDze' });
const backWrap2 = new MockElement({ className: 'kW9Bec' });
const backBtn2 = new MockElement({
  tag: 'div',
  attributes: { role: 'button', jsname: 'M2DA7b' },
  textContent: 'Quay lại'
});
backWrap2.appendChild(backBtn2);

const nextWrap2 = new MockElement({ className: 'lRwqcd' });
const nextBtn2 = new MockElement({
  tag: 'div',
  attributes: { role: 'button', jsname: 'OCpkoe' },
  textContent: 'Tiếp'
});
nextWrap2.appendChild(nextBtn2);

page2Root.appendChild(backWrap2);
page2Root.appendChild(nextWrap2);

const detectedNextPage2 = findNextButton(page2Root);
assert.strictEqual(detectedNextPage2, nextBtn2, 'findNextButton MUST pick the "Tiếp" button');
assert.notStrictEqual(detectedNextPage2, backBtn2, 'findNextButton MUST NEVER pick the "Quay lại" button');
console.log('  ✅ findNextButton correctly selected "Tiếp" and bypassed "Quay lại"');

// -----------------------------------------------------------------------------
// TEST 4: Safety Guard in clickSubmitButton
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: Safety Guard in clickSubmitButton ---');

// Simulate scenario where caller mistakenly passes backBtn
let success = false;
clickSubmitButton(backBtn, pageRoot).then(res => {
  assert.strictEqual(res, true);
  assert.strictEqual(realSubmitBtn.clicked, true, 'Real submit button in .lRwqcd should be clicked instead');
  assert.strictEqual(backBtn.clicked, undefined, 'Back button must NOT be clicked');
  console.log('  ✅ clickSubmitButton safely intercepted Back button and redirected click to real Submit button!');

  console.log('\n======================================================================');
  console.log('🎉 ALL TESTS FOR BACK BUTTON EXCLUSION PASSED WITH 100% SUCCESS! 🎉');
  console.log('======================================================================');
});
