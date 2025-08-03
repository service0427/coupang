@echo off
echo =================================
echo 쿠팡 상품 클릭 테스트 (Windows 11)
echo =================================
echo.

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

REM 실행 옵션 선택
if "%1"=="" (
    echo 사용법: run.bat [브라우저]
    echo 브라우저: chrome, firefox, webkit
    echo.
    echo 기본값으로 Chrome 실행...
    node ../index.js --browser chrome
) else (
    node ../index.js --browser %1
)

pause