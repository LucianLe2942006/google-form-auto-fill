// FormMind - Popup Controller Logic

(function () {
  'use strict';

  // Fallback catalog if external script fails to load
  const FALLBACK_CATALOG = {
    source: 'models.dev',
    last_synced: '2026-09-21T03:03:15.912Z',
    providers: {
      google: [
        { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', release_date: '2026-09-02', description: "Google's most intelligent Flash model, engineered for long-horizon software engineering, autonomous agents, and enterprise workflows" },
        { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', release_date: '2026-08-13', description: 'High-efficiency Gemini model for agentic workflows, coding, and multimodal reasoning' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', release_date: '2025-06-17', description: 'Fast and versatile multimodal model with low latency and balanced resource efficiency' }
      ],
      groq: [
        { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Groq) (Recommended)', release_date: '2026-08-01', description: 'OpenAI GPT-OSS 20B on Groq LPU (~1,000 tps), ultra-low token cost and fast structured JSON form filling' },
        { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Groq)', release_date: '2026-08-01', description: 'OpenAI GPT-OSS 120B on Groq LPU (~500 tps), flagship open weights reasoning for complex forms' }
      ],
      huggingface: [
        { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instruct (Hugging Face) (Recommended)', release_date: '2024-07-23', description: 'Meta Llama 3.1 8B on Hugging Face Serverless Router ($0.02/1M), ultra-low token cost and smooth instruction following' },
        { id: 'deepseek-ai/DeepSeek-V4.1-Flash', name: 'DeepSeek V4.1 Flash (Hugging Face)', release_date: '2026-09-10', description: 'DeepSeek V4.1 Flash on Hugging Face Serverless Router, high-speed and superior multilingual comprehension' }
      ],
      openai: [
        { id: 'gpt-6-astra', name: 'GPT-6 Astra', release_date: '2026-09-04', description: "OpenAI's most capable model for complex reasoning, coding, and agentic workflows" },
        { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', release_date: '2026-07-09', description: 'Frontier GPT-5.6 model for complex professional work and coding' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', release_date: '2024-07-18', description: 'Affordable and intelligent small model for fast, lightweight tasks' }
      ],
      anthropic: [
        { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', release_date: '2026-09-01', description: 'Claude model for demanding reasoning and long-horizon agentic work' },
        { id: 'claude-opus-5', name: 'Claude Opus 5', release_date: '2026-07-24', description: 'Strongest Claude Opus model for coding and agents' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', release_date: '2024-10-22', description: 'Fastest Claude 3.5 model with state-of-the-art speed' }
      ],
      openrouter: [
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', release_date: '2024-12-26', description: 'Strong open-weights mixture-of-experts model' },
        { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', release_date: '2024-12-06', description: 'State of the art 70B open weight model' }
      ]
    }
  };

  function initApp() {
    // DOM Elements
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    const statusDot = document.getElementById('status-dot');
    const statusLabel = document.getElementById('status-label');
    const formNameEl = document.getElementById('form-name');
    const btnRefresh = document.getElementById('btn-refresh-scan');

    const personaCards = document.querySelectorAll('.persona-card');
    const customContainer = document.getElementById('custom-prompt-container');
    const customInput = document.getElementById('custom-persona-input');

    const modelSelect = document.getElementById('model-select');
    const modelMetaInfo = document.getElementById('model-meta-info');
    const btnSyncModels = document.getElementById('btn-sync-models');
    const customModelContainer = document.getElementById('custom-model-container');
    const customProviderSelect = document.getElementById('custom-provider-select');
    const customModelName = document.getElementById('custom-model-name');
    const activeApiBadge = document.getElementById('active-api-badge');

    const btnFill = document.getElementById('btn-fill-form');
    const progressBox = document.getElementById('progress-box');
    const progressText = document.getElementById('progress-text');
    const progressSpinner = document.getElementById('progress-spinner');

    const questionsList = document.getElementById('questions-list');
    const inspectCount = document.getElementById('inspect-count');

    const geminiKeyInput = document.getElementById('gemini-key');
    const groqKeyInput = document.getElementById('groq-key');
    const huggingfaceKeyInput = document.getElementById('huggingface-key');
    const openaiKeyInput = document.getElementById('openai-key');
    const anthropicKeyInput = document.getElementById('anthropic-key');
    const openrouterKeyInput = document.getElementById('openrouter-key');
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const testButtons = document.querySelectorAll('.btn-test-key');

    // Internal State - all declared at top
    let currentTab = null;
    let formQuestions = [];
    let selectedPersona = 'positive';
    let isGoogleForm = false;
    let isFillInProgress = false;
    let currentCatalog = (typeof window !== 'undefined' && window.MODELS_DEV_CATALOG) ? window.MODELS_DEV_CATALOG : FALLBACK_CATALOG;

    // Unified progress listener for multi-page updates from content script
    const progressListener = (msg) => {
      if (msg && msg.action === 'FORMMIND_PAGE_PROGRESS' && msg.data) {
        const { message, status } = msg.data;
        if (status === 'completed') {
          isFillInProgress = false;
          showProgress(message, false);
          if (btnFill) btnFill.disabled = false;
        } else if (status === 'error') {
          isFillInProgress = false;
          showProgress(message, false, true);
          if (btnFill) btnFill.disabled = false;
        } else {
          isFillInProgress = true;
          showProgress(message, true);
          if (btnFill) btnFill.disabled = true;
        }
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    // Check if an active multi-page session is currently running
    if (chrome?.storage?.local) {
      chrome.storage.local.get(['formmind_active_session'], (res) => {
        const session = res?.formmind_active_session;
        if (session && session.inProgress && (Date.now() - (session.lastUpdated || session.startedAt || 0) < 180000)) {
          isFillInProgress = true;
          if (btnFill) btnFill.disabled = true;
          showProgress(session.statusMessage || `Đang tự động điền trang ${session.pageNumber}...`, true);
        }
      });
    }

    // Setup interactive handlers IMMEDIATELY so UI is instantly responsive
    setupTabs();
    setupPersonaSelection();
    setupModelControls();
    setupSettingsHandlers();
    setupFillHandler();
    setupFormUrlAndAutoNext();
    setupScheduleTab();

    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        statusDot.className = 'status-indicator-dot';
        statusLabel.textContent = 'Rescanning Google Form...';
        formNameEl.textContent = 'Contacting active tab...';
        checkActiveTabAndForm();
      });
    }

    // Now asynchronously load storage and check active tab
    loadSavedSettings()
      .catch(err => console.error('Error in loadSavedSettings:', err))
      .finally(() => {
        checkActiveTabAndForm().catch(err => console.error('Error in checkActiveTabAndForm:', err));
      });

    /**
     * Setup tab navigation
     */
    function setupTabs() {
      tabs.forEach(btn => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-tab');
          tabs.forEach(b => b.classList.remove('active'));
          tabContents.forEach(c => c.classList.remove('active'));

          btn.classList.add('active');
          const targetContent = document.getElementById(targetId);
          if (targetContent) targetContent.classList.add('active');
        });
      });
    }

    /**
     * Setup Persona Card selections
     */
    function setupPersonaSelection() {
      personaCards.forEach(card => {
        card.addEventListener('click', () => {
          personaCards.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          selectedPersona = card.getAttribute('data-persona');

          if (selectedPersona === 'custom') {
            if (customContainer) customContainer.style.display = 'block';
            if (customInput) customInput.focus();
          } else {
            if (customContainer) customContainer.style.display = 'none';
          }

          if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ defaultPersona: selectedPersona });
          }
        });
      });

      if (customInput) {
        customInput.addEventListener('input', () => {
          if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ customPersonaPrompt: customInput.value });
          }
        });
      }
    }

    /**
     * Setup Model dropdown & custom model inputs
     */
    function setupModelControls() {
      if (modelSelect) {
        modelSelect.addEventListener('change', () => {
          if (modelSelect.value === 'custom:custom') {
            if (customModelContainer) customModelContainer.style.display = 'block';
          } else {
            if (customModelContainer) customModelContainer.style.display = 'none';
          }
          if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ selectedModel: modelSelect.value });
          }
          syncFillToKeys(modelSelect.value);
          updateApiBadge();
          updateModelMeta();
        });
      }

      if (customProviderSelect) {
        customProviderSelect.addEventListener('change', () => {
          if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ customProvider: customProviderSelect.value });
          }
          if (modelSelect && modelSelect.value === 'custom:custom') {
            syncFillToKeys('custom:custom');
          }
          updateApiBadge();
        });
      }

      if (customModelName) {
        customModelName.addEventListener('input', () => {
          if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ customModelName: customModelName.value.trim() });
          }
          if (modelSelect && modelSelect.value === 'custom:custom') {
            syncFillToKeys('custom:custom');
          }
        });
      }

      if (btnSyncModels) {
        btnSyncModels.addEventListener('click', async () => {
          btnSyncModels.disabled = true;
          btnSyncModels.textContent = '⏳ Syncing...';

          try {
            const res = await fetch('https://models.dev/api.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const d = await res.json();

            function getModels(pKey, filterFn) {
              if (!d[pKey]) return [];
              return Object.values(d[pKey].models || {})
                .filter(filterFn)
                .sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))
                .map(m => ({
                  id: m.id,
                  name: m.name || m.id,
                  release_date: m.release_date || '',
                  description: m.description || ''
                }));
            }

            const newCatalog = {
              source: 'models.dev',
              last_synced: new Date().toISOString(),
              providers: {
                google: getModels('google', m => m.id.includes('gemini') && m.modalities?.output?.includes('text') && !m.id.includes('image') && !m.id.includes('translate') && !m.id.includes('1.5') && !m.id.includes('2.0')).slice(0, 10),
                groq: [
                  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Groq) (Recommended)', release_date: '2026-08-01', description: 'OpenAI GPT-OSS 20B on Groq LPU (~1,000 tps), ultra-low token cost and fast structured JSON form filling' },
                  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Groq)', release_date: '2026-08-01', description: 'OpenAI GPT-OSS 120B on Groq LPU (~500 tps), flagship open weights reasoning for complex forms' }
                ],
                huggingface: [
                  { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instruct (Hugging Face) (Recommended)', release_date: '2024-07-23', description: 'Meta Llama 3.1 8B on Hugging Face Serverless Router ($0.02/1M), ultra-low token cost and smooth instruction following' },
                  { id: 'deepseek-ai/DeepSeek-V4.1-Flash', name: 'DeepSeek V4.1 Flash (Hugging Face)', release_date: '2026-09-10', description: 'DeepSeek V4.1 Flash on Hugging Face Serverless Router, high-speed and superior multilingual comprehension' }
                ],
                openai: getModels('openai', m => m.modalities?.output?.includes('text') && !m.id.includes('realtime') && !m.id.includes('audio')).slice(0, 10),
                anthropic: getModels('anthropic', m => m.modalities?.output?.includes('text') && !m.id.includes('legacy')).slice(0, 10),
                openrouter: getModels('openrouter', m => (m.id.includes('deepseek') || m.id.includes('llama') || m.id.includes('qwen')) && m.modalities?.output?.includes('text')).slice(0, 10)
              }
            };

            const classicGoogle = [
              { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Recommended)', release_date: '2026-09-02', description: "Google's most intelligent Flash model, engineered for long-horizon software engineering and agents" },
              { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', release_date: '2026-08-13', description: 'High-efficiency Gemini model for agentic workflows, coding, and multimodal reasoning' },
              { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', release_date: '2025-06-17', description: 'Fast and versatile multimodal model with low latency and balanced resource efficiency' }
            ];
            classicGoogle.forEach(cg => {
              if (!newCatalog.providers.google.some(m => m.id === cg.id)) newCatalog.providers.google.push(cg);
            });

            currentCatalog = newCatalog;
            if (chrome.storage && chrome.storage.local) {
              await chrome.storage.local.set({ syncedModelsDev: newCatalog });
            }
            renderModelsDropdown(modelSelect.value);

            btnSyncModels.textContent = '✅ Synced!';
            setTimeout(() => {
              btnSyncModels.disabled = false;
              btnSyncModels.textContent = '🔄 Sync';
            }, 2000);
          } catch (err) {
            console.error('Failed to sync models.dev:', err);
            btnSyncModels.textContent = '❌ Failed';
            setTimeout(() => {
              btnSyncModels.disabled = false;
              btnSyncModels.textContent = '🔄 Sync';
            }, 2000);
          }
        });
      }
    }

    /**
     * Load saved settings and keys from storage
     */
    async function loadSavedSettings() {
      try {
        const data = await chrome.storage.sync.get([
          'geminiKey',
          'geminiModel',
          'geminiCustomModel',
          'groqKey',
          'groqModel',
          'groqCustomModel',
          'huggingfaceKey',
          'huggingfaceModel',
          'huggingfaceCustomModel',
          'openaiKey',
          'openaiModel',
          'openaiCustomModel',
          'anthropicKey',
          'anthropicModel',
          'anthropicCustomModel',
          'openrouterKey',
          'openrouterModel',
          'openrouterCustomModel',
          'selectedModel',
          'customProvider',
          'customModelName',
          'defaultPersona',
          'customPersonaPrompt'
        ]);

        if (data.geminiKey && geminiKeyInput) geminiKeyInput.value = data.geminiKey;
        if (data.groqKey && groqKeyInput) groqKeyInput.value = data.groqKey;
        if (data.huggingfaceKey && huggingfaceKeyInput) huggingfaceKeyInput.value = data.huggingfaceKey;
        if (data.openaiKey && openaiKeyInput) openaiKeyInput.value = data.openaiKey;
        if (data.anthropicKey && anthropicKeyInput) anthropicKeyInput.value = data.anthropicKey;
        if (data.openrouterKey && openrouterKeyInput) openrouterKeyInput.value = data.openrouterKey;

        // Auto-migrate legacy/deprecated models from storage
        const legacyMigrations = {
          'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
          'Qwen/Qwen2.5-7B-Instruct': 'meta-llama/Llama-3.1-8B-Instruct',
          'gemini-1.5-flash': 'gemini-3.8-flash',
          'gemini-2.0-flash': 'gemini-3.8-flash'
        };

        let migratedStorage = false;
        const migrationUpdates = {};

        if (data.groqModel && legacyMigrations[data.groqModel]) {
          data.groqModel = legacyMigrations[data.groqModel];
          migrationUpdates.groqModel = data.groqModel;
          migratedStorage = true;
        }
        if (data.huggingfaceModel && legacyMigrations[data.huggingfaceModel]) {
          data.huggingfaceModel = legacyMigrations[data.huggingfaceModel];
          migrationUpdates.huggingfaceModel = data.huggingfaceModel;
          migratedStorage = true;
        }
        if (data.geminiModel && legacyMigrations[data.geminiModel]) {
          data.geminiModel = legacyMigrations[data.geminiModel];
          migrationUpdates.geminiModel = data.geminiModel;
          migratedStorage = true;
        }

        if (data.selectedModel) {
          Object.entries(legacyMigrations).forEach(([oldId, newId]) => {
            if (data.selectedModel.includes(oldId)) {
              data.selectedModel = data.selectedModel.replace(oldId, newId);
              migrationUpdates.selectedModel = data.selectedModel;
              migratedStorage = true;
            }
          });
        }

        if (migratedStorage && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set(migrationUpdates);
        }

        // Restore provider-specific models in Keys tab
        ['gemini', 'groq', 'huggingface', 'openai', 'anthropic', 'openrouter'].forEach(p => {
          const selectEl = document.getElementById(`${p}-model-select`);
          const customEl = document.getElementById(`${p}-custom-model`);
          const savedModel = data[`${p}Model`];
          const savedCustom = data[`${p}CustomModel`];

          if (savedCustom && customEl) customEl.value = savedCustom;
          if (selectEl && savedModel) {
            const hasOpt = Array.from(selectEl.options).some(o => o.value === savedModel);
            if (hasOpt) {
              selectEl.value = savedModel;
            } else if (savedModel) {
              selectEl.value = 'custom';
              if (customEl) {
                customEl.value = savedModel;
                customEl.style.display = 'block';
              }
            }
          }
        });

        // Load models catalog from storage or catalog file
        await initModelCatalog(data.selectedModel || 'gemini:gemini-3.8-flash');

        if (data.customProvider && customProviderSelect) {
          customProviderSelect.value = data.customProvider;
        }
        if (data.customModelName && customModelName) {
          customModelName.value = data.customModelName;
        }

        if (modelSelect && modelSelect.value === 'custom:custom') {
          if (customModelContainer) customModelContainer.style.display = 'block';
        } else {
          if (customModelContainer) customModelContainer.style.display = 'none';
        }

        if (data.customPersonaPrompt && customInput) {
          customInput.value = data.customPersonaPrompt;
        }

        if (data.defaultPersona) {
          selectedPersona = data.defaultPersona;
          personaCards.forEach(card => {
            if (card.getAttribute('data-persona') === selectedPersona) {
              card.classList.add('selected');
            } else {
              card.classList.remove('selected');
            }
          });
          if (selectedPersona === 'custom' && customContainer) {
            customContainer.style.display = 'block';
          }
        }

        updateApiBadge();
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    }

    async function initModelCatalog(preferredModel) {
      try {
        if (chrome.storage && chrome.storage.local) {
          const localRes = await chrome.storage.local.get('syncedModelsDev');
          if (localRes && localRes.syncedModelsDev && localRes.syncedModelsDev.providers) {
            currentCatalog = localRes.syncedModelsDev;
          }
        }
      } catch (e) {
        console.warn('Could not read cached catalog:', e);
      }

      if (!currentCatalog || !currentCatalog.providers) {
        currentCatalog = (typeof window !== 'undefined' && window.MODELS_DEV_CATALOG) ? window.MODELS_DEV_CATALOG : FALLBACK_CATALOG;
      }

      renderModelsDropdown(preferredModel);
    }

    function renderModelsDropdown(selectedValue) {
      if (!modelSelect) return;
      if (!currentCatalog || !currentCatalog.providers) {
        currentCatalog = FALLBACK_CATALOG;
      }

      modelSelect.innerHTML = '';

      const providerConfigs = [
        { key: 'google', prefix: 'gemini', label: 'Google Gemini (models.dev)' },
        { key: 'groq', prefix: 'groq', label: 'Groq (Ultra-Fast & Low-Token)' },
        { key: 'huggingface', prefix: 'huggingface', label: 'Hugging Face (Low-Token & Multilingual)' },
        { key: 'openai', prefix: 'openai', label: 'OpenAI (models.dev)' },
        { key: 'anthropic', prefix: 'anthropic', label: 'Anthropic Claude (models.dev)' },
        { key: 'openrouter', prefix: 'openrouter', label: 'OpenRouter (models.dev)' }
      ];

      providerConfigs.forEach(pc => {
        const models = currentCatalog.providers[pc.key] || [];
        if (models.length === 0) return;

        const group = document.createElement('optgroup');
        group.label = pc.label;

        models.forEach(m => {
          const cleanId = (m.id || '').replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '');
          const opt = document.createElement('option');
          opt.value = `${pc.prefix}:${cleanId}`;
          opt.textContent = `${m.name} (${m.release_date || 'Latest'})`;
          opt.setAttribute('data-desc', m.description || '');
          opt.setAttribute('data-date', m.release_date || '');
          group.appendChild(opt);
        });

        modelSelect.appendChild(group);
      });

      // Custom option
      const customGroup = document.createElement('optgroup');
      customGroup.label = 'Custom / Other';
      const customOpt = document.createElement('option');
      customOpt.value = 'custom:custom';
      customOpt.textContent = '⚙️ Tùy chỉnh tên model riêng...';
      customGroup.appendChild(customOpt);
      modelSelect.appendChild(customGroup);

      if (selectedValue && Array.from(modelSelect.options).some(o => o.value === selectedValue)) {
        modelSelect.value = selectedValue;
      } else {
        const firstGemini = modelSelect.querySelector('option[value^="gemini:gemini-3.8-flash"]') || modelSelect.querySelector('option[value^="gemini:"]');
        if (firstGemini) modelSelect.value = firstGemini.value;
      }

      populateKeysTabModelSelects();
      syncFillToKeys(modelSelect.value);
      updateModelMeta();
    }

    function updateModelMeta() {
      if (!modelMetaInfo || !modelSelect) return;
      if (modelSelect.value === 'custom:custom') {
        modelMetaInfo.style.display = 'none';
        return;
      }

      const selectedOpt = modelSelect.selectedOptions ? modelSelect.selectedOptions[0] : null;
      if (!selectedOpt) {
        modelMetaInfo.style.display = 'none';
        return;
      }

      const desc = selectedOpt.getAttribute('data-desc');
      const date = selectedOpt.getAttribute('data-date');

      if (desc || date) {
        modelMetaInfo.style.display = 'block';
        modelMetaInfo.innerHTML = `
          ${date ? `<span class="model-meta-date">📅 Release: ${date}</span> • ` : ''}
          <span>${escapeHtml(desc || '')}</span>
        `;
      } else {
        modelMetaInfo.style.display = 'none';
      }
    }

    /**
     * Update active API status badge
     */
    function updateApiBadge() {
      if (!activeApiBadge || !modelSelect) return;

      let provider = (modelSelect.value || '').split(':')[0];
      if (provider === 'custom' && customProviderSelect) {
        provider = customProviderSelect.value;
      }
      if (!provider) provider = 'gemini';

      let hasKey = false;
      const gKey = geminiKeyInput ? geminiKeyInput.value.trim() : '';
      const groqKey = groqKeyInput ? groqKeyInput.value.trim() : '';
      const hfKey = huggingfaceKeyInput ? huggingfaceKeyInput.value.trim() : '';
      const oKey = openaiKeyInput ? openaiKeyInput.value.trim() : '';
      const aKey = anthropicKeyInput ? anthropicKeyInput.value.trim() : '';
      const orKey = openrouterKeyInput ? openrouterKeyInput.value.trim() : '';

      if (provider === 'gemini' && gKey) hasKey = true;
      if (provider === 'groq' && groqKey) hasKey = true;
      if (provider === 'huggingface' && hfKey) hasKey = true;
      if (provider === 'openai' && oKey) hasKey = true;
      if (provider === 'anthropic' && aKey) hasKey = true;
      if (provider === 'openrouter' && orKey) hasKey = true;

      if (hasKey) {
        activeApiBadge.textContent = `${provider.toUpperCase()} Key Ready`;
        activeApiBadge.className = 'api-status-badge';
      } else {
        activeApiBadge.textContent = `${provider.toUpperCase()} Key Missing`;
        activeApiBadge.className = 'api-status-badge missing';
      }
    }

    /**
     * Scan active tab for Google Form
     */
    async function checkActiveTabAndForm() {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        currentTab = tab;

        if (!tab || !tab.url) {
          showNoFormState('No active tab detected.');
          return;
        }

        const isDocsForm = tab.url.includes('docs.google.com/forms');
        const isMockForm = tab.url.includes('mock-form.html');

        if (!isDocsForm && !isMockForm) {
          showNoFormState('Please open a Google Form tab to use FormMind.');
          return;
        }

        isGoogleForm = true;
        if (statusLabel) statusLabel.textContent = 'Scanning Google Form...';
        if (formNameEl) formNameEl.textContent = tab.title || 'Detecting questions...';

        // Send scan message to content script
        chrome.tabs.sendMessage(tab.id, { action: 'GET_FORM_INFO' }, async (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            // Attempt auto-injecting content script if extension was reloaded
            try {
              if (chrome.scripting) {
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['content/content.js']
                });
                await chrome.scripting.insertCSS({
                  target: { tabId: tab.id },
                  files: ['content/content.css']
                });
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id, { action: 'GET_FORM_INFO' }, (retryRes) => {
                    if (retryRes && retryRes.success) {
                      formQuestions = retryRes.questions || [];
                      if (statusDot) statusDot.className = 'status-indicator-dot online';
                      if (statusLabel) statusLabel.textContent = `Google Form Ready (${retryRes.questionCount} questions)`;
                      if (formNameEl) formNameEl.textContent = retryRes.title || tab.title;
                      if (btnFill) btnFill.disabled = isFillInProgress || formQuestions.length === 0;
                      renderQuestionsInspection(formQuestions);
                      return;
                    }
                    showNoFormState('Vui lòng nhấn F5 tải lại trang Google Form để kết nối với extension.');
                  });
                }, 250);
                return;
              }
            } catch (injectErr) {
              console.warn('Auto-inject on scan failed:', injectErr);
            }

            showNoFormState('Vui lòng nhấn F5 tải lại trang Google Form để kết nối với extension.');
            return;
          }

          formQuestions = response.questions || [];
          if (statusDot) statusDot.className = 'status-indicator-dot online';
          if (statusLabel) statusLabel.textContent = `Google Form Ready (${response.questionCount} questions)`;
          if (formNameEl) formNameEl.textContent = response.title || tab.title;

          if (btnFill) btnFill.disabled = isFillInProgress || formQuestions.length === 0;

          renderQuestionsInspection(formQuestions);
        });
      } catch (err) {
        showNoFormState('Could not communicate with active tab.');
      }
    }

    function showNoFormState(message) {
      isGoogleForm = false;
      if (statusDot) statusDot.className = 'status-indicator-dot offline';
      if (statusLabel) statusLabel.textContent = 'No Form Detected';
      if (formNameEl) formNameEl.textContent = message;
      if (btnFill) btnFill.disabled = true;
      if (inspectCount) inspectCount.textContent = '0 items';
      if (questionsList) {
        questionsList.innerHTML = `
          <div class="empty-state">
            <p>${escapeHtml(message)}</p>
          </div>
        `;
      }
    }

    /**
     * Render detected questions in Inspection tab
     */
    function renderQuestionsInspection(questions) {
      if (!inspectCount || !questionsList) return;
      inspectCount.textContent = `${questions.length} items`;
      if (questions.length === 0) {
        questionsList.innerHTML = `
          <div class="empty-state">
            <p>No questions detected in form.</p>
          </div>
        `;
        return;
      }

      questionsList.innerHTML = '';
      questions.forEach((q, idx) => {
        const item = document.createElement('div');
        item.className = 'question-item';

        let optionsPreview = '';
        if (q.type === 'grid_radio' || q.type === 'grid_checkbox') {
          const rowCount = q.rows ? q.rows.length : 0;
          const colCount = q.columns ? q.columns.length : 0;
          const sampleRows = q.rows ? q.rows.slice(0, 2).map(escapeHtml).join(' | ') : '';
          optionsPreview = `<span class="question-options-preview">Matrix (${rowCount} rows × ${colCount} cols): ${sampleRows}${rowCount > 2 ? '...' : ''}</span>`;
        } else if (q.options && q.options.length > 0) {
          optionsPreview = `<span class="question-options-preview">Options: ${q.options.slice(0, 3).map(escapeHtml).join(', ')}${q.options.length > 3 ? '...' : ''}</span>`;
        }

        item.innerHTML = `
          <div class="question-item-header">
            <span class="question-item-title">#${idx + 1}. ${escapeHtml(q.title)}</span>
            <span class="question-type-badge">${escapeHtml(q.type)}${q.required ? ' *' : ''}</span>
          </div>
          ${optionsPreview}
        `;
        questionsList.appendChild(item);
      });
    }

    /**
     * Settings Handlers
     */
    function setupSettingsHandlers() {
      // Toggle custom model input in Keys tab & 2-way sync to Fill tab
      ['gemini', 'groq', 'huggingface', 'openai', 'anthropic', 'openrouter'].forEach(p => {
        const selectEl = document.getElementById(`${p}-model-select`);
        const customEl = document.getElementById(`${p}-custom-model`);
        if (selectEl) {
          selectEl.addEventListener('change', () => {
            if (selectEl.value === 'custom') {
              if (customEl) {
                customEl.style.display = 'block';
                customEl.focus();
              }
            } else {
              if (customEl) {
                customEl.style.display = 'none';
              }
            }
            syncKeysToFill(p);
          });
        }
        if (customEl) {
          customEl.addEventListener('input', () => {
            if (selectEl && selectEl.value === 'custom') {
              syncKeysToFill(p);
            }
          });
        }
      });

      // Auto-save API keys immediately when typing, pasting, or blurring so in-page floating button always has keys
      const keyInputs = [
        { el: geminiKeyInput, key: 'geminiKey' },
        { el: groqKeyInput, key: 'groqKey' },
        { el: huggingfaceKeyInput, key: 'huggingfaceKey' },
        { el: openaiKeyInput, key: 'openaiKey' },
        { el: anthropicKeyInput, key: 'anthropicKey' },
        { el: openrouterKeyInput, key: 'openrouterKey' }
      ];

      keyInputs.forEach(({ el, key }) => {
        if (!el) return;
        const autoPersist = () => {
          const val = el.value.trim();
          chrome.storage.sync.set({ [key]: val }, () => {
            updateApiBadge();
          });
        };
        el.addEventListener('input', autoPersist);
        el.addEventListener('change', autoPersist);
        el.addEventListener('blur', autoPersist);
      });

      if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
          const settings = {
            geminiKey: geminiKeyInput ? geminiKeyInput.value.trim() : '',
            groqKey: groqKeyInput ? groqKeyInput.value.trim() : '',
            huggingfaceKey: huggingfaceKeyInput ? huggingfaceKeyInput.value.trim() : '',
            openaiKey: openaiKeyInput ? openaiKeyInput.value.trim() : '',
            anthropicKey: anthropicKeyInput ? anthropicKeyInput.value.trim() : '',
            openrouterKey: openrouterKeyInput ? openrouterKeyInput.value.trim() : '',

            geminiModel: getChosenModelForProvider('gemini'),
            geminiCustomModel: document.getElementById('gemini-custom-model')?.value.trim() || '',
            groqModel: getChosenModelForProvider('groq'),
            groqCustomModel: document.getElementById('groq-custom-model')?.value.trim() || '',
            huggingfaceModel: getChosenModelForProvider('huggingface'),
            huggingfaceCustomModel: document.getElementById('huggingface-custom-model')?.value.trim() || '',
            openaiModel: getChosenModelForProvider('openai'),
            openaiCustomModel: document.getElementById('openai-custom-model')?.value.trim() || '',
            anthropicModel: getChosenModelForProvider('anthropic'),
            anthropicCustomModel: document.getElementById('anthropic-custom-model')?.value.trim() || '',
            openrouterModel: getChosenModelForProvider('openrouter'),
            openrouterCustomModel: document.getElementById('openrouter-custom-model')?.value.trim() || ''
          };

          chrome.storage.sync.set(settings, () => {
            updateApiBadge();
            btnSaveSettings.innerHTML = '<span>✅ Settings Saved!</span>';
            setTimeout(() => {
              btnSaveSettings.innerHTML = '<span>💾 Save All Settings</span>';
            }, 2000);
          });
        });
      }

      // Test API Key buttons
      testButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
          const provider = btn.getAttribute('data-provider');
          const feedbackEl = document.getElementById(`${provider}-feedback`);
          const keyInput = document.getElementById(`${provider}-key`);
          const key = keyInput ? keyInput.value.trim() : '';
          const chosenModel = getChosenModelForProvider(provider);

          if (!key) {
            if (feedbackEl) {
              feedbackEl.className = 'field-feedback error';
              feedbackEl.textContent = 'Please enter an API key first.';
            }
            return;
          }

          btn.disabled = true;
          btn.textContent = '...';
          if (feedbackEl) {
            feedbackEl.className = 'field-feedback';
            feedbackEl.textContent = `Testing with ${chosenModel}...`;
          }

          chrome.runtime.sendMessage(
            {
              action: 'TEST_API_KEY',
              payload: {
                provider,
                apiKey: key,
                model: chosenModel
              }
            },
            (res) => {
              btn.disabled = false;
              btn.textContent = 'Test';

              if (feedbackEl) {
                if (res && res.success) {
                  feedbackEl.className = 'field-feedback success';
                  feedbackEl.textContent = `✅ ${res.data?.message || 'Verified working!'}`;
                  // Auto-save key & model upon successful test verification!
                  chrome.storage.sync.set({
                    [`${provider}Key`]: key,
                    [`${provider}Model`]: chosenModel
                  }, () => {
                    updateApiBadge();
                  });
                } else {
                  feedbackEl.className = 'field-feedback error';
                  feedbackEl.textContent = `❌ ${res ? res.error : 'Connection failed'}`;
                }
              }
            }
          );
        });
      });
    }

    function populateKeysTabModelSelects() {
      if (!currentCatalog || !currentCatalog.providers) return;

      const providerMap = {
        gemini: currentCatalog.providers.google || [],
        groq: currentCatalog.providers.groq || [],
        huggingface: currentCatalog.providers.huggingface || [],
        openai: currentCatalog.providers.openai || [],
        anthropic: currentCatalog.providers.anthropic || [],
        openrouter: currentCatalog.providers.openrouter || []
      };

      Object.entries(providerMap).forEach(([provider, models]) => {
        const selectEl = document.getElementById(`${provider}-model-select`);
        if (!selectEl) return;

        const currentVal = selectEl.value;
        selectEl.innerHTML = '';

        models.forEach(m => {
          const cleanId = (m.id || '').replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '');
          const opt = document.createElement('option');
          opt.value = cleanId;
          opt.textContent = `${m.name} (${m.release_date || 'Latest'})`;
          selectEl.appendChild(opt);
        });

        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'Tùy chỉnh model...';
        selectEl.appendChild(customOpt);

        if (currentVal && Array.from(selectEl.options).some(o => o.value === currentVal)) {
          selectEl.value = currentVal;
        }
      });
    }

    function syncFillToKeys(fullModelVal) {
      if (!fullModelVal) return;
      let provider = '';
      let modelId = '';

      if (fullModelVal === 'custom:custom') {
        provider = customProviderSelect ? customProviderSelect.value : 'gemini';
        modelId = customModelName ? customModelName.value.trim() : '';
      } else {
        const colonIdx = fullModelVal.indexOf(':');
        if (colonIdx !== -1) {
          provider = fullModelVal.substring(0, colonIdx);
          modelId = fullModelVal.substring(colonIdx + 1);
        } else {
          provider = 'gemini';
          modelId = fullModelVal;
        }
      }

      modelId = (modelId || '').replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();

      if (!provider || provider === 'custom') return;

      const selectEl = document.getElementById(`${provider}-model-select`);
      const customEl = document.getElementById(`${provider}-custom-model`);
      if (!selectEl) return;

      const hasOpt = Array.from(selectEl.options).some(o => o.value === modelId);
      if (hasOpt) {
        selectEl.value = modelId;
        if (customEl) customEl.style.display = 'none';
      } else if (modelId) {
        selectEl.value = 'custom';
        if (customEl) {
          customEl.value = modelId;
          customEl.style.display = 'block';
        }
      }

      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({
          [`${provider}Model`]: modelId
        });
      }
    }

    function syncKeysToFill(provider) {
      if (!modelSelect) return;
      let chosenModel = getChosenModelForProvider(provider);
      chosenModel = (chosenModel || '').replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();
      const combinedVal = `${provider}:${chosenModel}`;

      // 1. Try to find the exact option in modelSelect
      let matchedOption = Array.from(modelSelect.options).find(o => o.value === combinedVal);
      if (matchedOption) {
        modelSelect.value = combinedVal;
        if (customModelContainer) customModelContainer.style.display = 'none';
      } else {
        // If not in catalog list, use custom option in Fill tab
        modelSelect.value = 'custom:custom';
        if (customProviderSelect) customProviderSelect.value = provider;
        if (customModelName) customModelName.value = chosenModel;
        if (customModelContainer) customModelContainer.style.display = 'block';
      }

      // 2. Persist to storage
      if (chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({
          selectedModel: modelSelect.value,
          [`${provider}Model`]: chosenModel,
          customProvider: provider,
          customModelName: chosenModel
        });
      }

      // 3. Update badges & descriptions
      updateApiBadge();
      updateModelMeta();
    }

    function getChosenModelForProvider(provider) {
      const selectEl = document.getElementById(`${provider}-model-select`);
      const customEl = document.getElementById(`${provider}-custom-model`);
      let val = '';
      if (!selectEl) val = getDefaultModelForProvider(provider);
      else if (selectEl.value === 'custom') {
        val = (customEl && customEl.value.trim()) || getDefaultModelForProvider(provider);
      } else {
        val = selectEl.value;
      }
      return (val || '').replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();
    }

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

    /**
     * Form Auto-Fill Trigger
     */
    function setupFillHandler() {
      if (!btnFill) return;

      btnFill.addEventListener('click', async () => {
        if (!currentTab || !isGoogleForm) return;

        const fullVal = modelSelect ? modelSelect.value : '';
        let provider = 'gemini';
        let rawModel = '';
        const colonIdx = fullVal.indexOf(':');
        if (colonIdx !== -1) {
          provider = fullVal.substring(0, colonIdx);
          rawModel = fullVal.substring(colonIdx + 1);
        } else {
          rawModel = fullVal;
        }

        let modelName = rawModel;
        if (provider === 'custom') {
          provider = customProviderSelect ? customProviderSelect.value : 'gemini';
          modelName = (customModelName ? customModelName.value.trim() : '') || getDefaultModelForProvider(provider);
        } else if (modelName === 'auto' || !modelName) {
          modelName = getChosenModelForProvider(provider);
        }
        modelName = (modelName || '').replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();

        const storageKeys = await chrome.storage.sync.get([
          'geminiKey',
          'groqKey',
          'huggingfaceKey',
          'openaiKey',
          'anthropicKey',
          'openrouterKey'
        ]);

        const apiKeyMap = {
          gemini: storageKeys.geminiKey || (geminiKeyInput ? geminiKeyInput.value.trim() : ''),
          groq: storageKeys.groqKey || (groqKeyInput ? groqKeyInput.value.trim() : ''),
          huggingface: storageKeys.huggingfaceKey || (huggingfaceKeyInput ? huggingfaceKeyInput.value.trim() : ''),
          openai: storageKeys.openaiKey || (openaiKeyInput ? openaiKeyInput.value.trim() : ''),
          anthropic: storageKeys.anthropicKey || (anthropicKeyInput ? anthropicKeyInput.value.trim() : ''),
          openrouter: storageKeys.openrouterKey || (openrouterKeyInput ? openrouterKeyInput.value.trim() : '')
        };

        const apiKey = apiKeyMap[provider];

        if (!apiKey) {
          showProgress(`Missing ${provider ? provider.toUpperCase() : 'AI'} API key. Please configure it in Keys tab.`, false, true);
          return;
        }

        const chkAutoAdvance = document.getElementById('chk-auto-advance');
        const autoAdvance = chkAutoAdvance ? chkAutoAdvance.checked : false;

        // Start Fill Process
        btnFill.disabled = true;
        isFillInProgress = true;
        showProgress(`Đang quét câu hỏi biểu mẫu...`, true);

        const sendFillCommand = () => {
          chrome.tabs.sendMessage(
            currentTab.id,
            {
              action: 'START_MULTI_PAGE_FILL',
              payload: {
                persona: selectedPersona,
                customPersonaPrompt: customInput ? customInput.value.trim() : '',
                model: modelName,
                provider,
                apiKey,
                autoAdvance
              }
            },
            async (res) => {
              if (chrome.runtime.lastError || !res || !res.success) {
                const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : (res ? res.error : 'Không có phản hồi từ trang');
                
                // If content script was not connected (e.g. extension just reloaded), auto-inject and retry
                if (err.includes('message port closed') || err.includes('Receiving end does not exist') || err.includes('Could not establish connection')) {
                  try {
                    if (chrome.scripting) {
                      await chrome.scripting.executeScript({
                        target: { tabId: currentTab.id },
                        files: ['content/content.js']
                      });
                      await chrome.scripting.insertCSS({
                        target: { tabId: currentTab.id },
                        files: ['content/content.css']
                      });
                      setTimeout(() => {
                        chrome.tabs.sendMessage(currentTab.id, {
                          action: 'START_MULTI_PAGE_FILL',
                          payload: {
                            persona: selectedPersona,
                            customPersonaPrompt: customInput ? customInput.value.trim() : '',
                            model: modelName,
                            provider,
                            apiKey,
                            autoAdvance
                          }
                        }, (retryRes) => {
                          if (chrome.runtime.lastError || !retryRes || !retryRes.success) {
                            if (!isDone) {
                              chrome.runtime.onMessage.removeListener(progressListener);
                              btnFill.disabled = false;
                              showProgress('Vui lòng nhấn F5 tải lại trang Google Form để đồng bộ extension.', false, true);
                            }
                          }
                        });
                      }, 300);
                      return;
                    }
                  } catch (injectErr) {
                    console.warn('Script injection fallback error:', injectErr);
                  }
                }

                if (!isDone) {
                  chrome.runtime.onMessage.removeListener(progressListener);
                  btnFill.disabled = false;
                  showProgress(`Vui lòng nhấn F5 tải lại trang Google Form để kết nối với extension.`, false, true);
                }
              } else {
                // Command received successfully by content script, awaiting progress updates
                showProgress('Đang gửi câu hỏi tới AI và tạo câu trả lời...', true);
              }
            }
          );
        };

        sendFillCommand();
      });
    }

    /**
     * Format milliseconds into HH:mm:ss or mm:ss
     */
    function formatMsToTime(ms) {
      if (!ms || ms <= 0) return '00:00:00';
      const totalSecs = Math.max(0, Math.floor(ms / 1000));
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;
      const pad = n => String(n).padStart(2, '0');
      if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      }
      return `${pad(minutes)}:${pad(seconds)}`;
    }

    /**
     * Setup Form URL and Auto Next checkbox with two-way sync
     */
    function setupFormUrlAndAutoNext() {
      const popupFormUrlInput = document.getElementById('popup-form-url');
      const btnGetCurrentUrl = document.getElementById('btn-get-current-url');
      const chkAutoAdvance = document.getElementById('chk-auto-advance');

      if (chrome?.storage?.local) {
        chrome.storage.local.get(['formmind_form_url', 'formmind_auto_next'], (res) => {
          if (popupFormUrlInput && res?.formmind_form_url) {
            popupFormUrlInput.value = res.formmind_form_url;
          }
          if (chkAutoAdvance) {
            // Default is OFF (unchecked) per specifications
            chkAutoAdvance.checked = !!(res && res.formmind_auto_next);
          }
        });
      }

      if (chkAutoAdvance) {
        chkAutoAdvance.addEventListener('change', () => {
          chrome.storage.local.set({ formmind_auto_next: chkAutoAdvance.checked });
        });
      }

      if (popupFormUrlInput) {
        let urlDebounce = null;
        popupFormUrlInput.addEventListener('input', () => {
          clearTimeout(urlDebounce);
          urlDebounce = setTimeout(() => {
            chrome.storage.local.set({ formmind_form_url: popupFormUrlInput.value.trim() });
          }, 350);
        });
        popupFormUrlInput.addEventListener('blur', () => {
          chrome.storage.local.set({ formmind_form_url: popupFormUrlInput.value.trim() });
        });
      }

      if (btnGetCurrentUrl) {
        btnGetCurrentUrl.addEventListener('click', () => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].url) {
              const tabUrl = tabs[0].url;
              if (popupFormUrlInput) popupFormUrlInput.value = tabUrl;
              chrome.storage.local.set({ formmind_form_url: tabUrl });
              btnGetCurrentUrl.innerHTML = '<span>✅ Đã lấy!</span>';
              setTimeout(() => {
                btnGetCurrentUrl.innerHTML = '<span>🎯 Lấy URL tab này</span>';
              }, 1500);
            }
          });
        });
      }
    }

    let globalUpdateScheduleCooldown = null;
    let globalUpdateWeightedRules = null;

    /**
     * Setup Schedule Tab: Module A (Cooldown) and Module B (Weighted Rules)
     */
    function setupScheduleTab() {
      const popupCooldownBanner = document.getElementById('popup-cooldown-banner');
      const popupCooldownTimer = document.getElementById('popup-cooldown-timer');
      const btnPopupSkipCooldown = document.getElementById('btn-popup-skip-cooldown');
      const btnPopupCancelCooldown = document.getElementById('btn-popup-cancel-cooldown');
      const chkCooldownEnabled = document.getElementById('chk-cooldown-enabled');
      const cooldownMinInput = document.getElementById('cooldown-min-val');
      const cooldownMaxInput = document.getElementById('cooldown-max-val');
      const cooldownUnitSelect = document.getElementById('cooldown-unit-select');
      const chkCooldownAutoSubmit = document.getElementById('chk-cooldown-auto-submit');
      const chkCooldownAutoRestart = document.getElementById('chk-cooldown-auto-restart');
      const cooldownPreviewHint = document.getElementById('cooldown-preview-hint');

      const btnAddWeightedRule = document.getElementById('btn-add-weighted-rule');
      const btnBatchRandomizeRules = document.getElementById('btn-batch-randomize-rules');
      const btnImportFormRules = document.getElementById('btn-import-form-rules');
      const weightedRulesContainer = document.getElementById('weighted-rules-container');
      const rulesEmptyState = document.getElementById('rules-empty-state');
      const btnSaveSchedule = document.getElementById('btn-save-schedule');
      const scheduleFeedback = document.getElementById('schedule-feedback');

      let currentWeightedRules = [];
      let popupCooldownInterval = null;

      /**
       * Generate random integer percentages for a given count summing to exactly 100%
       * @param {number} count Number of options
       * @returns {number[]} Array of integers summing to 100
       */
      function generatePercentages(count) {
        if (!count || count <= 0) return [];
        if (count === 1) return [100];

        // 1. Sinh count số thực ngẫu nhiên với minimum base để phân bổ tự nhiên
        const raw = Array.from({ length: count }, () => Math.random() + 0.15);
        const sumRaw = raw.reduce((a, b) => a + b, 0);

        // 2. Quy đổi sang phần trăm nguyên
        const percentages = raw.map(v => Math.floor((v / sumRaw) * 100));

        // 3. Tính phần dư bù trừ
        let diff = 100 - percentages.reduce((a, b) => a + b, 0);

        // 4. Cộng dồn bù diff vào các phần tử lớn nhất để tổng luôn luôn đạt chuẩn xác 100
        while (diff > 0) {
          let maxIdx = 0;
          for (let i = 1; i < percentages.length; i++) {
            if (percentages[i] > percentages[maxIdx]) maxIdx = i;
          }
          percentages[maxIdx] += 1;
          diff--;
        }
        while (diff < 0) {
          let maxIdx = 0;
          for (let i = 1; i < percentages.length; i++) {
            if (percentages[i] > percentages[maxIdx]) maxIdx = i;
          }
          if (percentages[maxIdx] > 0) percentages[maxIdx] -= 1;
          diff++;
        }

        return percentages;
      }

      /**
       * Auto-import detected choice-based questions from active form into currentWeightedRules
       */
      function importRulesFromFormQuestions() {
        if (!formQuestions || formQuestions.length === 0) {
          return false;
        }

        const eligible = formQuestions.filter(q => {
          return (q.options && q.options.length > 1) || q.type === 'scale' || q.type === 'radio' || q.type === 'checkbox' || q.type === 'dropdown';
        });

        if (eligible.length === 0) {
          return false;
        }

        const imported = eligible.map((q, idx) => {
          let opts = [];
          if (q.options && q.options.length > 0) {
            opts = q.options.map(optLabel => ({ label: optLabel, weight: 0 }));
          } else if (q.type === 'scale') {
            const min = q.scaleMin || 1;
            const max = q.scaleMax || 5;
            opts = [];
            for (let i = min; i <= max; i++) {
              opts.push({ label: String(i), weight: 0 });
            }
          } else {
            opts = [
              { label: 'Lựa chọn A', weight: 0 },
              { label: 'Lựa chọn B', weight: 0 }
            ];
          }

          const qOrder = q.id !== undefined && !isNaN(parseInt(q.id, 10)) ? (parseInt(q.id, 10) + 1) : (idx + 1);

          return {
            id: 'rule_q_' + qOrder + '_' + Date.now(),
            matchType: 'index',
            matchValue: String(qOrder),
            titleHint: q.title || `Câu hỏi ${qOrder}`,
            options: opts
          };
        });

        currentWeightedRules = imported;
        return true;
      }

      function updateCooldownHint() {
        if (!cooldownPreviewHint) return;
        const min = parseFloat(cooldownMinInput?.value) || 1;
        const max = parseFloat(cooldownMaxInput?.value) || 5;
        const unit = cooldownUnitSelect?.value || 'm';
        const unitName = unit === 's' ? 'giây' : unit === 'h' ? 'tiếng' : 'phút';
        cooldownPreviewHint.innerHTML = `💡 <em>Mỗi lượt điền sẽ chờ ngẫu nhiên từ <strong>${min} ${unitName}</strong> đến <strong>${max} ${unitName}</strong> trước khi tải lại form.</em>`;
      }

      if (cooldownMinInput) cooldownMinInput.addEventListener('input', updateCooldownHint);
      if (cooldownMaxInput) cooldownMaxInput.addEventListener('input', updateCooldownHint);
      if (cooldownUnitSelect) cooldownUnitSelect.addEventListener('change', updateCooldownHint);

      function checkAndRenderCooldownBanner(cdState) {
        if (popupCooldownInterval) clearInterval(popupCooldownInterval);
        if (!popupCooldownBanner) return;

        if (cdState && cdState.active && cdState.endTime > Date.now()) {
          popupCooldownBanner.style.display = 'block';
          const updateClock = () => {
            const rem = cdState.endTime - Date.now();
            if (rem <= 0) {
              popupCooldownBanner.style.display = 'none';
              if (popupCooldownInterval) clearInterval(popupCooldownInterval);
            } else if (popupCooldownTimer) {
              popupCooldownTimer.textContent = formatMsToTime(rem);
            }
          };
          updateClock();
          popupCooldownInterval = setInterval(updateClock, 500);
        } else {
          popupCooldownBanner.style.display = 'none';
        }
      }

      globalUpdateScheduleCooldown = checkAndRenderCooldownBanner;

      if (btnPopupSkipCooldown) {
        btnPopupSkipCooldown.addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'SKIP_COOLDOWN' });
          if (popupCooldownBanner) popupCooldownBanner.style.display = 'none';
          if (popupCooldownInterval) clearInterval(popupCooldownInterval);
        });
      }

      if (btnPopupCancelCooldown) {
        btnPopupCancelCooldown.addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'CANCEL_COOLDOWN' });
          if (popupCooldownBanner) popupCooldownBanner.style.display = 'none';
          if (popupCooldownInterval) clearInterval(popupCooldownInterval);
        });
      }

      function renderRules() {
        if (!weightedRulesContainer) return;
        weightedRulesContainer.innerHTML = '';

        if (!currentWeightedRules || currentWeightedRules.length === 0) {
          if (rulesEmptyState) rulesEmptyState.style.display = 'block';
          return;
        }
        if (rulesEmptyState) rulesEmptyState.style.display = 'none';

        currentWeightedRules.forEach((rule, rIdx) => {
          const card = document.createElement('div');
          card.className = 'rule-card';
          card.dataset.ruleIdx = rIdx;

          const totalWeight = (rule.options || []).reduce((s, o) => s + (parseFloat(o.weight) || 0), 0);
          const isValid100 = Math.abs(totalWeight - 100) < 0.1;
          const isIndexMatch = rule.matchType === 'index';
          const ruleLabel = isIndexMatch
            ? `Câu ${rule.matchValue || (rIdx + 1)}`
            : `Quy tắc #${rIdx + 1}`;
          const titleHintHtml = rule.titleHint
            ? `<span class="rule-title-hint" title="${escapeHtml(rule.titleHint)}">${escapeHtml(rule.titleHint)}</span>`
            : '';

          card.innerHTML = `
            <div class="rule-card-header">
              <div class="rule-badge-group">
                <span class="rule-badge">${escapeHtml(ruleLabel)}</span>
                ${titleHintHtml}
              </div>
              <button type="button" class="btn-delete-rule" data-action="delete-rule" data-rule-idx="${rIdx}" title="Xóa quy tắc này">✕</button>
            </div>
            <div class="rule-match-row">
              <select class="rule-match-select" data-action="change-match-type" data-rule-idx="${rIdx}">
                <option value="index" ${isIndexMatch ? 'selected' : ''}>Số thứ tự (STT)</option>
                <option value="title" ${!isIndexMatch ? 'selected' : ''}>Từ khóa tiêu đề</option>
              </select>
              <input type="text" class="rule-match-input" data-action="change-match-val" data-rule-idx="${rIdx}"
                value="${escapeHtml(rule.matchValue || '')}"
                placeholder="${isIndexMatch ? 'Số câu (vd: 1, 2, 3...)' : 'Từ khóa (vd: giới tính, độ tuổi, hài lòng...)'}">
            </div>
            <div class="rule-options-container" id="rule-opts-${rIdx}"></div>
            <button type="button" class="btn-add-opt" data-action="add-option" data-rule-idx="${rIdx}">+ Thêm lựa chọn</button>
            <div class="rule-footer-bar">
              <span class="rule-total-status ${isValid100 ? 'valid' : 'invalid'}">
                ${isValid100 ? '✅ Tổng: 100%' : `⚠️ Tổng: ${Math.round(totalWeight)}% (chưa bằng 100%)`}
              </span>
              ${!isValid100 ? `<button type="button" class="btn-normalize-100" data-action="normalize-100" data-rule-idx="${rIdx}">⚖️ Tự cân bằng 100%</button>` : ''}
            </div>
          `;

          const optsContainer = card.querySelector(`#rule-opts-${rIdx}`);
          (rule.options || []).forEach((opt, oIdx) => {
            const row = document.createElement('div');
            row.className = 'rule-option-row';
            row.innerHTML = `
              <input type="text" class="rule-option-input" data-action="edit-opt-label" data-rule-idx="${rIdx}" data-opt-idx="${oIdx}"
                value="${escapeHtml(opt.label || '')}" placeholder="Tên đáp án (vd: Nam, Nữ, A, B...)">
              <input type="number" class="rule-weight-input" min="0" max="100" data-action="edit-opt-weight" data-rule-idx="${rIdx}" data-opt-idx="${oIdx}"
                value="${opt.weight}">
              <span class="rule-weight-pct">%</span>
              <button type="button" class="btn-remove-opt" data-action="remove-option" data-rule-idx="${rIdx}" data-opt-idx="${oIdx}" title="Xóa lựa chọn này">✕</button>
            `;
            optsContainer.appendChild(row);
          });

          weightedRulesContainer.appendChild(card);
        });
      }

      globalUpdateWeightedRules = (newRules) => {
        currentWeightedRules = newRules;
        renderRules();
      };

      /**
       * 1-Click Batch Randomize Distribution Handler
       */
      function handleBatchRandomize() {
        // If empty, auto-import from formQuestions or fallback to default sample questions
        if (!currentWeightedRules || currentWeightedRules.length === 0) {
          const imported = importRulesFromFormQuestions();
          if (!imported) {
            currentWeightedRules = [
              {
                id: 'rule_1',
                matchType: 'index',
                matchValue: '1',
                titleHint: 'Ví dụ: Đánh giá chất lượng dịch vụ',
                options: [
                  { label: 'Rất hài lòng', weight: 0 },
                  { label: 'Hài lòng', weight: 0 },
                  { label: 'Bình thường', weight: 0 },
                  { label: 'Không hài lòng', weight: 0 }
                ]
              },
              {
                id: 'rule_2',
                matchType: 'index',
                matchValue: '2',
                titleHint: 'Ví dụ: Bạn có muốn giới thiệu bạn bè không?',
                options: [
                  { label: 'Có', weight: 0 },
                  { label: 'Không', weight: 0 }
                ]
              },
              {
                id: 'rule_3',
                matchType: 'index',
                matchValue: '3',
                titleHint: 'Ví dụ: Độ tuổi của bạn',
                options: [
                  { label: 'Dưới 18', weight: 0 },
                  { label: '18 - 25', weight: 0 },
                  { label: '26 - 35', weight: 0 }
                ]
              }
            ];
          }
          renderRules();
        }

        // Animate dice spin
        const diceIcon = btnBatchRandomizeRules?.querySelector('.btn-dice');
        if (diceIcon) {
          diceIcon.style.transform = 'rotate(360deg) scale(1.25)';
          setTimeout(() => {
            if (diceIcon) diceIcon.style.transform = '';
          }, 450);
        }

        // Batch distribute independent percentages for each question
        const ruleCards = weightedRulesContainer?.querySelectorAll('.rule-card') || [];

        currentWeightedRules.forEach((rule, rIdx) => {
          const opts = rule.options || [];
          if (opts.length === 0) return;

          // Generate independent random percentage distribution summing to exactly 100%
          const pcts = generatePercentages(opts.length);

          // Update model
          opts.forEach((o, oIdx) => {
            o.weight = pcts[oIdx];
          });

          // In-place DOM update with input event dispatching for reactivity
          const card = ruleCards[rIdx];
          if (card) {
            const weightInputs = card.querySelectorAll('.rule-weight-input');
            weightInputs.forEach((input, oIdx) => {
              if (pcts[oIdx] !== undefined) {
                input.value = pcts[oIdx];
                input.classList.remove('flashing');
                void input.offsetWidth; // Trigger reflow for CSS animation
                input.classList.add('flashing');
                input.dispatchEvent(new Event('input', { bubbles: true }));
              }
            });

            const statusEl = card.querySelector('.rule-total-status');
            if (statusEl) {
              statusEl.className = 'rule-total-status valid';
              statusEl.textContent = '✅ Tổng: 100%';
            }

            const normBtn = card.querySelector('.btn-normalize-100');
            if (normBtn) normBtn.remove();
          }
        });

        if (scheduleFeedback) {
          scheduleFeedback.className = 'field-feedback success';
          scheduleFeedback.textContent = `🎲 Đã tự động phân bổ ngẫu nhiên tỉ lệ 100% cho tất cả ${currentWeightedRules.length} câu hỏi! Bấm "Lưu cấu hình" để áp dụng.`;
          setTimeout(() => {
            if (scheduleFeedback && scheduleFeedback.textContent.includes('🎲')) {
              scheduleFeedback.textContent = '';
            }
          }, 4000);
        }
      }

      if (btnBatchRandomizeRules) {
        btnBatchRandomizeRules.addEventListener('click', handleBatchRandomize);
      }

      if (btnImportFormRules) {
        btnImportFormRules.addEventListener('click', () => {
          const ok = importRulesFromFormQuestions();
          if (ok) {
            renderRules();
            if (scheduleFeedback) {
              scheduleFeedback.className = 'field-feedback success';
              scheduleFeedback.textContent = `📥 Đã nạp thành công ${currentWeightedRules.length} câu hỏi từ Google Form! Bấm "🎲 Random tất cả tỉ lệ" để phân bổ.`;
              setTimeout(() => { if (scheduleFeedback) scheduleFeedback.textContent = ''; }, 3500);
            }
          } else {
            if (scheduleFeedback) {
              scheduleFeedback.className = 'field-feedback error';
              scheduleFeedback.textContent = '⚠️ Chưa tìm thấy câu hỏi nào trong form. Vui lòng mở trang Google Form.';
              setTimeout(() => { if (scheduleFeedback) scheduleFeedback.textContent = ''; }, 3500);
            }
          }
        });
      }

      if (weightedRulesContainer) {
        weightedRulesContainer.addEventListener('input', (e) => {
          const action = e.target.dataset.action;
          const rIdx = parseInt(e.target.dataset.ruleIdx, 10);
          const oIdx = parseInt(e.target.dataset.optIdx, 10);
          if (isNaN(rIdx) || !currentWeightedRules[rIdx]) return;

          if (action === 'change-match-val') {
            currentWeightedRules[rIdx].matchValue = e.target.value;
          } else if (action === 'edit-opt-label') {
            if (currentWeightedRules[rIdx].options[oIdx]) {
              currentWeightedRules[rIdx].options[oIdx].label = e.target.value;
            }
          } else if (action === 'edit-opt-weight') {
            if (currentWeightedRules[rIdx].options[oIdx]) {
              currentWeightedRules[rIdx].options[oIdx].weight = parseFloat(e.target.value) || 0;
              const card = e.target.closest('.rule-card');
              if (card) {
                const total = (currentWeightedRules[rIdx].options || []).reduce((s, o) => s + (parseFloat(o.weight) || 0), 0);
                const valid = Math.abs(total - 100) < 0.1;
                const statusEl = card.querySelector('.rule-total-status');
                if (statusEl) {
                  statusEl.className = `rule-total-status ${valid ? 'valid' : 'invalid'}`;
                  statusEl.textContent = valid ? '✅ Tổng: 100%' : `⚠️ Tổng: ${Math.round(total)}% (chưa bằng 100%)`;
                }
              }
            }
          }
        });

        weightedRulesContainer.addEventListener('change', (e) => {
          const action = e.target.dataset.action;
          const rIdx = parseInt(e.target.dataset.ruleIdx, 10);
          if (isNaN(rIdx) || !currentWeightedRules[rIdx]) return;

          if (action === 'change-match-type') {
            currentWeightedRules[rIdx].matchType = e.target.value;
            renderRules();
          }
        });

        weightedRulesContainer.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          const rIdx = parseInt(e.target.dataset.ruleIdx, 10);
          const oIdx = parseInt(e.target.dataset.optIdx, 10);
          if (isNaN(rIdx) || !currentWeightedRules[rIdx]) return;

          if (action === 'delete-rule') {
            currentWeightedRules.splice(rIdx, 1);
            renderRules();
          } else if (action === 'add-option') {
            const opts = currentWeightedRules[rIdx].options || [];
            opts.push({ label: `Đáp án ${opts.length + 1}`, weight: 0 });
            currentWeightedRules[rIdx].options = opts;
            renderRules();
          } else if (action === 'remove-option') {
            currentWeightedRules[rIdx].options.splice(oIdx, 1);
            renderRules();
          } else if (action === 'normalize-100') {
            const opts = currentWeightedRules[rIdx].options || [];
            const sum = opts.reduce((s, o) => s + (parseFloat(o.weight) || 0), 0);
            if (sum > 0) {
              let running = 0;
              opts.forEach((o, i) => {
                if (i === opts.length - 1) {
                  o.weight = Math.max(0, 100 - running);
                } else {
                  const share = Math.round(((parseFloat(o.weight) || 0) / sum) * 100);
                  o.weight = share;
                  running += share;
                }
              });
            } else if (opts.length > 0) {
              const even = Math.floor(100 / opts.length);
              opts.forEach((o, i) => {
                o.weight = i === opts.length - 1 ? 100 - (even * (opts.length - 1)) : even;
              });
            }
            renderRules();
          }
        });
      }

      if (btnAddWeightedRule) {
        btnAddWeightedRule.addEventListener('click', () => {
          currentWeightedRules.push({
            id: 'rule_' + Date.now(),
            matchType: 'index',
            matchValue: String(currentWeightedRules.length + 1),
            options: [
              { label: 'Lựa chọn A', weight: 50 },
              { label: 'Lựa chọn B', weight: 50 }
            ]
          });
          renderRules();
        });
      }

      // --- Module C: Text & Essay Input Question Rules ---
      const textRulesContainer = document.getElementById('text-rules-container');
      const textRulesEmptyState = document.getElementById('text-rules-empty-state');
      const btnAddTextRule = document.getElementById('btn-add-text-rule');
      const btnImportFormTextRules = document.getElementById('btn-import-form-text-rules');
      const btnApplyAllTextMode = document.getElementById('btn-apply-all-text-mode');
      const globalFixedInput = document.getElementById('global-fixed-input');
      const globalListTextarea = document.getElementById('global-list-textarea');
      const globalFixedContainer = document.getElementById('global-fixed-container');
      const globalListContainer = document.getElementById('global-list-container');
      const globalModeRadios = document.querySelectorAll('input[name="global-text-mode"]');

      let currentTextRules = [];
      let globalTextConfig = {
        type: 'text',
        mode: 'fixed',
        fixedValue: 'Không có ý kiến gì thêm',
        listValues: [
          'Dịch vụ rất tốt, nhân viên nhiệt tình',
          'Sản phẩm dùng ổn trong tầm giá',
          'Cần cải thiện tốc độ giao hàng',
          'Rất hài lòng với trải nghiệm lần này'
        ]
      };

      function updateGlobalModeUI() {
        const selectedRadio = document.querySelector('input[name="global-text-mode"]:checked');
        const mode = selectedRadio ? selectedRadio.value : 'fixed';
        globalTextConfig.mode = mode;

        if (globalFixedContainer) {
          globalFixedContainer.style.display = mode === 'fixed' ? 'block' : 'none';
        }
        if (globalListContainer) {
          globalListContainer.style.display = mode === 'random_list' ? 'block' : 'none';
        }
      }

      globalModeRadios.forEach(radio => {
        radio.addEventListener('change', updateGlobalModeUI);
      });

      if (globalFixedInput) {
        globalFixedInput.addEventListener('input', () => {
          globalTextConfig.fixedValue = globalFixedInput.value;
        });
      }

      if (globalListTextarea) {
        globalListTextarea.addEventListener('input', () => {
          globalTextConfig.listValues = globalListTextarea.value.split('\n').map(s => s.trim()).filter(Boolean);
        });
      }

      function renderTextRules() {
        if (!textRulesContainer) return;
        textRulesContainer.innerHTML = '';

        if (!currentTextRules || currentTextRules.length === 0) {
          if (textRulesEmptyState) textRulesEmptyState.style.display = 'block';
          return;
        }
        if (textRulesEmptyState) textRulesEmptyState.style.display = 'none';

        currentTextRules.forEach((rule, rIdx) => {
          const card = document.createElement('div');
          card.className = 'text-rule-card';
          card.dataset.textRuleIdx = rIdx;

          const isIndexMatch = rule.matchType === 'index';
          const ruleLabel = isIndexMatch ? `Câu ${rule.matchValue || (rIdx + 1)} (Tự luận)` : `Quy tắc Tự luận #${rIdx + 1}`;
          const titleHintHtml = rule.titleHint
            ? `<span class="rule-title-hint" title="${escapeHtml(rule.titleHint)}">${escapeHtml(rule.titleHint)}</span>`
            : '';
          const mode = rule.mode || 'fixed';
          const listText = Array.isArray(rule.listValues) ? rule.listValues.join('\n') : (rule.listValues || '');

          card.innerHTML = `
            <div class="rule-card-header">
              <div class="rule-badge-group">
                <span class="text-mode-badge">${escapeHtml(ruleLabel)}</span>
                ${titleHintHtml}
              </div>
              <button type="button" class="btn-delete-rule" data-action="delete-text-rule" data-rule-idx="${rIdx}" title="Xóa câu tự luận này">✕</button>
            </div>
            <div class="rule-match-row">
              <select class="rule-match-select" data-action="change-text-match-type" data-rule-idx="${rIdx}">
                <option value="index" ${isIndexMatch ? 'selected' : ''}>Số thứ tự (STT)</option>
                <option value="title" ${!isIndexMatch ? 'selected' : ''}>Từ khóa tiêu đề</option>
              </select>
              <input type="text" class="rule-match-input" data-action="change-text-match-val" data-rule-idx="${rIdx}"
                value="${escapeHtml(rule.matchValue || '')}"
                placeholder="${isIndexMatch ? 'Số câu (vd: 1, 2, 3...)' : 'Từ khóa (vd: ý kiến, nhận xét, họ tên...)'}">
            </div>
            <div class="mode-selector-row" style="margin-top: 4px;">
              <label class="mode-radio-label">
                <input type="radio" name="text-mode-${rIdx}" value="skip" ${mode === 'skip' ? 'checked' : ''} data-action="change-item-mode" data-rule-idx="${rIdx}">
                <span>🚫 Bỏ qua</span>
              </label>
              <label class="mode-radio-label">
                <input type="radio" name="text-mode-${rIdx}" value="fixed" ${mode === 'fixed' ? 'checked' : ''} data-action="change-item-mode" data-rule-idx="${rIdx}">
                <span>📌 Điền cố định</span>
              </label>
              <label class="mode-radio-label">
                <input type="radio" name="text-mode-${rIdx}" value="random_list" ${mode === 'random_list' ? 'checked' : ''} data-action="change-item-mode" data-rule-idx="${rIdx}">
                <span>🎲 Random theo list</span>
              </label>
            </div>
            <div class="text-mode-input-container">
              ${mode === 'skip' ? `<p class="text-skip-notice">⚪ Trường này sẽ được bỏ qua, để trống khi điền.</p>` : ''}
              ${mode === 'fixed' ? `
                <input type="text" class="styled-input-sm" data-action="edit-fixed-val" data-rule-idx="${rIdx}"
                  value="${escapeHtml(rule.fixedValue || '')}" placeholder="Nội dung cố định (vd: Không có ý kiến gì thêm)">
              ` : ''}
              ${mode === 'random_list' ? `
                <textarea class="styled-textarea-sm" rows="3" data-action="edit-list-val" data-rule-idx="${rIdx}"
                  placeholder="Mỗi đáp án mẫu trên 1 dòng...">${escapeHtml(listText)}</textarea>
              ` : ''}
            </div>
          `;

          textRulesContainer.appendChild(card);
        });
      }

      if (textRulesContainer) {
        textRulesContainer.addEventListener('input', (e) => {
          const action = e.target.dataset.action;
          const rIdx = parseInt(e.target.dataset.ruleIdx, 10);
          if (isNaN(rIdx) || !currentTextRules[rIdx]) return;

          if (action === 'change-text-match-val') {
            currentTextRules[rIdx].matchValue = e.target.value;
          } else if (action === 'edit-fixed-val') {
            currentTextRules[rIdx].fixedValue = e.target.value;
          } else if (action === 'edit-list-val') {
            currentTextRules[rIdx].listValues = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
          }
        });

        textRulesContainer.addEventListener('change', (e) => {
          const action = e.target.dataset.action;
          const rIdx = parseInt(e.target.dataset.ruleIdx, 10);
          if (isNaN(rIdx) || !currentTextRules[rIdx]) return;

          if (action === 'change-text-match-type') {
            currentTextRules[rIdx].matchType = e.target.value;
            renderTextRules();
          } else if (action === 'change-item-mode') {
            currentTextRules[rIdx].mode = e.target.value;
            renderTextRules();
          }
        });

        textRulesContainer.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          const rIdx = parseInt(e.target.dataset.ruleIdx, 10);
          if (isNaN(rIdx) || !currentTextRules[rIdx]) return;

          if (action === 'delete-text-rule') {
            currentTextRules.splice(rIdx, 1);
            renderTextRules();
          }
        });
      }

      if (btnAddTextRule) {
        btnAddTextRule.addEventListener('click', () => {
          currentTextRules.push({
            id: 'text_rule_' + Date.now(),
            type: 'text',
            matchType: 'index',
            matchValue: String(currentTextRules.length + 1),
            titleHint: '',
            mode: globalTextConfig.mode || 'fixed',
            fixedValue: globalTextConfig.fixedValue || 'Không có ý kiến gì thêm',
            listValues: [...(globalTextConfig.listValues || [])]
          });
          renderTextRules();
        });
      }

      // Import text & textarea questions from active form
      function importTextRulesFromForm() {
        if (!formQuestions || formQuestions.length === 0) return false;

        const textQuestions = formQuestions.filter(q => q.type === 'text' || q.type === 'textarea');
        if (textQuestions.length === 0) return false;

        const imported = textQuestions.map((q, idx) => {
          const qOrder = q.id !== undefined && !isNaN(parseInt(q.id, 10)) ? (parseInt(q.id, 10) + 1) : (idx + 1);
          return {
            id: 'text_q_' + qOrder + '_' + Date.now(),
            type: 'text',
            matchType: 'index',
            matchValue: String(qOrder),
            titleHint: q.title || `Câu hỏi tự luận ${qOrder}`,
            mode: globalTextConfig.mode || 'fixed',
            fixedValue: globalTextConfig.fixedValue || 'Không có ý kiến gì thêm',
            listValues: [...(globalTextConfig.listValues || [])]
          };
        });

        currentTextRules = imported;
        return true;
      }

      if (btnImportFormTextRules) {
        btnImportFormTextRules.addEventListener('click', () => {
          const ok = importTextRulesFromForm();
          if (ok) {
            renderTextRules();
            if (scheduleFeedback) {
              scheduleFeedback.className = 'field-feedback success';
              scheduleFeedback.textContent = `📥 Đã nạp thành công ${currentTextRules.length} câu tự luận từ Google Form!`;
              setTimeout(() => { if (scheduleFeedback) scheduleFeedback.textContent = ''; }, 3500);
            }
          } else {
            if (scheduleFeedback) {
              scheduleFeedback.className = 'field-feedback error';
              scheduleFeedback.textContent = '⚠️ Không tìm thấy câu hỏi tự luận/văn bản nào trong form hiện tại.';
              setTimeout(() => { if (scheduleFeedback) scheduleFeedback.textContent = ''; }, 3500);
            }
          }
        });
      }

      // Quick apply mode & values to ALL text rules
      if (btnApplyAllTextMode) {
        btnApplyAllTextMode.addEventListener('click', () => {
          const selectedRadio = document.querySelector('input[name="global-text-mode"]:checked');
          const mode = selectedRadio ? selectedRadio.value : 'fixed';
          const fixedVal = globalFixedInput ? globalFixedInput.value : '';
          const listVals = globalListTextarea ? globalListTextarea.value.split('\n').map(s => s.trim()).filter(Boolean) : [];

          globalTextConfig.mode = mode;
          globalTextConfig.fixedValue = fixedVal;
          globalTextConfig.listValues = listVals;

          if (!currentTextRules || currentTextRules.length === 0) {
            const ok = importTextRulesFromForm();
            if (!ok) {
              currentTextRules = [
                {
                  id: 'text_rule_sample',
                  type: 'text',
                  matchType: 'index',
                  matchValue: '1',
                  titleHint: 'Ví dụ: Đóng góp ý kiến',
                  mode: mode,
                  fixedValue: fixedVal,
                  listValues: [...listVals]
                }
              ];
            }
          }

          // Apply to all items
          currentTextRules.forEach(rule => {
            rule.mode = mode;
            if (mode === 'fixed') rule.fixedValue = fixedVal;
            if (mode === 'random_list') rule.listValues = [...listVals];
          });

          renderTextRules();

          if (scheduleFeedback) {
            const modeName = mode === 'skip' ? 'Bỏ qua (Skip)' : mode === 'fixed' ? 'Điền cố định' : 'Random theo danh sách';
            scheduleFeedback.className = 'field-feedback success';
            scheduleFeedback.textContent = `⚡ Đã áp dụng chế độ "${modeName}" cho toàn bộ ${currentTextRules.length} câu tự luận! Bấm "Lưu cấu hình" để lưu lại.`;
            setTimeout(() => { if (scheduleFeedback) scheduleFeedback.textContent = ''; }, 4000);
          }
        });
      }

      if (btnSaveSchedule) {
        btnSaveSchedule.addEventListener('click', async () => {
          const cooldownConfig = {
            enabled: chkCooldownEnabled ? chkCooldownEnabled.checked : false,
            min: parseFloat(cooldownMinInput?.value) || 5,
            max: parseFloat(cooldownMaxInput?.value) || 15,
            unit: cooldownUnitSelect?.value || 'm',
            autoSubmit: chkCooldownAutoSubmit ? chkCooldownAutoSubmit.checked : false,
            autoRestartFill: chkCooldownAutoRestart ? chkCooldownAutoRestart.checked : true
          };

          await chrome.storage.local.set({
            formmind_cooldown_config: cooldownConfig,
            formmind_weighted_rules: currentWeightedRules,
            formmind_text_rules: currentTextRules,
            formmind_text_global_default: globalTextConfig
          });

          if (scheduleFeedback) {
            scheduleFeedback.className = 'field-feedback success';
            scheduleFeedback.textContent = '✅ Đã lưu cấu hình Schedule & Rules thành công!';
            setTimeout(() => {
              if (scheduleFeedback) scheduleFeedback.textContent = '';
            }, 3000);
          }
        });
      }

      if (chrome?.storage?.local) {
        chrome.storage.local.get([
          'formmind_cooldown_config',
          'formmind_cooldown_state',
          'formmind_weighted_rules',
          'formmind_text_rules',
          'formmind_text_global_default'
        ], (res) => {
          const cfg = res?.formmind_cooldown_config;
          if (cfg) {
            if (chkCooldownEnabled) chkCooldownEnabled.checked = !!cfg.enabled;
            if (cooldownMinInput && cfg.min) cooldownMinInput.value = cfg.min;
            if (cooldownMaxInput && cfg.max) cooldownMaxInput.value = cfg.max;
            if (cooldownUnitSelect && cfg.unit) cooldownUnitSelect.value = cfg.unit;
            if (chkCooldownAutoSubmit) chkCooldownAutoSubmit.checked = !!cfg.autoSubmit;
            if (chkCooldownAutoRestart) chkCooldownAutoRestart.checked = cfg.autoRestartFill !== false;
            updateCooldownHint();
          }

          if (res?.formmind_weighted_rules) {
            currentWeightedRules = res.formmind_weighted_rules;
            renderRules();
          }

          if (res?.formmind_text_rules) {
            currentTextRules = res.formmind_text_rules;
            renderTextRules();
          }

          if (res?.formmind_text_global_default) {
            globalTextConfig = res.formmind_text_global_default;
            const targetRadio = document.querySelector(`input[name="global-text-mode"][value="${globalTextConfig.mode}"]`);
            if (targetRadio) targetRadio.checked = true;
            if (globalFixedInput && globalTextConfig.fixedValue) globalFixedInput.value = globalTextConfig.fixedValue;
            if (globalListTextarea && globalTextConfig.listValues) {
              globalListTextarea.value = Array.isArray(globalTextConfig.listValues) ? globalTextConfig.listValues.join('\n') : globalTextConfig.listValues;
            }
            updateGlobalModeUI();
          }

          checkAndRenderCooldownBanner(res?.formmind_cooldown_state);
        });
      }
    }

    // Listen for storage changes from in-page floating widget and background
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync') {
          if (changes.defaultPersona) {
            const newPersona = changes.defaultPersona.newValue;
            if (newPersona && newPersona !== selectedPersona) {
              selectedPersona = newPersona;
              personaCards.forEach(card => {
                if (card.getAttribute('data-persona') === selectedPersona) {
                  card.classList.add('selected');
                } else {
                  card.classList.remove('selected');
                }
              });
              if (customContainer) {
                customContainer.style.display = selectedPersona === 'custom' ? 'block' : 'none';
              }
            }
          }
          if (changes.selectedModel && modelSelect) {
            const newModel = changes.selectedModel.newValue;
            if (modelSelect.value !== newModel) {
              const hasOpt = Array.from(modelSelect.options).some(o => o.value === newModel);
              if (hasOpt) {
                modelSelect.value = newModel;
                syncFillToKeys(newModel);
                updateModelMeta();
              }
            }
          }
        }

        if (areaName === 'local') {
          // Two-way sync: Auto Next checkbox
          if (changes.formmind_auto_next) {
            const chkAutoAdvance = document.getElementById('chk-auto-advance');
            if (chkAutoAdvance) {
              chkAutoAdvance.checked = !!changes.formmind_auto_next.newValue;
            }
          }

          // Two-way sync: Form URL input
          if (changes.formmind_form_url) {
            const popupFormUrlInput = document.getElementById('popup-form-url');
            if (popupFormUrlInput && document.activeElement !== popupFormUrlInput) {
              popupFormUrlInput.value = changes.formmind_form_url.newValue || '';
            }
          }

          // Cooldown state changes
          if (changes.formmind_cooldown_state && typeof globalUpdateScheduleCooldown === 'function') {
            globalUpdateScheduleCooldown(changes.formmind_cooldown_state.newValue);
          }

          // Weighted rules changes
          if (changes.formmind_weighted_rules && typeof globalUpdateWeightedRules === 'function') {
            globalUpdateWeightedRules(changes.formmind_weighted_rules.newValue || []);
          }

          if (changes.formmind_active_session) {
            const newSession = changes.formmind_active_session.newValue;
            if (newSession && newSession.inProgress) {
              isFillInProgress = true;
              if (btnFill) btnFill.disabled = true;
              showProgress(newSession.statusMessage || `Đang tự động điền trang ${newSession.pageNumber}...`, true);
            } else {
              isFillInProgress = false;
              if (btnFill && isGoogleForm && formQuestions.length > 0) {
                btnFill.disabled = false;
              }
            }
          }
        }
      });
    }

    function showProgress(text, isSpinning = false, isError = false) {
      if (!progressBox || !progressText || !progressSpinner) return;
      progressBox.style.display = 'block';
      progressText.textContent = text;
      progressSpinner.style.display = isSpinning ? 'block' : 'none';

      if (isError) {
        progressText.style.color = 'var(--error)';
      } else {
        progressText.style.color = 'var(--text-secondary)';
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }

  // Support both early and late script execution
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
