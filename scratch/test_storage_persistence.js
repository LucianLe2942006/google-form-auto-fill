// Simulation test for FormMind unified storage persistence

const assert = require('assert');

// Mock chrome storage
const mockStorage = {
  local: {},
  sync: {},
  onChangedListeners: []
};

const chrome = {
  storage: {
    local: {
      get: (keys) => {
        return new Promise(resolve => {
          if (Array.isArray(keys)) {
            const res = {};
            keys.forEach(k => { if (mockStorage.local[k] !== undefined) res[k] = mockStorage.local[k]; });
            resolve(res);
          } else if (typeof keys === 'string') {
            resolve({ [keys]: mockStorage.local[keys] });
          } else {
            resolve({ ...mockStorage.local });
          }
        });
      },
      set: (items) => {
        return new Promise(resolve => {
          Object.assign(mockStorage.local, items);
          resolve();
        });
      }
    },
    sync: {
      get: (keys) => {
        return new Promise(resolve => {
          if (Array.isArray(keys)) {
            const res = {};
            keys.forEach(k => { if (mockStorage.sync[k] !== undefined) res[k] = mockStorage.sync[k]; });
            resolve(res);
          } else if (typeof keys === 'string') {
            resolve({ [keys]: mockStorage.sync[keys] });
          } else {
            resolve({ ...mockStorage.sync });
          }
        });
      },
      set: (items, callback) => {
        Object.assign(mockStorage.sync, items);
        if (callback) callback();
      }
    }
  }
};

async function unifiedStorageGet(keys) {
  let syncData = {};
  let localData = {};
  try {
    if (chrome?.storage?.sync) {
      syncData = (await chrome.storage.sync.get(keys)) || {};
    }
  } catch (e) {
    console.warn('sync.get warning:', e);
  }
  try {
    if (chrome?.storage?.local) {
      localData = (await chrome.storage.local.get(keys)) || {};
    }
  } catch (e) {
    console.warn('local.get warning:', e);
  }
  return { ...syncData, ...localData };
}

async function unifiedStorageSet(items) {
  if (!items || typeof items !== 'object') return;
  if (chrome?.storage?.local) {
    try {
      await chrome.storage.local.set(items);
    } catch (e) {
      console.error('local.set error:', e);
    }
  }
  if (chrome?.storage?.sync) {
    try {
      chrome.storage.sync.set(items, () => {});
    } catch (e) {
      console.warn('sync.set exception:', e);
    }
  }
}

async function runTests() {
  console.log('--- Test 1: Unified Storage Set & Get ---');
  const sampleData = {
    geminiKey: 'AIzaSySampleKey123456789',
    selectedModel: 'gemini:gemini-3.8-flash',
    formmind_form_url: 'https://docs.google.com/forms/d/e/1FAIpQLSc_test/viewform',
    formmind_auto_next: true,
    lastActiveTab: 'tab-schedule',
    formmind_cooldown_config: {
      enabled: true,
      min: 3,
      max: 10,
      unit: 'm',
      autoSubmit: true,
      autoRestartFill: true
    },
    formmind_weighted_rules: [
      {
        id: 'rule_1',
        matchType: 'index',
        matchValue: '1',
        titleHint: 'Mức độ hài lòng',
        options: [
          { label: 'Rất hài lòng', weight: 80 },
          { label: 'Hài lòng', weight: 20 }
        ]
      }
    ],
    formmind_text_rules: [
      {
        id: 'text_rule_1',
        type: 'text',
        matchType: 'index',
        matchValue: '2',
        titleHint: 'Ý kiến đóng góp',
        mode: 'fixed',
        fixedValue: 'Dịch vụ rất tuyệt vời!',
        listValues: []
      }
    ]
  };

  await unifiedStorageSet(sampleData);

  const restored = await unifiedStorageGet(Object.keys(sampleData));
  assert.strictEqual(restored.geminiKey, sampleData.geminiKey, 'API Key must match');
  assert.strictEqual(restored.formmind_form_url, sampleData.formmind_form_url, 'Form URL must match');
  assert.strictEqual(restored.formmind_auto_next, true, 'Auto next must be true');
  assert.strictEqual(restored.lastActiveTab, 'tab-schedule', 'Active tab must be remembered');
  assert.strictEqual(restored.formmind_weighted_rules.length, 1, 'Weighted rules length must be 1');
  assert.strictEqual(restored.formmind_text_rules.length, 1, 'Text rules length must be 1');
  console.log('✅ Test 1 Passed: All configurations stored and restored accurately.');

  console.log('--- Test 2: Sync Failure Resilience (Local Storage Fallback) ---');
  // Simulate sync failure (e.g. quota exceeded)
  chrome.storage.sync.get = () => { throw new Error('MAX_WRITE_OPERATIONS_PER_MINUTE exceeded'); };
  
  const resilientGet = await unifiedStorageGet(['geminiKey', 'formmind_form_url', 'formmind_weighted_rules']);
  assert.strictEqual(resilientGet.geminiKey, sampleData.geminiKey, 'Must retrieve from local even when sync throws');
  assert.strictEqual(resilientGet.formmind_form_url, sampleData.formmind_form_url, 'Must retrieve from local even when sync throws');
  assert.strictEqual(resilientGet.formmind_weighted_rules.length, 1, 'Must retrieve rules from local even when sync throws');
  console.log('✅ Test 2 Passed: Extension gracefully reads local storage without loss even if Chrome sync fails.');

  console.log('--- ALL STORAGE TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
