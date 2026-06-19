---
name: AIO Key Store Design System
description: Modern SaaS Dark Mode & Glassmorphism Design System
colors:
  primary: "#6366f1"
  primary-gradient-end: "#a855f7"
  neutral-bg: "#080b10"
  neutral-card: "#0d1117"
  border-color: "#1d2430"
  success: "#10b981"
  danger: "#f43f5e"
  warning: "#f59e0b"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "clamp(2rem, 5vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.5px"
  body:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
spacing:
  sm: "12px"
  md: "24px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "10px"
    padding: "10px 22px"
  card-container:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.lg}"
    padding: "28px"
---

# Design System: AIO Key Store

## 1. Overview

**Creative North Star: "The Neon Void Dashboard"**

Hệ thống thiết kế AIO Key Store được xây dựng dựa trên phong cách giao diện tối hiện đại (Premium Dark Mode), kết hợp các đường nét kính mờ (Glassmorphism) và hiệu ứng phát sáng neon (Neon Glow). Mục tiêu thẩm mỹ cốt lõi là gợi lên cảm giác về một công nghệ hiệu năng cao, tin cậy tuyệt đối và chuyên nghiệp.

Hệ thống từ chối các thiết kế AI slop phổ biến (như nền giấy beige/cream mặc định, các bento card sắp xếp lộn xộn vô hồn, hay các khối hộp ghost-card kết hợp đổ bóng quá mờ). Thay vào đó, nó nhấn mạnh vào các khối hộp tối mịn màng có biên tương phản cao, typography gọn gàng sắc nét của font Plus Jakarta Sans và sự hiếm hoi có chủ đích của các màu nhấn.

**Key Characteristics:**
- Nền vũ trụ tối sâu kết hợp với hai luồng sáng gradient tỏa từ góc trang.
- Thẻ card kính mờ trong suốt (`rgba(13, 17, 23, 0.7)`) kết hợp bo tròn góc lớn (`20px`).
- Trải nghiệm tương tác mượt mà thông qua các hiệu ứng biến đổi vị trí mềm mại (`transition`).

## 2. Colors

Bảng màu sử dụng sắc độ tối làm chủ đạo kết hợp các màu chỉ trạng thái có độ bão hòa cao giúp tương phản tối đa trên màn hình OLED/LCD.

### Primary
- **Indigo Glow** (`#6366f1` / `oklch(65.69% 0.196 272.9)`): Màu thương hiệu chính, sử dụng cho các hành động quan trọng, trạng thái được chọn và tiêu điểm tương tác.
- **Neon Purple** (`#a855f7` / `oklch(58.62% 0.228 312.6)`): Điểm kết thúc của dải màu gradient thương hiệu, tăng chiều sâu công nghệ.

### Neutral
- **Deep Space Black** (`#080b10` / `oklch(9.44% 0.015 272.5)`): Nền chính của toàn trang.
- **Glass Slate** (`#0d1117` / `rgba(13, 17, 23, 0.7)`): Nền của các thẻ Card hiển thị nội dung.
- **Borders & Dividers** (`#1d2430` / `rgba(255, 255, 255, 0.08)`): Đường viền phân cách mỏng nhẹ.
- **Muted Ink** (`#94a3b8` / `oklch(70.83% 0.032 247.8)`): Màu chữ phụ và ghi chú.

### Status Accent
- **Success Emerald** (`#10b981`): Chỉ thị thanh toán thành công hoặc Key đang hoạt động.
- **Danger Rose** (`#f43f5e`): Tiêu dùng cho các nút hủy bỏ, hết hạn hoặc hành động xóa.
- **Warning Amber** (`#f59e0b`): Trạng thái chờ thanh toán hoặc các lưu ý bắt buộc.

### Named Rules
**The 10% Accent Rule.** Màu nhấn Indigo/Purple chỉ được chiếm tối đa 10% diện tích giao diện trên bất kỳ màn hình nào. Sự hiếm hoi này tạo ra tiêu điểm dẫn dắt hành vi người dùng cực kỳ chính xác.

## 3. Typography

**Display Font:** Plus Jakarta Sans (với fallback sans-serif)
**Body Font:** Plus Jakarta Sans (với fallback sans-serif)

Typography có đặc điểm hình học cân đối, hiện đại, khoảng cách ký tự được tinh chỉnh nhẹ nhàng ở các tiêu đề lớn để không bị dính chữ.

