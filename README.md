# ⚡ FormMind - AI Google Form Auto-Filler (Chrome Extension)

<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="FormMind Logo" />
</p>

<p align="center">
  <strong>Tiện ích mở rộng Chrome tự động điền biểu mẫu Google Forms bằng AI theo Persona & Cảm xúc tùy chỉnh.</strong><br>
  Hỗ trợ Google Gemini (Free), Groq (Ultra-Fast), Hugging Face, OpenAI, Anthropic Claude và OpenRouter với công nghệ đồng bộ từ models.dev.
</p>

<p align="center">
  <a href="#-cách-cài-đặt-từng-bước-installation"><img src="https://img.shields.io/badge/Chrome-Manifest_V3-blue?style=flat-square" alt="Manifest V3"></a>
  <a href="#-các-nhà-cung-cấp-ai-hỗ-trợ"><img src="https://img.shields.io/badge/AI_Engine-Gemini_%7C_Groq_%7C_HuggingFace_%7C_OpenAI-orange?style=flat-square" alt="AI Engines"></a>
  <a href="#-bảo-mật--quyền-riêng-tư"><img src="https://img.shields.io/badge/Privacy-Local_Only-green?style=flat-square" alt="Privacy First"></a>
  <a href="https://github.com/LucianLe2942006/google-form-auto-fill"><img src="https://img.shields.io/badge/GitHub-Repository-black?style=flat-square" alt="GitHub Repo"></a>
</p>

---

## 🌟 Giới Thiệu (Overview)

**FormMind** là một tiện ích mở rộng Chrome (Manifest V3) thông minh, giúp bạn tự động quét câu hỏi trên bất kỳ trang **Google Forms** nào, phân tích ngữ cảnh và điền đáp án hoàn toàn tự động bằng AI theo đúng phong cách (**Persona & Sentiment**) bạn mong muốn.

### Điểm nổi bật:
- ⚡ **Tự động điền 1-Click**: Điền toàn bộ form chỉ trong vài giây.
- 🎭 **5 Chế độ Persona đa dạng**: Tích cực, Tiêu cực, Trung lập/Không ý kiến, Cân bằng, hoặc Tùy chỉnh (Custom Prompt).
- 📄 **Tự động chuyển trang (Multi-page Forms)**: Tự động bấm "Tiếp" (Next) và điền liên tục qua các trang cho đến khi gặp nút "Gửi" (Submit).
- 🎯 **Nhận diện ràng buộc thông minh**: Phân tích câu hỏi hộp kiểm để tự động tuân thủ số lượng chọn: *"chọn chính xác 2 mục"*, *"chọn ít nhất 1"*, *"tối đa 3"*,... tránh lỗi validation.
- 🧩 **Hỗ trợ lưới ma trận (Grid)**: Điền được cả Lưới trắc nghiệm (`grid_radio`) và Lưới hộp kiểm (`grid_checkbox`).
- 🔘 **Widget nổi tiện dụng (Floating Pill)**: Nằm ngay góc dưới màn hình biểu mẫu, điền form trực tiếp mà không cần bấm mở popup tiện ích.
- 🔄 **Đồng bộ danh mục Model từ models.dev**: Tích hợp danh sách model mới nhất (Gemini 3.8/3.7/2.5 Flash, Groq Llama 3.1 8B Instant, Hugging Face Qwen 2.5 7B Instruct, GPT-6 Astra, Claude Fable 5.1, DeepSeek V3,...).
- 🛡️ **Tự động phục hồi lỗi Model (Smart Fallback)**: Tự động chuyển về model dự phòng ổn định nếu model được chọn bị lỗi phiên bản API hoặc 404.
- 🔒 **Bảo mật tuyệt đối**: API Key lưu trữ cục bộ trong trình duyệt, gọi trực tiếp từ client đến máy chủ của nhà cung cấp AI, không qua bất kỳ server trung gian nào.

---

## 🚀 Hướng Dẫn Cài Đặt Chi Tiết (Installation Guide)

Tiện ích hoạt động mượt mà trên tất cả các trình duyệt nhân Chromium: **Google Chrome, Microsoft Edge, Brave, Cốc Cốc, Opera,...**

### Bước 1: Tải mã nguồn về máy tính

