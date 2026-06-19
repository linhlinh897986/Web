@echo off
title AIO Key Selling Website
cd /d "%~dp0"
echo ======================================================
echo 🚀 Dang khoi dong Website Ban Key AIO...
echo ======================================================
:: Cài đặt thư viện tự động nếu chưa cài
if not exist node_modules (
  echo Thu vien node_modules chua duoc cai dat. Dang tien hanh npm install...
  npm install
)
:: Chạy ứng dụng Express chính
npm start