### Hierarchy
- **Display** (ExtraBold (800), `clamp(2rem, 5vw, 4rem)`, `1.2`): Dành cho Logo hoặc tiêu đề giới thiệu chính của trang đăng nhập. Khoảng cách chữ (`letter-spacing: -0.5px`).
- **Headline / Title** (Bold (700), `18px` - `22px`, `1.4`): Tiêu đề chính của các thẻ Card.
- **Body** (Regular (400), `14px`, `1.5`): Nội dung prose chính, bảng dữ liệu, và các dòng mô tả. Giới hạn độ dài dòng từ 65–75 ký tự (characters) để tối ưu việc đọc.
- **Label / Badge** (SemiBold (600), `11px` - `13px`, `1.3`): Chữ trên các thẻ trạng thái (badge), nhãn của form nhập liệu.

### Named Rules
**The No-Tight-Eyebrow Rule.** Nghiêm cấm đặt các chữ Eyebrow viết hoa cỡ siêu nhỏ dán sát phía trên tiêu đề H2 ở mỗi mục. Hãy để khoảng cách tự nhiên và kích thước tiêu đề tự nói lên vai trò của nó.

## 4. Elevation

Hệ thống thiết kế này sử dụng triết lý phân lớp trực quan (Tonal Layering) kết hợp hiệu ứng kính mờ (Glassmorphism) thay vì lạm dụng đổ bóng sâu.

### Shadow Vocabulary
- **Primary Glow** (`box-shadow: 0 4px 15px rgba(99, 102, 241, 0.15)`): Sử dụng cho các nút nhấn chính khi hover để tạo cảm giác phản hồi cơ học.
- **Card Depth** (`box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3)`): Tạo khoảng cách phân lớp giữa thẻ card nổi trên nền tối vũ trụ.

### Named Rules
**The Interactive Glow Rule.** Bóng phát sáng (glow) chỉ xuất hiện khi đối tượng tương tác nhận được hành động chuột (hover) hoặc tiêu điểm (focus). Trạng thái tĩnh phải giữ phẳng và mịn.

## 5. Components

### Buttons
- **Shape:** Các nút nhấn có góc bo tròn trung bình (`10px`).
- **Primary:** Sử dụng dải màu gradient thương hiệu (`linear-gradient(135deg, #6366f1 0%, #a855f7 100%)`), chữ trắng đậm, padding (`10px 22px`).
- **Hover:** Dịch chuyển nhẹ lên trên (`transform: translateY(-2px)`) kèm theo hiệu ứng bóng sáng neon lan tỏa (`box-shadow`).

### Cards / Containers
- **Corner Style:** Bo tròn góc lớn (`20px`).
- **Background:** Sử dụng màu kính mờ Glass Slate.
- **Border:** Viền mảnh mờ (`1px solid rgba(255, 255, 255, 0.08)`) để tách biệt card với nền tối.
- **Internal Padding:** `28px` để tạo sự thông thoáng tối đa.

### Inputs / Fields
- **Style:** Nền tối nhẹ trong suốt (`rgba(255, 255, 255, 0.03)`), viền mảnh, bo tròn (`12px`).
- **Focus:** Viền chuyển sang màu Indigo và thêm một lớp viền bóng phát sáng bao quanh (`box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15)`).

## 6. Do's and Don'ts

### Do:
- **Do** Giữ thiết kế nền tối sâu và mịn làm nền chủ đạo cho các trang.
- **Do** Đảm bảo chữ văn bản luôn có độ tương phản tối thiểu là 4.5:1 so với nền để dễ đọc.
- **Do** Sử dụng các hiệu ứng chuyển đổi mượt mà (`transition: all 0.3s`) trên mọi thành phần nút bấm hoặc liên kết.

### Don't:
- **Don't** Sử dụng viền dán bên trái hoặc phải (`border-left` / `border-right` dày hơn 1px) làm điểm nhấn màu sắc cho Card hay Alert.
- **Don't** Sử dụng chữ viết hoa kích cỡ nhỏ có khoảng cách ký tự rộng làm tiêu đề phụ (eyebrow) lặp đi lặp lại.
- **Don't** Sử dụng các hiệu ứng đổ bóng quá lớn (blur >= 16px) kết hợp đồng thời với viền cứng trên cùng một Card tĩnh.
