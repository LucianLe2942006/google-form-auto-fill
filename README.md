# ⚡ FormMind - AI Google Form Auto-Filler (Chrome Extension) v2.0.1

<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="FormMind Logo" />
</p>

<p align="center">
  <strong>Tiện ích mở rộng Chrome tự động điền biểu mẫu Google Forms thông minh bằng AI, hỗ trợ lặp tự động (Cooldown), điền đa trang (Multi-page) và tùy biến tỉ lệ câu hỏi chi tiết.</strong><br>
  Tích hợp Google Gemini (Free), Groq (Ultra-Fast), Hugging Face, OpenAI, Anthropic Claude và OpenRouter.
</p>

<p align="center">
  <a href="https://github.com/LucianLe2942006/google-form-auto-fill/releases/tag/v2.0.1"><img src="https://img.shields.io/badge/Release-v2.0.1-success?style=flat-square" alt="Version 2.0.1"></a>
  <a href="#-cách-cài-đặt-từng-bước-installation"><img src="https://img.shields.io/badge/Chrome-Manifest_V3-blue?style=flat-square" alt="Manifest V3"></a>
  <a href="#-các-nhà-cung-cấp-ai-hỗ-trợ"><img src="https://img.shields.io/badge/AI_Engine-Gemini_%7C_Groq_%7C_HuggingFace_%7C_OpenAI-orange?style=flat-square" alt="AI Engines"></a>
  <a href="#-bảo-mật--quyền-riêng-tư"><img src="https://img.shields.io/badge/Privacy-Local_Only-green?style=flat-square" alt="Privacy First"></a>
  <a href="https://github.com/LucianLe2942006/google-form-auto-fill"><img src="https://img.shields.io/badge/GitHub-Repository-black?style=flat-square" alt="GitHub Repo"></a>
</p>

---

## 🌟 Có gì mới ở FormMind v2.0.1? (What's New in v2.0.1)

FormMind v2.0.1 mang đến các bản vá lỗi quan trọng và nâng cấp toàn diện cho luồng tự động hóa biểu mẫu đa trang:

1. **🔧 Vá triệt để lỗi nhận diện trang hoàn tất & Chống nghẽn Cooldown (v2.0.1 Hotfix)**:
   - **Chuẩn hóa nhận diện DOM**: Google Forms chuyển URL sang `/formResponse` ngay từ Trang 2 trở đi. Hệ thống đã được nâng cấp để phân biệt chính xác 100% giữa Section trung gian (đang điền) và màn hình xác nhận nộp bài (đã hoàn thành).
   - **Bộ lọc Gatekeeper bổ sung**: Ngăn chặn hoàn toàn việc nhận diện nhầm khi nút *"Quay lại"* (`.kW9Bec`, `.xK37zc`) hoặc thẻ `<form>` còn tồn tại.
   - **Xóa bỏ lỗi *"Không tìm thấy câu hỏi hoặc nút chuyển trang"***: Chặn đứng tình trạng `checkAndResumeActiveSession` cố chấp gọi auto-fill trên màn hình kết thúc form.
   - **Khử Race Condition trước khi Submit**: Đảm bảo dọn dẹp sạch sẽ session cũ, giúp thanh Cooldown đếm ngược tự động kích hoạt mượt mà sau khi nộp form.
2. **📄 Hỗ trợ Biểu mẫu Đa trang (Multi-page Forms) & Đọc biến ngầm `FB_PUBLIC_LOAD_DATA_`**:
   - Khai thác biến ngầm của Google Forms để trích xuất 100% cấu trúc câu hỏi từ tất cả các Section/Trang ngay từ đầu.
   - Tự động phát hiện và xử lý mượt mà trang giới thiệu / mô tả (0 câu hỏi).
   - Tự động bấm **"Tiếp" (Next)** qua từng trang và nộp form khi đến trang cuối.
3. **🛡️ Bộ lọc an toàn chống bấm nhầm nút "Quay lại" (Back Button Safety Guard)**:
   - Loại trừ triệt để các nút Quay lại trong container `.kW9Bec` / `.xK37zc`.
   - Ưu tiên chính xác 100% vào nút "Gửi" trong container `.lRwqcd`, ngăn ngừa hoàn toàn tình trạng form bị lùi trang thay vì nộp bài.
