@echo off
echo ========================================
echo 쿠팡 상품 클릭 테스트 (프록시 없이 실행)
echo ========================================
echo.

REM 프록시 없이 실행
set PROXY_SERVER=

REM npm 패키지 설치 확인
if not exist node_modules (
    echo npm 패키지 설치 중...
    npm install
    echo.
)

REM Playwright 브라우저 설치 확인
if not exist "%USERPROFILE%\AppData\Local\ms-playwright" (
    echo Playwright 브라우저 설치 중...
    npx playwright install
    echo.
)

REM 실행
if "%1"=="" (
    node ../index.js --browser chrome --proxy none
) else (
    node ../index.js --browser %1 --proxy none
)

pause