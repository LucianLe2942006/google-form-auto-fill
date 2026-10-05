// Test model prefix stripping, fallback logic, and floating button parsing

const assert = require('assert');

console.log('=== TEST 1: Model Name Sanitization ===');

function sanitizeModelName(model) {
  return (model || '')
    .trim()
    .replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '')
    .replace(/^models\//i, '')
    .trim();
}

const testCases = [
  { input: 'gemini:gemini-3.8-flash', expected: 'gemini-3.8-flash' },
  { input: 'gemini:gemini-3.7-flash', expected: 'gemini-3.7-flash' },
  { input: 'gemini:gemini-2.5-flash', expected: 'gemini-2.5-flash' },
  { input: 'gemini:gemini:gemini-3.8-flash', expected: 'gemini-3.8-flash' },
  { input: 'models/gemini-3.8-flash', expected: 'gemini-3.8-flash' },
  { input: 'groq:openai/gpt-oss-20b', expected: 'openai/gpt-oss-20b' },
  { input: 'huggingface:meta-llama/Llama-3.1-8B-Instruct', expected: 'meta-llama/Llama-3.1-8B-Instruct' },
  { input: 'huggingface:meta-llama/Llama-3.1-8B-Instruct:fastest', expected: 'meta-llama/Llama-3.1-8B-Instruct:fastest' },
  { input: 'openai:gpt-4o-mini', expected: 'gpt-4o-mini' },
  { input: 'anthropic:claude-3-5-haiku-20241022', expected: 'claude-3-5-haiku-20241022' },
  { input: 'openrouter:deepseek/deepseek-chat', expected: 'deepseek/deepseek-chat' },
  { input: 'custom:my-own-model', expected: 'my-own-model' }
];

testCases.forEach(({ input, expected }) => {
  const actual = sanitizeModelName(input);
  assert.strictEqual(actual, expected, `Failed for input: ${input}. Expected: ${expected}, got: ${actual}`);
});
console.log('✅ All model sanitization test cases passed!');

console.log('\n=== TEST 2: Floating Button Option Parsing ===');

function parseFloatingSelection(chosenModelVal, settings = {}) {
  let chosenProvider = 'gemini';
  let chosenModel = 'gemini-3.8-flash';

  function getDefaultModelForProvider(provider) {
    switch (provider) {
      case 'gemini': return 'gemini-3.8-flash';
      case 'groq': return 'openai/gpt-oss-20b';
      case 'huggingface': return 'meta-llama/Llama-3.1-8B-Instruct';
      case 'openai': return 'gpt-4o-mini';
      case 'anthropic': return 'claude-3-5-haiku-20241022';
      case 'openrouter': return 'deepseek/deepseek-chat';
      default: return 'gemini-3.8-flash';
    }
  }

  if (chosenModelVal.startsWith('custom:')) {
    chosenProvider = settings.customProvider || 'gemini';
    let rawCustom = settings.customModelName || (chosenProvider === 'gemini' ? 'gemini-3.8-flash' : 'openai/gpt-oss-20b');
    chosenModel = rawCustom.replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();
  } else if (chosenModelVal.includes(':')) {
    const colonIdx = chosenModelVal.indexOf(':');
    chosenProvider = chosenModelVal.substring(0, colonIdx) || 'gemini';
    let rawM = chosenModelVal.substring(colonIdx + 1);
    rawM = rawM.replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();
    if (!rawM || rawM === 'auto') {
      chosenModel = getDefaultModelForProvider(chosenProvider);
    } else {
      chosenModel = rawM;
    }
  } else {
    chosenModel = chosenModelVal.replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();
  }

  return { chosenProvider, chosenModel };
}

