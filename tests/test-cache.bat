@echo off
echo ========================================
echo 캐시 효율성 테스트 (네트워크 헤더 분석)
echo ========================================
echo.
echo 1. 일반 모드 테스트 (캐시 없음)
echo ========================================
call clear-data.bat
node index.js -b chrome --no-proxy
echo.
echo Enter를 눌러 영구 프로필 모드 테스트를 시작하세요...
pause

echo ========================================
echo 2. 영구 프로필 모드 테스트 (캐시 있음)
echo ========================================
echo 브라우저 프로필은 유지하고 추적 데이터만 삭제...
rmdir /s /q download-data 2>nul
rmdir /s /q cookie-data 2>nul
node index.js -b chrome --persistent --no-proxy
echo.
echo 테스트 완료!
pause