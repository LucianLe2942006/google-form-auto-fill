/**
 * Unit Test Suite for:
 * 1. Cooldown Timing (Submission Confirmation Watcher & isFormCompleted)
 * 2. Personal Information Profile (Vietnamese Auto-Generation, Custom Parsing, and Field Identification)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Extract helper functions directly from content.js
const contentJsCode = fs.readFileSync(path.join(__dirname, '..', 'content', 'content.js'), 'utf8');

function extractFunction(code, funcName) {
  const marker = `function ${funcName}`;
  const startIdx = code.indexOf(marker);
  if (startIdx === -1) {
    throw new Error(`Function ${funcName} not found in content.js`);
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

// Build VM environment to run extracted functions
const helperCode = `
  ${extractFunction(contentJsCode, 'removeVietnameseTones')}
  ${extractFunction(contentJsCode, 'pickRandom')}
  ${extractFunction(contentJsCode, 'generateFakeVNProfile')}
  ${extractFunction(contentJsCode, 'parseCustomProfile')}
  ${extractFunction(contentJsCode, 'identifyProfileFieldType')}
  ${extractFunction(contentJsCode, 'resolveProfileFieldValue')}
  ${extractFunction(contentJsCode, 'formatMsToTime')}
  ${extractFunction(contentJsCode, 'isFormCompleted')}

  module.exports = {
    removeVietnameseTones,
    pickRandom,
    generateFakeVNProfile,
    parseCustomProfile,
    identifyProfileFieldType,
    resolveProfileFieldValue,
    formatMsToTime,
    isFormCompleted
  };
`;

const vm = require('vm');
const sandbox = {
  module: { exports: {} },
  window: { location: { href: 'https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform' } },
  document: {
    body: { innerText: '' },
    querySelectorAll: () => [],
    querySelector: () => null
  },
  console
};
vm.createContext(sandbox);
vm.runInContext(helperCode, sandbox);

const {
  removeVietnameseTones,
  pickRandom,
  generateFakeVNProfile,
  parseCustomProfile,
  identifyProfileFieldType,
  resolveProfileFieldValue,
  formatMsToTime,
  isFormCompleted
} = sandbox.module.exports;

console.log('--- TEST SUITE 1: Profile Field Identification ---');

const nameCases = [
  'Họ và tên',
  'Họ & tên',
  'Họ và tên của bạn',
  'Họ tên',
  'Tên của bạn',
  'Full name',
  'Your name'
];
nameCases.forEach(title => {
  assert.strictEqual(identifyProfileFieldType(title), 'name', `Failed to identify name for: "${title}"`);
});
console.log('✅ Name identification passed!');

const phoneCases = [
  'Số điện thoại',
  'Số điện thoại liên hệ',
  'SĐT',
  'Số ĐT',
  'Phone number',
  'Zalo / Phone',
  'Số điện thoại / Zalo'
];
phoneCases.forEach(title => {
  assert.strictEqual(identifyProfileFieldType(title), 'phone', `Failed to identify phone for: "${title}"`);
});
console.log('✅ Phone identification passed!');

const emailCases = [
  'Email',
  'Địa chỉ email',
  'Email của bạn',
  'Thư điện tử',
  'E-mail'
];
emailCases.forEach(title => {
  assert.strictEqual(identifyProfileFieldType(title), 'email', `Failed to identify email for: "${title}"`);
});
console.log('✅ Email identification passed!');

const otherCases = [
  { text: 'Mã số sinh viên (MSSV)', expected: 'student_id' },
  { text: 'MSSV', expected: 'student_id' },
  { text: 'Lớp học', expected: 'class' },
  { text: 'Tuổi của bạn', expected: 'age' },
  { text: 'Năm sinh', expected: 'birth_year' },
  { text: 'Địa chỉ thường trú', expected: 'address' }
];
otherCases.forEach(c => {
  assert.strictEqual(identifyProfileFieldType(c.text), c.expected, `Failed to identify for: "${c.text}"`);
});
console.log('✅ Student ID, Class, Age, Birth year, Address identification passed!');

// Negative cases to avoid false-positives
const negativeCases = [
  'Tên công ty của bạn',
  'Tên sản phẩm bạn yêu thích',
  'Tên thương hiệu',
  'Ý kiến đóng góp khác',
  'Bạn biết đến chương trình qua đâu?'
];
negativeCases.forEach(title => {
  assert.notStrictEqual(identifyProfileFieldType(title), 'name', `False positive name match on: "${title}"`);
});
console.log('✅ Negative false-positive cases passed!');

console.log('\n--- TEST SUITE 2: Vietnamese Profile Data Generation ---');

for (let i = 0; i < 20; i++) {
  const name = generateFakeVNProfile('name');
  assert.ok(name && name.split(' ').length >= 2, `Invalid generated name: "${name}"`);

  const phone = generateFakeVNProfile('phone');
  assert.strictEqual(phone.length, 10, `Phone must be exactly 10 digits: "${phone}"`);
  const validPrefixes = ['09', '08', '03', '07'];
  assert.ok(validPrefixes.some(p => phone.startsWith(p)), `Phone prefix invalid: "${phone}"`);

  const sessionProfile = { name };
  const email = generateFakeVNProfile('email', sessionProfile);
  assert.ok(email.endsWith('@gmail.com'), `Email must end with @gmail.com: "${email}"`);
  assert.ok(!/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(email), `Email should not contain accents: "${email}"`);

  const studentId = generateFakeVNProfile('student_id');
  assert.ok(studentId.length >= 7, `Student ID invalid: "${studentId}"`);
}
console.log('✅ 20 iterations of Vietnamese Profile Data Generation passed!');

console.log('\n--- TEST SUITE 3: Custom Profile Parsing ---');

const sampleCustom = `
Họ tên: Nguyễn Văn An, Trần Minh Quân, Lê Hoàng Nam
SĐT: 0912345678, 0987654321
Email: minhquan2003@gmail.com; test2@gmail.com
MSSV: B21DCCN001
Lớp: D21CQCN01-B
Tuổi: 22
Năm sinh: 2002
Địa chỉ: Hà Nội, TP. Hồ Chí Minh
`;

const rawParsed = parseCustomProfile(sampleCustom);
const parsed = JSON.parse(JSON.stringify(rawParsed));
assert.deepStrictEqual(parsed.name, ['Nguyễn Văn An', 'Trần Minh Quân', 'Lê Hoàng Nam']);
assert.deepStrictEqual(parsed.phone, ['0912345678', '0987654321']);
assert.deepStrictEqual(parsed.email, ['minhquan2003@gmail.com', 'test2@gmail.com']);
assert.deepStrictEqual(parsed.student_id, ['B21DCCN001']);
assert.deepStrictEqual(parsed.class, ['D21CQCN01-B']);
assert.deepStrictEqual(parsed.age, ['22']);
assert.deepStrictEqual(parsed.birth_year, ['2002']);
assert.deepStrictEqual(parsed.address, ['Hà Nội', 'TP. Hồ Chí Minh']);
console.log('✅ Custom profile text parsing passed!');

console.log('\n--- TEST SUITE 4: Profile Value Resolution (Skip / Fake / Custom Fallback) ---');

// Case 1: mode = 'skip'
const skipVal = resolveProfileFieldValue('name', { mode: 'skip' });
assert.strictEqual(skipVal, '__FORMMIND_SKIP__', 'Skip mode must return __FORMMIND_SKIP__');

// Case 2: mode = 'fake' with empty custom
const session = {};
const fakeName = resolveProfileFieldValue('name', { mode: 'fake', customText: '' }, session);
assert.ok(fakeName && fakeName.length > 3, `Fake name should be generated: "${fakeName}"`);
assert.strictEqual(session.name, fakeName, 'Generated name should be stored in sessionProfile');

const fakeEmail = resolveProfileFieldValue('email', { mode: 'fake', customText: '' }, session);
assert.ok(fakeEmail.endsWith('@gmail.com'), `Fake email should be generated: "${fakeEmail}"`);

// Case 3: mode = 'fake' with custom data containing name & phone, but missing email
const customConfig = {
  mode: 'fake',
  customText: 'Họ tên: Đặng Thùy Trang\nSĐT: 0977888999'
};
const customName = resolveProfileFieldValue('name', customConfig, {});
assert.strictEqual(customName, 'Đặng Thùy Trang', 'Should pick specified custom name');

const customPhone = resolveProfileFieldValue('phone', customConfig, {});
assert.strictEqual(customPhone, '0977888999', 'Should pick specified custom phone');

// Fallback when field is missing from custom text
const fallbackEmail = resolveProfileFieldValue('email', customConfig, { name: customName });
assert.ok(fallbackEmail.endsWith('@gmail.com'), 'Should fallback to auto-generated email when missing');
assert.ok(fallbackEmail.includes('dang') || fallbackEmail.includes('thuy') || fallbackEmail.includes('trang'), 'Generated email should reflect custom name');
console.log('✅ Profile value resolution (Skip, Auto-gen, Custom & Fallback) passed!');

console.log('\n--- TEST SUITE 5: Cooldown Timing & Confirmation Detection ---');

// Case 1: On question page (questions present in DOM)
sandbox.window.location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform';
sandbox.document.querySelectorAll = (sel) => {
  if (sel.includes('Qr7Oae')) return [{ id: 'q1' }]; // active question
  return [];
};
sandbox.document.body.innerText = 'Trang 2/2. Bấm Gửi để hoàn tất.';
assert.strictEqual(isFormCompleted(), false, 'isFormCompleted MUST be false when questions are in the DOM');

// Case 2: On confirmation page by URL (/formResponse)
sandbox.window.location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSc.../formResponse';
sandbox.document.querySelectorAll = () => [];
assert.strictEqual(isFormCompleted(), true, 'isFormCompleted MUST be true on /formResponse');

// Case 3: On confirmation page by exact Google Forms confirmation block
sandbox.window.location.href = 'https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform';
const mockEndEl = {
  tagName: 'DIV',
  textContent: 'Câu trả lời của bạn đã được ghi lại.',
  children: []
};
sandbox.document.querySelectorAll = (sel) => {
  if (sel.includes('div') || sel.includes('span')) return [mockEndEl];
  return [];
};
assert.strictEqual(isFormCompleted(), true, 'isFormCompleted MUST be true when exact confirmation text block is present');

// Case 4: Confirmation text with English "Your response has been recorded."
const mockEndEn = {
  tagName: 'DIV',
  textContent: 'Your response has been recorded.',
  children: []
};
sandbox.document.querySelectorAll = (sel) => {
  if (sel.includes('div') || sel.includes('span')) return [mockEndEn];
  return [];
};
assert.strictEqual(isFormCompleted(), true, 'isFormCompleted MUST be true with "Your response has been recorded."');

// Cooldown formatting test
const formattedTime = formatMsToTime(125000); // 2m 05s
assert.strictEqual(formattedTime, '02:05', 'formatMsToTime should return mm:ss or hh:mm:ss');
const formattedHour = formatMsToTime(3665000); // 1h 01m 05s
assert.strictEqual(formattedHour, '01:01:05', 'formatMsToTime should return hh:mm:ss for >= 1 hour');
console.log('✅ Cooldown timing & Confirmation detection passed!');

console.log('\n========================================');
console.log('🎉 ALL UNIT TESTS PASSED SUCCESSFULLY! 🎉');
console.log('========================================');