4. **⏱️ Tab Schedule & Vòng lặp Cooldown tự động**:
   - Tự động nộp form và đếm ngược Cooldown trước khi lặp lại lượt điền tiếp theo.
   - Thanh đếm ngược Cooldown nổi trực quan trên màn hình và trong popup.
   - Nút **"⚡ Chạy ngay" (Skip Cooldown)**: Bỏ qua đếm ngược và chuyển hướng tức thì về form gốc `/viewform` để điền tiếp mà không bị reload lại trang kết quả.
   - Nút **"🛑 Hủy chu kỳ" (Cancel Cooldown)**.
5. **🎲 Phân bổ Tỉ lệ Tùy chỉnh (Weighted Rules) & Tỉ lệ Độc lập cho Checkbox**:
   - Tùy chỉnh tỉ lệ phần trăm xuất hiện cho từng đáp án trắc nghiệm.
   - **Câu chọn 1 (Radio, Scale, Dropdown)**: Ràng buộc tổng = 100%, có nút *"⚖️ Tự cân bằng 100%"*.
   - **Câu hỏi Checkbox (Hộp kiểm nhiều đáp án)**: Cho phép mỗi ô nhận tỉ lệ độc lập từ 0% đến 100% (tổng có thể vượt 100% như 150%, 210%), đồng thời tuân thủ chính xác các ràng buộc min/max/exact choices của form.
   - Nút **"📥 Nạp từ Form"**: 1-Click đọc toàn bộ câu hỏi đa trang vào danh sách quy tắc.
   - Nút **"🎲 Random tất cả tỉ lệ"**: 1-Click tự động phân bổ ngẫu nhiên tỉ lệ cho 100% câu hỏi toàn bộ các trang!
6. **📝 Quy tắc câu hỏi Văn bản (Text Rules) & Tạo Hồ sơ Việt Nam (Profile Faker)**:
   - Hỗ trợ câu hỏi điền văn bản theo 3 chế độ: Cố định (Fixed), Bỏ qua (Skip), hoặc Lấy ngẫu nhiên từ danh sách (Random from list).
   - Tự động tạo và điền thông tin cá nhân chuẩn Việt Nam: Họ tên, Số điện thoại, Email, MSSV, Lớp, Tuổi, Năm sinh, Địa chỉ.
7. **🎭 Bổ sung Persona "Random" & Cơ chế Grayout / Khóa Tab**:
   - Bổ sung Persona `random` (Khách quan tự nhiên) cho toàn bộ hệ thống.
   - Cơ chế bảo vệ xung đột (Conflict of interest): Khi chọn Persona khác (`positive`, `negative`,...), Module B tỉ lệ sẽ tự động làm mờ và khóa lại; khi chọn Persona `random`, Module B sẽ mở khóa đầy đủ.
8. **🛑 Dừng khẩn cấp (Emergency Terminate) & Chế độ Debug Log**:
   - Nút Terminate dừng ngay lập tức mọi tiến trình, timer và automation mà không reload trang.
   - Switch Debug Mode ghi log chi tiết kèm snapshot DOM và xuất file báo cáo lỗi JSON `formmind_bug_report_<timestamp>.json`.

---

## ⚡ Tính Năng Cốt Lõi (Core Features)

- ⚡ **Tự động điền 1-Click**: Điền toàn bộ biểu mẫu chỉ trong vài giây.
- 🎭 **6 Chế độ Persona phong phú**:
  - 🌟 **Tích cực (Positive)**: Khen ngợi, đánh giá 5 sao/điểm tối đa.
  - 👎 **Tiêu cực (Negative)**: Phê bình, chỉ ra khuyết điểm, đánh giá điểm thấp.
  - 🤷 **Trung lập (Neutral / IDK)**: Chọn mức bình thường (3/5), "Không ý kiến", "Không áp dụng".
  - ⚖️ **Cân bằng (Balanced)**: Đánh giá khách quan, nêu cả ưu và nhược điểm.
  - 🎲 **Ngẫu nhiên (Random)**: Đa dạng hóa phản hồi, mở khóa cấu hình tỉ lệ phần trăm chi tiết.
  - 🎨 **Tùy chỉnh (Custom Prompt)**: Nhập vai theo yêu cầu riêng (VD: *"Tôi là sinh viên năm 2..."*).
