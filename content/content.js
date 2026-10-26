// FormMind - Content Script for Google Forms

(function () {
  console.log('[FormMind] Initializing Google Form content script...');

  // State & Flags
  let cachedQuestions = [];
  let cachedTextRules = [];
  let cachedTextGlobalDefault = null;
  let isAborted = false;
  let isDebugModeEnabled = false;
  let bugLogs = [];
  const MAX_BUG_LOGS = 100;
  const activeTimeouts = new Set();

  function safeSetTimeout(fn, ms) {
    let id;
    id = setTimeout(() => {
      activeTimeouts.delete(id);
      if (!isAborted) {
        fn();
      }
    }, ms);
    activeTimeouts.add(id);
    return id;
  }

  function clearAllRegisteredTimeouts() {
    for (const id of activeTimeouts) {
      clearTimeout(id);
    }
    activeTimeouts.clear();
  }

  /**
   * Captures immediate DOM snapshot for debugging & bug reporting
   */
  function captureDomState() {
    try {
      const questions = typeof scanGoogleForm === 'function' ? scanGoogleForm() : [];
      const nextBtn = typeof findNextButton === 'function' ? findNextButton() : null;
      const submitBtn = typeof findSubmitButton === 'function' ? findSubmitButton() : null;
      return {
        questionsFound: questions.length,
        hasNextButton: !!nextBtn,
        hasSubmitButton: !!submitBtn,
        isFormCompleted: typeof isFormCompleted === 'function' ? isFormCompleted() : false,
        pageTitle: document.title || '',
        url: window.location.href || ''
      };
    } catch (e) {
      return {
        questionsFound: 0,
        hasNextButton: false,
        hasSubmitButton: false,
        isFormCompleted: false,
        pageTitle: document.title || '',
        url: window.location.href || '',
        captureError: e.message
      };
    }
  }

  /**
   * Records a structured bug entry when Debug Mode is ON
   */
  function recordBugEntry({ step, errorMessage, errorStack, domState, extra } = {}) {
    try {
      const entry = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        step: step || 'unspecified_step',
        errorMessage: typeof errorMessage === 'string' ? errorMessage : (errorMessage?.message || String(errorMessage)),
        errorStack: errorStack || (new Error().stack || ''),
        domState: domState || captureDomState()
      };
      if (extra) {
        entry.extra = extra;
      }

      console.warn(`[FormMind Debug][${entry.step}]`, entry.errorMessage, entry);

      bugLogs.push(entry);
      if (bugLogs.length > MAX_BUG_LOGS) {
        bugLogs.shift();
      }

      try {
        if (chrome?.storage?.local) {
          chrome.storage.local.set({ formmind_bug_logs: bugLogs });
        }
      } catch (e) {}

      updateBugReportButton();
    } catch (logErr) {
      console.warn('[FormMind] Error in recordBugEntry:', logErr);
    }
  }

  // Global error listeners for Debug Mode
  window.addEventListener('error', (event) => {
    if (!isDebugModeEnabled) return;
    recordBugEntry({
      step: 'window.onerror',
      errorMessage: event.message || String(event),
      errorStack: event.error?.stack || '',
      extra: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!isDebugModeEnabled) return;
    const reason = event.reason;
    recordBugEntry({
      step: 'window.unhandledrejection',
      errorMessage: (reason && reason.message) || String(reason),
      errorStack: (reason && reason.stack) || ''
    });
  });

  /**
   * Updates UI appearance and count badge of Debug switch and Bug Report button
   */
  function updateBugReportButton() {
    const btn = document.getElementById('fmind-btn-bug-report');
    const countEl = document.getElementById('fmind-bug-count');
    const debugLabel = document.getElementById('fmind-debug-label');
    const debugToggle = document.getElementById('fmind-debug-mode-toggle');

    if (debugLabel && debugToggle) {
      debugToggle.checked = !!isDebugModeEnabled;
      if (isDebugModeEnabled) {
        debugLabel.classList.add('fmind-debug-on');
      } else {
        debugLabel.classList.remove('fmind-debug-on');
      }
    }

    if (countEl) {
      countEl.textContent = String(bugLogs.length);
    }

    if (btn) {
      btn.title = `Bấm để tải xuống Bug Report (${bugLogs.length} lỗi/nhật ký đã ghi nhận)`;
      if (bugLogs.length > 0) {
        btn.classList.add('has-logs');
      } else {
        btn.classList.remove('has-logs');
      }
      if (isDebugModeEnabled) {
        btn.classList.add('debug-active');
      } else {
        btn.classList.remove('debug-active');
      }
    }

    const clearBtn = document.getElementById('fmind-btn-clear-logs');
    if (clearBtn) {
      clearBtn.style.display = bugLogs.length > 0 ? 'inline-flex' : 'none';
    }
  }

  /**
   * Downloads structured JSON report containing recorded logs, DOM snapshot, and system state
   */
  async function downloadBugReport() {
    try {
      const localData = await new Promise(r => {
        if (chrome?.storage?.local) {
          chrome.storage.local.get(null, r);
        } else {
          r({});
        }
      });
      const currentDom = captureDomState();

      const reportData = {
        reportGeneratedAt: new Date().toISOString(),
        environment: {
          url: window.location.href,
          title: document.title,
          userAgent: navigator.userAgent,
          screenResolution: `${window.innerWidth}x${window.innerHeight}`,
          platform: navigator.platform
        },
        automationStatus: {
          isDebugModeEnabled,
          isWorkflowRunning,
          isAborted,
          retryCount: localData?.retryCount || localData?.formmind_retry_count || 0,
          formmind_auto_next: localData?.formmind_auto_next
        },
        domSnapshot: currentDom,
        storageConfigSnapshot: {
          selectedModel: localData?.selectedModel,
          defaultPersona: localData?.defaultPersona,
          formmind_form_url: localData?.formmind_form_url,
          cooldownConfig: localData?.formmind_cooldown_config,
          profileConfig: localData?.formmind_profile_config
        },
        totalLogsRecorded: bugLogs.length,
        bugEntries: bugLogs
      };

      const jsonStr = JSON.stringify(reportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      const timeStr = new Date().toISOString().replace(/[:.]/g, '-');
      downloadLink.href = blobUrl;
      downloadLink.download = `formmind_bug_report_${timeStr}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      setTimeout(() => {
        downloadLink.remove();
        URL.revokeObjectURL(blobUrl);
      }, 1000);

      showToast(`📥 Đã tải file Bug Report (${bugLogs.length} bản ghi)!`, 'success');
    } catch (err) {
      console.error('[FormMind] Error downloading bug report:', err);
      showToast(`⚠️ Lỗi khi xuất báo cáo: ${err.message}`, 'error');
    }
  }

  /**
   * Temporarily updates Floating Bar main button status text
   */
  function updateFloatingStatus(statusText) {
    const fillBtn = document.getElementById('fmind-quick-fill-btn');
    if (fillBtn) {
      fillBtn.classList.remove('loading', 'fmind-btn-running');
      fillBtn.innerHTML = `<span>${statusText}</span>`;
      safeSetTimeout(() => {
        if (!isWorkflowRunning) {
          fillBtn.innerHTML = '<span>⚡ Auto-Fill</span>';
        }
      }, 3500);
    }
  }

  /**
   * Emergency Terminate Automation:
   * 1. Hủy ngay lập tức các timer (Cooldown, retry countdown, delays, reload timers).
   * 2. Đặt cờ toàn cục isAborted = true, lưu { isRunning: false, retryCount: 0 } vào chrome.storage.local.
   * 3. Ngắt tiến trình điền form và ngắt kết nối MutationObserver.
   * 4. Cập nhật UI: ẩn đếm ngược Cooldown / Retry, chuyển trạng thái Floating Bar về "⚪ Đã dừng tiến trình".
   */
  async function terminateAutomation() {
    console.warn('[FormMind] 🛑 EMERGENCY TERMINATE TRIGGERED BY USER.');
    isAborted = true;
    isWorkflowRunning = false;

    // 1. Hủy toàn bộ intervals
    if (cooldownInterval) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;
    }
    if (retryCountdownInterval) {
      clearInterval(retryCountdownInterval);
      retryCountdownInterval = null;
    }
    if (activeSubmissionInterval) {
      clearInterval(activeSubmissionInterval);
      activeSubmissionInterval = null;
    }

    // 2. Ngắt kết nối MutationObserver
    if (activeSubmissionObserver) {
      activeSubmissionObserver.disconnect();
      activeSubmissionObserver = null;
    }

    // 3. Xóa các registered timeouts
    clearAllRegisteredTimeouts();

    // 4. Báo background hủy cooldown (tuyệt đối không gửi SKIP_COOLDOWN vì SKIP sẽ kích hoạt reload tab ngay)
    sendSafeRuntimeMessage({ action: 'CANCEL_COOLDOWN' });

    // 5. Cập nhật storage
    try {
      if (chrome?.storage?.local) {
        await new Promise(r => {
          chrome.storage.local.set({
            isRunning: false,
            retryCount: 0,
            formmind_retry_count: 0
          }, r);
        });
        await new Promise(r => {
          chrome.storage.local.remove([
            'formmind_active_session',
            'formmind_auto_start_next_run',
            'formmind_cooldown_state'
          ], r);
        });
      }
    } catch (e) {
      console.warn('[FormMind] Error updating storage in terminateAutomation:', e);
    }

    // 6. Cập nhật UI
    removeCooldownBar();
    removeRetryBar();
    updateFloatingButtonState(false);
    updateFloatingStatus('⚪ Đã dừng tiến trình');

    showToast('🛑 Đã dừng khẩn cấp toàn bộ tiến trình tự động!', 'error');
    console.log('[FormMind] terminateAutomation completed.');
  }

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

    if (chrome?.storage?.local) {
      chrome.storage.local.get(['formmind_debug_mode', 'formmind_bug_logs'], (res) => {
        isDebugModeEnabled = !!res?.formmind_debug_mode;
        bugLogs = Array.isArray(res?.formmind_bug_logs) ? res.formmind_bug_logs : [];
        updateBugReportButton();
      });
    }

    createFloatingWidget();
    setupMessageListeners();
    checkAndResumeActiveSession();
    checkAndHandleCooldownOrAutoStart();
  }

  // --- AUTOMATION & SCHEDULE HELPERS ---

  /**
   * Helper to parse time strings like 10, 1.5 with units 's', 'm', 'h' to milliseconds
   */
  function parseTimeToMs(value, unit = 'm') {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return 0;
    switch (unit) {
      case 's': return Math.round(num * 1000);
      case 'm': return Math.round(num * 60 * 1000);
      case 'h': return Math.round(num * 3600 * 1000);
      default: return Math.round(num * 60 * 1000);
    }
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
   * Check if current page is the submission confirmation page
   * ĐIỀU KIỆN DUY NHẤT để kích hoạt Cooldown:
   * 1. URL chuyển hẳn sang trang kết quả: window.location.href.includes('/formResponse')
   * 2. Xuất hiện chính xác khối tiêu đề thông báo nộp thành công của Google Forms:
   *    const endMessage = Array.from(document.querySelectorAll('div, span')).some(el => 
   *      el.textContent.trim() === 'Câu trả lời của bạn đã được ghi lại.' ||
   *      el.textContent.trim() === 'Your response has been recorded.' ||
   *      el.textContent.trim() === 'Câu trả lời của bạn đã được ghi lại' ||
   *      el.textContent.trim() === 'Your response has been recorded'
   *    );
   */
  /**
   * Check if current page is the submission confirmation page
   * ĐIỀU KIỆN DUY NHẤT để xác nhận hoàn tất form và kích hoạt Cooldown:
   * - Điều kiện URL: window.location.href.includes('/formResponse')
   * - Điều kiện DOM: Tìm thấy phần tử xác nhận nộp thành công đặc thù của Google Forms:
   *   + Class: .freebirdFormviewerViewResponseConfirmationMessage hoặc .vHW8Ge
   *   + Hoặc tiêu đề (div[role="heading"], .M7eMe) có nội dung khớp chính xác:
   *     "Câu trả lời của bạn đã được ghi lại." hoặc "Your response has been recorded."
   * 
   * NHỮNG ĐIỀU CẤM TUYỆT ĐỐI (NEGATIVE CONSTRAINTS):
   * 1. CẤM kiểm tra questions.length === 0 để kết luận form đã xong.
   * 2. CẤM dùng innerText.includes("câu trả lời") hay regex lỏng lẻo.
   * 3. CẤM kích hoạt Cooldown hay kết luận hoàn thành khi trên màn hình vẫn còn nút "Tiếp" (Next) hoặc nút "Gửi" (Submit).
   */
  function isFormCompleted() {
    // GATEKEEPER 1: Nếu trên màn hình còn nút "Tiếp" (Next) hoặc nút "Gửi" (Submit) -> CẤM kết luận hoàn thành!
    const nextBtn = typeof findNextButton === 'function' ? findNextButton() : (typeof findFormButton === 'function' ? (findFormButton('Tiếp') || findFormButton('Next')) : null);
    const submitBtn = typeof findSubmitButton === 'function' ? findSubmitButton() : (typeof findFormButton === 'function' ? (findFormButton('Gửi') || findFormButton('Submit')) : null);
    if (nextBtn || submitBtn) {
      return false;
    }

    // GATEKEEPER 2: Nếu còn câu hỏi trên trang (div[role="listitem"]) -> CẤM kết luận hoàn thành!
    const rawListItems = document.querySelectorAll('div[role="listitem"]');
    if (rawListItems && rawListItems.length > 0) {
      const actualQuestions = Array.from(rawListItems).filter(el => {
        if (typeof el.getAttribute === 'function') {
          return el.getAttribute('role') === 'listitem';
        }
        return el.tagName === 'DIV' && el.getAttribute && el.getAttribute('role') === 'listitem';
      });
      if (actualQuestions.length > 0) {
        return false;
      }
    }

    // GATEKEEPER 3: Nếu còn nút "Quay lại" (Back) -> Đang ở các trang giữa (trang 2, 3... có đuôi /formResponse), CẤM kết luận hoàn thành!
    const backBtn = typeof isBackButton === 'function'
      ? Array.from(document.querySelectorAll('div[role="button"]')).find(b => isBackButton(b))
      : document.querySelector('.kW9Bec, .xK37zc');
    if (backBtn) {
      return false;
    }

    // GATEKEEPER 4: Nếu còn nút "Xóa hết câu trả lời" -> CẤM kết luận hoàn thành!
    const allButtons = Array.from(document.querySelectorAll('div[role="button"], button'));
    const clearBtn = allButtons.find(b => {
      const t = (b.textContent || b.innerText || '').trim().toLowerCase();
      return t === 'xóa hết câu trả lời' || t === 'clear form';
    });
    if (clearBtn) {
      return false;
    }

    // ĐIỀU KIỆN 1 (URL đặc thù): /alreadyResponsive (trang thông báo đã gửi phản hồi)
    const href = window.location.href || '';
    if (href.includes('/alreadyResponsive')) {
      return true;
    }

    // ĐIỀU KIỆN 2 (DOM):
    // 2.1. Class đặc thù xác nhận nộp thành công của Google Forms
    const confirmationEl = document.querySelector('.freebirdFormviewerViewResponseConfirmationMessage, .vHW8Ge');
    if (confirmationEl) {
      return true;
    }

    // 2.2. Tiêu đề / Nội dung xác nhận chính xác của Google Forms
    const headings = document.querySelectorAll('div[role="heading"], .M7eMe, div, span');
    for (const el of headings) {
      if (el.children && el.children.length > 2) continue;
      const text = (el.textContent || '').trim();
      if (
        text === 'Câu trả lời của bạn đã được ghi lại.' ||
        text === 'Your response has been recorded.' ||
        text === 'Câu trả lời của bạn đã được ghi lại' ||
        text === 'Your response has been recorded' ||
        text === 'Câu trả lời của bạn đã được ghi nhận.' ||
        text === 'Câu trả lời của bạn đã được ghi nhận'
      ) {
        return true;
      }
    }

    // 2.3. Link gửi câu trả lời khác đặc thù trên màn hình hoàn tất
    const submitAnotherLink = document.querySelector('a[href*="/viewform"], .c2gzEf a, .freebirdFormviewerViewResponseLinksContainer a');
    if (submitAnotherLink) {
      const linkText = (submitAnotherLink.textContent || submitAnotherLink.innerText || '').toLowerCase();
      if (linkText.includes('câu trả lời khác') || linkText.includes('another response') || linkText.includes('chỉnh sửa') || linkText.includes('edit your response')) {
        return true;
      }
    }

    // 2.4. Khi ở URL /formResponse: CHỈ coi là hoàn thành khi thẻ form đã biến mất và không có nút quay lại
    if (href.includes('/formResponse')) {
      const activeForm = document.querySelector('form');
      if (!activeForm && !backBtn) {
        return true;
      }
    }

    // Nếu chưa thỏa mãn các điều kiện trên, hệ thống bắt buộc phải xác định là form ĐANG CHẠY
    return false;
  }

  // --- SUBMISSION CONFIRMATION WATCHER ---
  let activeSubmissionObserver = null;
  let activeSubmissionInterval = null;

  function watchForSubmissionConfirmationAndStartCooldown(cdConfig) {
    if (!cdConfig || !cdConfig.enabled) return;

    // GATEKEEPER: If submit or next button still exists, NEVER trigger cooldown immediately!
    const hasNext = typeof findNextButton === 'function' ? findNextButton() : (typeof findFormButton === 'function' ? (findFormButton('Tiếp') || findFormButton('Next')) : null);
    const hasSubmit = typeof findSubmitButton === 'function' ? findSubmitButton() : (typeof findFormButton === 'function' ? (findFormButton('Gửi') || findFormButton('Submit')) : null);
    if (hasNext || hasSubmit) {
      // Must wait for form to be submitted and confirmed
    } else if (isFormCompleted()) {
      chrome.storage.local.set({ retryCount: 0, formmind_retry_count: 0 });
      startCooldown(cdConfig);
      return;
    }

    if (activeSubmissionObserver) {
      activeSubmissionObserver.disconnect();
      activeSubmissionObserver = null;
    }
    if (activeSubmissionInterval) {
      clearInterval(activeSubmissionInterval);
      activeSubmissionInterval = null;
    }

    const checkAndTrigger = () => {
      // CRITICAL GATEKEEPER: Absolutely CANNOT start cooldown as long as submit or next button exists!
      const nextBtn = typeof findNextButton === 'function' ? findNextButton() : (typeof findFormButton === 'function' ? (findFormButton('Tiếp') || findFormButton('Next')) : null);
      const submitBtn = typeof findSubmitButton === 'function' ? findSubmitButton() : (typeof findFormButton === 'function' ? (findFormButton('Gửi') || findFormButton('Submit')) : null);
      if (nextBtn || submitBtn) {
        return false;
      }

      if (isFormCompleted()) {
        if (activeSubmissionObserver) {
          activeSubmissionObserver.disconnect();
          activeSubmissionObserver = null;
        }
        if (activeSubmissionInterval) {
          clearInterval(activeSubmissionInterval);
          activeSubmissionInterval = null;
        }
        console.log('[FormMind] Form submission confirmed! Resetting retry count and starting Cooldown...');
        chrome.storage.local.set({ retryCount: 0, formmind_retry_count: 0 });
        startCooldown(cdConfig);
        return true;
      }
      return false;
    };

    activeSubmissionObserver = new MutationObserver(() => {
      checkAndTrigger();
    });

    if (document.body) {
      activeSubmissionObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    const startTime = Date.now();
    activeSubmissionInterval = setInterval(() => {
      if (checkAndTrigger()) return;
      if (Date.now() - startTime > 120000) {
        if (activeSubmissionObserver) {
          activeSubmissionObserver.disconnect();
          activeSubmissionObserver = null;
        }
        clearInterval(activeSubmissionInterval);
        activeSubmissionInterval = null;
      }
    }, 350);
  }

  /**
   * Weighted random selection (Cumulative Distribution Function)
   * options: Array of { label: string, weight: number }
   */
  function weightedRandom(options) {
    if (!options || !Array.isArray(options) || options.length === 0) return null;
    const valid = options.filter(o => typeof o.weight === 'number' && o.weight > 0);
    if (valid.length === 0) {
      return options[Math.floor(Math.random() * options.length)];
    }
    const totalWeight = valid.reduce((sum, o) => sum + o.weight, 0);
    let random = Math.random() * totalWeight;
    for (const opt of valid) {
      if (random < opt.weight) {
        return opt;
      }
      random -= opt.weight;
    }
    return valid[valid.length - 1];
  }

  /**
   * Helper to normalize question titles and keywords for resilient matching
   */
  function cleanTitle(s) {
    return (s || '')
      .toLowerCase()
      .replace(/[\*\:\?\.\,\!\-\_\/\(\)\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Evaluate if a question matches any rule in weightedRules, and return the chosen answer value
   */
  function evaluateWeightedRule(question, questionIndex, rules) {
    if (!rules || !Array.isArray(rules) || rules.length === 0) return null;
    const rawTitle = (question.title || '').trim();
    const qTitleClean = cleanTitle(rawTitle);
    const qTitle = rawTitle.toLowerCase();
    const qIdx = questionIndex + 1; // 1-based index

    // Ưu tiên 1: So khớp theo Title trước (để đảm bảo chính xác xuyên suốt đa trang)
    let matchedRule = rules.find(rule => {
      if (rule.matchType === 'title' || (!rule.matchType && rule.matchValue && isNaN(Number(rule.matchValue)))) {
        const kwRaw = (rule.matchValue || rule.titleHint || '').trim();
        if (!kwRaw) return false;
        const kwClean = cleanTitle(kwRaw);
        if (kwClean && (qTitleClean === kwClean || qTitleClean.includes(kwClean) || kwClean.includes(qTitleClean))) {
          return true;
        }
        const kw = kwRaw.toLowerCase();
        try {
          const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          if (re.test(rawTitle)) return true;
        } catch (e) {}
        return qTitle.includes(kw);
      }
      return false;
    });

    // Ưu tiên 2: Fallback so khớp theo Index nếu không có rule title nào khớp
    if (!matchedRule) {
      matchedRule = rules.find(rule => {
        if (rule.matchType === 'index') {
          const ruleIdx = parseInt(rule.matchValue, 10);
          return !isNaN(ruleIdx) && ruleIdx === qIdx;
        }
        return false;
      });
    }

    if (!matchedRule || !matchedRule.options || matchedRule.options.length === 0) {
      return null;
    }

    const isCheckboxQuestion = question.type === 'checkbox' || matchedRule.type === 'checkbox';

    // Xử lý câu hỏi Hộp kiểm (Checkbox): Xác suất độc lập từng ô (> 100%), tuân thủ min/max/exact
    if (isCheckboxQuestion) {
      const selectedLabels = [];
      const availableOptions = question.options || [];

      const resolveLabel = (lbl) => {
        const targetLabel = (lbl || '').toLowerCase().trim();
        if (availableOptions.length > 0) {
          const exact = availableOptions.find(o => o.toLowerCase().trim() === targetLabel);
          if (exact) return exact;
          const sub = availableOptions.find(o => 
            o.toLowerCase().trim().includes(targetLabel) || targetLabel.includes(o.toLowerCase().trim())
          );
          if (sub) return sub;
          const letterMatch = (lbl || '').match(/^[A-Z]$/i);
          if (letterMatch) {
            const charIdx = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
            if (charIdx >= 0 && charIdx < availableOptions.length) {
              return availableOptions[charIdx];
            }
          }
          const numIdx = parseInt(lbl, 10);
          if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= availableOptions.length) {
            return availableOptions[numIdx - 1];
          }
        }
        return lbl;
      };

      // 1. Kiểm tra xác suất độc lập cho từng lựa chọn: Math.random() * 100 < opt.weight
      matchedRule.options.forEach(opt => {
        const weight = parseFloat(opt.weight) || 0;
        if (weight > 0 && Math.random() * 100 < weight) {
          const matchedLabel = resolveLabel(opt.label);
          if (matchedLabel && !selectedLabels.includes(matchedLabel)) {
            selectedLabels.push(matchedLabel);
          }
        }
      });

      // 2. Ràng buộc min / max / exact của câu hỏi
      const constraints = question.constraints || {};
      const allOptLabels = availableOptions.length > 0 
        ? availableOptions 
        : matchedRule.options.map(o => o.label);

      // A. Ràng buộc chính xác (exact)
      if (constraints.exact && constraints.exact > 0) {
        const targetExact = Math.min(constraints.exact, allOptLabels.length);
        while (selectedLabels.length < targetExact) {
          const unselected = matchedRule.options
            .map(o => resolveLabel(o.label))
            .filter(lbl => lbl && !selectedLabels.includes(lbl));
          if (unselected.length > 0) {
            selectedLabels.push(unselected[0]);
          } else {
            const nextOpt = allOptLabels.find(l => !selectedLabels.includes(l));
            if (nextOpt) selectedLabels.push(nextOpt);
            else break;
          }
        }
        if (selectedLabels.length > targetExact) {
          selectedLabels.length = targetExact;
        }
      } else {
        // B. Ràng buộc tối thiểu (min)
        if (constraints.min && constraints.min > 0) {
          const targetMin = Math.min(constraints.min, allOptLabels.length);
          while (selectedLabels.length < targetMin) {
            const unselected = matchedRule.options
              .map(o => resolveLabel(o.label))
              .filter(lbl => lbl && !selectedLabels.includes(lbl));
            if (unselected.length > 0) {
              selectedLabels.push(unselected[0]);
            } else {
              const nextOpt = allOptLabels.find(l => !selectedLabels.includes(l));
              if (nextOpt) selectedLabels.push(nextOpt);
              else break;
            }
          }
        }
        // C. Ràng buộc tối đa (max)
        if (constraints.max && constraints.max > 0) {
          if (selectedLabels.length > constraints.max) {
            selectedLabels.length = constraints.max;
          }
        }
      }

      // Nếu câu hỏi là bắt buộc (required) mà chưa chọn mục nào -> chọn mục có trọng số cao nhất hoặc mục đầu tiên
      if (question.required && selectedLabels.length === 0 && allOptLabels.length > 0) {
        const sorted = [...matchedRule.options].sort((a, b) => (parseFloat(b.weight) || 0) - (parseFloat(a.weight) || 0));
        const best = sorted[0] ? resolveLabel(sorted[0].label) : allOptLabels[0];
        selectedLabels.push(best || allOptLabels[0]);
      }

      return selectedLabels;
    }

    const picked = weightedRandom(matchedRule.options);
    if (!picked) return null;

    const targetLabel = (picked.label || '').toLowerCase().trim();
    const availableOptions = question.options || [];

    if (availableOptions.length > 0) {
      let exact = availableOptions.find(o => o.toLowerCase().trim() === targetLabel);
      if (exact) return exact;

      let sub = availableOptions.find(o => 
        o.toLowerCase().trim().includes(targetLabel) || targetLabel.includes(o.toLowerCase().trim())
      );
      if (sub) return sub;

      const letterMatch = picked.label.match(/^[A-Z]$/i);
      if (letterMatch) {
        const charIdx = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
        if (charIdx >= 0 && charIdx < availableOptions.length) {
          return availableOptions[charIdx];
        }
      }
      const numIdx = parseInt(picked.label, 10);
      if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= availableOptions.length) {
        return availableOptions[numIdx - 1];
      }
    }

    return picked.label;
  }

  // --- VIETNAMESE PROFILE GENERATION & PARSING HELPERS ---

  /**
   * Remove Vietnamese accent marks for generating natural email addresses
   */
  function removeVietnameseTones(str) {
    if (!str) return '';
    return str.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Helper to pick a random item from an array
   */
  function pickRandom(arr) {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return '';
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Generate realistic Vietnamese sample data for personal profile fields
   */
  function generateFakeVNProfile(fieldType, existingProfile = {}) {
    const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
    const middleNames = ['Văn', 'Thị', 'Hữu', 'Đức', 'Minh', 'Ngọc', 'Gia', 'Hoàng', 'Thanh', 'Anh', 'Bảo', 'Xuân', 'Khánh', 'Tuấn', 'Quang', 'Hải'];
    const firstNames = [
      'An', 'Anh', 'Bình', 'Cường', 'Dũng', 'Dương', 'Đạt', 'Đức', 'Hải', 'Hiếu',
      'Hòa', 'Huy', 'Hùng', 'Hưng', 'Khoa', 'Kiên', 'Lâm', 'Linh', 'Long', 'Minh',
      'Nam', 'Nghĩa', 'Nguyên', 'Nhân', 'Phát', 'Phong', 'Phúc', 'Quân', 'Quang',
      'Sơn', 'Tài', 'Tâm', 'Thắng', 'Thành', 'Thảo', 'Thịnh', 'Thuận', 'Tiến',
      'Toàn', 'Trí', 'Trung', 'Tú', 'Tuấn', 'Việt', 'Vinh', 'Vũ', 'Hà', 'Hương',
      'Lan', 'Mai', 'Ngọc', 'Nhi', 'Phương', 'Quỳnh', 'Trang', 'Vy', 'Yến'
    ];
    const phonePrefixes = [
      '090', '091', '092', '093', '094', '096', '097', '098',
      '081', '082', '083', '084', '085', '086', '088', '089',
      '032', '033', '034', '035', '036', '037', '038', '039',
      '070', '076', '077', '078', '079'
    ];
    const classes = ['D21CQCN01-B', 'D22CQCN02-N', 'D20CQVT01', 'K65-CLC', 'CNTT-K18A', 'QTKD-K19B', 'ATTT-01', 'KT-2022'];
    const addresses = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Bình Dương', 'Đồng Nai', 'Nam Định', 'Thái Bình', 'Nghệ An', 'Huế'];

    switch (fieldType) {
      case 'name': {
        const last = pickRandom(lastNames);
        const mid = pickRandom(middleNames);
        const first = pickRandom(firstNames);
        return `${last} ${mid} ${first}`;
      }
      case 'phone': {
        const prefix = pickRandom(phonePrefixes);
        const suffix = String(Math.floor(1000000 + Math.random() * 9000000));
        return `${prefix}${suffix}`;
      }
      case 'email': {
        let baseName = '';
        if (existingProfile.name) {
          baseName = removeVietnameseTones(existingProfile.name);
        }
        if (!baseName) {
          baseName = removeVietnameseTones(`${pickRandom(lastNames)} ${pickRandom(firstNames)}`);
        }
        const num = Math.floor(10 + Math.random() * 990);
        return `${baseName}${num}@gmail.com`;
      }
      case 'student_id': {
        const prefixes = ['B21DCCN', 'B22DCCN', 'B20DCCN', 'B23DCCN', 'B21DCKT', 'B22DCVT', '2052', '2152', '2252'];
        const p = pickRandom(prefixes);
        const num = p.length <= 4
          ? String(Math.floor(1000 + Math.random() * 9000))
          : String(Math.floor(100 + Math.random() * 900)).padStart(3, '0');
        return `${p}${num}`;
      }
      case 'class':
        return pickRandom(classes);
      case 'age':
        return String(Math.floor(19 + Math.random() * 6));
      case 'birth_year':
        return String(Math.floor(2000 + Math.random() * 5));
      case 'address':
        return pickRandom(addresses);
      default:
        return '';
    }
  }

  /**
   * Parse user's custom profile textarea into categorized key-value arrays
   * Supports inputs like:
   * Họ tên: Nguyễn Văn An, Trần Minh Quân
   * SĐT: 0912345678, 0987654321
   * Email: minhquan2003@gmail.com
   * MSSV: B21DCCN001
   */
  function parseCustomProfile(customText) {
    const result = {
      name: [],
      phone: [],
      email: [],
      student_id: [],
      class: [],
      age: [],
      birth_year: [],
      address: []
    };

    if (!customText || typeof customText !== 'string' || !customText.trim()) {
      return result;
    }

    const lines = customText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      const match = line.match(/^([^:=]+)[:=]\s*(.+)$/);
      if (!match) continue;

      const rawKey = match[1].toLowerCase().trim();
      const rawVal = match[2].trim();
      if (!rawVal) continue;

      const values = rawVal.split(/[,;]/).map(v => v.trim()).filter(Boolean);
      if (values.length === 0) continue;

      if (/^(họ\s*(?:và|&)?\s*tên|họ\s*tên|tên|name|full\s*name)$/i.test(rawKey)) {
        result.name.push(...values);
      } else if (/^(số\s*điện\s*thoại|sđt|số\s*đt|phone|tel|zalo|mobile)$/i.test(rawKey)) {
        result.phone.push(...values);
      } else if (/^(email|e-mail|thư\s*điện\s*tử|mail)$/i.test(rawKey)) {
        result.email.push(...values);
      } else if (/^(mssv|mã\s*số\s*sinh\s*viên|mã\s*sinh\s*viên|student\s*id)$/i.test(rawKey)) {
        result.student_id.push(...values);
      } else if (/^(lớp|chi\s*đoàn|class)$/i.test(rawKey)) {
        result.class.push(...values);
      } else if (/^(tuổi|age)$/i.test(rawKey)) {
        result.age.push(...values);
      } else if (/^(năm\s*sinh|ngày\s*sinh|dob|birth)$/i.test(rawKey)) {
        result.birth_year.push(...values);
      } else if (/^(địa\s*chỉ|nơi\s*ở|quê\s*quán|address)$/i.test(rawKey)) {
        result.address.push(...values);
      }
    }

    return result;
  }

  /**
   * Identify if question title or description matches personal profile fields
   */
  function identifyProfileFieldType(title, description = '') {
    const text = `${title || ''} ${description || ''}`.toLowerCase().trim();
    if (!text) return null;

    // 1. Phone number (High specificity)
    if (/(?:số\s*điện\s*thoại|sđt|số\s*đt|\bphone\s*number\b|\bphone\b|\bzalo\b|\btelephone\b|\bmobile\b)/i.test(text)) {
      return 'phone';
    }

    // 2. Email (High specificity)
    if (/(?:email|e-mail|thư\s*điện\s*tử|\bmail\b)/i.test(text)) {
      return 'email';
    }

    // 3. Student ID / MSSV
    if (/(?:mssv|mã\s*số\s*sinh\s*viên|mã\s*sinh\s*viên|mã\s*học\s*viên|student\s*id)/i.test(text)) {
      return 'student_id';
    }

    // 4. Name (Họ và tên, Họ tên, Tên của bạn)
    const isExcludedName = /(?:công\s*ty|doanh\s*nghiệp|sản\s*phẩm|dịch\s*vụ|đề\s*tài|trường\s*học|trường\s*đại\s*học|nhãn\s*hàng|thương\s*hiệu)/i.test(text);
    if (!isExcludedName) {
      if (
        /(?:họ\s*(?:và|&)?\s*tên|họ\s*tên|tên\s+của\s+bạn|họ\s+và\s+chữ\s+lót|your\s+name|full\s*name)/i.test(text) ||
        (/^(họ\s*tên|tên|name)$/i.test(title.trim()))
      ) {
        return 'name';
      }
    }

    // 5. Class / Lớp
    if (/(?:lớp\s*(?:học|chuyên\s*ngành)?|chi\s*đoàn|\bclass\b)/i.test(text) && !/(?:lớp\s*mấy)/i.test(text)) {
      return 'class';
    }

    // 6. Age
    if (/(?:\btuổi\s*(?:của\s*bạn)?|\bage\b)/i.test(text) && text.length <= 40) {
      return 'age';
    }

    // 7. Birth Year / DOB
    if (/(?:năm\s*sinh|ngày\s*sinh|ngày\s*tháng\s*năm\s*sinh|\bdob\b|date\s*of\s*birth)/i.test(text)) {
      return 'birth_year';
    }

    // 8. Address
    if (/(?:địa\s*chỉ\s*(?:của\s*bạn|nơi\s*ở|nhà)?|quê\s*quán|\baddress\b)/i.test(text)) {
      return 'address';
    }

    return null;
  }

  /**
   * Resolve appropriate value for a recognized profile field based on profile configuration
   */
  function resolveProfileFieldValue(fieldType, profileConfig, sessionProfile = {}) {
    if (!profileConfig || profileConfig.mode === 'skip') {
      return '__FORMMIND_SKIP__';
    }

    if (profileConfig.mode === 'fake') {
      const customParsed = parseCustomProfile(profileConfig.customText || '');
      const availableCustomValues = customParsed[fieldType] || [];

      let pickedValue = '';
      if (availableCustomValues.length > 0) {
        pickedValue = pickRandom(availableCustomValues);
      } else {
        pickedValue = generateFakeVNProfile(fieldType, sessionProfile);
      }

      if (fieldType === 'name' && !sessionProfile.name) {
        sessionProfile.name = pickedValue;
      }
      return pickedValue;
    }

    return null;
  }

  /**
   * Evaluate if a text/textarea question matches a text rule or global default
   * @param {Object} question The scanned question object
   * @param {number} questionIndex 0-based index
   * @param {Array} textRules Array of configured text rules
   * @param {Object} globalDefault Optional global default text config
   * @returns {Object|null} { action: 'skip'|'fill', value: string } or null
   */
  function evaluateTextRule(question, questionIndex, textRules, globalDefault) {
    if (!question || (question.type !== 'text' && question.type !== 'textarea')) {
      return null;
    }

    const rawTitle = (question.title || '').trim();
    const qTitleClean = cleanTitle(rawTitle);
    const qTitle = rawTitle.toLowerCase();
    const qIdx = questionIndex + 1; // 1-based index

    let matchedRule = null;
    if (Array.isArray(textRules) && textRules.length > 0) {
      // Ưu tiên 1: So khớp theo Title trước
      matchedRule = textRules.find(rule => {
        if (rule.matchType === 'title' || (!rule.matchType && rule.matchValue && isNaN(Number(rule.matchValue)))) {
          const kwRaw = (rule.matchValue || rule.titleHint || '').trim();
          if (!kwRaw) return false;
          const kwClean = cleanTitle(kwRaw);
          if (kwClean && (qTitleClean === kwClean || qTitleClean.includes(kwClean) || kwClean.includes(qTitleClean))) {
            return true;
          }
          const kw = kwRaw.toLowerCase();
          try {
            const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            if (re.test(rawTitle)) return true;
          } catch (e) {}
          return qTitle.includes(kw);
        }
        return false;
      });

      // Ưu tiên 2: Fallback theo Index nếu không có rule title nào khớp
      if (!matchedRule) {
        matchedRule = textRules.find(rule => {
          if (rule.matchType === 'index') {
            const ruleIdx = parseInt(rule.matchValue, 10);
            return !isNaN(ruleIdx) && ruleIdx === qIdx;
          }
          return false;
        });
      }
    }

    const ruleToApply = matchedRule || (globalDefault && globalDefault.enabled ? globalDefault : null);
    if (!ruleToApply) return null;

    const mode = ruleToApply.mode || 'fixed';

    if (mode === 'skip') {
      return { action: 'skip', value: '' };
    }

    if (mode === 'fixed') {
      return { action: 'fill', value: ruleToApply.fixedValue || '' };
    }

    if (mode === 'random_list') {
      let list = [];
      if (Array.isArray(ruleToApply.listValues)) {
        list = ruleToApply.listValues;
      } else if (typeof ruleToApply.listValues === 'string') {
        list = ruleToApply.listValues.split('\n').map(s => s.trim()).filter(Boolean);
      }
      if (list.length > 0) {
        const chosenText = list[Math.floor(Math.random() * list.length)];
        return { action: 'fill', value: chosenText };
      }
      return { action: 'fill', value: ruleToApply.fixedValue || '' };
    }

    return null;
  }

  // --- COOLDOWN LOOP CONTROLLER ---
  let cooldownInterval = null;

  /**
   * Resolve target form URL ensuring redirection returns to /viewform, not /formResponse
   */
  function resolveTargetFormUrl(storedUrl = '') {
    if (storedUrl && storedUrl.startsWith('http') && !storedUrl.includes('/formResponse')) {
      return storedUrl;
    }
    const anotherResponseLink = document.querySelector('a[href*="/viewform"]');
    if (anotherResponseLink && anotherResponseLink.href) {
      return anotherResponseLink.href;
    }
    const currentHref = window.location.href || '';
    if (currentHref.includes('/formResponse')) {
      return currentHref.replace(/\/formResponse.*/i, '/viewform');
    }
    return currentHref;
  }

  async function startCooldown(config) {
    if (!config || !config.enabled) return;
    const minMs = parseTimeToMs(config.min || 5, config.unit || 'm');
    const maxMs = parseTimeToMs(config.max || 10, config.unit || 'm');
    const safeMin = Math.min(minMs, maxMs);
    const safeMax = Math.max(minMs, maxMs);
    const waitMs = safeMin + Math.floor(Math.random() * (safeMax - safeMin + 1));
    const endTime = Date.now() + waitMs;

    const localData = await new Promise(r => chrome.storage.local.get(['formmind_form_url'], r));
    const rawFormUrl = (localData?.formmind_form_url || '').trim();
    const formUrl = resolveTargetFormUrl(rawFormUrl);

    sendSafeRuntimeMessage({
      action: 'START_COOLDOWN',
      payload: { waitMs, endTime, formUrl }
    });

    renderCooldownBar(endTime);
    showToast(`✅ Đã nộp form thành công! Chờ lượt tiếp theo: ${formatMsToTime(waitMs)}`, 'success');
  }

  function renderCooldownBar(endTime) {
    if (cooldownInterval) clearInterval(cooldownInterval);

    let widget = document.getElementById('formmind-floating-widget');
    if (!widget) {
      createFloatingWidget();
      widget = document.getElementById('formmind-floating-widget');
    }
    if (!widget) return;

    let bar = widget.querySelector('#fmind-cooldown-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'fmind-cooldown-bar';
      bar.id = 'fmind-cooldown-bar';
      bar.innerHTML = `
        <div class="fmind-cooldown-info">
          <span>✅</span>
          <span style="font-weight: 600;">Đã nộp form thành công! Chờ lượt tiếp theo...</span>
          <span class="fmind-cooldown-timer" id="fmind-cooldown-timer">00:00:00</span>
        </div>
        <button type="button" class="fmind-btn-skip" id="fmind-btn-skip-cooldown" title="Bỏ qua thời gian chờ và chạy ngay">
          ⚡ Chạy ngay
        </button>
      `;
      widget.prepend(bar);

      const skipBtn = bar.querySelector('#fmind-btn-skip-cooldown');
      if (skipBtn) {
        skipBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          skipCooldown();
        });
      }
    } else {
      const infoSpan = bar.querySelector('.fmind-cooldown-info span[style*="font-weight"]');
      if (infoSpan) {
        infoSpan.textContent = 'Đã nộp form thành công! Chờ lượt tiếp theo...';
      }
    }

    bar.style.display = 'flex';

    const updateTimer = () => {
      const remaining = endTime - Date.now();
      const timerEl = document.getElementById('fmind-cooldown-timer');
      if (remaining <= 0) {
        if (cooldownInterval) clearInterval(cooldownInterval);
        removeCooldownBar();
        handleCooldownFinished();
      } else if (timerEl) {
        timerEl.textContent = formatMsToTime(remaining);
      }
    };

    updateTimer();
    cooldownInterval = setInterval(updateTimer, 500);
  }

  function removeCooldownBar() {
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = null;
    const bar = document.getElementById('fmind-cooldown-bar');
    if (bar) bar.remove();
  }

  async function skipCooldown() {
    if (typeof isAborted !== 'undefined' && isAborted) return;
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = null;
    removeCooldownBar();

    showToast('⚡ Đang bỏ qua Cooldown và bắt đầu lượt mới...', 'info');

    // 1. Reset triệt để trạng thái Cooldown trong storage ngay lập tức
    await chrome.storage.local.set({
      formmind_cooldown_state: { active: false, endTime: 0, durationMs: 0 },
      formmind_auto_start_next_run: true,
      isRunning: true,
      retryCount: 0,
      formmind_retry_count: 0
    });

    // 2. Báo cho Service Worker hủy alarm
    sendSafeRuntimeMessage({ action: 'SKIP_COOLDOWN' });

    // 3. Xác định URL đích (/viewform) để chuyển hướng, TUYỆT ĐỐI không reload trang kết quả
    const res = await new Promise(r => chrome.storage.local.get(['formmind_form_url'], r));
    const rawFormUrl = (res?.formmind_form_url || '').trim();
    const targetUrl = resolveTargetFormUrl(rawFormUrl);

    const delayFn = typeof safeSetTimeout === 'function' ? safeSetTimeout : setTimeout;
    delayFn(() => {
      if (typeof isAborted !== 'undefined' && isAborted) return;
      if (targetUrl && targetUrl.startsWith('http') && !targetUrl.includes('/formResponse')) {
        window.location.href = targetUrl;
      } else {
        const current = window.location.href;
        if (current.includes('/formResponse')) {
          window.location.href = current.replace(/\/formResponse.*/i, '/viewform');
        } else {
          window.location.reload();
        }
      }
    }, 200);
  }

  async function handleCooldownFinished() {
    if (typeof isAborted !== 'undefined' && isAborted) return;
    const res = await new Promise(r => chrome.storage.local.get(['formmind_form_url', 'formmind_cooldown_config'], r));
    if (typeof isAborted !== 'undefined' && isAborted) return;
    const rawFormUrl = (res?.formmind_form_url || '').trim();
    if (res?.formmind_cooldown_config?.autoRestartFill !== false) {
      await chrome.storage.local.set({
        formmind_cooldown_state: { active: false, endTime: 0, durationMs: 0 },
        formmind_auto_start_next_run: true,
        isRunning: true,
        retryCount: 0,
        formmind_retry_count: 0
      });
    }
    const targetUrl = resolveTargetFormUrl(rawFormUrl);
    if (typeof isAborted !== 'undefined' && isAborted) return;
    if (targetUrl && targetUrl.startsWith('http') && !targetUrl.includes('/formResponse')) {
      window.location.href = targetUrl;
    } else {
      const current = window.location.href;
      if (current.includes('/formResponse')) {
        window.location.href = current.replace(/\/formResponse.*/i, '/viewform');
      } else {
        window.location.reload();
      }
    }
  }

  // --- HIGH DEMAND RETRY MECHANISM ---
  let retryCountdownInterval = null;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function detectHighDemandError(customMessage = '') {
    const bodyText = (document.body ? (document.body.innerText || document.body.textContent || '') : '').toLowerCase();
    const titleText = (document.title || '').toLowerCase();
    const msg = String(customMessage || '').toLowerCase();
    const combined = `${msg} ${titleText} ${bodyText}`;

    const highDemandPatterns = [
      /high\s*demand/i,
      /quá\s*tải/i,
      /lượng\s*truy\s*cập\s*cao/i,
      /vui\s*lòng\s*thử\s*lại\s*sau/i,
      /too\s*many\s*requests/i,
      /rate\s*limit/i,
      /resource_exhausted/i,
      /\b429\b/,
      /\b503\b/,
      /service\s*unavailable/i,
      /hệ\s*thống\s*đang\s*bận/i
    ];

    return highDemandPatterns.some(pattern => pattern.test(combined));
  }

  function renderRetryBar(message, isFinalFailure = false) {
    let widget = document.getElementById('formmind-floating-widget');
    if (!widget) {
      createFloatingWidget();
      widget = document.getElementById('formmind-floating-widget');
    }
    if (!widget) return;

    removeCooldownBar();

    let bar = widget.querySelector('#fmind-retry-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'fmind-cooldown-bar fmind-retry-bar';
      bar.id = 'fmind-retry-bar';
      widget.prepend(bar);
    }

    bar.style.display = 'flex';
    bar.style.background = isFinalFailure
      ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
      : 'linear-gradient(135deg, #f59e0b, #d97706)';
    bar.style.color = '#ffffff';

    bar.innerHTML = `
      <div class="fmind-cooldown-info" style="color: #ffffff; font-weight: 600; width: 100%; justify-content: center; text-align: center;">
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }

  function removeRetryBar() {
    if (retryCountdownInterval) {
      clearInterval(retryCountdownInterval);
      retryCountdownInterval = null;
    }
    const bar = document.getElementById('fmind-retry-bar');
    if (bar) bar.remove();
  }

  async function handleHighDemandRetry(errorReason = '') {
    try {
      if (retryCountdownInterval) {
        clearInterval(retryCountdownInterval);
        retryCountdownInterval = null;
      }

      const storageData = await new Promise(r => chrome.storage.local.get([
        'retryCount',
        'formmind_retry_count',
        'formmind_form_url',
        'isRunning'
      ], r));
      const currentRetryCount = parseInt(storageData?.retryCount ?? storageData?.formmind_retry_count ?? 0, 10);
      const formUrl = (storageData?.formmind_form_url || '').trim();

      if (currentRetryCount < 3) {
        const nextRetry = currentRetryCount + 1;
        // Yêu cầu: Tăng retryCount trong storage, giữ nguyên isRunning: true, sau đó mới F5
        await chrome.storage.local.set({
          retryCount: nextRetry,
          formmind_retry_count: nextRetry,
          isRunning: true,
          formmind_auto_start_next_run: true
        });

        let secondsLeft = 5;
        const initialNotice = `⚠️ Quá tải (High Demand)! Thử lại lần ${nextRetry}/3 sau ${secondsLeft}s...`;
        renderRetryBar(initialNotice, false);
        showToast(initialNotice, 'error');

        retryCountdownInterval = setInterval(async () => {
          if (typeof isAborted !== 'undefined' && isAborted) {
            clearInterval(retryCountdownInterval);
            retryCountdownInterval = null;
            return;
          }
          secondsLeft--;
          if (secondsLeft <= 0) {
            clearInterval(retryCountdownInterval);
            retryCountdownInterval = null;
            if (typeof isAborted !== 'undefined' && isAborted) return;
            if (formUrl && formUrl.startsWith('http')) {
              window.location.href = formUrl;
            } else {
              window.location.reload();
            }
          } else {
            const updateNotice = `⚠️ Quá tải (High Demand)! Thử lại lần ${nextRetry}/3 sau ${secondsLeft}s...`;
            renderRetryBar(updateNotice, false);
          }
        }, 1000);

      } else {
        // retryCount >= 3: Give up! Lưu isRunning: false, reset retryCount = 0, không F5 nữa
        await chrome.storage.local.remove(['formmind_active_session', 'formmind_auto_start_next_run']);
        await chrome.storage.local.set({
          retryCount: 0,
          formmind_retry_count: 0,
          isRunning: false
        });

        const finalFailMsg = `❌ Thất bại: Đã thử lại 3 lần nhưng hệ thống vẫn quá tải. Đã dừng tiến trình!`;
        renderRetryBar(finalFailMsg, true);
        showToast(finalFailMsg, 'error');
        console.warn('[FormMind] High demand retry limit reached (3/3). Process stopped to avoid lock/ban.');

        const fillBtn = document.getElementById('fmind-quick-fill-btn');
        if (fillBtn) {
          fillBtn.classList.remove('loading', 'fmind-btn-running');
          fillBtn.innerHTML = '<span>⚡ Auto-Fill</span>';
          fillBtn.title = 'Bấm để tự động điền form ngay lập tức';
        }
      }
    } catch (err) {
      console.error('[FormMind] Error in handleHighDemandRetry:', err);
    }
  }

  async function checkAndHandleCooldownOrAutoStart() {
    try {
      // High demand check on page load
      if (detectHighDemandError()) {
        console.warn('[FormMind] High demand detected in page on load!');
        await handleHighDemandRetry('DOM on load');
        return;
      }

      const local = await new Promise(r => chrome.storage.local.get([
        'formmind_cooldown_state',
        'formmind_cooldown_config',
        'formmind_auto_start_next_run',
        'formmind_active_session',
        'formmind_form_url'
      ], r));

      const cooldownState = local?.formmind_cooldown_state;
      const cooldownConfig = local?.formmind_cooldown_config;
      const autoStart = local?.formmind_auto_start_next_run;
      const activeSession = local?.formmind_active_session;
      const rawFormUrl = (local?.formmind_form_url || '').trim();

      // 0. If an active multi-page session is in progress, check if form is completed
      if (activeSession && activeSession.inProgress && (Date.now() - (activeSession.lastUpdated || activeSession.startedAt || 0) < 180000)) {
        if (typeof isFormCompleted === 'function' && isFormCompleted()) {
          console.log('[FormMind] Active session found on completed form. Purging session to allow cooldown.');
          chrome.storage.local.remove('formmind_active_session');
        } else {
          return;
        }
      }

      // =========================================================================
      // ƯU TIÊN 1: Cờ formmind_auto_start_next_run (Chạy ngay / Sau Cooldown)
      // =========================================================================
      if (autoStart) {
        const currentHref = window.location.href || '';
        // Nếu đang ở trang kết quả đã hoàn thành: lập tức chuyển hướng về /viewform
        if (isFormCompleted()) {
          const targetUrl = resolveTargetFormUrl(rawFormUrl);
          console.log('[FormMind] autoStart flag detected on result page. Redirecting to form:', targetUrl);
          if (targetUrl && targetUrl.startsWith('http') && !targetUrl.includes('/formResponse')) {
            window.location.href = targetUrl;
          } else {
            window.location.href = currentHref.replace(/\/formResponse.*/i, '/viewform');
          }
          return;
        }

        // Đang ở trang form hợp lệ: Xóa cờ autoStart, reset cooldown và bắt đầu điền form ngay!
        await chrome.storage.local.remove('formmind_auto_start_next_run');
        await chrome.storage.local.set({
          formmind_cooldown_state: { active: false, endTime: 0, durationMs: 0 },
          isRunning: true,
          retryCount: 0,
          formmind_retry_count: 0
        });

        if (typeof isAborted !== 'undefined' && isAborted) return;
        showToast('🚀 Bắt đầu lượt điền tự động mới...', 'info');

        const delayFn = typeof safeSetTimeout === 'function' ? safeSetTimeout : setTimeout;
        delayFn(() => {
          if (typeof isAborted === 'undefined' || !isAborted) {
            handleMainWorkflow();
          }
        }, 1000);
        return;
      }

      // =========================================================================
      // ƯU TIÊN 2: Nếu đang trong Cooldown hợp lệ -> Vẽ thanh đếm ngược
      // =========================================================================
      if (cooldownState && cooldownState.active && cooldownState.endTime > Date.now()) {
        renderCooldownBar(cooldownState.endTime);
        return;
      }

      // =========================================================================
      // ƯU TIÊN 3: Nếu đang ở màn hình kết thúc form -> Bắt đầu Cooldown mới
      // =========================================================================
      if (isFormCompleted()) {
        if (cooldownConfig && cooldownConfig.enabled) {
          chrome.storage.local.set({ retryCount: 0, formmind_retry_count: 0 });
          startCooldown(cooldownConfig);
        }
        return;
      }
    } catch (e) {
      console.warn('[FormMind] checkAndHandleCooldownOrAutoStart error:', e);
    }
  }

  /**
   * Polls until questions, next button, or submit button are fully rendered on the active page
   */
  async function waitForQuestionsOnPage(timeoutMs = 4000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const questions = scanGoogleForm();
      if (questions.length > 0) {
        return { success: true, questions };
      }
      const nextBtn = typeof findNextButton === 'function' ? findNextButton() : null;
      if (nextBtn) {
        return { success: true, isIntroPage: true, nextBtn, questions: [] };
      }
      const submitBtn = typeof findSubmitButton === 'function' ? findSubmitButton() : null;
      if (submitBtn) {
        return { success: true, isOnlySubmit: true, submitBtn, questions: [] };
      }
      await new Promise(r => setTimeout(r, 200));
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

      // CHỐT CHẶN 1: Nếu form đã hoàn thành (isFormCompleted), TUYỆT ĐỐI không resume, dọn session và dừng lại
      if (typeof isFormCompleted === 'function' && isFormCompleted()) {
        console.log('[FormMind] Form is already completed. Clearing active session.');
        chrome.storage.local.remove('formmind_active_session');
        return;
      }

      // Wait for questions to be mounted in the DOM
      const waitResult = await waitForQuestionsOnPage(8000);

      // CHỐT CHẶN 2: Sau khi chờ DOM, kiểm tra lại nếu form đã hoàn tất
      if (typeof isFormCompleted === 'function' && isFormCompleted()) {
        console.log('[FormMind] Form is completed after waiting for DOM. Clearing active session.');
        chrome.storage.local.remove('formmind_active_session');
        return;
      }

      // CHỐT CHẶN 3: Nếu sau 8s không có bất kỳ câu hỏi hoặc nút chuyển trang nào, dọn session và dừng lại
      if (!waitResult || !waitResult.success) {
        console.log('[FormMind] No questions or navigation buttons found after 8s. Terminating resume attempt.');
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
          const nextBtn = findNextButton();
          const submitBtn = findSubmitButton();
          sendResponse({
            success: true,
            title: getFormTitle(),
            questionCount: questions.length,
            hasNextPage: !!nextBtn,
            hasSubmit: !!submitBtn,
            isIntroPage: questions.length === 0 && !!nextBtn,
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

      if (request.action === 'EXTRACT_ALL_FORM_QUESTIONS') {
        try {
          const fullQuestions = extractAllQuestionsFromFBData();
          if (fullQuestions && fullQuestions.length > 0) {
            sendResponse({ success: true, questions: fullQuestions, source: 'fb_data' });
          } else {
            // Fallback sang scan DOM nếu không tìm thấy script
            const domQuestions = scanGoogleForm();
            sendResponse({
              success: true,
              questions: (domQuestions || []).map(q => ({
                id: q.id,
                title: q.title,
                description: q.description,
                type: q.type,
                options: q.options || [],
                rows: q.rows || [],
                columns: q.columns || [],
                required: !!q.required,
                scaleMin: q.scaleMin,
                scaleMax: q.scaleMax
              })),
              source: 'dom'
            });
          }
        } catch (err) {
          sendResponse({ success: false, error: err.message, questions: [] });
        }
        return false;
      }

      if (request.action === 'APPLY_AI_ANSWERS') {
        applyAnswersToForm(request.answers)
          .then(result => sendResponse({ success: true, count: result.count }))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
      }

      if (request.action === 'START_MULTI_PAGE_FILL') {
        const payload = request.payload || {};
        removeRetryBar();
        chrome.storage.local.set({ formmind_retry_count: 0 });
        // Immediately acknowledge receipt so message port never closes with timeout
        sendResponse({ success: true, started: true });

        // Run multi-page fill asynchronously in page context
        runMultiPageAutoFill({
          selectedPersona: payload.persona || 'positive',
          chosenModel: payload.model || 'gemini-3.8-flash',
          chosenProvider: payload.provider || 'gemini',
          apiKey: payload.apiKey,
          customPersonaPrompt: payload.customPersonaPrompt || '',
          autoAdvance: payload.autoAdvance === true,
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

      if (request.action === 'SKIP_COOLDOWN') {
        skipCooldown();
        sendResponse({ success: true });
        return true;
      }

      if (request.action === 'CANCEL_COOLDOWN') {
        if (cooldownInterval) clearInterval(cooldownInterval);
        cooldownInterval = null;
        removeCooldownBar();
        sendResponse({ success: true });
        return true;
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
   * Extract 100% of questions across all pages/sections from embedded FB_PUBLIC_LOAD_DATA_
   * Google Forms embeds the full question structure in the initial HTML.
   */
  function extractAllQuestionsFromFBData() {
    let rawData = null;
    // 1. Thử lấy từ window toàn cục nếu có
    if (typeof window !== 'undefined' && window.FB_PUBLIC_LOAD_DATA_ && Array.isArray(window.FB_PUBLIC_LOAD_DATA_)) {
      rawData = window.FB_PUBLIC_LOAD_DATA_;
    } else {
      // 2. Tìm trong các thẻ <script> của trang
      const scripts = typeof document !== 'undefined' ? Array.from(document.querySelectorAll('script')) : [];
      for (const s of scripts) {
        const text = s.textContent || '';
        if (text.includes('FB_PUBLIC_LOAD_DATA_')) {
          const match = text.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]+?\])\s*;/);
          if (match) {
            try {
              rawData = JSON.parse(match[1]);
              break;
            } catch (e) {
              try {
                rawData = (new Function(`return ${match[1]}`))();
                break;
              } catch (err) {}
            }
          } else {
            const altMatch = text.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]+\])/);
            if (altMatch) {
              try {
                rawData = (new Function(`return ${altMatch[1]}`))();
                break;
              } catch (err) {}
            }
          }
        }
      }
    }

    if (!rawData || !rawData[1] || !Array.isArray(rawData[1][1])) {
      return null;
    }

    const rawList = rawData[1][1];
    const allQuestions = [];
    let index = 1;

    for (const item of rawList) {
      if (!item) continue;
      const title = (item[1] || '').trim();
      const desc = (item[2] || '').trim();
      const typeCode = item[3];
      const payload = item[4] && item[4][0];

      // Bỏ qua tiêu đề phân đoạn trang (typeCode 8 là Section break) hoặc item không có payload
      if (typeCode === 8 || !payload) continue;

      let type = 'text';
      let options = [];
      let scaleMin = 1;
      let scaleMax = 5;

      // Map mã loại câu hỏi của Google Form
      if (typeCode === 2) {
        type = 'radio';
        if (Array.isArray(payload[1])) {
          options = payload[1].map(o => o && o[0]).filter(Boolean);
        }
      } else if (typeCode === 3) {
        type = 'dropdown';
        if (Array.isArray(payload[1])) {
          options = payload[1].map(o => o && o[0]).filter(Boolean);
        }
      } else if (typeCode === 4) {
        type = 'checkbox';
        if (Array.isArray(payload[1])) {
          options = payload[1].map(o => o && o[0]).filter(Boolean);
        }
      } else if (typeCode === 5) {
        type = 'scale';
        scaleMin = (payload[3] && payload[3][0] !== undefined) ? payload[3][0] : 1;
        scaleMax = (payload[3] && payload[3][1] !== undefined) ? payload[3][1] : 5;
        for (let i = scaleMin; i <= scaleMax; i++) options.push(String(i));
      } else if (typeCode === 0) {
        type = 'text';
      } else if (typeCode === 1) {
        type = 'textarea';
      }

      allQuestions.push({
        id: index++,
        title: title || `Câu hỏi ${index - 1}`,
        description: desc,
        type: type,
        options: options,
        scaleMin: scaleMin,
        scaleMax: scaleMax,
        required: payload[2] === 1
      });
    }

    return allQuestions;
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

  // Default fallback phrases for "Khác: _____" (Other option) text inputs
  const DEFAULT_OTHER_TEXTS = [
    'Ý kiến khác',
    'Không có ý kiến gì thêm',
    'Tùy thuộc vào nhu cầu thực tế',
    'Lý do cá nhân khác',
    'Cần xem xét và đánh giá thêm'
  ];

  /**
   * Helper to identify if an option is "Khác / Other" via label text, aria-label, or child input
   */
  function isOtherOption(element, labelText) {
    if (labelText) {
      const s = String(labelText).toLowerCase().trim();
      if (
        /(^|\b)(khác|mục khác|câu trả lời khác|other|otro|autre|sonstiges)(\b|:|\s*$)/i.test(s) ||
        s.includes('khác') ||
        s.includes('other')
      ) {
        return true;
      }
    }
    if (element) {
      const aria = (element.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes('khác') || aria.includes('other')) {
        return true;
      }
      const container = element.closest('.docssharedWizToggleLabeledContainer, .nWQ3rd, .Y6EkJc, label, div[role="listitem"]') || element.parentElement;
      if (container && container.querySelector('input[type="text"], input:not([type]), input.Hvn9fb, input[jsname="YPqjbf"]')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Helper to fill text into "Khác: ____" (Other Option) text input and dispatch input events
   * @param {HTMLElement} container The option container, radio/checkbox element, or question node
   * @param {string} value The desired text value (if any)
   * @param {Object} question The question metadata object
   */
  async function fillOtherOptionInput(container, value, question) {
    if (!container) return false;

    // 1. Locate the text input associated with the "Other / Khác" option
    let inputEl = null;

    // A. Check inside container directly
    inputEl = container.querySelector('input.Hvn9fb, input[jsname="YPqjbf"], input.whsOnd[type="text"], input[type="text"], input:not([type])');

    // B. Check parent row container
    if (!inputEl) {
      const row = container.closest('.docssharedWizToggleLabeledContainer, .nWQ3rd, .Y6EkJc, label, div[role="row"]') || container.parentElement;
      if (row) {
        inputEl = row.querySelector('input.Hvn9fb, input[jsname="YPqjbf"], input.whsOnd[type="text"], input[type="text"], input:not([type])');
      }
    }

    // C. Check question node as fallback
    if (!inputEl && question?.node) {
      inputEl = question.node.querySelector('input.Hvn9fb, input[jsname="YPqjbf"], input[aria-label*="khác" i], input[aria-label*="other" i]');
    }

    if (!inputEl) {
      console.warn('[FormMind] Could not locate input for "Khác" option in container:', container);
      return false;
    }

    // 2. Resolve the text to fill
    let textToFill = '';
    if (value && typeof value === 'string') {
      const cleanVal = value.replace(/^.*?(khác|other)\s*[:：\-\(]?\s*/i, '').replace(/\)$/, '').trim();
      if (cleanVal && !/^(khác|mục khác|other)$/i.test(cleanVal)) {
        textToFill = cleanVal;
      }
    }

    // If still empty, check user's configured text rules or global text config
    if (!textToFill && cachedTextRules && cachedTextRules.length > 0 && question) {
      const qIdx = cachedQuestions.findIndex(q => q.id === question.id);
      const textRuleRes = evaluateTextRule(question, qIdx, cachedTextRules, cachedTextGlobalDefault);
      if (textRuleRes && textRuleRes.action !== 'skip' && textRuleRes.value) {
        textToFill = textRuleRes.value;
      }
    }

    // Check global text default
    if (!textToFill && cachedTextGlobalDefault) {
      if (cachedTextGlobalDefault.mode === 'fixed' && cachedTextGlobalDefault.fixedValue) {
        textToFill = cachedTextGlobalDefault.fixedValue.trim();
      } else if (cachedTextGlobalDefault.mode === 'list' && Array.isArray(cachedTextGlobalDefault.listValues) && cachedTextGlobalDefault.listValues.length > 0) {
        const idx = Math.floor(Math.random() * cachedTextGlobalDefault.listValues.length);
        textToFill = cachedTextGlobalDefault.listValues[idx].trim();
      }
    }

    // Fallback: asynchronous check of storage if cachedTextRules was empty
    if (!textToFill) {
      try {
        const stored = await new Promise(r => chrome.storage.local.get(['formmind_text_rules', 'formmind_text_global_default'], r));
        const tRules = stored?.formmind_text_rules || [];
        const tGlobal = stored?.formmind_text_global_default || null;
        if (tRules.length > 0 && question) {
          const qIdx = cachedQuestions.findIndex(q => q.id === question.id);
          const textRuleRes = evaluateTextRule(question, qIdx, tRules, tGlobal);
          if (textRuleRes && textRuleRes.action !== 'skip' && textRuleRes.value) {
            textToFill = textRuleRes.value;
          }
        }
        if (!textToFill && tGlobal) {
          if (tGlobal.mode === 'fixed' && tGlobal.fixedValue) {
            textToFill = tGlobal.fixedValue.trim();
          } else if (tGlobal.mode === 'list' && Array.isArray(tGlobal.listValues) && tGlobal.listValues.length > 0) {
            const idx = Math.floor(Math.random() * tGlobal.listValues.length);
            textToFill = tGlobal.listValues[idx].trim();
          }
        }
      } catch (e) {}
    }

    // Fallback: pick from sensible default list
    if (!textToFill) {
      const randIdx = Math.floor(Math.random() * DEFAULT_OTHER_TEXTS.length);
      textToFill = DEFAULT_OTHER_TEXTS[randIdx];
    }

    // 3. Dispatch full input events to ensure Google Forms registers the value
    inputEl.focus();
    inputEl.value = textToFill;
    inputEl.setAttribute('data-initial-value', textToFill);
    inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    inputEl.blur();

    console.log(`[FormMind] Successfully filled "Khác" option input with: "${textToFill}"`);
    return true;
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
      if (isAborted) {
        console.log('[FormMind] applyAnswersToForm aborted by user.');
        break;
      }

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
        } else if (isDebugModeEnabled) {
          recordBugEntry({
            step: 'applyAnswersToForm:fillSingleQuestion_failed',
            errorMessage: `Không thể điền giá trị cho câu hỏi #${question.id} ("${question.title}")`,
            extra: { questionId: question.id, value: ans.value }
          });
        }
      } catch (err) {
        console.warn(`[FormMind] Error filling question #${question.id} (${question.title}):`, err);
        if (isDebugModeEnabled) {
          recordBugEntry({
            step: 'applyAnswersToForm:exception',
            errorMessage: err.message,
            errorStack: err.stack,
            extra: { questionId: question.id, title: question.title }
          });
        }
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

      // Skip mode: leave blank and do not fill
      if (value === '__FORMMIND_SKIP__') {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        return true;
      }

      const textValue = String(value || '');
      input.focus();
      input.value = textValue;

      // Dispatch full suite of events for Google Forms Closure/React/Vue state binding
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
        radioToClick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
        radioToClick.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
        radioToClick.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
        radioToClick.click();

        const parentContainer = radioToClick.closest('.docssharedWizToggleLabeledContainer, label') || radioToClick.parentElement;
        if (parentContainer && parentContainer !== radioToClick) {
          try {
            parentContainer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
            parentContainer.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
            parentContainer.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
            parentContainer.click();
          } catch (e) {}
        }

        // Check if selected option is "Khác" / Other option and fill its text input
        const optLabel = options[targetIndex] || '';
        if (isOtherOption(radioToClick, optLabel)) {
          await new Promise(r => setTimeout(r, 80));
          await fillOtherOptionInput(radioToClick, value, question);
        }

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

      // Apply clicks to match selectedIndices and fill Other input if selected
      for (let idx = 0; idx < checkboxes.length; idx++) {
        const cb = checkboxes[idx];
        const shouldCheck = selectedIndices.includes(idx);
        const isCurrentlyChecked = cb.getAttribute('aria-checked') === 'true';
        if (shouldCheck && !isCurrentlyChecked) {
          cb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
          cb.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
          cb.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
          cb.click();
          const parentContainer = cb.closest('.docssharedWizToggleLabeledContainer, label') || cb.parentElement;
          if (parentContainer && parentContainer !== cb) {
            try {
              parentContainer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
              parentContainer.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
              parentContainer.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
              parentContainer.click();
            } catch (e) {}
          }
        } else if (!shouldCheck && isCurrentlyChecked) {
          cb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
          cb.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
          cb.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
          cb.click(); // Uncheck
        }

        if (shouldCheck) {
          const optLabel = options[idx] || '';
          if (isOtherOption(cb, optLabel)) {
            await new Promise(r => setTimeout(r, 80));
            await fillOtherOptionInput(cb, value, question);
          }
        }
      }

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
        targetRadio.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        targetRadio.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
        targetRadio.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
        targetRadio.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
        targetRadio.click();
        const parentContainer = targetRadio.closest('.docssharedWizToggleLabeledContainer, label') || targetRadio.parentElement;
        if (parentContainer && parentContainer !== targetRadio) {
          try {
            parentContainer.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
          } catch (e) {}
        }
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
          <svg class="fmind-brand-icon" width="18" height="18" viewBox="0 0 128 128" fill="none">
            <rect x="8" y="8" width="112" height="112" rx="26" fill="#1e1b4b" stroke="#a855f7" stroke-width="6"/>
            <!-- Form -->
            <rect x="24" y="28" width="50" height="70" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="6"/>
            <path d="M34 50l4 4 8-8 M34 72l4 4 8-8" stroke="#38bdf8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="52" y1="50" x2="66" y2="50" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
            <line x1="52" y1="72" x2="66" y2="72" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
            <!-- Brain / Mind -->
            <path d="M 66 48 C 64 34, 76 22, 90 22 C 102 22, 112 30, 112 42 C 120 45, 122 56, 116 66 C 120 76, 114 86, 104 88 C 96 96, 82 96, 76 88 L 76 104" stroke="#c084fc" stroke-width="7" stroke-linecap="round" fill="none"/>
            <circle cx="82" cy="36" r="5" fill="#ffffff"/>
            <circle cx="100" cy="48" r="5" fill="#67e8f9"/>
            <circle cx="86" cy="68" r="5" fill="#f472b6"/>
            <path d="M 90 38 L 86 48 L 94 48 L 88 60" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
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
          <option value="random">🎲 Random</option>
          <option value="custom">🎨 Custom</option>
        </select>
        <label class="fmind-checkbox-label" title="Tự động chuyển tiếp trang khi điền xong (Mặc định: TẮT)">
          <input type="checkbox" id="fmind-auto-next" class="fmind-checkbox">
          <span>Auto Next</span>
        </label>
        <input type="text" id="fmind-form-url" class="fmind-input-url" placeholder="🔗 Link Form..." title="Dán URL của Form gốc để lặp lại sau Cooldown">
        <button type="button" class="fmind-btn-fill" id="fmind-quick-fill-btn" title="Bấm để tự động điền form ngay lập tức">
          <span>⚡ Auto-Fill</span>
        </button>
        <button type="button" class="fmind-btn-terminate" id="fmind-btn-terminate" title="Dừng khẩn cấp toàn bộ tiến trình tự động (Terminate)">
          <span>🛑 Dừng lại</span>
        </button>
        <div class="fmind-divider"></div>
        <label class="fmind-debug-label" id="fmind-debug-label" title="Bật/Tắt chế độ Debug để ghi lại lỗi và kiểm tra DOM">
          <input type="checkbox" id="fmind-debug-mode-toggle" class="fmind-checkbox">
          <span>🐞 Debug</span>
        </label>
        <button type="button" class="fmind-btn-bug-report" id="fmind-btn-bug-report" title="Tải file Bug Report chi tiết dạng JSON">
          <span>📥 Logs (<span id="fmind-bug-count">0</span>)</span>
        </button>
        <button type="button" class="fmind-btn-clear-logs" id="fmind-btn-clear-logs" title="Xóa sạch toàn bộ lịch sử Bug Logs" style="display: none;">
          <span>🧹</span>
        </button>
      </div>
    `;

    document.body.appendChild(widget);

    // Bind event elements
    const fillBtn = widget.querySelector('#fmind-quick-fill-btn');
    const terminateBtn = widget.querySelector('#fmind-btn-terminate');
    const debugToggle = widget.querySelector('#fmind-debug-mode-toggle');
    const bugReportBtn = widget.querySelector('#fmind-btn-bug-report');
    const clearLogsBtn = widget.querySelector('#fmind-btn-clear-logs');
    const modelSelect = widget.querySelector('#fmind-quick-model');
    const personaSelect = widget.querySelector('#fmind-quick-persona');
    const badge = widget.querySelector('#fmind-badge');
    const autoNextCheckbox = widget.querySelector('#fmind-auto-next');
    const formUrlInput = widget.querySelector('#fmind-form-url');

    if (badge) {
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToast('✨ FormMind sẵn sàng! Chọn Model, Persona, bật/tắt Auto Next và Link Form rồi bấm Auto-Fill.', 'info');
      });
    }

    // Load saved preferences from sync and local storage
    getSyncStorage(['defaultPersona', 'selectedModel']).then((syncRes) => {
      chrome.storage.local.get([
        'syncedModelsDev',
        'formmind_auto_next',
        'formmind_form_url',
        'formmind_cooldown_state',
        'formmind_debug_mode',
        'formmind_bug_logs'
      ], (localRes) => {
        if (syncRes && syncRes.defaultPersona && personaSelect) {
          personaSelect.value = syncRes.defaultPersona;
        }
        const activeModel = (syncRes && syncRes.selectedModel) || 'gemini:gemini-3.8-flash';
        populateFloatingModels(modelSelect, localRes ? localRes.syncedModelsDev : null, activeModel);

        // Auto Next: default is OFF (unchecked) per specifications
        if (autoNextCheckbox) {
          autoNextCheckbox.checked = !!(localRes && localRes.formmind_auto_next);
        }

        // Form URL input
        if (formUrlInput && localRes && localRes.formmind_form_url) {
          formUrlInput.value = localRes.formmind_form_url;
        }

        // Check if running or cooldown is currently active
        if (localRes?.isRunning) {
          updateFloatingButtonState(true);
        }
        const cdState = localRes?.formmind_cooldown_state;
        if (cdState && cdState.active && cdState.endTime > Date.now()) {
          renderCooldownBar(cdState.endTime);
        }

        // Initialize Debug Mode & Bug Count (and auto-clean any legacy terminateAutomation entries)
        isDebugModeEnabled = !!(localRes && localRes.formmind_debug_mode);
        const rawLogs = Array.isArray(localRes && localRes.formmind_bug_logs) ? localRes.formmind_bug_logs : [];
        bugLogs = rawLogs.filter(b => b && b.step !== 'terminateAutomation');
        if (bugLogs.length !== rawLogs.length && chrome?.storage?.local) {
          chrome.storage.local.set({ formmind_bug_logs: bugLogs });
        }
        updateBugReportButton();
      });
    });

    // Save Auto Next checkbox changes to chrome.storage.local (Two-way sync)
    if (autoNextCheckbox) {
      autoNextCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ formmind_auto_next: autoNextCheckbox.checked });
      });
    }

    // Save Form URL with debounce and on blur (Two-way sync)
    let urlDebounceTimer = null;
    if (formUrlInput) {
      formUrlInput.addEventListener('input', () => {
        clearTimeout(urlDebounceTimer);
        urlDebounceTimer = setTimeout(() => {
          chrome.storage.local.set({ formmind_form_url: formUrlInput.value.trim() });
        }, 350);
      });
      formUrlInput.addEventListener('blur', () => {
        chrome.storage.local.set({ formmind_form_url: formUrlInput.value.trim() });
      });
    }

    // Save persona on change (mirror to sync and local)
    personaSelect.addEventListener('change', () => {
      chrome.storage.sync.set({ defaultPersona: personaSelect.value });
      chrome.storage.local.set({ defaultPersona: personaSelect.value });
    });

    // Save model on change and sync with Keys tab (mirror to sync and local)
    modelSelect.addEventListener('change', () => {
      const chosen = modelSelect.value;
      if (chosen.includes(':')) {
        const colonIdx = chosen.indexOf(':');
        const p = chosen.substring(0, colonIdx);
        let m = chosen.substring(colonIdx + 1);
        m = m.replace(/^((gemini|openai|anthropic|openrouter|custom):+)+/i, '').trim();
        const payload = {
          selectedModel: `${p}:${m}`,
          [`${p}Model`]: m
        };
        chrome.storage.sync.set(payload);
        chrome.storage.local.set(payload);
      } else {
        const cleanVal = chosen.replace(/^((gemini|openai|anthropic|openrouter|custom):+)+/i, '').trim();
        chrome.storage.sync.set({ selectedModel: cleanVal });
        chrome.storage.local.set({ selectedModel: cleanVal });
      }
    });

    // Real-time two-way synchronization with extension popup and storage changes
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
      if (areaName === 'local') {
        if (changes.defaultPersona && personaSelect) {
          personaSelect.value = changes.defaultPersona.newValue;
        }
        if (changes.isRunning !== undefined) {
          updateFloatingButtonState(!!changes.isRunning.newValue);
        }
        if (changes.syncedModelsDev && modelSelect) {
          populateFloatingModels(modelSelect, changes.syncedModelsDev.newValue, modelSelect.value);
        }
        // Two-way sync: Auto Next checkbox
        if (changes.formmind_auto_next && autoNextCheckbox) {
          autoNextCheckbox.checked = !!changes.formmind_auto_next.newValue;
        }
        // Two-way sync: Form URL input
        if (changes.formmind_form_url && formUrlInput) {
          if (document.activeElement !== formUrlInput) {
            formUrlInput.value = changes.formmind_form_url.newValue || '';
          }
        }
        // Cooldown state updates
        if (changes.formmind_cooldown_state) {
          const state = changes.formmind_cooldown_state.newValue;
          if (state && state.active && state.endTime > Date.now()) {
            renderCooldownBar(state.endTime);
          } else {
            removeCooldownBar();
          }
        }
        // Debug mode & Bug log updates
        if (changes.formmind_debug_mode) {
          isDebugModeEnabled = !!changes.formmind_debug_mode.newValue;
          updateBugReportButton();
        }
        if (changes.formmind_bug_logs) {
          bugLogs = Array.isArray(changes.formmind_bug_logs.newValue) ? changes.formmind_bug_logs.newValue : [];
          updateBugReportButton();
        }
      }
    });

    // Auto-Fill Click handler
    fillBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[FormMind] In-page floating Auto-Fill button clicked!');
      await handleFloatingAutoFill();
    });

    // Terminate Click handler
    if (terminateBtn) {
      terminateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('[FormMind] In-page floating Terminate button clicked!');
        await terminateAutomation();
      });
    }

    // Debug Mode Toggle handler
    if (debugToggle) {
      debugToggle.addEventListener('change', () => {
        isDebugModeEnabled = debugToggle.checked;
        if (chrome?.storage?.local) {
          chrome.storage.local.set({ formmind_debug_mode: isDebugModeEnabled });
        }
        updateBugReportButton();
        showToast(isDebugModeEnabled ? '🐞 Đã BẬT chế độ Debug!' : '🐞 Đã TẮT chế độ Debug.', 'info');
      });
    }

    // Bug Report Download handler
    if (bugReportBtn) {
      bugReportBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        await downloadBugReport();
      });
    }

    // Clear Logs handler
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        bugLogs = [];
        if (chrome?.storage?.local) {
          chrome.storage.local.set({ formmind_bug_logs: [] });
        }
        updateBugReportButton();
        showToast('🧹 Đã xóa sạch danh sách Bug Logs!', 'info');
      });
    }
  }

  /**
   * Helper to check if an element is rendered and visible on screen
   */
  function isElementVisible(el) {
    if (!el) return false;
    // Check inline style or closest hidden container (EXCLUDING aria-hidden which is for accessibility, not visual layout)
    if (el.closest && el.closest('[style*="display: none"], [style*="display:none"], .hidden, [hidden]')) {
      return false;
    }
    if (el.style && (el.style.display === 'none' || el.style.visibility === 'hidden' || el.style.opacity === '0')) {
      return false;
    }
    if (window.getComputedStyle) {
      try {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }
      } catch (e) {}
    }
    // Node.js test environment check
    if (typeof process !== 'undefined') {
      return true;
    }
    return (
      (el.offsetWidth && el.offsetWidth > 0) ||
      (el.offsetHeight && el.offsetHeight > 0) ||
      (typeof el.getClientRects === 'function' && el.getClientRects().length > 0) ||
      el.offsetParent !== null
    );
  }

  /**
   * Kiểm tra xem một phần tử có phải là nút "Quay lại" (Back / Previous) hay không
   */
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

  /**
   * Search for Google Form action button by text
   * Excludes "Xóa hết câu trả lời" and "Quay lại"
   * BẮT BUỘC kiểm tra nút phải đang hiển thị trên màn hình (isElementVisible)
   */
  function findFormButton(buttonText) {
    if (!buttonText) return null;
    const target = buttonText.normalize('NFC').trim().toLowerCase();
    const buttons = document.querySelectorAll('div[role="button"], button');
    for (const btn of buttons) {
      if (btn.closest && btn.closest('#formmind-floating-widget')) continue;
      if (isBackButton(btn)) continue;

      // Loại trừ nút "Xóa hết câu trả lời" và nút "Quay lại"
      const text = (btn.textContent || btn.innerText || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
      if (text.includes('xóa hết') || text.includes('quay lại') || text.includes('clear form') || text.includes('back')) {
        continue;
      }

      if (text === target) {
        const candidate = (btn.closest && btn.closest('div[role="button"], button')) || btn;
        if (!isBackButton(candidate) && isElementVisible(candidate)) {
          return candidate;
        }
      }
    }
    return null;
  }

  /**
   * Detect Next button in Google Forms (multi-page section navigation)
   * TUYỆT ĐỐI chỉ trả về nút khi nút đang hiển thị (visible).
   * Ở trang cuối cùng, Google Forms vẫn giữ nút Tiếp với style="display: none",
   * hàm này phải trả về null để luồng biết đây là trang cuối cùng!
   */
  function findNextButton() {
    const isSubmitText = (txt) => {
      if (!txt) return false;
      const clean = txt.normalize('NFC').trim().toLowerCase();
      const submitKeywords = [
        'gửi', 'submit', 'nộp', 'nộp bài', 'gửi phản hồi', 'gửi biểu mẫu',
        'submit response', 'submit form', 'hoàn tất', 'hoàn thành', 'send', 'finish'
      ];
      return submitKeywords.some(kw => clean === kw || clean.startsWith(kw));
    };

    // 1. Ưu tiên nút trong container hành động .lRwqcd nếu có text "Tiếp" / "Next"
    const lRwqcdBtns = Array.from(document.querySelectorAll('.lRwqcd div[role="button"], .lRwqcd button'));
    for (const btn of lRwqcdBtns) {
      if (btn.closest && btn.closest('#formmind-floating-widget')) continue;
      if (isBackButton(btn)) continue;

      const btnText = (btn.innerText || btn.textContent || (typeof btn.getAttribute === 'function' ? btn.getAttribute('aria-label') : '') || '').normalize('NFC').trim().toLowerCase();
      if (isSubmitText(btnText)) continue; // Nhường cho findSubmitButton

      if (/^(tiếp|next|tiếp tục|tiếp theo)/i.test(btnText) && isElementVisible(btn)) {
        return btn;
      }
    }

    const directBtn = findFormButton('Tiếp') ||
                      findFormButton('Next') ||
                      findFormButton('Tiếp tục') ||
                      findFormButton('Tiếp theo');
    if (directBtn && !isBackButton(directBtn) && isElementVisible(directBtn)) {
      const dText = (directBtn.innerText || directBtn.textContent || '').normalize('NFC').trim().toLowerCase();
      if (!isSubmitText(dText)) {
        return directBtn;
      }
    }

    const jsnameBtn = document.querySelector('div[role="button"][jsname="OCpkoe"], button[jsname="OCpkoe"]');
    if (jsnameBtn && !isBackButton(jsnameBtn) && isElementVisible(jsnameBtn)) {
      const jText = (jsnameBtn.innerText || jsnameBtn.textContent || '').normalize('NFC').trim().toLowerCase();
      if (!isSubmitText(jText)) {
        return jsnameBtn;
      }
    }

    // Quét thêm qua các thẻ span chứa text "Tiếp" hoặc "Next"
    const nextSpans = Array.from(document.querySelectorAll(
      'span.NPEfkd, span.VfPpkd-vQzf8d, div[role="button"] span, button span'
    ));
    const nextWords = ['tiếp', 'next', 'tiếp tục', 'tiếp theo'];

    for (const span of nextSpans) {
      if (span.closest && span.closest('#formmind-floating-widget')) continue;
      if (isBackButton(span)) continue;

      const text = (span.textContent || span.innerText || '').normalize('NFC').trim().toLowerCase();
      if (!text || isBackButton(span) || isSubmitText(text)) continue;

      if (nextWords.includes(text) || nextWords.some(w => text.startsWith(w))) {
        const parentBtn = (span.closest && span.closest('div[role="button"], button')) || span;
        if (isBackButton(parentBtn)) continue;

        const fullBtnText = (parentBtn.textContent || parentBtn.innerText || '').normalize('NFC').toLowerCase();
        if (isBackButton(parentBtn) || isSubmitText(fullBtnText)) continue;

        if (isElementVisible(parentBtn)) {
          return parentBtn;
        }
      }
    }

    return null;
  }

  /**
   * Detect Submit button in Google Forms
   * BẮT BUỘC kiểm tra nút phải đang hiển thị trên màn hình (isElementVisible)
   * Tuyệt đối lọc bỏ nút Quay lại (Back)
   */
  function findSubmitButton() {
    const submitKeywords = [
      'gửi', 'submit', 'nộp', 'nộp bài', 'gửi phản hồi', 'gửi biểu mẫu',
      'submit response', 'submit form', 'hoàn tất', 'hoàn thành', 'send', 'finish'
    ];

    const isConfirmText = (txt) => /(câu trả lời|đã được ghi lại|response has been recorded|đã gửi|thank you|cảm ơn|đã nộp|bạn đã phản hồi)/i.test(txt);

    const isSubmitText = (text) => {
      if (!text) return false;
      const clean = text.normalize('NFC').trim().toLowerCase();
      if (isConfirmText(clean)) return false;
      return submitKeywords.some(kw => clean === kw || clean.startsWith(kw));
    };

    // 1. ƯU TIÊN SỐ 1: Nút nằm trong container hành động chuyển tiếp/gửi (.lRwqcd)
    // Đây là vị trí chuẩn 100% của Google Forms cho nút Tiếp hoặc Gửi
    const lRwqcdBtns = Array.from(document.querySelectorAll('.lRwqcd div[role="button"], .lRwqcd button'));
    for (const btn of lRwqcdBtns) {
      if (btn.closest && btn.closest('#formmind-floating-widget')) continue;
      if (isBackButton(btn)) continue; // TUYỆT ĐỐI BỎ QUA NẾU LÀ NÚT QUAY LẠI

      const btnText = (btn.innerText || btn.textContent || (typeof btn.getAttribute === 'function' ? btn.getAttribute('aria-label') : '') || '').normalize('NFC').trim().toLowerCase();
      if (isSubmitText(btnText)) {
        const parentBtn = (btn.closest && btn.closest('div[role="button"], button')) || btn;
        if (!isBackButton(parentBtn) && isElementVisible(parentBtn)) {
          return parentBtn;
        }
      }
    }

    // 2. Quét tất cả các thẻ span hiển thị chữ "Gửi" / "Submit"
    const candidateSpans = Array.from(document.querySelectorAll(
      'span.NPEfkd, span.VfPpkd-vQzf8d, div[role="button"] span, button span'
    ));
    for (const span of candidateSpans) {
      if (span.closest && span.closest('#formmind-floating-widget')) continue;
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
      const buttons = Array.from(document.querySelectorAll(`div[role="button"][jsname="${jsn}"], button[jsname="${jsn}"]`));
      for (const btn of buttons) {
        if (btn.closest && btn.closest('#formmind-floating-widget')) continue;
        if (isBackButton(btn)) continue; // Bỏ qua ngay lập tức

        const fullText = (btn.textContent || btn.innerText || '').normalize('NFC').trim().toLowerCase();
        if (isSubmitText(fullText)) {
          const parentBtn = (btn.closest && btn.closest('div[role="button"], button')) || btn;
          if (!isBackButton(parentBtn) && isElementVisible(parentBtn)) {
            return parentBtn;
          }
        }
      }
    }

    // 4. Cứu cánh ở trang cuối cùng: Nếu không còn nút Tiếp (.lRwqcd không có chữ Tiếp)
    // Lấy nút duy nhất trong .lRwqcd mà không phải nút Quay lại
    for (const btn of lRwqcdBtns) {
      if (btn.closest && btn.closest('#formmind-floating-widget')) continue;
      if (isBackButton(btn)) continue;
      const parentBtn = (btn.closest && btn.closest('div[role="button"], button')) || btn;
      if (isBackButton(parentBtn)) continue;
      const isBtn = parentBtn.tagName === 'BUTTON' || (typeof parentBtn.getAttribute === 'function' && parentBtn.getAttribute('role') === 'button');
      const text = (parentBtn.innerText || parentBtn.textContent || '').normalize('NFC').trim().toLowerCase();
      if (isBtn && !isConfirmText(text) && text.length <= 30 && isElementVisible(parentBtn)) {
        return parentBtn;
      }
    }

    return null;
  }

  /**
   * Dispatches complete user-like click event sequence to ensure Google Forms registers the submission
   */
  async function clickSubmitButton(submitBtn) {
    if (!submitBtn) return false;
    if (typeof isAborted !== 'undefined' && isAborted) return false;

    // CHỐT CHẶN AN TOÀN: Nếu lỡ nhận nhầm nút Quay lại, từ chối click ngay lập tức!
    if (isBackButton(submitBtn)) {
      console.error('[FormMind CRITICAL] Phát hiện nút bấm là nút Quay lại! Từ chối click và tìm lại nút Gửi...');
      const realSubmitBtn = document.querySelector('.lRwqcd div[role="button"], .lRwqcd button');
      if (realSubmitBtn && !isBackButton(realSubmitBtn)) {
        submitBtn = realSubmitBtn;
      } else {
        showToast('⚠️ Không thể gửi form vì phát hiện nhầm nút Quay lại.', 'error');
        return false;
      }
    }

    // 1. Cuộn màn hình tới vị trí nút
    submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 2. Đặt độ trễ ngắn khoảng 500ms – 800ms để form hoàn tất render và validate dữ liệu
    const delayFn = typeof safeSetTimeout === 'function' ? safeSetTimeout : setTimeout;
    await new Promise(r => delayFn(r, 650));
    if (typeof isAborted !== 'undefined' && isAborted) return false;

    if (typeof submitBtn.focus === 'function') {
      try { submitBtn.focus(); } catch (e) {}
    }

    // 3. Dispatch pointer events
    try {
      submitBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window, isPrimary: true, button: 0, buttons: 1 }));
    } catch (e) {}

    // 4. Dispatch full mouse event sequence
    submitBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
    submitBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));

    try {
      submitBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window, isPrimary: true, button: 0 }));
    } catch (e) {}

    submitBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
    submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));

    // 5. Kích hoạt direct .click()
    try {
      submitBtn.click();
    } catch (e) {
      console.warn('[FormMind] submitBtn.click() error:', e);
    }

    // 6. Click thẻ span con bên trong nếu có (Google Forms closure span / Material span)
    const childClickable = submitBtn.querySelector('span.NPEfkd, span.VfPpkd-vQzf8d, span.RveJvd, span.snByac, span, div.uArJ5e');
    if (childClickable && childClickable !== submitBtn) {
      try {
        childClickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
        childClickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
        childClickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
        childClickable.click();
      } catch (e) {}
    }

    return true;
  }

  /**
   * Wait for Google Forms page transition to complete after clicking Next
   */
  function waitForPageTransition(previousQuestionTitles, maxWaitMs = 7000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const prevSet = new Set((previousQuestionTitles || []).map(t => t.toLowerCase().trim()));

      const interval = setInterval(() => {
        if (typeof isAborted !== 'undefined' && isAborted) {
          clearInterval(interval);
          resolve({ success: false, aborted: true });
          return;
        }

        // Check if required field validation blocked the navigation
        // NOTE: Google Forms uses .RHiN0e for required asterisks (*). Do NOT match asterisks!
        // Real validation error messages must have role="alert" or .o69ahc and have actual error text > 1 char.
        const errorAlerts = Array.from(document.querySelectorAll('[role="alert"], .o69ahc, div.y7daIf'));
        const realErrorAlert = errorAlerts.find(el => {
          if (!isElementVisible(el)) return false;
          const text = (el.innerText || el.textContent || '').trim();
          if (!text || text === '*' || text.length < 2) return false;
          // Must match validation wording (e.g. "Đây là một câu hỏi bắt buộc", "This is a required question", "Chọn tối đa...")
          return /(bắt buộc|required|không hợp lệ|invalid|hãy chọn|chọn ít nhất|chọn tối đa|nhập lại|must|at least|at most)/i.test(text);
        });

        if (realErrorAlert) {
          clearInterval(interval);
          resolve({
            success: false,
            error: realErrorAlert.innerText.trim() || 'Một số câu hỏi bắt buộc chưa được điền.'
          });
          return;
        }

        const currentQuestions = scanGoogleForm();
        const hasNewQuestions = currentQuestions.length > 0 && (prevSet.size === 0 || currentQuestions.some(q => !prevSet.has(q.title.toLowerCase().trim())));
        const submitBtn = findSubmitButton();
        const nextBtn = findNextButton();
        const isOnlySubmit = submitBtn && !nextBtn;

        if (hasNewQuestions || (currentQuestions.length > 0 && isOnlySubmit) || (prevSet.size > 0 && currentQuestions.length === 0 && (nextBtn || submitBtn))) {
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
   * Polls until form submission is completed or URL redirects to formResponse
   */
  function waitForSubmissionConfirmation(maxWaitMs = 7000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (typeof isAborted !== 'undefined' && isAborted) {
          clearInterval(checkInterval);
          resolve(false);
          return;
        }
        if (isFormCompleted() || Date.now() - startTime >= maxWaitMs) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 300);
    });
  }

  /**
   * Handle section navigation between multi-page forms.
   * ONLY advances to next page; NEVER triggers Cooldown or timer!
   */
  async function handlePageNavigation({
    nextBtn,
    pageNumber,
    totalFilledAcrossAllPages,
    questions,
    onProgress,
    selectedPersona,
    chosenModel,
    chosenProvider,
    apiKey,
    customPersonaPrompt,
    autoAdvance
  }) {
    if (!nextBtn) return { success: false, error: 'Không tìm thấy nút Next/Tiếp.' };
    if (isBackButton(nextBtn)) {
      console.error('[FormMind CRITICAL] Nút chuyển trang bị nhận diện nhầm là nút Quay lại! Hủy thao tác chuyển trang.');
      return { success: false, error: 'Phát hiện nhầm nút Quay lại.' };
    }

    const previousTitles = (questions || []).map(q => q.title);
    const navMsg = (questions && questions.length > 0)
      ? `📄 Trang ${pageNumber} hoàn tất! Tự động chuyển sang trang ${pageNumber + 1}...`
      : `📖 Trang ${pageNumber} (giới thiệu) hoàn tất! Tự động chuyển sang trang ${pageNumber + 1}...`;
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

    // Persist active session before advancing so if Google Forms reloads or navigates, next page continues automatically
    try {
      if (chrome?.storage?.local) {
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
      }
    } catch (e) {
      console.warn('[FormMind] Error saving active session before navigation:', e);
    }

    // Scroll and click Next
    nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(r => setTimeout(r, 600)); // short realistic pause before click
    nextBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    nextBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    nextBtn.click();

    // Click inner span (Google Forms closure span / Material span) if present
    const childClickable = nextBtn.querySelector('span.NPEfkd, span.VfPpkd-vQzf8d, span.RveJvd, span.snByac, span, div.uArJ5e');
    if (childClickable && childClickable !== nextBtn) {
      try {
        childClickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
        childClickable.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0 }));
        childClickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0 }));
        childClickable.click();
      } catch (e) {}
    }

    // Wait for page transition (for SPA forms)
    const transition = await waitForPageTransition(previousTitles);
    return transition;
  }

  /**
   * Handle form submission on the final page, and ONLY triggers Cooldown AFTER submit / confirmation!
   */
  async function handleFormSubmission({
    submitBtn,
    pageNumber,
    totalFilledAcrossAllPages,
    autoAdvance = true,
    onProgress
  }) {
    if (isAborted) return { success: false, stopped: true, count: totalFilledAcrossAllPages, totalPages: pageNumber };

    // 1. Remove active multi-page session since form filling is complete
    try {
      if (chrome?.storage?.local) {
        await chrome.storage.local.remove('formmind_active_session');
      }
    } catch (e) {}

    const finishMsg = pageNumber > 1
      ? `✨ Đã tự động điền xong ${pageNumber} trang (${totalFilledAcrossAllPages} câu)!`
      : `✨ Đã tự động điền ${totalFilledAcrossAllPages} câu hỏi!`;

    showToast(finishMsg, 'success');
    if (onProgress) {
      onProgress({
        status: 'completed',
        page: pageNumber,
        totalFilled: totalFilledAcrossAllPages,
        message: finishMsg
      });
    }

    // 2. Read Cooldown configuration
    let cdConfig = null;
    try {
      const cdData = await new Promise(r => chrome.storage.local.get(['formmind_cooldown_config'], r));
      cdConfig = cdData?.formmind_cooldown_config;
    } catch (e) {
      console.warn('[FormMind] Error reading cooldown config:', e);
    }

    // 3. Ensure submit button is located (re-query if null or newly rendered)
    if (!submitBtn) {
      submitBtn = findSubmitButton();
      if (!submitBtn) {
        for (let i = 0; i < 5; i++) {
          if (isAborted) break;
          await new Promise(r => safeSetTimeout(r, 300));
          submitBtn = findSubmitButton();
          if (submitBtn) break;
        }
      }
    }

    if (isAborted) return { success: false, stopped: true, count: totalFilledAcrossAllPages, totalPages: pageNumber };

    // 4. ACTION: Tự động click nút Gửi ngay lập tức sau khi hoàn tất các trường dữ liệu trên trang cuối!
    if (submitBtn) {
      console.log('[FormMind] Submit button found on final page. Automatically clicking Submit...');
      showToast('🚀 Đang gửi form (Submit)...', 'info');
      await clickSubmitButton(submitBtn);

      // GATEKEEPER: ONLY start cooldown AFTER submission is confirmed!
      // NEVER start cooldown on this question page while submit button is present!
      if (cdConfig && cdConfig.enabled && !isAborted) {
        watchForSubmissionConfirmationAndStartCooldown(cdConfig);
      }
    } else if (isFormCompleted()) {
      // Already on the completion/confirmation page!
      if (cdConfig && cdConfig.enabled && !isAborted) {
        chrome.storage.local.set({ formmind_retry_count: 0 });
        startCooldown(cdConfig);
      }
    } else {
      console.warn('[FormMind] Submit button not found and form not completed.');
      if (isDebugModeEnabled && !isAborted) {
        recordBugEntry({
          step: 'handleFormSubmission:missing_submit_button',
          errorMessage: 'Không tìm thấy nút Gửi (Submit) trên trang cuối cùng',
          domState: captureDomState()
        });
      }
    }

    return { success: true, count: totalFilledAcrossAllPages, totalPages: pageNumber };
  }

  /**
   * Process a single page of the form:
   * Handles both:
   * - Case A: Page HAS questions -> generates AI answers, applies rules, fills form, then checks Next/Submit.
   * - Case B: Page has NO questions (Intro / Cover / Description page) -> checks Next/Submit:
   *     If Next button found and autoAdvance=true: waits 0.5s - 1s (delay simulating skimming) and clicks Next.
   *     If Next button found and autoAdvance=false: notifies user to click Next manually.
   *     If Submit button found: delegates to handleFormSubmission.
   */
  async function processCurrentPage({
    pageNumber,
    totalFilledAcrossAllPages,
    selectedPersona,
    chosenModel,
    chosenProvider,
    apiKey,
    customPersonaPrompt,
    autoAdvance = true,
    sessionProfile = {},
    onProgress
  }) {
    if (isAborted) return { action: 'stopped', count: totalFilledAcrossAllPages, totalPages: pageNumber };

    // 1. Wait for questions or navigation buttons on page
    await waitForQuestionsOnPage(4000);
    if (isAborted) return { action: 'stopped', count: totalFilledAcrossAllPages, totalPages: pageNumber };

    const questions = scanGoogleForm();
    const nextBtn = findNextButton();
    const submitBtn = findSubmitButton();

    // =========================================================================
    // TRƯỜNG HỢP B: KHÔNG CÓ CÂU HỎI NÀO (Trang bìa, mô tả, giới thiệu)
    // =========================================================================
    if (questions.length === 0) {
      // Trường hợp A - Trang bìa / Trang giới thiệu (0 câu hỏi, nhưng có nút "Tiếp"):
      // Không được báo hoàn thành. Nếu Auto Next = true: Chờ 1s rồi tự động click vào nút "Tiếp"
      if (nextBtn && !isBackButton(nextBtn)) {
        if (!autoAdvance) {
          showToast(`📖 Trang ${pageNumber} là trang mô tả / giới thiệu. Vui lòng bấm "Tiếp" để tiếp tục.`, 'info');
          return { action: 'stopped', count: totalFilledAcrossAllPages, totalPages: pageNumber };
        }

        console.log(`[FormMind] Trang ${pageNumber} là trang mô tả (0 câu hỏi). Chờ 1 giây rồi click nút Tiếp...`);
        const introMsg = `📖 Trang ${pageNumber} là trang mô tả (0 câu hỏi). Chờ 1s rồi chuyển trang...`;
        showToast(introMsg, 'info');
        if (onProgress) {
          onProgress({
            status: 'navigating',
            page: pageNumber,
            nextPage: pageNumber + 1,
            totalFilled: totalFilledAcrossAllPages,
            message: introMsg
          });
        }

        // Chờ 1 giây (mô phỏng độ trễ người dùng)
        await new Promise(r => safeSetTimeout(r, 1000));
        if (isAborted) return { action: 'stopped', count: totalFilledAcrossAllPages, totalPages: pageNumber };

        // Kích hoạt click nút Tiếp
        nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nextBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
        nextBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        nextBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        nextBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        try {
          nextBtn.click();
        } catch (e) {
          console.warn('[FormMind] Error calling nextBtn.click():', e);
        }

        // Đợi trang tiếp theo nạp xong mới tiếp tục quy trình
        const transition = await waitForPageTransition([]);
        if (isAborted) return { action: 'stopped', count: totalFilledAcrossAllPages, totalPages: pageNumber };
        if (!transition.success) {
          console.warn('[FormMind] Warning on page transition:', transition.error);
        }

        return { action: 'next', newFilledCount: 0 };
      }

      // B.2. Không có nút Tiếp, nhưng có nút Gửi (Submit)
      if (submitBtn) {
        if (isAborted) return { action: 'stopped', count: totalFilledAcrossAllPages, totalPages: pageNumber };
        const subResult = await handleFormSubmission({
          submitBtn,
          pageNumber,
          totalFilledAcrossAllPages,
          autoAdvance,
          onProgress
        });
        return { action: 'completed', count: subResult.count, totalPages: pageNumber };
      }

      // B.2.5. Nếu trang hiện tại là màn hình xác nhận đã hoàn tất form
      if (typeof isFormCompleted === 'function' && isFormCompleted()) {
        chrome.storage.local.remove('formmind_active_session');
        const compMsg = `✨ Form đã được nộp hoàn tất!`;
        if (onProgress) onProgress({ status: 'completed', page: pageNumber, totalFilled: totalFilledAcrossAllPages, message: compMsg });
        return { action: 'completed', count: totalFilledAcrossAllPages, totalPages: pageNumber };
      }

      // B.3. Hoàn toàn không tìm thấy câu hỏi hoặc nút điều hướng
      chrome.storage.local.remove('formmind_active_session');
      const noQMsg = `Không tìm thấy câu hỏi hoặc nút chuyển trang ở trang ${pageNumber}.`;
      showToast(noQMsg, 'error');
      if (isDebugModeEnabled) {
        recordBugEntry({
          step: 'processCurrentPage:no_elements_found',
          errorMessage: noQMsg,
          domState: captureDomState()
        });
      }
      if (onProgress) onProgress({ status: 'error', error: noQMsg, message: noQMsg });
      return { action: 'error', error: noQMsg };
    }

    // =========================================================================
    // TRƯỜNG HỢP A: CÓ CÂU HỎI TRÊN TRANG -> Điền câu hỏi theo cấu hình
    // =========================================================================
    const progressMsg = `Đang tạo câu trả lời cho trang ${pageNumber} (${questions.length} câu)...`;
    try {
      if (chrome?.storage?.local) {
        const res = await new Promise(r => chrome.storage.local.get(['formmind_active_session'], r));
        if (res?.formmind_active_session?.inProgress) {
          await new Promise(r => {
            chrome.storage.local.set({
              formmind_active_session: {
                ...res.formmind_active_session,
                statusMessage: progressMsg,
                pageNumber: pageNumber,
                totalFilled: totalFilledAcrossAllPages,
                lastUpdated: Date.now()
              }
            }, r);
          });
        }
      }
    } catch (e) {}

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
      if (detectHighDemandError(msg)) {
        await handleHighDemandRetry(msg);
        return { action: 'error', error: msg };
      }
      if (msg.includes('message port closed') || msg.includes('Extension context invalidated')) {
        msg = 'Kết nối tới tiện ích bị gián đoạn (do vừa reload extension). Vui lòng nhấn F5 tải lại trang Google Form.';
      }
      const errMsg = `Lỗi AI ở trang ${pageNumber}: ${msg}`;
      showToast(errMsg, 'error');
      if (onProgress) onProgress({ status: 'error', error: msg, message: errMsg });
      return { action: 'error', error: msg };
    }

    // 3. Apply Personal Profile Recognition, Weighted Random Rules & Text Question Rules (take priority over AI answers)
    try {
      const rulesData = await new Promise(r => chrome.storage.local.get([
        'formmind_weighted_rules',
        'formmind_text_rules',
        'formmind_text_global_default',
        'formmind_profile_config'
      ], r));

      const weightedRules = rulesData?.formmind_weighted_rules || [];
      const textRules = rulesData?.formmind_text_rules || [];
      const textGlobalDefault = rulesData?.formmind_text_global_default || null;
      const profileConfig = rulesData?.formmind_profile_config || { mode: 'skip' };

      // Cache for Other option resolution
      cachedTextRules = textRules;
      cachedTextGlobalDefault = textGlobalDefault;

      if (!Array.isArray(aiResult)) aiResult = [];

      questions.forEach((q, idx) => {
        // A. Check Personal Profile recognition (for text/textarea questions)
        if (q.type === 'text' || q.type === 'textarea') {
          const profileField = identifyProfileFieldType(q.title, q.description);
          if (profileField) {
            const profileVal = resolveProfileFieldValue(profileField, profileConfig, sessionProfile);
            if (profileVal !== null && profileVal !== undefined) {
              console.log(`[FormMind Profile] Matched field "${profileField}" for Q#${q.id} ("${q.title}") -> Value:`, profileVal);
              const existing = aiResult.find(a => a.id === q.id);
              if (existing) {
                existing.value = profileVal;
              } else {
                aiResult.push({ id: q.id, value: profileVal });
              }
              return; // Handled by personal profile!
            }
          }

          // B. If not a profile field, check Text/Textarea question rules
          const textRuleRes = evaluateTextRule(q, idx, textRules, textGlobalDefault);
          if (textRuleRes) {
            console.log(`[FormMind Text Rule] Matched for Q#${q.id} ("${q.title}") -> Action:`, textRuleRes);
            const finalVal = textRuleRes.action === 'skip' ? '__FORMMIND_SKIP__' : textRuleRes.value;
            const existing = aiResult.find(a => a.id === q.id);
            if (existing) {
              existing.value = finalVal;
            } else {
              aiResult.push({ id: q.id, value: finalVal });
            }
            return;
          }
        }

        // C. Check Multiple Choice weighted rules
        // CHỈ ÁP DỤNG WEIGHTED RULES KHI PERSONA ĐANG LÀ 'random'
        if (selectedPersona === 'random' && weightedRules.length > 0) {
          const weightedVal = evaluateWeightedRule(q, idx, weightedRules);
          if (weightedVal !== null && weightedVal !== undefined) {
            console.log(`[FormMind Weighted Random] Matched rule for Q#${q.id} ("${q.title}") -> Selected:`, weightedVal);
            const existing = aiResult.find(a => a.id === q.id);
            if (existing) {
              existing.value = weightedVal;
            } else {
              aiResult.push({ id: q.id, value: weightedVal });
            }
          }
        }
      });
    } catch (ruleErr) {
      console.warn('[FormMind] Error applying weighted/text/profile rules:', ruleErr);
    }

    // Apply answers to DOM with constraint guarantees
    const fillResult = await applyAnswersToForm(aiResult);
    const newFilledCount = fillResult.count;
    const currentTotalFilled = totalFilledAcrossAllPages + newFilledCount;

    const filledMsg = `Trang ${pageNumber} đã điền (${newFilledCount}/${questions.length} câu)!`;

    // 4. Kiểm tra nút chuyển trang (Next) hoặc nút nộp (Submit)
    const pageNextBtn = findNextButton();
    const pageSubmitBtn = findSubmitButton();

    // CHỈ CẬP NHẬT active session nếu còn trang tiếp theo (có nút Next).
    // Nếu đây là trang cuối chuẩn bị nộp bài (không có nút Next), KHÔNG ghi lại active session để tránh race condition khi submit!
    if (pageNextBtn) {
      try {
        if (chrome?.storage?.local) {
          const res = await new Promise(r => chrome.storage.local.get(['formmind_active_session'], r));
          if (res?.formmind_active_session?.inProgress) {
            await new Promise(r => {
              chrome.storage.local.set({
                formmind_active_session: {
                  ...res.formmind_active_session,
                  statusMessage: filledMsg,
                  pageNumber: pageNumber,
                  totalFilled: currentTotalFilled,
                  lastUpdated: Date.now()
                }
              }, r);
            });
          }
        }
      } catch (e) {}
    }

    if (onProgress) {
      onProgress({
        status: 'filled',
        page: pageNumber,
        filledCount: newFilledCount,
        totalFilled: currentTotalFilled,
        message: filledMsg
      });
    }

    if (pageNextBtn) {
      if (!autoAdvance) {
        // Auto Next TẮT: Dừng lại ở trang này, không tự chuyển, không bật Cooldown
        chrome.storage.local.remove('formmind_active_session');
        const finishMsg = pageNumber > 1
          ? `✨ Đã tự động điền xong trang ${pageNumber} (${currentTotalFilled} câu)! Bấm Tiếp để sang trang sau.`
          : `✨ Đã tự động điền trang 1 (${currentTotalFilled}/${questions.length} câu)! Bấm Tiếp để sang trang sau.`;

        showToast(finishMsg, 'success');
        if (onProgress) onProgress({ status: 'completed', page: pageNumber, totalFilled: currentTotalFilled, message: finishMsg });
        return { action: 'stopped', count: currentTotalFilled, totalPages: pageNumber };
      }

      // Auto Next BẬT: sử dụng handlePageNavigation để chuyển sang trang sau (KHÔNG BAO GIỜ bật Cooldown)
      const navResult = await handlePageNavigation({
        nextBtn: pageNextBtn,
        pageNumber,
        totalFilledAcrossAllPages: currentTotalFilled,
        questions,
        onProgress,
        selectedPersona,
        chosenModel,
        chosenProvider,
        apiKey,
        customPersonaPrompt,
        autoAdvance
      });

      if (!navResult.success) {
        if (navResult.aborted || (typeof isAborted !== 'undefined' && isAborted)) {
          return { action: 'stopped', count: currentTotalFilled, totalPages: pageNumber };
        }
        chrome.storage.local.remove('formmind_active_session');
        const errMsg = navResult.error || 'Chuyển trang bị chặn do câu hỏi bắt buộc.';
        showToast(`⚠️ ${errMsg}`, 'error');
        if (isDebugModeEnabled && !isAborted) {
          recordBugEntry({
            step: 'processCurrentPage:navigation_blocked',
            errorMessage: errMsg,
            domState: captureDomState()
          });
        }
        if (onProgress) onProgress({ status: 'error', error: errMsg, message: errMsg });
        return { action: 'error', error: errMsg };
      }

      return { action: 'next', newFilledCount };
    }

    // Không có nút Tiếp -> Đây là trang cuối cùng! Xử lý nộp form và kích hoạt Cooldown
    if (isAborted) return { action: 'stopped', count: currentTotalFilled, totalPages: pageNumber };
    const subResult = await handleFormSubmission({
      submitBtn: pageSubmitBtn,
      pageNumber,
      totalFilledAcrossAllPages: currentTotalFilled,
      autoAdvance,
      onProgress
    });
    return { action: 'completed', count: subResult.count, totalPages: pageNumber };
  }

  /**
   * Multi-Page Form Filling Engine:
   * Loops through pages calling processCurrentPage(), advancing when Next is clicked,
   * until completion or maximum pages reached.
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
    const sessionProfile = {};
    const maxPages = 20;

    while (pageNumber <= maxPages) {
      if (isAborted) {
        console.log('[FormMind] runMultiPageAutoFill stopped (aborted).');
        return { success: false, stopped: true, count: totalFilledAcrossAllPages, totalPages: pageNumber };
      }

      const pageResult = await processCurrentPage({
        pageNumber,
        totalFilledAcrossAllPages,
        selectedPersona,
        chosenModel,
        chosenProvider,
        apiKey,
        customPersonaPrompt,
        autoAdvance,
        sessionProfile,
        onProgress
      });

      if (isAborted) {
        console.log('[FormMind] runMultiPageAutoFill stopped after processCurrentPage (aborted).');
        return { success: false, stopped: true, count: totalFilledAcrossAllPages, totalPages: pageNumber };
      }

      if (pageResult.action === 'next') {
        totalFilledAcrossAllPages += (pageResult.newFilledCount || 0);
        pageNumber++;
        continue;
      }

      if (pageResult.action === 'completed' || pageResult.action === 'stopped') {
        return { success: true, count: pageResult.count, totalPages: pageResult.totalPages };
      }

      if (pageResult.action === 'error') {
        return { success: false, error: pageResult.error };
      }

      break;
    }

    chrome.storage.local.remove('formmind_active_session');
    return { success: true, count: totalFilledAcrossAllPages, totalPages: pageNumber };
  }

  /**
   * Safe helper to read from chrome.storage (merges local and sync) with Promise
   */
  function getSyncStorage(keys) {
    return new Promise((resolve) => {
      try {
        let localData = {};
        let syncData = {};
        const onGotLocal = (lRes) => {
          localData = lRes || {};
          if (chrome?.storage?.sync) {
            chrome.storage.sync.get(keys, (sRes) => {
              syncData = sRes || {};
              resolve({ ...syncData, ...localData });
            });
          } else {
            resolve(localData);
          }
        };

        if (chrome?.storage?.local) {
          chrome.storage.local.get(keys, onGotLocal);
        } else if (chrome?.storage?.sync) {
          chrome.storage.sync.get(keys, (sRes) => {
            resolve(sRes || {});
          });
        } else {
          resolve({});
        }
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
   * Helper to update Floating Button appearance according to isRunning state
   */
  function updateFloatingButtonState(isRunning) {
    const fillBtn = document.getElementById('fmind-quick-fill-btn');
    if (!fillBtn) return;
    if (isRunning) {
      fillBtn.classList.remove('loading');
      fillBtn.classList.add('fmind-btn-running');
      fillBtn.title = 'Bấm để dừng tiến trình tự động';
      fillBtn.innerHTML = '<span>⏹️ Dừng lại</span>';
    } else {
      fillBtn.classList.remove('loading', 'fmind-btn-running');
      fillBtn.title = 'Bấm để tự động điền form ngay lập tức';
      fillBtn.innerHTML = '<span>⚡ Auto-Fill</span>';
    }
  }

  let isWorkflowRunning = false;

  /**
   * Main orchestration workflow for filling Google Forms
   * Tái lập theo đúng 3 bước ưu tiên:
   * BƯỚC 1: Kiểm tra kết thúc form (isFormCompleted) -> Chạy Cooldown UI + Countdown, kết thúc thì chuyển về targetFormUrl
   * BƯỚC 2: Kiểm tra lỗi quá tải (High Demand / Rate Limit) -> Thử lại tối đa 3 lần (mỗi lần 5s), quá 3 lần dừng tiến trình
   * BƯỚC 3: Xử lý trang hiện tại (Điền câu hỏi, xử lý trang bìa, hoặc chuyển tiếp/nộp form)
   */
  async function handleMainWorkflow() {
    console.log('[FormMind] handleMainWorkflow initiated.');

    // Concurrency lock to prevent duplicate concurrent runs
    if (isWorkflowRunning) {
      console.log('[FormMind] handleMainWorkflow already in progress, skipping duplicate call.');
      return;
    }
    isWorkflowRunning = true;
    isAborted = false;

    try {
      // =======================================================================
      // BƯỚC 1: KIỂM TRA KẾT THÚC FORM (ĐIỀU KIỆN DUY NHẤT Ở MỤC 2)
      // =======================================================================
      if (isFormCompleted()) {
        console.log('[FormMind] Form is completed (formResponse URL or confirmation DOM). Starting Cooldown...');
        const cdData = await new Promise(r => chrome.storage.local.get(['formmind_cooldown_config'], r));
        const cdConfig = cdData?.formmind_cooldown_config;
        if (cdConfig && cdConfig.enabled && !isAborted) {
          await chrome.storage.local.set({ retryCount: 0, formmind_retry_count: 0 });
          await startCooldown(cdConfig);
        } else {
          showToast('✅ Đã nộp form thành công!', 'success');
          updateFloatingButtonState(false);
          await chrome.storage.local.set({ isRunning: false });
        }
        return;
      }

      // =======================================================================
      // BƯỚC 2: KIỂM TRA LỖI QUÁ TẢI / RATE LIMIT (HIGH DEMAND)
      // =======================================================================
      if (detectHighDemandError()) {
        console.warn('[FormMind] High demand detected in page at handleMainWorkflow start!');
        if (isDebugModeEnabled) {
          recordBugEntry({
            step: 'handleMainWorkflow:high_demand_start',
            errorMessage: 'Phát hiện lỗi Google Forms quá tải khi bắt đầu handleMainWorkflow',
            domState: captureDomState()
          });
        }
        await handleHighDemandRetry('DOM on load');
        return;
      }
      // Nếu không có lỗi và form chạy bình thường: Reset retryCount = 0
      await chrome.storage.local.set({ retryCount: 0, formmind_retry_count: 0 });

      // Lưu URL hiện tại của form nếu chưa có hoặc nếu đang ở trang form hợp lệ (không phải /formResponse)
      const currentHref = window.location.href || '';
      if (currentHref && !currentHref.includes('/formResponse')) {
        chrome.storage.local.set({ formmind_form_url: currentHref });
      }

      // =======================================================================
      // BƯỚC 3: XỬ LÝ TRANG HIỆN TẠI (ĐIỀN HOẶC CHUYỂN TIẾP)
      // =======================================================================
      await chrome.storage.local.set({ isRunning: true });
      updateFloatingButtonState(true);

      const fillBtn = document.getElementById('fmind-quick-fill-btn');
      const personaSelect = document.getElementById('fmind-quick-persona');
      const modelSelect = document.getElementById('fmind-quick-model');

      // 4. Retrieve saved preferences
      const settings = await getSyncStorage([
        'provider',
        'geminiKey',
        'groqKey',
        'huggingfaceKey',
        'openaiKey',
        'anthropicKey',
        'openrouterKey',
        'selectedModel',
        'defaultPersona',
        'customPersonaPrompt',
        'autoAdvancePages',
        'customProvider',
        'customModelName'
      ]);

      const localData = await new Promise(r => chrome.storage.local.get([
        'formmind_auto_next',
        'defaultPersona',
        'selectedModel'
      ], r));

      const selectedPersona = (personaSelect && personaSelect.value) || localData?.defaultPersona || settings.defaultPersona || 'positive';
      const quickModelVal = (modelSelect && modelSelect.value) || localData?.selectedModel || settings.selectedModel || 'gemini:gemini-3.8-flash';

      let chosenModelVal = quickModelVal;
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
        const availableProvider = Object.keys(apiKeyMap).find(p => apiKeyMap[p] && apiKeyMap[p].trim());
        if (availableProvider) {
          chosenProvider = availableProvider;
          apiKey = apiKeyMap[availableProvider].trim();
          chosenModel = getDefaultModelForProvider(chosenProvider);
          showToast(`💡 Đang dùng ${chosenProvider.toUpperCase()} (${chosenModel}) vì model này đã có API key.`, 'info');
        } else {
          await terminateAutomation();
          showToast('⚠️ Vui lòng mở extension FormMind (ở thanh công cụ) để lưu API key trước!', 'error');
          return;
        }
      }

      // Auto Advance setting (default: true for continuous multi-page automation)
      const autoAdvance = localData?.formmind_auto_next !== undefined ? !!localData.formmind_auto_next : true;

      // 5. Run the Multi-page filling engine
      await runMultiPageAutoFill({
        selectedPersona,
        chosenModel,
        chosenProvider,
        apiKey,
        customPersonaPrompt: settings.customPersonaPrompt || '',
        autoAdvance: autoAdvance,
        onProgress: (p) => {
          if (!fillBtn) return;
          if (p.status === 'thinking') {
            fillBtn.innerHTML = `<span>⏳ Trang ${p.page}...</span>`;
          } else if (p.status === 'navigating') {
            fillBtn.innerHTML = `<span>➡️ Sang trang ${p.nextPage}...</span>`;
          } else if (p.status === 'filled') {
            fillBtn.innerHTML = `<span>✅ Đã điền ${p.filledCount} câu</span>`;
          }
        }
      });
    } catch (err) {
      if (isAborted) {
        console.log('[FormMind] handleMainWorkflow interrupted by user abort.');
        return;
      }
      console.error('[FormMind] Error in handleMainWorkflow:', err);
      if (isDebugModeEnabled) {
        recordBugEntry({
          step: 'handleMainWorkflow:exception',
          errorMessage: err.message,
          errorStack: err.stack,
          domState: captureDomState()
        });
      }
      if (detectHighDemandError(err.message)) {
        await handleHighDemandRetry(err.message);
      } else {
        showToast(`Lỗi: ${err.message}`, 'error');
        await terminateAutomation();
      }
    } finally {
      isWorkflowRunning = false;
    }
  }

  /**
   * Stop the main orchestration workflow (delegates to terminateAutomation)
   */
  async function stopMainWorkflow() {
    await terminateAutomation();
  }

  /**
   * Floating button click handler: Toggles Start / Stop
   */
  async function handleFloatingAutoFill() {
    removeRetryBar();
    const { isRunning } = await new Promise(r => chrome.storage.local.get(['isRunning'], r));
    if (isRunning) {
      // User clicked Stop
      await terminateAutomation();
    } else {
      // User clicked Start
      isAborted = false;
      await chrome.storage.local.set({ isRunning: true, retryCount: 0, formmind_retry_count: 0 });
      updateFloatingButtonState(true);
      await handleMainWorkflow();
    }
  }

  /**
   * Auto-resume after page reload if isRunning is true (e.g. after High Demand retry or Cooldown reload)
   */
  async function initAutoResume() {
    if (initAutoResume.hasResumed) return;
    initAutoResume.hasResumed = true;

    try {
      const { isRunning, retryCount = 0 } = await new Promise(r => {
        chrome.storage.local.get(['isRunning', 'retryCount', 'formmind_retry_count'], r);
      });
      const aborted = typeof isAborted !== 'undefined' && isAborted;
      if (isRunning && !aborted) {
        console.log(`[FormMind] Auto-resume: isRunning is true (retryCount=${retryCount}). Waiting 1.5s for DOM...`);
        // Chờ 1.5s để Google Forms dựng xong DOM
        const delayFn = typeof safeSetTimeout === 'function' ? safeSetTimeout : setTimeout;
        delayFn(() => {
          if (typeof isAborted === 'undefined' || !isAborted) {
            handleMainWorkflow();
          }
        }, 1500);
      }
    } catch (err) {
      console.warn('[FormMind] initAutoResume error:', err);
    }
  }

  // Tự động khôi phục sau reload (Auto-resume)
  window.addEventListener('load', async () => {
    initAutoResume();
  });
  if (document.readyState === 'complete') {
    initAutoResume();
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

  // Internal test interface
  if (typeof window !== 'undefined') {
    window.__FormMindInternal = {
      evaluateWeightedRule,
      evaluateTextRule,
      cleanTitle,
      extractAllQuestionsFromFBData
    };
  }

})();