Bạn có thể chọn một trong hai cách:

#### Cách A: Dùng Git (Khuyên dùng)
Mở Terminal / Command Prompt / PowerShell và chạy lệnh:
```bash
git clone https://github.com/LucianLe2942006/google-form-auto-fill.git
```

#### Cách B: Tải file ZIP
1. Truy cập [github.com/LucianLe2942006/google-form-auto-fill](https://github.com/LucianLe2942006/google-form-auto-fill).
2. Nhấn nút xanh **Code** -> chọn **Download ZIP**.
3. Giải nén file `.zip` vào một thư mục trên máy tính của bạn.

---

### Bước 2: Cài đặt tiện ích vào Chrome

1. Mở trình duyệt Google Chrome (hoặc Edge, Brave, Cốc Cốc).
2. Truy cập vào trang quản lý tiện ích bằng cách nhập đường dẫn sau vào thanh địa chỉ:
   ```
   chrome://extensions/
   ```
   *(Đối với Microsoft Edge, truy cập `edge://extensions/`)*
3. Ở góc trên cùng bên phải, **bật công tắc "Developer mode"** (Chế độ dành cho nhà phát triển).
4. Ở góc trên bên trái, bấm nút **"Load unpacked"** (Tải tiện ích đã giải nén).
5. Điều hướng và chọn thư mục dự án bạn vừa clone hoặc giải nén (thư mục chứa file `manifest.json`).
6. Biểu tượng **FormMind** (⚡) sẽ xuất hiện trong danh sách tiện ích của bạn!
7. Nhấn vào biểu tượng mảnh ghép puzzle ở thanh công cụ Chrome và **Ghim (Pin)** FormMind để tiện sử dụng.

---

## 🔑 Hướng Dẫn Lấy API Key

Bạn chỉ cần có **một** API Key để sử dụng tiện ích:

| Nhà cung cấp (Provider) | Đề xuất Model | Đặc điểm & Chi phí | Hướng dẫn lấy Key |
| :--- | :--- | :--- | :--- |
| **Google Gemini** *(Khuyên dùng)* | `gemini-3.8-flash` / `gemini-3.7-flash` | **100% Miễn phí** (Free Tier), phản hồi thông minh, chính xác | 1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey)<br>2. Đăng nhập Google & bấm **Create API key**<br>3. Sao chép chuỗi key bắt đầu bằng `AIza...` |
| **Groq** *(Siêu tốc & Tiết kiệm token)* | `openai/gpt-oss-20b` | **Cực nhanh** (~1,000 tps), Free Tier rộng rãi, siêu tiết kiệm token ($0.075/1M), JSON chuẩn | 1. Đăng ký tại [Groq Console](https://console.groq.com/keys)<br>2. Bấm **Create API Key**<br>3. Sao chép key bắt đầu bằng `gsk_...` |
| **Hugging Face** *(Serverless Router & Tiết kiệm token)* | `meta-llama/Llama-3.1-8B-Instruct` | Router Serverless, chi phí siêu rẻ ($0.02/1M), suy luận chính xác, tuân thủ prompt form chặt chẽ | 1. Truy cập [HF Tokens](https://huggingface.co/settings/tokens)<br>2. Tạo User Access Token (Read/Inference)<br>3. Sao chép key bắt đầu bằng `hf_...` |
| **OpenAI** | `gpt-4o-mini` / `gpt-6-astra` | Trả phí theo lượt dùng | Đăng ký và lấy key tại [OpenAI Platform](https://platform.openai.com/api-keys) |
| **Anthropic Claude** | `claude-3-5-haiku` / `claude-fable-5-1` | Trả phí theo lượt dùng | Đăng ký tại [Anthropic Console](https://console.anthropic.com/settings/keys) |
| **OpenRouter** | `deepseek/deepseek-chat` / `meta-llama/...` | Có model miễn phí / trả phí | Lấy key tại [OpenRouter Keys](https://openrouter.ai/keys) |

---

## ⚙️ Cấu Hình Tiện Ích Lần Đầu

1. Nhấp vào biểu tượng **FormMind** trên thanh công cụ trình duyệt để mở cửa sổ Popup.
2. Chuyển sang tab **Keys** (ở góc phải thanh điều hướng).
3. Dán API Key của bạn vào ô tương ứng (ví dụ: Google Gemini API Key hoặc Groq API Key).
4. Nhấn nút **Test** bên cạnh để kiểm tra kết nối (sẽ hiện thông báo xác nhận thành công).
5. Chọn model bạn muốn dùng (hoặc để mặc định `Gemini 3.8 Flash` hoặc `Llama 3.1 8B Instant`).
6. Nhấn nút **💾 Save All Settings** ở dưới cùng để lưu lại.

---

## 💡 Cách Sử Dụng (Usage)

### Cách 1: Sử dụng qua Cửa sổ Popup
1. Mở bất kỳ biểu mẫu Google Forms nào (URL bắt đầu bằng `https://docs.google.com/forms/...`).
2. Bấm vào biểu tượng **FormMind** trên thanh công cụ.
3. Tiện ích sẽ tự động nhận diện tiêu đề và số lượng câu hỏi trên form.
4. Chọn phong cách trả lời (**Persona**):
   - 🌟 **Positive**: Khen ngợi, đánh giá 5 sao/điểm tối đa, lựa chọn các câu trả lời tích cực nhất.
   - 👎 **Negative**: Phê bình, đánh giá điểm thấp, chỉ ra các điểm còn hạn chế.
   - 🤷 **IDK / Neutral**: Chọn "Không biết", "Không áp dụng", chọn mức điểm trung lập (3/5).
   - ⚖️ **Balanced**: Đánh giá khách quan, nêu rõ cả ưu và khuyết điểm.
   - 🎨 **Custom**: Tùy chỉnh vai diễn, ví dụ: *"Tôi là nhân viên văn phòng 30 tuổi, quan tâm đến tính tiện lợi và chi phí rẻ"*.
5. Tích chọn **Tự động chuyển trang (Multi-page forms)** nếu biểu mẫu có nhiều trang.
6. Nhấn nút **⚡ Auto-Fill Form with AI**.
7. Xem trực tiếp quá trình điền, kiểm tra lại câu trả lời và nhấn **Submit (Gửi)** khi hoàn tất!

---

### Cách 2: Sử dụng Widget Nổi (Floating Widget) Trực Tiếp Trên Trang
Khi bạn mở bất kỳ Google Form nào, FormMind sẽ tự động hiển thị một thanh widget nổi ở góc dưới bên phải màn hình:
1. Bạn có thể chọn trực tiếp **Persona** từ menu thả xuống.
2. Chọn mô hình AI mong muốn.
3. Bấm nút **⚡ Điền Form** ngay trên trang web mà không cần mở popup.
4. Bạn cũng có thể kéo di chuyển hoặc thu nhỏ widget nếu cần!

---

## 📋 Các Loại Câu Hỏi Được Hỗ Trợ (Supported Question Types)

FormMind hỗ trợ 100% các dạng câu hỏi tiêu chuẩn trên Google Forms:

| Dạng câu hỏi | Phần tử DOM Google Forms | Cơ chế xử lý |
| :--- | :--- | :--- |
| **Câu trả lời ngắn (Short Answer)** | `input[type="text"]` | AI sinh câu trả lời ngắn gọn, súc tích đúng trọng tâm |
| **Đoạn văn (Paragraph)** | `textarea` | AI viết đoạn văn bản tự nhiên theo văn phong của persona |
| **Trắc nghiệm 1 đáp án (Radio)** | `div[role="radio"]` | Lựa chọn phương án phù hợp nhất với tính cách |
| **Hộp kiểm nhiều đáp án (Checkboxes)** | `div[role="checkbox"]` | Tự động phân tích ràng buộc (ví dụ: *chọn chính xác 2 mục, chọn ít nhất 1 mục, chọn tối đa 3 mục*) để tick đúng số lượng |
| **Thang đo tuyến tính (Linear Scale / Rating)** | Hàng radio `1 - 5`, `1 - 10` | Chọn mức điểm cao (5), thấp (1-2) hoặc trung bình (3) theo persona |
| **Menu thả xuống (Dropdown)** | `div[role="listbox"]` | Mở menu ảo của Google Form và click chọn giá trị tương ứng |
| **Lưới trắc nghiệm (Multiple Choice Grid)** | Bảng ma trận `grid_radio` | Tự động chọn đúng 1 đáp án trên từng hàng theo từng cột |
| **Lưới hộp kiểm (Checkbox Grid)** | Bảng ma trận `grid_checkbox` | Tự động tích các ô phù hợp trên từng hàng của lưới |

---

## 🧪 Kiểm Thử Offline (Local Mock Form)

Dự án có sẵn một biểu mẫu giả lập Google Forms chứa đầy đủ mọi dạng câu hỏi để bạn kiểm tra thử nghiệm mà không cần tạo form thật:

1. Mở trình duyệt Chrome.
2. Nhấn `Ctrl + O` (hoặc kéo thả vào trình duyệt) và mở file:
   ```
   test/mock-form.html
   ```
   *(Đường dẫn đầy đủ: `c:\Users\...\auto-fill-form\test\mock-form.html`)*
3. Mở FormMind hoặc dùng Floating Widget để thử điền form và trải nghiệm!

---

## 🔍 Tab Inspector (Soi chi tiết câu hỏi)

Khi bạn muốn kiểm tra xem tiện ích đã phát hiện được những câu hỏi và ràng buộc nào trên biểu mẫu:
1. Mở popup FormMind -> Chọn tab **Inspect**.
2. Tiện ích sẽ liệt kê chi tiết:
   - Tiêu đề câu hỏi & trạng thái bắt buộc (`Required`).
   - Kiểu câu hỏi (`Radio`, `Checkbox`, `Text`, `Scale`, `Grid`,...).
   - Toàn bộ danh sách tùy chọn (options, hàng, cột).
   - Ràng buộc trích xuất tự động (Ví dụ: `Chọn chính xác 2 mục`).

---

## 📂 Cấu Trúc Mã Nguồn (Project Structure)

```
google-form-auto-fill/
├── manifest.json              # Khai báo cấu hình Chrome Extension (Manifest V3)
├── background/
│   └── background.js          # Service Worker: Gọi API AI, xử lý Persona, cơ chế fallback
├── content/
│   ├── content.js             # Quét DOM Google Forms, phân tích ràng buộc, điền dữ liệu, widget nổi
│   └── content.css            # Giao diện Floating Widget, hiệu ứng pulse và thông báo Toast
├── popup/
│   ├── popup.html             # Giao diện người dùng Glassmorphism (Tab Fill, Inspect, Keys)
│   ├── popup.css              # Dark mode styling hiện đại, responsive
│   ├── popup.js               # Quản lý sự kiện giao diện, lưu cấu hình, kích hoạt auto-fill
│   └── models.js              # Quản lý danh mục mô hình, đồng bộ từ models.dev
├── data/
│   ├── models.json            # Cơ sở dữ liệu model ngoại tuyến (Gemini, Groq, Hugging Face, OpenAI, Claude, OpenRouter)
│   └── models.js              # Module xuất dữ liệu model
├── icons/
│   ├── icon16.png             # Biểu tượng 16x16
│   ├── icon48.png             # Biểu tượng 48x48
│   └── icon128.png            # Biểu tượng 128x128
├── test/
│   └── mock-form.html         # Form HTML giả lập Google Forms để kiểm thử offline
├── scripts/
│   └── generate_icons.js      # Script Node.js vẽ bộ icon tiện ích
└── README.md                  # Tài liệu hướng dẫn sử dụng và cài đặt
```

---

## 🔒 Bảo Mật & Quyền Riêng Tư (Privacy & Security)

- **Không sử dụng máy chủ trung gian (Zero Middleman)**: Toàn bộ quá trình gọi API đều diễn ra trực tiếp từ trình duyệt của bạn tới API của Google, Groq, Hugging Face, OpenAI, Anthropic hoặc OpenRouter.
- **Lưu trữ bảo mật**: API Key được lưu trong bộ nhớ `chrome.storage.sync` an toàn của trình duyệt Chrome, không bao giờ được gửi tới bất kỳ bên thứ ba nào khác.
- **Mã nguồn mở 100%**: Toàn bộ mã nguồn minh bạch, người dùng có thể thoải mái kiểm tra và tùy chỉnh theo nhu cầu.
