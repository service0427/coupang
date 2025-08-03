@echo off
echo ========================================
echo 프로필 및 세션 관리 테스트
echo ========================================
echo.

echo 1. 기본 프로필 + 세션 초기화 (기본값)
echo ========================================
node index.js -b chrome --persistent --no-proxy
pause

echo.
echo 2. user1 프로필 생성
echo ========================================
node index.js -b chrome --persistent --profile-name user1 --no-proxy
pause

echo.
echo 3. user1 프로필 재사용 (세션 유지)
echo ========================================
node index.js -b chrome --persistent --profile-name user1 --no-clear-session --no-proxy
echo.
echo ✅ 쿠키와 로그인 상태가 유지되어야 합니다
pause

echo.
echo 4. user2 프로필 (새 프로필)
echo ========================================
node index.js -b chrome --persistent --profile-name user2 --no-proxy
echo.
echo ✅ 완전히 새로운 프로필이 생성됩니다
pause