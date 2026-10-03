// FormMind - Content Script for Google Forms

(function () {
  console.log('[FormMind] Initializing Google Form content script...');

  // State
  let cachedQuestions = [];

  // Helper to send runtime messages safely without throwing unhandled port closed errors
  function sendSafeRuntimeMessage(msg, callback) {
    try {
      if (!chrome?.runtime?.id) return;
      chrome.runtime.sendMessage(msg, (res) => {
        const voidErr = chrome.runtime.lastError;
        if (callback) callback(res);
      });
    } catch (e) {
      // Ignore if context is unmounted
    }
  }

  // Initialize floating widget once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Remove any previously rendered floating widget (e.g. upon script re-injection)
    const oldWidget = document.getElementById('formmind-floating-widget');
    if (oldWidget) oldWidget.remove();

    createFloatingWidget();
    setupMessageListeners();
    checkAndResumeActiveSession();
  }

  /**
   * Polls until questions or submit button are fully rendered on the active page
   */
  async function waitForQuestionsOnPage(timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const questions = scanGoogleForm();
      if (questions.length > 0) {
        return { success: true, questions };
      }
      const submitBtn = findSubmitButton();
      if (submitBtn && !findNextButton()) {
        return { success: true, isOnlySubmit: true, submitBtn, questions: [] };
      }
      await new Promise(r => setTimeout(r, 300));
    }
    return { success: false, questions: scanGoogleForm() };
  }

  /**
   * Resume multi-page filling session if Google Forms reloaded/navigated to next section
   */
  async function checkAndResumeActiveSession() {
    try {
      if (!chrome?.storage?.local) return;
      const res = await new Promise(r => chrome.storage.local.get(['formmind_active_session'], r));
      const session = res?.formmind_active_session;
      if (!session || !session.inProgress) return;

      // Only resume if session was created/updated within the last 3 minutes
      if (Date.now() - (session.lastUpdated || session.startedAt || 0) > 180000) {
        chrome.storage.local.remove('formmind_active_session');
        return;
      }

      console.log(`[FormMind] Resuming active multi-page session at Page ${session.pageNumber}...`);
      const resumeMsg = `📄 Đang tiếp tục tự động điền trang ${session.pageNumber}...`;
      showToast(resumeMsg, 'info');

      // Update session status in storage immediately so popup sees it on open
      chrome.storage.local.set({
        formmind_active_session: {
          ...session,
          statusMessage: resumeMsg,
          lastUpdated: Date.now()
        }
      });

      sendSafeRuntimeMessage({
        action: 'FORMMIND_PAGE_PROGRESS',
        data: {
          status: 'navigating',
          page: session.pageNumber - 1,
          nextPage: session.pageNumber,
          totalFilled: session.totalFilled,
          message: resumeMsg
        }
      });

      // Wait for questions to be mounted in the DOM
      await waitForQuestionsOnPage(8000);

      await runMultiPageAutoFill({
        selectedPersona: session.persona,
        chosenModel: session.model,
        chosenProvider: session.provider,
        apiKey: session.apiKey,
        customPersonaPrompt: session.customPersonaPrompt,
        autoAdvance: session.autoAdvance,
        initialPageNumber: session.pageNumber,
        initialTotalFilled: session.totalFilled,
        onProgress: (p) => {
          sendSafeRuntimeMessage({
            action: 'FORMMIND_PAGE_PROGRESS',
            data: p
          });
        }
      });
    } catch (err) {
      console.warn('[FormMind] Error in checkAndResumeActiveSession:', err);
    }
  }

  /**
   * Listen for messages from the popup
   */
  function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!request || !request.action) return false;

      if (request.action === 'GET_FORM_INFO') {
        try {
          const questions = scanGoogleForm();
          sendResponse({
            success: true,
            title: getFormTitle(),
            questionCount: questions.length,
            questions: questions.map(q => ({
              id: q.id,
              title: q.title,
              description: q.description,
              type: q.type,
              options: q.options,
              rows: q.rows || [],
              columns: q.columns || [],
              required: q.required
            }))
          });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        return false; // Synchronous response, do not return true
      }

      if (request.action === 'APPLY_AI_ANSWERS') {
        applyAnswersToForm(request.answers)
          .then(result => sendResponse({ success: true, count: result.count }))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
      }

      if (request.action === 'START_MULTI_PAGE_FILL') {
        const payload = request.payload || {};
        // Immediately acknowledge receipt so message port never closes with timeout
        sendResponse({ success: true, started: true });

        // Run multi-page fill asynchronously in page context
        runMultiPageAutoFill({
          selectedPersona: payload.persona || 'positive',
          chosenModel: payload.model || 'gemini-3.8-flash',
          chosenProvider: payload.provider || 'gemini',
          apiKey: payload.apiKey,
          customPersonaPrompt: payload.customPersonaPrompt || '',
          autoAdvance: payload.autoAdvance !== false,
          onProgress: (progressInfo) => {
            sendSafeRuntimeMessage({
              action: 'FORMMIND_PAGE_PROGRESS',
              data: progressInfo
            });
          }
        }).catch(err => {
          console.error('[FormMind Content Fill Error]:', err);
          showToast(`Lỗi: ${err.message}`, 'error');
          sendSafeRuntimeMessage({
            action: 'FORMMIND_PAGE_PROGRESS',
            data: { status: 'error', message: `Lỗi: ${err.message}` }
          });
        });

        return false;
      }

      return false;
    });
  }

  /**
   * Get the main Google Form title
   */
  function getFormTitle() {
    const titleEl = document.querySelector('div[role="heading"][aria-level="1"], .F9yp7e, .freebirdFormviewerViewHeaderTitle');
    return titleEl ? titleEl.innerText.trim() : document.title || 'Google Form';
  }

  /**
   * Extract question description, helper text, and validation constraints (min, max, exact selections)
   */
  function extractQuestionConstraints(node, titleText = '') {
    const parts = [];

    // Helper text, descriptions, sub-labels
    const descEls = node.querySelectorAll(
      '.g4hhxb, .Sn4eF, .z3vRcc, .W4RThf, [id*="desc"], [id*="help"], .freebirdFormviewerViewItemsItemItemHelpText'
    );
    descEls.forEach(el => {
      const txt = el.innerText.trim();
      if (txt && !parts.includes(txt)) parts.push(txt);
    });

    // Active validation error / constraint alerts (Google Forms error banners)
    const alertEls = node.querySelectorAll(
      '.RHiN0e, [role="alert"], .o69ahc, .CDELXb, .d9O0Ce, div[aria-live="assertive"], div[aria-live="polite"]'
    );
    const alertParts = [];
    alertEls.forEach(el => {
      if (isElementVisible(el)) {
        const txt = el.innerText.trim();
        if (txt && !alertParts.includes(txt)) alertParts.push(txt);
      }
    });
    const validationAlert = alertParts.join(' | ');
    if (validationAlert && !parts.includes(validationAlert)) {
      parts.push(validationAlert);
    }

    const fullText = (titleText + ' ' + parts.join(' ')).trim();
    let min = null;
    let max = null;
    let exact = null;

    // Exact matches: "chọn chính xác 2", "chọn đúng 2", "chọn 2 mục", "chọn 2 đáp án", "select exactly 2", "pick 2 options", "(chọn 2)"
    const exactMatch = fullText.match(/(?:chọn\s+(?:chính\s+xác|đúng)\s+(\d+)|chọn\s+(\d+)\s+(?:mục|lựa\s+chọn|câu|phương\s+án|đáp\s+án)|select\s+exactly\s+(\d+)|pick\s+(\d+)\s+options?|\(chọn\s+(\d+)\))/i);
    if (exactMatch) {
      exact = parseInt(exactMatch[1] || exactMatch[2] || exactMatch[3] || exactMatch[4] || exactMatch[5], 10);
    }

    // Range matches: "chọn từ 1 đến 3", "chọn từ 1 - 3", "chọn 1 đến 3", "chọn 1 hoặc 2", "chọn 1 - 3", "select between 1 and 3", "choose 1 to 3"
    const rangeMatch = fullText.match(/(?:chọn\s+từ\s+(\d+)\s*(?:đến|-)\s*(\d+)|chọn\s+(\d+)\s*(?:đến|-|hoặc)\s*(\d+)|select\s+between\s+(\d+)\s+and\s+(\d+)|select\s+(\d+)\s*(?:to|-)\s*(\d+))/i);
    if (rangeMatch) {
      const rMin = parseInt(rangeMatch[1] || rangeMatch[3] || rangeMatch[5] || rangeMatch[7], 10);
      const rMax = parseInt(rangeMatch[2] || rangeMatch[4] || rangeMatch[6] || rangeMatch[8], 10);
      if (!isNaN(rMin) && !isNaN(rMax)) {
        min = rMin;
        max = rMax;
      }
    }

    // Min matches: "chọn ít nhất 2", "tối thiểu 2", "ít nhất 2", "select at least 2", "at least 2", "min 2"
    if (!min) {
      const minMatch = fullText.match(/(?:chọn\s+ít\s+nhất\s+(\d+)|tối\s+thiểu\s+(?:là\s+)?(\d+)|ít\s+nhất\s+(\d+)|select\s+at\s+least\s+(\d+)|at\s+least\s+(\d+)|min\s+(\d+))/i);
      if (minMatch) {
        min = parseInt(minMatch[1] || minMatch[2] || minMatch[3] || minMatch[4] || minMatch[5] || minMatch[6], 10);
      }
    }

    // Max matches: "chọn nhiều nhất 3", "tối đa 3", "không quá 3", "select at most 3", "at most 3", "up to 3", "max 3"
    if (!max) {
      const maxMatch = fullText.match(/(?:chọn\s+(?:nhiều\s+nhất|tối\s+đa)\s+(\d+)|tối\s+đa\s+(?:là\s+)?(\d+)|không\s+quá\s+(\d+)|nhiều\s+nhất\s+(\d+)|select\s+at\s+most\s+(\d+)|at\s+most\s+(\d+)|up\s+to\s+(\d+)|max\s+(\d+))/i);
      if (maxMatch) {
        max = parseInt(maxMatch[1] || maxMatch[2] || maxMatch[3] || maxMatch[4] || maxMatch[5] || maxMatch[6] || maxMatch[7] || maxMatch[8], 10);
      }
    }

    let summary = '';
    if (exact) summary = `Chọn chính xác ${exact} mục (Select exactly ${exact})`;
    else if (min && max) summary = `Chọn từ ${min} đến ${max} mục (Select between ${min} and ${max})`;
    else if (min) summary = `Chọn ít nhất ${min} mục (Select at least ${min})`;
    else if (max) summary = `Chọn tối đa ${max} mục (Select at most ${max})`;
    else if (validationAlert) summary = validationAlert;
    else summary = parts.join(' | ');

    return {
      description: parts.join(' | '),
      validationAlert,
      min,
      max,
      exact,
      summary
    };
  }

  /**
   * Scan Google Form DOM and identify all question containers and types
   */
  function scanGoogleForm() {
    cachedQuestions = [];

    // Question items in modern Google Forms
    let questionNodes = Array.from(document.querySelectorAll('div[role="listitem"]'));

    if (questionNodes.length === 0) {
      questionNodes = Array.from(document.querySelectorAll('.Qr7Oae, .freebirdFormviewerViewItemsItemItem'));
    }

    let idCounter = 0;

    questionNodes.forEach((node) => {
      // Only process questions visible on the current active page
      if (!isElementVisible(node)) return;

      // Find question title
      const titleEl = node.querySelector('div[role="heading"], .M7eMe, .freebirdFormviewerViewItemsItemItemTitle');
      if (!titleEl) return;

      const titleText = titleEl.innerText.trim();
      if (!titleText) return;

      // Check if required
      const required = Boolean(
        node.querySelector('.v3YIBe, .RHiN0e') ||
        titleEl.innerText.includes('*') ||
        node.getAttribute('aria-required') === 'true'
      );

      // Extract description and validation constraints
      const constraints = extractQuestionConstraints(node, titleText);

      // Determine Question Type & Collect Targets
      const itemInfo = detectQuestionTypeAndControls(node);
      if (!itemInfo) return;

      cachedQuestions.push({
        id: idCounter++,
        title: titleText.replace(/\s*\*$/, ''), // remove trailing asterisk
        description: constraints.description,
        constraints: constraints,
        required,
        type: itemInfo.type,
        options: itemInfo.options || [],
        rows: itemInfo.rows || [],
        columns: itemInfo.columns || [],
        node: node,
        controls: itemInfo.controls
      });
    });

    console.log(`[FormMind] Scanned ${cachedQuestions.length} questions from form.`);
    return cachedQuestions;
  }

    /**
     * Detect Multiple Choice Grid (grid_radio) or Checkbox Grid (grid_checkbox)
     * Google Forms renders grid questions as a table of rows with radios or checkboxes.
     */
    function detectGridQuestion(node) {
      // 1. Column headers
      let columnHeaders = Array.from(
        node.querySelectorAll('div[role="columnheader"], .ThdJC, .c2gzKc, .O1CAb, .grid-col-header')
      ).map(el => el.innerText.trim()).filter(Boolean);

      // 2. Detect Multiple Choice Grid by radiogroup rows
      // Google Forms assigns role="radiogroup" to each individual row in a grid
      const radiogroups = Array.from(node.querySelectorAll('div[role="radiogroup"], .grid-row[role="radiogroup"]'));

      if (radiogroups.length > 1) {
        const rows = [];
        radiogroups.forEach((rg, rIdx) => {
          const rowContainer = rg.closest('div[role="row"], .E2DuGf, .grid-row') || rg.parentElement;
          const rowHeaderEl = rowContainer ? rowContainer.querySelector('div[role="rowheader"], .SS37Od, .b3hWve, .VveJif, .K2RDMe, .grid-row-header') : null;
          let rowLabel = (rowHeaderEl ? rowHeaderEl.innerText.trim() : '') ||
                         (rg.getAttribute('aria-label') || '').trim() ||
                         `Row ${rIdx + 1}`;

          const radios = Array.from(rg.querySelectorAll('div[role="radio"]'));
          if (radios.length === 0) return;

          // If columnHeaders couldn't be found via headers, extract from radios
          if (columnHeaders.length === 0) {
            columnHeaders = radios.map((r, cIdx) => {
              const aria = r.getAttribute('aria-label') || '';
              if (aria.includes(',')) {
                const parts = aria.split(',');
                return parts[parts.length - 1].trim();
              }
              return r.getAttribute('data-value') || aria.trim() || `Option ${cIdx + 1}`;
            });
          }

          rows.push({
            index: rIdx,
            label: rowLabel,
            radios: radios
          });
        });

        if (rows.length > 1) {
          return {
            type: 'grid_radio',
            rows: rows.map(r => r.label),
            columns: columnHeaders,
            controls: {
              rows: rows,
              columns: columnHeaders
            }
          };
        }
      }

      // 3. Detect grid by row elements with multiple radios or checkboxes
      const candidateRows = Array.from(
        node.querySelectorAll('div[role="row"], .E2DuGf, .grid-row')
      ).filter(r => {
        // Must contain at least 2 radios or 2 checkboxes (exclude column header row)
        return r.querySelectorAll('div[role="radio"], div[role="checkbox"]').length >= 2;
      });

      if (candidateRows.length > 1) {
        const firstRowRadios = candidateRows[0].querySelectorAll('div[role="radio"]');
        const isRadio = firstRowRadios.length >= 2;
        const isCheckbox = !isRadio && candidateRows[0].querySelectorAll('div[role="checkbox"]').length >= 2;

        if (isRadio || isCheckbox) {
          const type = isRadio ? 'grid_radio' : 'grid_checkbox';
          const rows = [];

          candidateRows.forEach((rEl, rIdx) => {
            const rowHeaderEl = rEl.querySelector('div[role="rowheader"], .SS37Od, .b3hWve, .VveJif, .K2RDMe, .grid-row-header');
            let rowLabel = (rowHeaderEl ? rowHeaderEl.innerText.trim() : '') ||
                           (rEl.getAttribute('aria-label') || '').trim() ||
                           `Row ${rIdx + 1}`;

            const inputs = Array.from(rEl.querySelectorAll(isRadio ? 'div[role="radio"]' : 'div[role="checkbox"]'));
            if (inputs.length === 0) return;

            if (columnHeaders.length === 0) {
              columnHeaders = inputs.map((inp, cIdx) => {
                const aria = inp.getAttribute('aria-label') || '';
                if (aria.includes(',')) {
                  const parts = aria.split(',');
                  return parts[parts.length - 1].trim();
                }
                return inp.getAttribute('data-value') || aria.trim() || `Option ${cIdx + 1}`;
              });
            }

            rows.push({
              index: rIdx,
              label: rowLabel,
              radios: isRadio ? inputs : undefined,
              checkboxes: isCheckbox ? inputs : undefined
            });
          });

          if (rows.length > 1) {
            return {
              type,
              rows: rows.map(r => r.label),
              columns: columnHeaders,
              controls: {
                rows: rows,
                columns: columnHeaders
              }
            };
          }
        }
      }

      return null;
    }

    /**
     * Detect question type (text, textarea, radio, checkbox, scale, dropdown, grid_radio, grid_checkbox) and extract DOM controls
     */
    function detectQuestionTypeAndControls(node) {
      // 0. Check for Grid Questions (Multiple Choice Grid & Checkbox Grid)
      // Must be evaluated BEFORE standard radio/checkbox checks to prevent flattening matrix rows
      const gridInfo = detectGridQuestion(node);
      if (gridInfo) {
        return gridInfo;
      }

      // 1. Check for Linear Scale (Likert 1-5, 1-10)
      // Identified by .N3EkYr or radio group where options are numbers
      const scaleRadios = Array.from(node.querySelectorAll('div[role="radio"]'));
      const isLinearScale = node.querySelector('.N3EkYr') || (
        scaleRadios.length >= 3 &&
        scaleRadios.every(r => /^\d+$/.test(r.getAttribute('data-value') || r.innerText.trim()))
      );

      if (isLinearScale && scaleRadios.length > 0) {
        const scaleValues = scaleRadios.map(r => r.getAttribute('data-value') || r.innerText.trim());
        return {
          type: 'scale',
          options: scaleValues,
          controls: {
            scaleRadios
          }
        };
      }

      // 2. Check for Multiple Choice (Radio group)
      const radioEls = Array.from(node.querySelectorAll('div[role="radio"]'));
      if (radioEls.length > 0) {
        const options = [];
        radioEls.forEach(radio => {
          // Label is usually inside .aDTYNe or text sibling
          const labelContainer = radio.closest('label') || radio.parentElement;
          const textEl = labelContainer ? labelContainer.querySelector('.aDTYNe, span') : null;
          const label = textEl ? textEl.innerText.trim() : (radio.getAttribute('aria-label') || radio.getAttribute('data-value') || '').trim();
          options.push(label || `Option ${options.length + 1}`);
        });

        return {
          type: 'radio',
          options,
          controls: {
            radios: radioEls
          }
        };
      }

      // 3. Check for Checkboxes (Multi-select)
      const checkboxEls = Array.from(node.querySelectorAll('div[role="checkbox"]'));
    if (checkboxEls.length > 0) {
      const options = [];
      checkboxEls.forEach(cb => {
        const labelContainer = cb.closest('label') || cb.parentElement;
        const textEl = labelContainer ? labelContainer.querySelector('.aDTYNe, span') : null;
        const label = textEl ? textEl.innerText.trim() : (cb.getAttribute('aria-label') || '').trim();
        options.push(label || `Option ${options.length + 1}`);
      });

      return {
        type: 'checkbox',
        options,
        controls: {
          checkboxes: checkboxEls
        }
      };
    }

    // 4. Check for Dropdown (listbox)
    const listbox = node.querySelector('div[role="listbox"]');
    if (listbox) {
      // In Google Forms dropdowns, options might only populate when clicked or are stored in data attributes
      return {
        type: 'dropdown',
        options: [],
        controls: {
          listbox
        }
      };
    }

    // 5. Check for Paragraph (textarea)
    const textarea = node.querySelector('textarea.KHxj8b, textarea');
    if (textarea) {
      return {
        type: 'textarea',
        controls: {
          input: textarea
        }
      };
    }

    // 6. Check for Short Answer (input text)
    const textInput = node.querySelector('input.whsOnd[type="text"], input[type="text"], input:not([type])');
    if (textInput) {
      return {
        type: 'text',
        controls: {
          input: textInput
        }
      };
    }

    return null;
  }

  /**
   * Fill answers into Google Form DOM elements
   */
  async function applyAnswersToForm(answers) {
    if (!answers || !Array.isArray(answers)) {
      throw new Error('Invalid answers array received.');
    }

    let filledCount = 0;

    for (const ans of answers) {
      const question = cachedQuestions.find(q => q.id === ans.id);
      if (!question) continue;

      try {
        const success = await fillSingleQuestion(question, ans.value);
        if (success) {
          filledCount++;
          // Add visual pulse effect
          question.node.classList.remove('fmind-highlight-filled');
          void question.node.offsetWidth; // trigger reflow
          question.node.classList.add('fmind-highlight-filled');
        }
      } catch (err) {
        console.warn(`[FormMind] Error filling question #${question.id} (${question.title}):`, err);
      }
    }

    return { count: filledCount };
  }

  /**
   * Fill an individual question according to its type
   */
  async function fillSingleQuestion(question, value) {
    const { type, controls, options } = question;

    // 1. Text & Textarea
    if (type === 'text' || type === 'textarea') {
      const input = controls.input;
      if (!input) return false;

      const textValue = String(value || '');
      input.focus();
      input.value = textValue;

      // Dispatch full suite of events for Google Forms Closure/React state binding
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
      return true;
    }

    // 2. Radio (Multiple Choice)
    if (type === 'radio') {
      const radios = controls.radios;
      if (!radios || radios.length === 0) return false;

      // Find matching index or label
      let targetIndex = -1;
      if (typeof value === 'number') {
        targetIndex = value;
      } else {
        const targetStr = String(value).toLowerCase().trim();
        targetIndex = options.findIndex(opt => opt.toLowerCase().trim() === targetStr);

        // Fallback: partial match or includes
        if (targetIndex === -1) {
          targetIndex = options.findIndex(opt => 
            opt.toLowerCase().includes(targetStr) || targetStr.includes(opt.toLowerCase())
          );
        }
      }

      if (targetIndex < 0 || targetIndex >= radios.length) {
        // Fallback to first option if required and no match
        targetIndex = 0;
      }

      const radioToClick = radios[targetIndex];
      if (radioToClick) {
        radioToClick.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        radioToClick.click();
        radioToClick.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      }
    }

    // 3. Checkboxes (Multi-select)
    if (type === 'checkbox') {
      const checkboxes = controls.checkboxes;
      if (!checkboxes || checkboxes.length === 0) return false;

      let targets = Array.isArray(value) ? [...value] : [value];
      const constraints = question.constraints || {};

      // Match targets to option indices
      let selectedIndices = [];
      checkboxes.forEach((cb, idx) => {
        const optLabel = options[idx] || '';
        const isMatched = targets.some(t => {
          if (typeof t === 'number') return t === idx;
          const s = String(t).toLowerCase().trim();
          return optLabel.toLowerCase().trim() === s || optLabel.toLowerCase().includes(s) || s.includes(optLabel.toLowerCase());
        });
        if (isMatched) selectedIndices.push(idx);
      });

      // Constraint enforcement:
      // A. Exact constraint (e.g. Chọn chính xác 2 mục / Select exactly 2)
      if (constraints.exact && constraints.exact > 0) {
        const reqExact = Math.min(constraints.exact, checkboxes.length);
        while (selectedIndices.length < reqExact) {
          const nextIdx = checkboxes.findIndex((_, idx) => !selectedIndices.includes(idx));
          if (nextIdx !== -1) selectedIndices.push(nextIdx);
          else break;
        }
        if (selectedIndices.length > reqExact) {
          selectedIndices = selectedIndices.slice(0, reqExact);
        }
      } else {
        // B. Min constraint (e.g. Chọn ít nhất 2 mục / Select at least 2)
        if (constraints.min && constraints.min > 0) {
          const reqMin = Math.min(constraints.min, checkboxes.length);
          while (selectedIndices.length < reqMin) {
            const nextIdx = checkboxes.findIndex((_, idx) => !selectedIndices.includes(idx));
            if (nextIdx !== -1) selectedIndices.push(nextIdx);
            else break;
          }
        }
        // C. Max constraint (e.g. Chọn tối đa 3 mục / Select at most 3)
        if (constraints.max && constraints.max > 0) {
          if (selectedIndices.length > constraints.max) {
            selectedIndices = selectedIndices.slice(0, constraints.max);
          }
        }
      }

      // If required and still 0 selected, pick at least first option
      if (question.required && selectedIndices.length === 0 && checkboxes.length > 0) {
        selectedIndices.push(0);
      }

      // If no numerical constraint, and 0 selected but targets were provided, fallback to first option
      if (selectedIndices.length === 0 && checkboxes.length > 0 && targets.length > 0) {
        selectedIndices.push(0);
      }

      // Apply clicks to match selectedIndices
      checkboxes.forEach((cb, idx) => {
        const shouldCheck = selectedIndices.includes(idx);
        const isCurrentlyChecked = cb.getAttribute('aria-checked') === 'true';
        if (shouldCheck && !isCurrentlyChecked) {
          cb.click();
        } else if (!shouldCheck && isCurrentlyChecked) {
          cb.click(); // Uncheck
        }
      });

      return selectedIndices.length > 0;
    }

    // 4. Linear Scale
    if (type === 'scale') {
      const scaleRadios = controls.scaleRadios;
      if (!scaleRadios || scaleRadios.length === 0) return false;

      let targetVal = parseInt(value, 10);
      let targetRadio = scaleRadios.find(r => {
        const val = parseInt(r.getAttribute('data-value') || r.innerText.trim(), 10);
        return val === targetVal;
      });

      if (!targetRadio) {
        // Pick median or last
        targetRadio = scaleRadios[Math.floor(scaleRadios.length / 2)];
      }

      if (targetRadio) {
        targetRadio.click();
        targetRadio.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      }
    }

    // 5. Dropdown
    if (type === 'dropdown' && controls.listbox) {
      // In Google forms, click listbox to reveal options
      controls.listbox.click();
      await new Promise(r => setTimeout(r, 200));

      const optionEls = Array.from(document.querySelectorAll('div[role="option"]'));
      if (optionEls.length > 0) {
        const targetStr = String(value).toLowerCase().trim();
        let targetOpt = optionEls.find(el => el.innerText.toLowerCase().trim().includes(targetStr));
        if (!targetOpt && optionEls[1]) {
          targetOpt = optionEls[1]; // pick first valid non-placeholder option
        }
        if (targetOpt) {
          targetOpt.click();
          return true;
        }
      }
    }

    // 6. Multiple Choice Grid (grid_radio)
    // Ensures EVERY row in the grid question is selected so Google Forms never errors
    if (type === 'grid_radio' && controls.rows) {
      const rows = controls.rows;
      const columns = controls.columns || [];
      if (rows.length === 0) return false;

      let anyRowFilled = false;

      rows.forEach((rowObj, rIdx) => {
        const rowRadios = rowObj.radios;
        if (!rowRadios || rowRadios.length === 0) return;

        let targetColVal = null;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Object format: { "Row Label": "Column Label" } or { "0": "Column Label" }
          if (value[rowObj.label] !== undefined) {
            targetColVal = value[rowObj.label];
          } else {
            const matchingKey = Object.keys(value).find(k => 
              k.toLowerCase().trim() === rowObj.label.toLowerCase().trim() ||
              rowObj.label.toLowerCase().includes(k.toLowerCase().trim()) ||
              k.toLowerCase().includes(rowObj.label.toLowerCase().trim()) ||
              k === String(rIdx)
            );
            if (matchingKey !== undefined) {
              targetColVal = value[matchingKey];
            }
          }
        } else if (Array.isArray(value)) {
          // Array format: ["Col 1", "Col 2"]
          if (rIdx < value.length) {
            targetColVal = value[rIdx];
          }
        } else if (value !== undefined && value !== null) {
          // Scalar fallback
          targetColVal = value;
        }

        // Find matching radio in rowRadios
        let targetIndex = -1;

        if (typeof targetColVal === 'number') {
          targetIndex = targetColVal;
        } else if (targetColVal) {
          const targetStr = String(targetColVal).toLowerCase().trim();
          // Match against columns
          targetIndex = columns.findIndex(col => col.toLowerCase().trim() === targetStr);

          if (targetIndex === -1) {
            targetIndex = columns.findIndex(col => 
              col.toLowerCase().includes(targetStr) || targetStr.includes(col.toLowerCase())
            );
          }

          // Match against radio attributes
          if (targetIndex === -1) {
            targetIndex = rowRadios.findIndex(r => {
              const val = (r.getAttribute('data-value') || '').toLowerCase().trim();
              const aria = (r.getAttribute('aria-label') || '').toLowerCase().trim();
              return val === targetStr || aria.includes(targetStr) || targetStr.includes(val);
            });
          }
        }

        // Critical fallback: If no match or index out of range, select median option or first option
        // This GUARANTEES that every row has an answer, completely fixing "Câu hỏi này yêu cầu một câu trả lời mỗi dòng"
        if (targetIndex < 0 || targetIndex >= rowRadios.length) {
          targetIndex = Math.min(rowRadios.length - 1, Math.max(0, Math.floor(rowRadios.length / 2)));
        }

        const radioToClick = rowRadios[targetIndex];
        if (radioToClick) {
          radioToClick.click();
          radioToClick.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          anyRowFilled = true;
        }
      });

      return anyRowFilled;
    }

    // 7. Checkbox Grid (grid_checkbox)
    if (type === 'grid_checkbox' && controls.rows) {
      const rows = controls.rows;
      const columns = controls.columns || [];
      if (rows.length === 0) return false;

      let anyChecked = false;

      rows.forEach((rowObj, rIdx) => {
        const rowCheckboxes = rowObj.checkboxes;
        if (!rowCheckboxes || rowCheckboxes.length === 0) return;

        let targetCols = [];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          let rawVal = value[rowObj.label];
          if (rawVal === undefined) {
            const matchingKey = Object.keys(value).find(k => 
              k.toLowerCase().trim() === rowObj.label.toLowerCase().trim() ||
              rowObj.label.toLowerCase().includes(k.toLowerCase().trim()) ||
              k === String(rIdx)
            );
            if (matchingKey !== undefined) rawVal = value[matchingKey];
          }
          targetCols = Array.isArray(rawVal) ? rawVal : (rawVal !== undefined ? [rawVal] : []);
        } else if (Array.isArray(value)) {
          const rawVal = value[rIdx];
          targetCols = Array.isArray(rawVal) ? rawVal : (rawVal !== undefined ? [rawVal] : []);
        }

        let rowChecked = false;
        rowCheckboxes.forEach((cb, cIdx) => {
          const colName = (columns[cIdx] || '').toLowerCase().trim();
          const cbVal = (cb.getAttribute('data-value') || '').toLowerCase().trim();
          const cbAria = (cb.getAttribute('aria-label') || '').toLowerCase().trim();

          const shouldCheck = targetCols.some(t => {
            if (typeof t === 'number') return t === cIdx;
            const s = String(t).toLowerCase().trim();
            return colName === s || colName.includes(s) || cbVal === s || cbAria.includes(s);
          });

          const isCurrentlyChecked = cb.getAttribute('aria-checked') === 'true';
          if (shouldCheck && !isCurrentlyChecked) {
            cb.click();
            rowChecked = true;
          } else if (!shouldCheck && isCurrentlyChecked) {
            cb.click();
          }
        });

        // If question required and row has nothing checked, check first column
        if (question.required && !rowChecked && rowCheckboxes[0]) {
          rowCheckboxes[0].click();
          rowChecked = true;
        }

        if (rowChecked) anyChecked = true;
      });

      return anyChecked;
    }

    return false;
  }

  /**
   * Render in-page floating widget
   */
  const DEFAULT_MODELS_GROUPS = [
    {
      group: 'Google Gemini',
      provider: 'gemini',
      models: [
        { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Recommended)' },
        { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
      ]
    },
    {
      group: 'Groq',
      provider: 'groq',
      models: [
        { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Groq) (Recommended)' },
        { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Groq)' }
      ]
    },
    {
      group: 'Hugging Face',
      provider: 'huggingface',
      models: [
        { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B Instruct (Recommended)' },
        { id: 'deepseek-ai/DeepSeek-V4.1-Flash', name: 'DeepSeek V4.1 Flash' }
      ]
    },
    {
      group: 'OpenAI',
      provider: 'openai',
      models: [
        { id: 'gpt-6-astra', name: 'GPT-6 Astra' },
        { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
      ]
    },
    {
      group: 'Anthropic Claude',
      provider: 'anthropic',
      models: [
        { id: 'claude-fable-5-1', name: 'Claude Fable 5.1' },
        { id: 'claude-opus-5', name: 'Claude Opus 5' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' }
      ]
    },
    {
      group: 'OpenRouter',
      provider: 'openrouter',
      models: [
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' },
        { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
        { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' }
      ]
    }
  ];

  function populateFloatingModels(modelSelect, catalog, currentVal) {
    if (!modelSelect) return;
    modelSelect.innerHTML = '';

    const providerNames = {
      google: 'Google Gemini',
      groq: 'Groq',
      huggingface: 'Hugging Face',
      openai: 'OpenAI',
      anthropic: 'Anthropic Claude',
      openrouter: 'OpenRouter'
    };
    const providerKeys = {
      google: 'gemini',
      groq: 'groq',
      huggingface: 'huggingface',
      openai: 'openai',
      anthropic: 'anthropic',
      openrouter: 'openrouter'
    };

    if (catalog && catalog.providers) {
      Object.entries(catalog.providers).forEach(([catKey, models]) => {
        if (!models || models.length === 0) return;
        const groupEl = document.createElement('optgroup');
        groupEl.label = providerNames[catKey] || catKey;
        const pKey = providerKeys[catKey] || catKey;

        models.forEach(m => {
          const cleanId = (m.id || '').replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '');
          const opt = document.createElement('option');
          opt.value = `${pKey}:${cleanId}`;
          opt.textContent = m.name || cleanId;
          groupEl.appendChild(opt);
        });
        modelSelect.appendChild(groupEl);
      });
    } else {
      DEFAULT_MODELS_GROUPS.forEach(g => {
        const groupEl = document.createElement('optgroup');
        groupEl.label = g.group;
        g.models.forEach(m => {
          const cleanId = (m.id || '').replace(/^((gemini|groq|huggingface|openai|anthropic|openrouter|custom):+)+/i, '');
          const opt = document.createElement('option');
          opt.value = `${g.provider}:${cleanId}`;
          opt.textContent = m.name;
          groupEl.appendChild(opt);
        });
        modelSelect.appendChild(groupEl);
      });
    }

    // Add custom option if currently active
    if (currentVal && currentVal.startsWith('custom:')) {
      const customOpt = document.createElement('option');
      customOpt.value = currentVal;
      customOpt.textContent = 'Custom Model';
      modelSelect.appendChild(customOpt);
    }

    if (currentVal) {
      const exists = Array.from(modelSelect.options).some(o => o.value === currentVal);
      if (exists) {
        modelSelect.value = currentVal;
      } else {
        const tempOpt = document.createElement('option');
        tempOpt.value = currentVal;
        const parts = currentVal.split(':');
        tempOpt.textContent = parts[parts.length - 1] || currentVal;
        modelSelect.appendChild(tempOpt);
        modelSelect.value = currentVal;
      }
    } else if (modelSelect.options.length > 0) {
      modelSelect.value = 'gemini:gemini-3.8-flash';
    }
  }

  /**
   * Render in-page floating widget with Model and Persona selectors
   */
  function createFloatingWidget() {
    if (document.getElementById('formmind-floating-widget')) return;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', createFloatingWidget);
      return;
    }

    const widget = document.createElement('div');
    widget.id = 'formmind-floating-widget';

    widget.innerHTML = `
      <div class="fmind-pill" id="fmind-pill-container">
        <div class="fmind-logo-badge" id="fmind-badge" title="FormMind AI Assistant - Bấm để xem trợ giúp">
          <span class="fmind-sparkle-icon">✨</span>
          <span>FormMind</span>
        </div>
        <select class="fmind-select-model" id="fmind-quick-model" title="Chọn AI Model để điền">
          <option value="gemini:gemini-3.8-flash">Gemini 3.8 Flash</option>
        </select>
        <select class="fmind-select-persona" id="fmind-quick-persona" title="Chọn phong cách / Tone câu trả lời">
          <option value="positive">🌟 Positive</option>
          <option value="negative">👎 Negative</option>
          <option value="idk">🤷 IDK / Neutral</option>
          <option value="neutral">⚖️ Balanced</option>
          <option value="custom">🎨 Custom</option>
        </select>
        <button type="button" class="fmind-btn-fill" id="fmind-quick-fill-btn" title="Bấm để tự động điền form ngay lập tức">
          <span>⚡ Auto-Fill</span>
        </button>
      </div>
    `;

    document.body.appendChild(widget);

    // Bind event elements
    const fillBtn = widget.querySelector('#fmind-quick-fill-btn');
    const modelSelect = widget.querySelector('#fmind-quick-model');
    const personaSelect = widget.querySelector('#fmind-quick-persona');
    const badge = widget.querySelector('#fmind-badge');

    if (badge) {
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToast('✨ FormMind AI Form Filler sẵn sàng! Chọn Model và Persona rồi bấm Auto-Fill.', 'info');
      });
    }

    // Load saved preferences with safe helper
    getSyncStorage(['defaultPersona', 'selectedModel']).then((syncRes) => {
      chrome.storage.local.get(['syncedModelsDev'], (localRes) => {
        if (syncRes && syncRes.defaultPersona && personaSelect) {
          personaSelect.value = syncRes.defaultPersona;
        }
        const activeModel = (syncRes && syncRes.selectedModel) || 'gemini:gemini-3.8-flash';
        populateFloatingModels(modelSelect, localRes ? localRes.syncedModelsDev : null, activeModel);
      });
    });

    // Save persona on change
    personaSelect.addEventListener('change', () => {
      chrome.storage.sync.set({ defaultPersona: personaSelect.value });
    });

    // Save model on change and sync with Keys tab
    modelSelect.addEventListener('change', () => {
      const chosen = modelSelect.value;
      if (chosen.includes(':')) {
        const colonIdx = chosen.indexOf(':');
        const p = chosen.substring(0, colonIdx);
        let m = chosen.substring(colonIdx + 1);
        m = m.replace(/^((gemini|openai|anthropic|openrouter|custom):+)+/i, '').trim();
        chrome.storage.sync.set({
          selectedModel: `${p}:${m}`,
          [`${p}Model`]: m
        });
      } else {
        const cleanVal = chosen.replace(/^((gemini|openai|anthropic|openrouter|custom):+)+/i, '').trim();
        chrome.storage.sync.set({ selectedModel: cleanVal });
      }
    });

    // Real-time synchronization when user changes model or persona in extension popup
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        if (changes.defaultPersona && personaSelect) {
          personaSelect.value = changes.defaultPersona.newValue;
        }
        if (changes.selectedModel && modelSelect) {
          const newModel = changes.selectedModel.newValue;
          if (modelSelect.value !== newModel) {
            const hasOpt = Array.from(modelSelect.options).some(o => o.value === newModel);
            if (hasOpt) {
              modelSelect.value = newModel;
            } else {
              chrome.storage.local.get(['syncedModelsDev'], (res) => {
                populateFloatingModels(modelSelect, res ? res.syncedModelsDev : null, newModel);
              });
            }
          }
        }
      }
      if (areaName === 'local' && changes.syncedModelsDev && modelSelect) {
        populateFloatingModels(modelSelect, changes.syncedModelsDev.newValue, modelSelect.value);
      }
    });

    // Click handler with explicit event stopping and execution
    fillBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[FormMind] In-page floating Auto-Fill button clicked!');
      await handleFloatingAutoFill(fillBtn, personaSelect ? personaSelect.value : 'positive', modelSelect ? modelSelect.value : '');
    });
  }

  /**
   * Helper to check if an element is rendered and visible on screen
   */
  function isElementVisible(el) {
    if (!el) return false;
    // Check if element or any parent container is hidden
    if (el.closest && el.closest('[style*="display: none"], [style*="display:none"], [aria-hidden="true"], .hidden')) {
      return false;
    }
    const style = window.getComputedStyle(el);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0 || el.offsetParent !== null);
  }

  /**
   * Detect Next button in Google Forms (multi-page section navigation)
   */
  function findNextButton() {
    // 1. Google Forms specific jsname for Next button
    const gfNextBtn = document.querySelector('div[role="button"][jsname="OCpkoe"], button[jsname="OCpkoe"]');
    if (gfNextBtn && isElementVisible(gfNextBtn)) {
      return gfNextBtn;
    }

    // 2. Search buttons in the form or navigation container
    const candidateButtons = Array.from(document.querySelectorAll(
      'div[role="button"], button, input[type="button"], input[type="submit"], .btn-next'
    ));

    const nextRegex = /^(tiếp|tiếp theo|tiếp tục|next|siguiente|suivant|weiter|avanti|próximo|volgende|следующий|далее|次へ|下一步|继续)$/i;
    const excludeRegex = /(submit|gửi|quay lại|back|xóa|clear|hủy|cancel)/i;

    for (const btn of candidateButtons) {
      if (btn.closest('#formmind-floating-widget')) continue;
      const text = (btn.innerText || btn.value || btn.getAttribute('aria-label') || '').trim();
      if (nextRegex.test(text) && !excludeRegex.test(text)) {
        if (isElementVisible(btn)) return btn;
      }
    }

    // 3. Substring check for Next / Tiếp
    for (const btn of candidateButtons) {
      if (btn.closest('#formmind-floating-widget')) continue;
      const text = (btn.innerText || btn.value || btn.getAttribute('aria-label') || '').trim();
      if ((/tiếp/i.test(text) || /\bnext\b/i.test(text)) && !excludeRegex.test(text)) {
        if (isElementVisible(btn)) return btn;
      }
    }

    return null;
  }

  /**
   * Detect Submit button in Google Forms
   */
  function findSubmitButton() {
    const gfSubmitBtn = document.querySelector('div[role="button"][jsname="M2DA7b"], button[jsname="M2DA7b"]');
    if (gfSubmitBtn && isElementVisible(gfSubmitBtn)) {
      return gfSubmitBtn;
    }

    const candidateButtons = Array.from(document.querySelectorAll('div[role="button"], button, input[type="submit"], .btn-submit'));
    const submitRegex = /^(gửi|submit|enviar|envoyer|absenden|invia|submeter|verzenden|отправить|送信|提交)$/i;
    const nextRegex = /(tiếp|next|quay lại|back|clear|xóa)/i;

    for (const btn of candidateButtons) {
      if (btn.closest('#formmind-floating-widget')) continue;
      const text = (btn.innerText || btn.value || btn.getAttribute('aria-label') || '').trim();
      if (submitRegex.test(text) && !nextRegex.test(text)) {
        if (isElementVisible(btn)) return btn;
      }
    }

    return null;
  }

  /**
   * Wait for Google Forms page transition to complete after clicking Next
   */
  function waitForPageTransition(previousQuestionTitles, maxWaitMs = 7000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const prevSet = new Set(previousQuestionTitles.map(t => t.toLowerCase().trim()));

      const interval = setInterval(() => {
        // Check if required field validation blocked the navigation
        const errorAlert = document.querySelector('.RHiN0e, [role="alert"].o69ahc');
        if (errorAlert && isElementVisible(errorAlert)) {
          clearInterval(interval);
          resolve({
            success: false,
            error: errorAlert.innerText.trim() || 'Một số câu hỏi bắt buộc chưa được điền.'
          });
          return;
        }

        const currentQuestions = scanGoogleForm();
        const hasNewQuestions = currentQuestions.length > 0 && currentQuestions.some(q => !prevSet.has(q.title.toLowerCase().trim()));
        const submitBtn = findSubmitButton();
        const isOnlySubmit = submitBtn && !findNextButton();

        if (hasNewQuestions || (currentQuestions.length > 0 && isOnlySubmit)) {
          clearInterval(interval);
          setTimeout(() => {
            resolve({ success: true, questions: scanGoogleForm() });
          }, 400);
          return;
        }

        if (Date.now() - startTime >= maxWaitMs) {
          clearInterval(interval);
          resolve({ success: true, questions: scanGoogleForm(), timedOut: true });
        }
      }, 250);
    });
  }

  /**
   * Multi-Page Form Filling Engine:
   * Fills active page questions, automatically advances to next pages when Next button exists,
   * and repeats until the final Submit page is reached.
   */
  async function runMultiPageAutoFill({
    selectedPersona,
    chosenModel,
    chosenProvider,
    apiKey,
    customPersonaPrompt,
    autoAdvance = true,
    initialPageNumber = 1,
    initialTotalFilled = 0,
    onProgress
  }) {
    let pageNumber = initialPageNumber;
    let totalFilledAcrossAllPages = initialTotalFilled;
    const maxPages = 20;

    const updateSessionStatus = (statusMessage) => {
      try {
        if (chrome?.storage?.local) {
          chrome.storage.local.get(['formmind_active_session'], (res) => {
            if (res?.formmind_active_session?.inProgress) {
              chrome.storage.local.set({
                formmind_active_session: {
                  ...res.formmind_active_session,
                  statusMessage: statusMessage,
                  pageNumber: pageNumber,
                  totalFilled: totalFilledAcrossAllPages,
                  lastUpdated: Date.now()
                }
              });
            }
          });
        }
      } catch (e) {}
    };

    while (pageNumber <= maxPages) {
      // 1. Wait for questions to be fully hydrated in DOM
      await waitForQuestionsOnPage(8000);
      const questions = scanGoogleForm();

      if (questions.length === 0) {
        const submitBtn = findSubmitButton();
        if (submitBtn) {
          // Finished all questions and reached Submit
          chrome.storage.local.remove('formmind_active_session');
          submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const finishMsg = pageNumber > 1
            ? `✨ Đã hoàn tất tự động điền ${pageNumber - 1} trang (${totalFilledAcrossAllPages} câu)! Vui lòng kiểm tra lại trước khi bấm Gửi.`
            : `✨ Đã đến trang Gửi (Submit)! Vui lòng kiểm tra lại.`;
          showToast(finishMsg, 'success');
          if (onProgress) onProgress({ status: 'completed', page: pageNumber, totalFilled: totalFilledAcrossAllPages, message: finishMsg });
          return { success: true, count: totalFilledAcrossAllPages, totalPages: pageNumber };
        }

        chrome.storage.local.remove('formmind_active_session');
        const noQMsg = `Không tìm thấy câu hỏi nào ở trang ${pageNumber}.`;
        showToast(noQMsg, 'error');
        if (onProgress) onProgress({ status: 'error', error: noQMsg, message: noQMsg });
        return { success: false, error: noQMsg };
      }

      const progressMsg = `Đang tạo câu trả lời cho trang ${pageNumber} (${questions.length} câu)...`;
      updateSessionStatus(progressMsg);
      if (onProgress) {
        onProgress({
          status: 'thinking',
          page: pageNumber,
          questionCount: questions.length,
          totalFilled: totalFilledAcrossAllPages,
          message: progressMsg
        });
      }
      showToast(progressMsg, 'info');

      // 2. Request AI answers for this page with extracted constraints
      const simplifiedQuestions = questions.map(q => ({
        id: q.id,
        title: q.title,
        description: q.description || '',
        constraint: q.constraints?.summary || '',
        validationAlert: q.constraints?.validationAlert || '',
        minChoices: q.constraints?.min,
        maxChoices: q.constraints?.max,
        exactChoices: q.constraints?.exact,
        type: q.type,
        options: q.options || [],
        rows: q.rows || [],
        columns: q.columns || [],
        required: q.required
      }));

      let aiResult;
      try {
        aiResult = await new Promise((resolve, reject) => {
          const cleanModel = (chosenModel || '').replace(/^((gemini|openai|anthropic|openrouter|custom):+)+/i, '').replace(/^models\//i, '').trim();
          chrome.runtime.sendMessage(
            {
              action: 'GENERATE_FORM_ANSWERS',
              payload: {
                questions: simplifiedQuestions,
                persona: selectedPersona,
                customPersonaPrompt: customPersonaPrompt || '',
                model: cleanModel,
                provider: chosenProvider,
                apiKey: apiKey
              }
            },
            (res) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else if (!res || !res.success) {
                reject(new Error(res ? res.error : 'Không nhận được phản hồi từ AI'));
              } else {
                resolve(res.data);
              }
            }
          );
        });
      } catch (err) {
        chrome.storage.local.remove('formmind_active_session');
        let msg = err.message || String(err);
        if (msg.includes('message port closed') || msg.includes('Extension context invalidated')) {
          msg = 'Kết nối tới tiện ích bị gián đoạn (do vừa reload extension). Vui lòng nhấn F5 tải lại trang Google Form.';
        }
        const errMsg = `Lỗi AI ở trang ${pageNumber}: ${msg}`;
        showToast(errMsg, 'error');
        if (onProgress) onProgress({ status: 'error', error: msg, message: errMsg });
        return { success: false, error: msg };
      }

      // 3. Apply answers to DOM with constraint guarantees
      const fillResult = await applyAnswersToForm(aiResult);
      totalFilledAcrossAllPages += fillResult.count;

      const filledMsg = `Trang ${pageNumber} đã điền (${fillResult.count}/${questions.length} câu)!`;
      updateSessionStatus(filledMsg);
      if (onProgress) {
        onProgress({
          status: 'filled',
          page: pageNumber,
          filledCount: fillResult.count,
          totalFilled: totalFilledAcrossAllPages,
          message: filledMsg
        });
      }

      // 4. Check for Next button or Submit button
      const nextBtn = findNextButton();
      const submitBtn = findSubmitButton();

      // If no Next button exists or user disabled autoAdvance, stop here
      if (!nextBtn || !autoAdvance) {
        chrome.storage.local.remove('formmind_active_session');
        if (submitBtn) {
          submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const finishMsg = pageNumber > 1
          ? `✨ Đã tự động điền xong ${pageNumber} trang (${totalFilledAcrossAllPages} câu)! Vui lòng kiểm tra lại trước khi bấm Gửi.`
          : `✨ Đã tự động điền ${totalFilledAcrossAllPages}/${questions.length} câu hỏi! Vui lòng kiểm tra lại trước khi bấm Gửi.`;
        
        showToast(finishMsg, 'success');
        if (onProgress) onProgress({ status: 'completed', page: pageNumber, totalFilled: totalFilledAcrossAllPages, message: finishMsg });
        return { success: true, count: totalFilledAcrossAllPages, totalPages: pageNumber };
      }

      // 5. Auto-advance to Next Page!
      const previousTitles = questions.map(q => q.title);
      const navMsg = `📄 Trang ${pageNumber} hoàn tất! Tự động chuyển sang trang ${pageNumber + 1}...`;
      updateSessionStatus(navMsg);
      showToast(navMsg, 'info');
      if (onProgress) {
        onProgress({
          status: 'navigating',
          page: pageNumber,
          nextPage: pageNumber + 1,
          totalFilled: totalFilledAcrossAllPages,
          message: navMsg
        });
      }

      // Persist active session before advancing so if Google Forms reloads/POSTs, Page 2 automatically continues!
      await new Promise(r => {
        chrome.storage.local.set({
          formmind_active_session: {
            inProgress: true,
            persona: selectedPersona,
            model: chosenModel,
            provider: chosenProvider,
            apiKey: apiKey,
            customPersonaPrompt: customPersonaPrompt || '',
            autoAdvance: autoAdvance,
            pageNumber: pageNumber + 1,
            totalFilled: totalFilledAcrossAllPages,
            statusMessage: navMsg,
            startedAt: Date.now(),
            lastUpdated: Date.now()
          }
        }, () => r());
      });

      nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 600)); // Short realistic pause before clicking
      nextBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      nextBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      nextBtn.click();

      // Wait for page transition (for SPA forms that do in-page transition)
      const transition = await waitForPageTransition(previousTitles);
      if (!transition.success) {
        chrome.storage.local.remove('formmind_active_session');
        const errMsg = transition.error || 'Chuyển trang bị chặn do câu hỏi bắt buộc.';
        showToast(`⚠️ ${errMsg}`, 'error');
        if (onProgress) onProgress({ status: 'error', error: errMsg, message: errMsg });
        return { success: false, error: errMsg };
      }

      pageNumber++;
    }

    chrome.storage.local.remove('formmind_active_session');
    return { success: true, count: totalFilledAcrossAllPages, totalPages: pageNumber };
  }

  /**
   * Safe helper to read from chrome.storage.sync with Promise
   */
  function getSyncStorage(keys) {
    return new Promise((resolve) => {
      try {
        if (!chrome?.storage?.sync) {
          resolve({});
          return;
        }
        chrome.storage.sync.get(keys, (res) => {
          if (chrome.runtime.lastError) {
            console.warn('[FormMind] storage error:', chrome.runtime.lastError);
            resolve({});
          } else {
            resolve(res || {});
          }
        });
      } catch (err) {
        console.warn('[FormMind] storage exception:', err);
        resolve({});
      }
    });
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
   * Floating button click handler
   */
  async function handleFloatingAutoFill(btn, selectedPersona, quickModelVal) {
    if (!btn || btn.classList.contains('loading')) return;

    const originalText = btn.innerHTML;
    // 1. Give user INSTANT visual feedback right on the button
    btn.classList.add('loading');
    btn.innerHTML = '<span>⏳ Đang quét form...</span>';

    try {
      // 2. Read saved settings from storage safely
      const settings = await getSyncStorage([
        'provider',
        'geminiKey',
        'groqKey',
        'huggingfaceKey',
        'openaiKey',
        'anthropicKey',
        'openrouterKey',
        'selectedModel',
        'customPersonaPrompt',
        'autoAdvancePages',
        'customProvider',
        'customModelName'
      ]);

      let chosenModelVal = quickModelVal || settings.selectedModel || 'gemini:gemini-3.8-flash';
      let chosenProvider = 'gemini';
      let chosenModel = 'gemini-3.8-flash';

      if (chosenModelVal.startsWith('custom:')) {
        chosenProvider = settings.customProvider || 'gemini';
        let rawCustom = settings.customModelName || (chosenProvider === 'gemini' ? 'gemini-3.8-flash' : 'gpt-4o-mini');
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

      const apiKeyMap = {
        gemini: settings.geminiKey || '',
        groq: settings.groqKey || '',
        huggingface: settings.huggingfaceKey || '',
        openai: settings.openaiKey || '',
        anthropic: settings.anthropicKey || '',
        openrouter: settings.openrouterKey || ''
      };

      let apiKey = apiKeyMap[chosenProvider];

      if (!apiKey || !apiKey.trim()) {
        // Automatic fallback: check if user configured ANY other provider key
        const availableProvider = Object.keys(apiKeyMap).find(p => apiKeyMap[p] && apiKeyMap[p].trim());
        if (availableProvider) {
          chosenProvider = availableProvider;
          apiKey = apiKeyMap[availableProvider].trim();
          chosenModel = getDefaultModelForProvider(chosenProvider);
          showToast(`💡 Đang dùng ${chosenProvider.toUpperCase()} (${chosenModel}) vì model này đã có API key.`, 'info');
        } else {
          btn.classList.remove('loading');
          btn.innerHTML = originalText;
          showToast('⚠️ Vui lòng mở extension FormMind (ở thanh công cụ) để lưu API key trước!', 'error');
          return;
        }
      }

      btn.innerHTML = '<span>🤖 AI đang suy nghĩ...</span>';

      // 3. Start Multi-page Auto-fill engine
      await runMultiPageAutoFill({
        selectedPersona: selectedPersona || 'positive',
        chosenModel,
        chosenProvider,
        apiKey,
        customPersonaPrompt: settings.customPersonaPrompt || '',
        autoAdvance: settings.autoAdvancePages !== false,
        onProgress: (p) => {
          if (p.status === 'thinking') {
            btn.innerHTML = `<span>⏳ Trang ${p.page}...</span>`;
          } else if (p.status === 'navigating') {
            btn.innerHTML = `<span>➡️ Sang trang ${p.nextPage}...</span>`;
          } else if (p.status === 'filled') {
            btn.innerHTML = `<span>✅ Đã điền ${p.filledCount} câu</span>`;
          }
        }
      });
    } catch (err) {
      console.error('[FormMind] Error in handleFloatingAutoFill:', err);
      showToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      btn.classList.remove('loading');
      btn.innerHTML = originalText;
    }
  }

  /**
   * Display floating toast notifications
   */
  function showToast(message, type = 'info') {
    const existing = document.querySelector('.fmind-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `fmind-toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : '💡';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 400);
      }
    }, 4500);
  }

})();
