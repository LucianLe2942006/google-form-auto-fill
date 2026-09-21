# ⚡ FormMind - AI Google Form Auto-Filler (Chrome Extension)

**FormMind** is an intelligent Manifest V3 Chrome Extension that reads questions from Google Forms, consults top-tier AI models (Google Gemini, OpenAI, Anthropic Claude, or OpenRouter), and auto-fills every question according to your chosen **Persona & Sentiment**.

---

## 🌟 Key Features

- 🎭 **Persona & Tone Controls**:
  - **🌟 Very Positive**: Picks high ratings (5/5, 10/10), compliments, top-tier choices.
  - **👎 Critical / Negative**: Picks low ratings (1-2/5), provides constructive criticism and highlights pain points.
  - **🤷 IDK / Indifferent**: Selects "Not Applicable", "I don't know", middle/neutral ratings, and brief non-committal answers.
  - **⚖️ Balanced / Objective**: Gives nuanced, fair answers weighing pros and cons.
  - **🎨 Custom Persona**: Define your own persona (e.g., *"Act as a 30-year-old game developer who loves open source"*).
- 🧠 **Multi-AI Provider Support (Tự động hoàn toàn)**:
  - **Google Gemini**: Tự động kết nối và chọn model Flash tốt nhất đang hoạt động trên tài khoản của bạn qua endpoint `/v1beta/models`.
  - **OpenAI**: Tự động sử dụng mô hình tối ưu cho điền biểu mẫu (`gpt-4o-mini`).
  - **Anthropic Claude**: Tự động sử dụng mô hình Claude Haiku tốc độ cao, trả về JSON chuẩn xác.
  - **OpenRouter & DeepSeek**: Sử dụng cơ chế định tuyến thông minh tự động (`openrouter/auto`).
  - **Tùy chỉnh (Custom Model ID)**: Vẫn hỗ trợ gõ tên model tùy ý cho người dùng nâng cao.
- 📋 **Universal Question Type Support**:
  - Short Answer (`input[type="text"]`)
  - Paragraph (`textarea`)
  - Multiple Choice (`radio`)
  - Checkboxes (`multi-select`)
  - Linear Scales / Ratings (1-5, 1-10 Likert scales)
  - Dropdowns (`listbox`)
- 🔒 **Privacy-First & Secure**:
  - Your API keys are saved locally in `chrome.storage.sync`.
  - Direct client-to-endpoint requests; no middleman proxy or third-party servers.
- ⚡ **In-Page Floating Quick-Fill Widget**:
  - Auto-fills directly from a floating badge on the Google Form without even opening the popup.

---

## 🚀 Installation Guide

### Step 1: Load Extension into Chrome
1. Open Google Chrome (or Brave, Edge, Opera).
2. Navigate to `chrome://extensions/` in the URL bar.
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select this project folder:
   ```
   c:\Users\Le Nhut Huy\Desktop\Projects\auto-fill-form
   ```
6. The extension icon will appear in your Chrome toolbar. Pin it for quick access!

---

## 🔑 Getting an API Key

You only need **one** API key to get started. We recommend Google Gemini because it provides a generous free tier:

| Provider | Chế độ lựa chọn Model | Where to get Key | Cost |
| :--- | :--- | :--- | :--- |
| **Google Gemini** *(Recommended)* | **Tự động** (API tự chọn model tốt nhất) | [Google AI Studio](https://aistudio.google.com/app/apikey) | **Free** |
| **OpenAI** | **Tự động** (Mặc định tối ưu `gpt-4o-mini`) | [OpenAI Platform](https://platform.openai.com/api-keys) | Pay-as-you-go |
| **Anthropic Claude** | **Tự động** (Mặc định tối ưu `claude-3-5-haiku`) | [Anthropic Console](https://console.anthropic.com/) | Pay-as-you-go |
| **OpenRouter** | **Tự động** (`openrouter/auto`) | [OpenRouter](https://openrouter.ai/keys) | Pay-as-you-go / Free models |

---

## 💡 How to Use

### 1. Configure Your API Key
1. Click the **FormMind** icon in your browser toolbar.
2. Switch to the **Keys** tab.
3. Paste your API key (e.g. Gemini key) and click **Test** to confirm connectivity.
4. Click **Save All Settings**.

### 2. Auto-Fill a Form
1. Open any **Google Form** (e.g. `https://docs.google.com/forms/...`).
2. **Option A (Extension Popup)**:
   - Click the extension icon.
   - Choose your persona: **Positive**, **Negative**, **IDK / Neutral**, or **Custom**.
   - Click **⚡ Auto-Fill Form with AI**.
3. **Option B (On-Page Floating Widget)**:
   - Notice the floating **✨ FormMind** pill in the bottom-right corner of the form.
   - Select your persona directly from the dropdown and click **⚡ Auto-Fill**.
4. Review the filled responses, make any adjustments if desired, and click **Submit**!

---

## 🧪 Local Testing (Without live Google Form)

A mock Google Form is included in this repository for instant offline testing:
1. In Chrome, press `Ctrl + O` (or drag and drop) and open:
   ```
   c:\Users\Le Nhut Huy\Desktop\Projects\auto-fill-form\test\mock-form.html
   ```
2. Test both the popup and the in-page floating widget on the mock form!

---

## 📂 Project Structure

```
auto-fill-form/
├── manifest.json              # Chrome Manifest V3 configuration
├── background/
│   └── background.js          # AI API handlers (Gemini, OpenAI, Claude, OpenRouter)
├── content/
│   ├── content.js             # Google Form DOM parser, filler, and floating pill widget
│   └── content.css            # Styles for in-page pill, toasts, and highlight pulses
├── popup/
│   ├── popup.html             # Glassmorphism popup UI (Fill, Inspect, Keys tabs)
│   ├── popup.css              # Modern dark-mode styling and micro-animations
│   └── popup.js               # Tab logic, form inspector, and fill triggers
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── test/
│   └── mock-form.html         # Google Form structure mock for offline verification
└── README.md                  # Documentation and quickstart guide
```
