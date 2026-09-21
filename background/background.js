// FormMind - AI Background Service Worker (Manifest V3)

// Default persona prompt templates
const PERSONA_TEMPLATES = {
  positive: `You are an enthusiastic, deeply satisfied, and positive respondent.
- In ratings and linear scales, pick high scores (e.g., 5/5, 9-10/10).
- For multiple choice/radios, pick the most positive, encouraging, or highest-tier options.
- For open text and paragraph questions, provide glowing, constructive, complimentary feedback highlighting strengths, ease of use, and great experiences.`,

  negative: `You are a critical, dissatisfied, and demanding respondent with high standards.
- In ratings and linear scales, pick lower or below-average scores (e.g., 1/5 or 2/5, 2-3/10).
- For multiple choice/radios, pick options indicating dissatisfaction, frustration, or areas needing overhaul.
- For open text and paragraph questions, provide honest, firm, and critical feedback highlighting bugs, delays, confusion, or unmet expectations.`,

  idk: `You are an indifferent respondent with little to no familiarity or opinion on the topic ("IDK / Neutral / Not Applicable").
- If options include "I don't know", "Not applicable", "No opinion", "Never used", or "Neutral", ALWAYS prefer that option.
- In linear scales or ratings, select the middle/neutral value (e.g., 3 on a 1-5 scale, 5 on a 1-10 scale).
- For open text and paragraph questions, write brief, non-committal answers like "Not applicable", "I don't have enough experience with this to say", or "No comment".`,

  neutral: `You are a balanced, objective, and unbiased respondent.
- In ratings and linear scales, select moderate, middle scores (e.g., 3/5 or 4/5 depending on context).
- For open text and paragraph questions, provide reasoned answers that acknowledge both pros and cons fairly and constructively.`,

  custom: `You are responding based strictly on the user's custom persona instructions.`
};

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) return false;

  if (request.action === 'GENERATE_FORM_ANSWERS') {
    (async () => {
      try {
        const response = await handleGenerateAnswers(request.payload || {});
        sendResponse({ success: true, data: response });
      } catch (error) {
        console.error('[FormMind Background Error]:', error);
        sendResponse({ success: false, error: error?.message || String(error) });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (request.action === 'TEST_API_KEY') {
    (async () => {
      try {
        const result = await handleTestApiKey(request.payload || {});
        sendResponse({ success: true, data: result });
      } catch (error) {
        console.error('[FormMind Test Key Error]:', error);
        sendResponse({ success: false, error: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (request.action === 'FORMMIND_PAGE_PROGRESS') {
    sendResponse({ received: true });
    return false;
  }

  return false;
});

/**
 * Handle form answers generation with chosen AI model
 */
async function handleGenerateAnswers(payload = {}) {
  const { questions, persona, customPersonaPrompt, model } = payload || {};
  let provider = payload?.provider || 'gemini';
  let apiKey = payload?.apiKey;

  // If apiKey is missing in the message, look up directly from chrome.storage.sync
  if (!apiKey || !apiKey.trim()) {
    try {
      const stored = await chrome.storage.sync.get([
        'geminiKey',
        'openaiKey',
        'anthropicKey',
        'openrouterKey',
        'selectedModel'
      ]);
      const keyMap = {
        gemini: stored.geminiKey,
        openai: stored.openaiKey,
        anthropic: stored.anthropicKey,
        openrouter: stored.openrouterKey
      };
      if (provider && keyMap[provider] && keyMap[provider].trim()) {
        apiKey = keyMap[provider].trim();
      } else {
        // Fallback to any provider that has a configured key
        const found = Object.keys(keyMap).find(p => keyMap[p] && keyMap[p].trim());
        if (found) {
          provider = found;
          apiKey = keyMap[found].trim();
          console.log(`[FormMind] Background auto-fallback to available provider: ${provider}`);
        }
      }
    } catch (e) {
      console.warn('[FormMind] Error reading storage fallback in background:', e);
    }
  }

  if (!apiKey || !apiKey.trim()) {
    throw new Error(`Chưa có API Key cho ${provider ? provider.toUpperCase() : 'AI'}. Vui lòng mở menu FormMind để nhập API key.`);
  }

  if (!questions || questions.length === 0) {
    throw new Error('No form questions were detected to answer.');
  }

  // Build persona instructions
  let personaInstruction = PERSONA_TEMPLATES[persona] || PERSONA_TEMPLATES.positive;
  if (persona === 'custom' && customPersonaPrompt && customPersonaPrompt.trim()) {
    personaInstruction = `Custom Persona Instructions:\n${customPersonaPrompt.trim()}`;
  } else if (customPersonaPrompt && customPersonaPrompt.trim()) {
    personaInstruction += `\nAdditional Custom Persona Guidelines:\n${customPersonaPrompt.trim()}`;
  }

  const systemPrompt = `You are FormMind, an expert AI form filler.
Your task is to review form questions and provide appropriate, realistic, and coherent answers adhering strictly to the user's specified persona.

${personaInstruction}

CRITICAL RULES:
1. You must return answers for EVERY question provided.
2. For 'radio' (multiple choice) or 'dropdown' questions, your answer MUST match one of the provided exact option strings or index.
3. For 'checkbox' questions (multiple choice with squares):
   - You MUST inspect 'constraint', 'validationAlert', 'minChoices', 'maxChoices', 'exactChoices', 'description', or 'title' for required selection counts.
   - If 'exactChoices' or an exact count is specified (e.g. "Chọn chính xác 2 mục", "chọn 2 đáp án", "Select exactly 2"): You MUST return an array containing EXACTLY that number of options.
   - If 'minChoices' or a minimum is specified (e.g. "Chọn ít nhất 2", "Select at least 2"): Return an array with AT LEAST that number of options.
   - If 'maxChoices' or a maximum is specified (e.g. "Chọn tối đa 3", "Select at most 3"): Return an array with AT MOST that number of options.
   - If a range is specified (e.g. "Chọn từ 1 đến 3 đáp án", "1 - 3", "1 hoặc 2"): Return a number of options strictly within that range (e.g. 2 options).
   - If NO explicit numerical constraint is specified: Select 1, 2, or 3 sensible, realistic options matching the persona (never return an empty array, and do NOT blindly select all options).
   - If there is an active 'validationAlert' (e.g. "Chọn ít nhất 2 mục", "Câu hỏi này yêu cầu một câu trả lời mỗi dòng"), you MUST satisfy it completely so form validation passes.
   - Every string in your array MUST match one of the available options verbatim.
4. For 'scale' (rating) questions, return an integer within the min/max range of that scale (e.g. 1 to 5).
5. For 'grid_radio' (multiple choice grid): This question has multiple rows in 'rows' and column choices in 'columns'. You MUST provide an answer for EVERY SINGLE row! Return an object mapping each row title to a chosen column string from 'columns', e.g. {"Row 1": "Column A", "Row 2": "Column B"}, or an array of chosen column strings in order of 'rows'.
6. For 'grid_checkbox' (checkbox grid): Return an object mapping each row title to an array of chosen column strings from 'columns', e.g. {"Row 1": ["Col A"], "Row 2": ["Col B"]}.
7. For 'text' (short answer), keep it concise (1-2 sentences).
8. For 'textarea' (paragraph), write 2-4 sentences of realistic, high-quality feedback fitting the persona.
9. Return your response strictly in valid JSON format matching the schema specified below, with no surrounding markdown or explanation.`;

  const userPrompt = `Here are the form questions to answer:
${JSON.stringify(questions, null, 2)}

Respond with a JSON object strictly adhering to this structure:
{
  "answers": [
    {
      "id": 0,
      "type": "text | textarea | radio | checkbox | scale | dropdown | grid_radio | grid_checkbox",
      "value": "string | number | array | object mapping each row to a column string for grid_radio"
    }
  ]
}`;

  let rawResponseText = '';

  const cleanModel = (model || '').trim().replace(/^((gemini|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();

  switch (provider) {
    case 'gemini':
      rawResponseText = await callGeminiAPI({ apiKey, model: cleanModel || 'auto', systemPrompt, userPrompt });
      break;
    case 'openai':
      rawResponseText = await callOpenAIAPI({ apiKey, model: cleanModel || 'auto', systemPrompt, userPrompt });
      break;
    case 'anthropic':
      rawResponseText = await callAnthropicAPI({ apiKey, model: cleanModel || 'auto', systemPrompt, userPrompt });
      break;
    case 'openrouter':
      rawResponseText = await callOpenRouterAPI({ apiKey, model: cleanModel || 'auto', systemPrompt, userPrompt });
      break;
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }

  // Parse structured JSON response
  return parseAIJsonResponse(rawResponseText);
}

// Cached resolved Gemini model per session
let cachedGeminiModel = null;

/**
 * Automatically query Google AI Studio API for models available for this API key
 */
async function resolveGeminiModel(apiKey) {
  if (cachedGeminiModel) return cachedGeminiModel;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const availableModels = (data.models || [])
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      // Prioritize verified modern production Flash models: 2.0 -> 1.5 -> 3.8 -> 3.7
      const bestModel = availableModels.find(m => m === 'gemini-2.0-flash')
                     || availableModels.find(m => m === 'gemini-1.5-flash')
                     || availableModels.find(m => m.includes('2.0-flash'))
                     || availableModels.find(m => m.includes('1.5-flash'))
                     || availableModels.find(m => m.includes('flash') && !m.includes('2.5') && !m.includes('preview'))
                     || availableModels[0];

      if (bestModel) {
        console.log(`[FormMind] Gemini API automatically selected model: ${bestModel}`);
        cachedGeminiModel = bestModel;
        return bestModel;
      }
    }
  } catch (err) {
    console.warn('[FormMind] Could not auto-detect Gemini models list, using fallback:', err);
  }

  // Safe verified default
  return 'gemini-2.0-flash';
}

/**
 * Call Google Gemini API with automatic model sanitation and multi-stage fallback
 */
async function callGeminiAPI({ apiKey, model, systemPrompt, userPrompt }) {
  let activeModel = (model || '').trim().replace(/^((gemini|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();
  if (!activeModel || activeModel === 'auto') {
    activeModel = cachedGeminiModel || await resolveGeminiModel(apiKey);
  }
  if (!activeModel || activeModel === 'auto') {
    activeModel = 'gemini-2.0-flash';
  }

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json'
    }
  };

  const executeCall = async (modelName) => {
    // Strictly strip any provider prefix like "gemini:" or "models/" before calling Google endpoint
    const cleanName = (modelName || '').trim().replace(/^((gemini|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanName)}:generateContent?key=${apiKey}`;
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  };

  let response = await executeCall(activeModel);

  // If initial model fails due to 404, 400 Bad Request, model not found, or unsupported generateContent
  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.clone().json();
    } catch (e) {}

    const errMsg = (errorData?.error?.message || '').toLowerCase();
    const isModelError = response.status === 404 ||
                         response.status === 400 ||
                         errMsg.includes('not found') ||
                         errMsg.includes('not supported') ||
                         errMsg.includes('models/');

    if (isModelError) {
      console.warn(`[FormMind] Model "${activeModel}" failed (${errMsg || response.status}), attempting fallback...`);

      // Fallback priority: 1. Dynamically resolved model from key -> 2. gemini-2.0-flash -> 3. gemini-1.5-flash
      const candidateFallbacks = ['gemini-2.0-flash', 'gemini-1.5-flash'];
      try {
        const resolved = await resolveGeminiModel(apiKey);
        if (resolved && !candidateFallbacks.includes(resolved)) {
          candidateFallbacks.unshift(resolved);
        }
      } catch (e) {}

      let fallbackSucceeded = false;
      for (const fbModel of candidateFallbacks) {
        if (fbModel === activeModel) continue;
        console.log(`[FormMind] Retrying with fallback model: ${fbModel}`);
        const fbResponse = await executeCall(fbModel);
        if (fbResponse.ok) {
          console.log(`[FormMind] Fallback to ${fbModel} succeeded!`);
          response = fbResponse;
          activeModel = fbModel;
          cachedGeminiModel = fbModel;
          fallbackSucceeded = true;
          break;
        }
      }

      if (!fallbackSucceeded) {
        const message = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(`Gemini API Error: ${message}`);
      }
    } else {
      const message = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(`Gemini API Error: ${message}`);
    }
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned an empty response.');
  }
  return text;
}

/**
 * Call OpenAI API
 */
async function callOpenAIAPI({ apiKey, model, systemPrompt, userPrompt }) {
  const activeModel = (!model || model === 'auto') ? 'gpt-4o-mini' : model;
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const requestBody = {
    model: activeModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`OpenAI API Error: ${message}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('OpenAI API returned an empty response.');
  }
  return text;
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropicAPI({ apiKey, model, systemPrompt, userPrompt }) {
  const activeModel = (!model || model === 'auto') ? 'claude-3-5-haiku-20241022' : model;
  const endpoint = 'https://api.anthropic.com/v1/messages';

  const requestBody = {
    model: activeModel,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt + '\n\nOutput only valid JSON.' }
    ],
    temperature: 0.7
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`Claude API Error: ${message}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text) {
    throw new Error('Claude API returned an empty response.');
  }
  return text;
}

/**
 * Call OpenRouter API
 */
async function callOpenRouterAPI({ apiKey, model, systemPrompt, userPrompt }) {
  // OpenRouter supports 'openrouter/auto' to let OpenRouter pick the best model automatically
  const activeModel = (!model || model === 'auto') ? 'openrouter/auto' : model;
  const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  const requestBody = {
    model: activeModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/google-form-ai-filler',
      'X-Title': 'FormMind AutoFiller'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`OpenRouter API Error: ${message}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('OpenRouter API returned an empty response.');
  }
  return text;
}

/**
 * Clean & Parse JSON response from LLM
 */
function parseAIJsonResponse(rawText) {
  let cleaned = rawText.trim();
  // Strip Markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.answers && Array.isArray(parsed.answers)) {
      return parsed.answers;
    } else if (Array.isArray(parsed)) {
      return parsed;
    }
    // If object with keys as ids
    const answers = Object.keys(parsed).map(key => ({
      id: isNaN(Number(key)) ? key : Number(key),
      value: parsed[key]
    }));
    return answers;
  } catch (err) {
    console.error('Failed to parse AI response JSON:', cleaned);
    throw new Error(`Failed to parse AI response as JSON: ${err.message}. Raw output snippet: ${cleaned.slice(0, 150)}...`);
  }
}

/**
 * Light ping to test if an API Key is valid
 */
async function handleTestApiKey({ provider, apiKey, model }) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Please enter an API Key first.');
  }

  // For Gemini: test directly using models listing endpoint (fast, free, accurate)
  if (provider === 'gemini') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}: Invalid Gemini API Key`);
    }
    const data = await res.json();
    const models = (data.models || [])
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''));

    const cleanModel = (model || '').trim().replace(/^((gemini|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();

    // Respect user's selected model or pick verified modern 2.0 / 1.5
    let targetModel = cleanModel;
    if (!targetModel || targetModel === 'auto') {
      targetModel = models.find(m => m === 'gemini-2.0-flash')
                 || models.find(m => m === 'gemini-1.5-flash')
                 || models.find(m => m.includes('2.0-flash'))
                 || models.find(m => m.includes('1.5-flash'))
                 || models.find(m => m.includes('flash') && !m.includes('2.5'))
                 || 'gemini-2.0-flash';
    }

    cachedGeminiModel = targetModel;
    return { verified: true, message: `Connected to Gemini! (${targetModel})` };
  }

  // For other providers: test via lightweight prompt
  const dummyQuestions = [
    {
      id: 0,
      title: "Test question",
      type: "text"
    }
  ];

  await handleGenerateAnswers({
    questions: dummyQuestions,
    persona: 'neutral',
    customPersonaPrompt: '',
    model: model || 'auto',
    provider: provider,
    apiKey: apiKey
  });

  return { verified: true, message: `Successfully connected to ${provider.toUpperCase()}!` };
}
