# Speakly — IELTS Speaking practice

Web luyện IELTS Speaking: chọn Part 1/2/3, nhập câu hỏi, **ghi âm câu trả lời**, nghe lại và nhận góp ý từ Gemini. Part 2 có hướng dẫn Cue Card và đồng hồ chuẩn bị 1 phút, nói 2 phút. Mỗi Part giữ câu hỏi riêng trên trình duyệt; audio chỉ tồn tại tạm trong phiên hiện tại. Gemini trả bản chép lời và góp ý về nội dung, ngôn ngữ, cách nói. Đây là góp ý luyện tập, không phải điểm IELTS chính thức.

## Chạy và deploy

1. Tạo Gemini API key trong [Google AI Studio](https://aistudio.google.com/apikey). Kiểm tra project/key còn quota hoặc credit.
2. Tạo một repository GitHub mới. Trong thư mục này chạy `git init`, `git add .`, `git commit -m "Initial Speakly site"`, `git branch -M main`, `git remote add origin <URL_REPOSITORY_GITHUB>`, rồi `git push -u origin main`. Kiểm tra `.dev.vars` không xuất hiện trong danh sách file được commit.
3. Trong Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, chọn repository vừa tạo. Đặt build command là `exit 0`, build output directory là `.`. Thư mục `functions/` được Cloudflare nhận làm Pages Functions.
4. Trong project Pages: **Settings → Variables and Secrets → Add**, đặt tên `GEMINI_API_KEY`, dán key, chọn **Encrypt**, rồi Save. Chọn môi trường Production (và Preview nếu muốn thử các nhánh khác). Deploy lại sau khi thêm secret.
5. Cloudflare cấp địa chỉ `*.pages.dev` miễn phí. Sau này sửa source: chạy `git add .`, `git commit -m "Mô tả thay đổi"`, `git push`. Cloudflare tự deploy phiên bản mới khi có commit được push lên nhánh production.

Để chạy local cùng API, tạo file `.dev.vars` chứa `GEMINI_API_KEY=...`, rồi chạy `npx wrangler pages dev .`. File `.dev.vars` đã được gitignore. Nếu chỉ mở `index.html`, bạn có thể xem giao diện và thử ghi âm/nghe lại; nút nhận xét cần Pages Function nên sẽ không hoạt động. Khi truy cập web qua trình duyệt, hãy cho phép micro. Trên internet, micro cần trang HTTPS (Cloudflare Pages cung cấp sẵn).

Gemini API key chỉ được dùng trong `functions/api/feedback.js`, không gửi xuống trình duyệt. Bản ghi âm được gửi tới Gemini khi người dùng nhấn nhận nhận xét; không lưu trên server của web. Khi đưa web cho nhiều người dùng, nên bổ sung giới hạn lượt sử dụng theo người/IP để bảo vệ quota.