- 🔘 **Widget nổi tiện dụng (Floating Widget)**: Nằm ngay góc màn hình biểu mẫu, điền form trực tiếp mà không cần mở popup tiện ích.
- 🎯 **Nhận diện ràng buộc thông minh**: Tự động phân tích câu hỏi hộp kiểm để tuân thủ số lượng: *"chọn chính xác 2 mục"*, *"chọn ít nhất 1"*, *"tối đa 3"*,... tránh lỗi validation của Google Forms.
- 🧩 **Hỗ trợ lưới ma trận (Grid)**: Hỗ trợ cả Lưới trắc nghiệm (`grid_radio`) và Lưới hộp kiểm (`grid_checkbox`).
- 🔄 **Đồng bộ danh mục Model từ models.dev**: Tích hợp danh sách model mới nhất (Gemini 3.8/3.7/2.5 Flash, Groq Llama 3.1 8B Instant, Hugging Face Qwen 2.5 7B, GPT-4o-mini,...).
- 🛡️ **Tự động phục hồi lỗi Model (Smart Fallback)**: Tự động chuyển về model dự phòng ổn định nếu model được chọn bị lỗi phiên bản API hoặc quá tải.
- 🔒 **Bảo mật tuyệt đối**: API Key lưu trữ cục bộ trong trình duyệt, gọi trực tiếp từ client đến máy chủ của nhà cung cấp AI, không qua máy chủ trung gian.

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
2. Nhấn nút xanh **Code** -> chọn **Download ZIP** (hoặc tải bản [Release v2.0](https://github.com/LucianLe2942006/google-form-auto-fill/releases/tag/v2.0)).
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
| **Google Gemini** *(Khuyên dùng)* | `gemini-3.8-flash` / `gemini-3.7-flash` | **100% Miễn phí** (Free Tier), thông minh, xử lý tiếng Việt xuất sắc | 1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey)<br>2. Đăng nhập Google & bấm **Create API key**<br>3. Sao chép chuỗi key bắt đầu bằng `AIza...` |
| **Groq** *(Siêu tốc & Tiết kiệm token)* | `openai/gpt-oss-20b` | **Cực nhanh** (~1,000 tps), Free Tier rộng rãi, siêu tiết kiệm token ($0.075/1M), JSON chuẩn | 1. Đăng ký tại [Groq Console](https://console.groq.com/keys)<br>2. Bấm **Create API Key**<br>3. Sao chép key bắt đầu bằng `gsk_...` |
| **Hugging Face** *(Serverless Router)* | `meta-llama/Llama-3.1-8B-Instruct` | Router Serverless, chi phí siêu rẻ ($0.02/1M), tuân thủ prompt chặt chẽ | 1. Truy cập [HF Tokens](https://huggingface.co/settings/tokens)<br>2. Tạo User Access Token (Read/Inference)<br>3. Sao chép key bắt đầu bằng `hf_...` |
| **OpenAI** | `gpt-4o-mini` | Trả phí theo lượt dùng | Đăng ký và lấy key tại [OpenAI Platform](https://platform.openai.com/api-keys) |
| **Anthropic Claude** | `claude-3-5-haiku` | Trả phí theo lượt dùng | Đăng ký tại [Anthropic Console](https://console.anthropic.com/settings/keys) |
| **OpenRouter** | `deepseek/deepseek-chat` / `meta-llama/...` | Có model miễn phí / trả phí | Lấy key tại [OpenRouter Keys](https://openrouter.ai/keys) |

---

## ⚙️ Cấu Hình Tiện Ích Lần Đầu

1. Nhấp vào biểu tượng **FormMind** trên thanh công cụ trình duyệt để mở cửa sổ Popup.
2. Chuyển sang tab **Keys** (ở thanh điều hướng).
3. Dán API Key của bạn vào ô tương ứng (ví dụ: Google Gemini API Key hoặc Groq API Key).
4. Nhấn nút **Test** bên cạnh để kiểm tra kết nối (sẽ hiện thông báo xác nhận thành công).
5. Chọn model bạn muốn dùng (hoặc để mặc định `Gemini 3.8 Flash`).
6. Nhấn nút **💾 Save All Settings** ở dưới cùng để lưu lại.

---

## 💡 Cách Sử Dụng (Usage)

### Cách 1: Sử dụng qua Cửa sổ Popup
1. Mở bất kỳ biểu mẫu Google Forms nào (URL bắt đầu bằng `https://docs.google.com/forms/...`).
2. Bấm vào biểu tượng **FormMind** trên thanh công cụ.
3. Chọn phong cách trả lời (**Persona**): Tích cực, Tiêu cực, Trung lập, Cân bằng, Ngẫu nhiên, hoặc Tùy chỉnh.
4. Bật công tắc **Tự động chuyển trang (Auto Next)** nếu biểu mẫu có nhiều trang.
5. Nhấn nút **⚡ Tự động điền (Auto-Fill Form with AI)**.
6. Xem trực tiếp quá trình điền, kiểm tra câu trả lời và form sẽ được gửi tự động.

---

### Cách 2: Sử dụng Widget Nổi (Floating Widget)
Khi bạn mở bất kỳ Google Form nào, FormMind sẽ hiển thị thanh widget nổi ở góc dưới bên phải màn hình:
1. Chọn nhanh **Persona** và **Mô hình AI** từ menu thả xuống.
2. Bấm nút **⚡ Điền Form** ngay trên trang web mà không cần mở popup.
3. Bạn có thể thu nhỏ hoặc kéo widget di chuyển vị trí tùy ý.
4. Nút **Dừng khẩn cấp (🛑 Dừng)** trên widget cho phép hủy tiến trình ngay lập tức.

---

### Cách 3: Sử dụng Tab Schedule (Lặp Cooldown & Tỉ lệ Nâng cao)
Dành cho các biểu mẫu cần khảo sát số lượng lớn hoặc kiểm soát chặt chẽ xác suất từng đáp án:
1. Mở popup FormMind -> chọn tab **Schedule**.
2. **Cấu hình Cooldown**:
   - Bật công tắc **Kích hoạt Cooldown**.
   - Thiết lập thời gian chờ (ví dụ: `10s`, `30s`, `2m`).
   - Bật tùy chọn **Tự động bắt đầu điền lượt mới sau khi đếm ngược kết thúc**.
3. **Cấu hình Hồ sơ cá nhân (Module A)**:
   - Chọn chế độ điền thông tin (Tự động sinh hồ sơ Việt Nam ngẫu nhiên, Sử dụng thông tin cố định, hoặc Bỏ qua).
4. **Cấu hình Tỉ lệ câu hỏi (Module B)**:
   - Đảm bảo Persona đang chọn là **🎲 Ngẫu nhiên (Random)**.
   - Nhấn nút **"📥 Nạp từ Form"** để lấy tự động 100% câu hỏi đa trang.
   - Nhấn nút **"🎲 Random tất cả tỉ lệ"** để phân bổ tự động.
   - Tùy chỉnh trực tiếp % cho từng đáp án:
     - Chọn 1: Ràng buộc 100%.
     - Checkbox: Điền % độc lập cho từng ô (tổng có thể vượt 100%).
5. **Cấu hình câu hỏi Tự luận (Module C)**:
   - Điền câu trả lời cố định hoặc nhập danh sách câu trả lời để AI bốc thăm ngẫu nhiên.
6. Nhấn **💾 Lưu cấu hình lịch trình**.

---

## 📋 Các Loại Câu Hỏi Được Hỗ Trợ (Supported Question Types)

FormMind hỗ trợ 100% các dạng câu hỏi tiêu chuẩn trên Google Forms:

| Dạng câu hỏi | Phần tử DOM Google Forms | Cơ chế xử lý |
| :--- | :--- | :--- |
| **Câu trả lời ngắn (Short Answer)** | `input[type="text"]` | AI sinh câu trả lời ngắn gọn hoặc điền theo Rule văn bản/Hồ sơ |
| **Đoạn văn (Paragraph)** | `textarea` | AI viết đoạn văn bản tự nhiên theo văn phong của persona |
| **Trắc nghiệm 1 đáp án (Radio)** | `div[role="radio"]` | Lựa chọn phương án theo Persona hoặc theo % cấu hình (Tổng = 100%) |
| **Hộp kiểm nhiều đáp án (Checkboxes)** | `div[role="checkbox"]` | Xác suất độc lập từng ô (> 100%), tuân thủ min/max/exact constraints |
| **Thang đo tuyến tính (Linear Scale / Rating)** | Hàng radio `1 - 5`, `1 - 10` | Chọn mức điểm theo persona hoặc tỉ lệ % |
| **Menu thả xuống (Dropdown)** | `div[role="listbox"]` | Mở menu ảo của Google Form và click chọn giá trị tương ứng |
| **Lưới trắc nghiệm (Multiple Choice Grid)** | Bảng ma trận `grid_radio` | Tự động chọn đúng 1 đáp án trên từng hàng theo từng cột |
| **Lưới hộp kiểm (Checkbox Grid)** | Bảng ma trận `grid_checkbox` | Tự động tích các ô phù hợp trên từng hàng của lưới |

---

## 🧪 Kiểm Thử Tự Động (Automated Unit Tests)

Dự án sở hữu bộ test toàn diện với **17 test suites** độc lập chạy bằng Node.js:

```bash
# Chạy toàn bộ các bài test kiểm thử logic
Get-ChildItem scratch/test_*.js | ForEach-Object { node $_.FullName }
```

Danh sách các module kiểm thử:
- `test_back_button_and_submit_priority.js`: Kiểm thử bộ lọc chặn nút Quay lại và ưu tiên nút Gửi.
- `test_skip_cooldown_and_checkbox_independent.js`: Kiểm thử bỏ qua Cooldown và tỉ lệ Checkbox độc lập.
- `test_cooldown_intro_and_autoresume.js`: Kiểm thử chu trình Cooldown, trang giới thiệu và tự khôi phục sau reload.
- `test_random_persona_and_module_disable.js`: Kiểm thử Persona Random và cơ chế Grayout/Khóa Module B.
- `test_terminate_and_debug_system.js`: Kiểm thử Terminate không reload và hệ thống Debug Log.
- `test_submit_gatekeeper_and_high_demand_retry.js`: Kiểm thử chốt chặn nút Gửi và xử lý lỗi Quá tải (High demand).

---

## 📂 Cấu Trúc Mã Nguồn (Project Structure)

```
google-form-auto-fill/
├── manifest.json              # Khai báo cấu hình Chrome Extension (Manifest V3 - v2.0.1)
├── background/
│   └── background.js          # Service Worker: Gọi API AI, quản lý Cooldown Alarms, Fallback
├── content/
│   ├── content.js             # Quét DOM Google Forms, trích xuất FB_PUBLIC_LOAD_DATA_, xử lý đa trang, widget nổi
│   └── content.css            # Giao diện Floating Widget, thanh Cooldown, thanh Retry và Toast
├── popup/
│   ├── popup.html             # Giao diện Glassmorphism (Tab Fill, Schedule, Inspect, Keys)
│   ├── popup.css              # Dark mode styling hiện đại, responsive, trạng thái grayout
│   ├── popup.js               # Quản lý sự kiện giao diện, lưu cấu hình, batch randomize, import FB data
│   └── models.js              # Quản lý danh mục mô hình, đồng bộ từ models.dev
├── data/
│   ├── models.json            # Cơ sở dữ liệu model ngoại tuyến (Gemini, Groq, Hugging Face, OpenAI, Claude, OpenRouter)
│   └── models.js              # Module xuất dữ liệu model
├── scratch/                   # Bộ kiểm thử tự động (18 unit test suites)
├── icons/                     # Bộ biểu tượng nhận diện FormMind (16x16, 32x32, 48x48, 128x128, 512x512, logo.svg)
├── test/
│   └── mock-form.html         # Form HTML giả lập Google Forms để kiểm thử offline
└── README.md                  # Tài liệu hướng dẫn sử dụng và cài đặt phiên bản 2.0.1
```

---

## 🔒 Bảo Mật & Quyền Riêng Tư (Privacy & Security)

- **Không sử dụng máy chủ trung gian (Zero Middleman)**: Toàn bộ quá trình gọi API đều diễn ra trực tiếp từ trình duyệt của bạn tới API của Google, Groq, Hugging Face, OpenAI, Anthropic hoặc OpenRouter.
- **Lưu trữ bảo mật**: API Key được lưu trong bộ nhớ `chrome.storage` an toàn của trình duyệt Chrome, không bao giờ được gửi tới bất kỳ bên thứ ba nào.
- **Mã nguồn mở 100%**: Toàn bộ mã nguồn minh bạch, người dùng có thể thoải mái kiểm tra và tùy biến theo nhu cầu.
