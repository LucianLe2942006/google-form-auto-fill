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

        const chkAutoAdvance = document.getElementById('chk-auto-advance');
        if (chkAutoAdvance) {
          if (data.autoAdvancePages !== undefined) {
            chkAutoAdvance.checked = data.autoAdvancePages !== false;
          }
          chkAutoAdvance.addEventListener('change', () => {
            if (chrome.storage && chrome.storage.sync) {
              chrome.storage.sync.set({ autoAdvancePages: chkAutoAdvance.checked });
            }
          });
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
        const autoAdvance = chkAutoAdvance ? chkAutoAdvance.checked : true;

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

    // Listen for storage changes from in-page floating widget
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