const parseTests = [
  {
    input: 'gemini:gemini-3.8-flash',
    expected: { chosenProvider: 'gemini', chosenModel: 'gemini-3.8-flash' }
  },
  {
    input: 'groq:openai/gpt-oss-20b',
    expected: { chosenProvider: 'groq', chosenModel: 'openai/gpt-oss-20b' }
  },
  {
    input: 'huggingface:meta-llama/Llama-3.1-8B-Instruct',
    expected: { chosenProvider: 'huggingface', chosenModel: 'meta-llama/Llama-3.1-8B-Instruct' }
  },
  {
    input: 'gemini:auto',
    expected: { chosenProvider: 'gemini', chosenModel: 'gemini-3.8-flash' }
  },
  {
    input: 'groq:auto',
    expected: { chosenProvider: 'groq', chosenModel: 'openai/gpt-oss-20b' }
  },
  {
    input: 'huggingface:auto',
    expected: { chosenProvider: 'huggingface', chosenModel: 'meta-llama/Llama-3.1-8B-Instruct' }
  },
  {
    input: 'custom:custom',
    settings: { customProvider: 'groq', customModelName: 'groq:openai/gpt-oss-20b' },
    expected: { chosenProvider: 'groq', chosenModel: 'openai/gpt-oss-20b' }
  }
];

parseTests.forEach(({ input, settings, expected }) => {
  const res = parseFloatingSelection(input, settings);
  assert.strictEqual(res.chosenProvider, expected.chosenProvider);
  assert.strictEqual(res.chosenModel, expected.chosenModel);
});
console.log('✅ Floating option parsing test cases passed!');

console.log('\n=== TEST 3: Multi-layer Fallback Simulator ===');

async function simulateGeminiApiCall(initialModel, mockResponses) {
  let activeModel = sanitizeModelName(initialModel);
  if (!activeModel || activeModel === 'auto') {
    activeModel = 'gemini-3.8-flash';
  }

  const executeCall = async (modelName) => {
    const cleanName = sanitizeModelName(modelName);
    return mockResponses[cleanName] || { ok: false, status: 404, error: { message: `models/${cleanName} is not found` } };
  };

  let response = await executeCall(activeModel);

  if (!response.ok) {
    const errMsg = (response.error?.message || '').toLowerCase();
    const isModelError = response.status === 404 ||
                         response.status === 400 ||
                         errMsg.includes('not found') ||
                         errMsg.includes('not supported') ||
                         errMsg.includes('models/');

    if (isModelError) {
      const candidateFallbacks = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-2.5-flash'];
      let fallbackSucceeded = false;
      for (const fbModel of candidateFallbacks) {
        if (fbModel === activeModel) continue;
        const fbResponse = await executeCall(fbModel);
        if (fbResponse.ok) {
          response = fbResponse;
          activeModel = fbModel;
          fallbackSucceeded = true;
          break;
        }
      }

      if (!fallbackSucceeded) {
        throw new Error(`Gemini API Error: ${response.error?.message || response.status}`);
      }
    } else {
      throw new Error(`Gemini API Error: ${response.error?.message || response.status}`);
    }
  }

  return { success: true, finalModel: activeModel, data: response.data };
}

(async () => {
  // Scenario 1: Initial deprecated model fails (e.g. gemini-2.0-flash / 1.5-flash), falls back to 3.8-flash
  const mockResponses1 = {
    'gemini-2.0-flash': {
      ok: false,
      status: 404,
      error: { message: 'models/gemini-2.0-flash is not found or deprecated' }
    },
    'gemini-3.8-flash': {
      ok: true,
      status: 200,
      data: '{"answers": []}'
    }
  };

  const res1 = await simulateGeminiApiCall('gemini-2.0-flash', mockResponses1);
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.finalModel, 'gemini-3.8-flash');
  console.log('✅ Scenario 1 (gemini-2.0-flash -> auto-fallback to gemini-3.8-flash): PASSED!');

  // Scenario 2: 3.8-flash rate-limited/down, auto-fallback cascade to 3.7-flash
  const mockResponses2 = {
    'unknown-experimental-model': {
      ok: false,
      status: 404,
      error: { message: 'models/unknown-experimental-model is not found' }
    },
    'gemini-3.8-flash': {
      ok: false,
      status: 404,
      error: { message: 'models/gemini-3.8-flash is not found' }
    },
    'gemini-3.7-flash': {
      ok: true,
      status: 200,
      data: '{"answers": []}'
    }
  };

  const res2 = await simulateGeminiApiCall('unknown-experimental-model', mockResponses2);
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.finalModel, 'gemini-3.7-flash');
  console.log('✅ Scenario 2 (auto-fallback cascade to gemini-3.7-flash): PASSED!');

  console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
})();
