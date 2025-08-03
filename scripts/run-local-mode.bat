@echo off
echo ========================================
echo 쿠팡 자동화 - 로컬 모드 (JSON 설정 사용)
echo ========================================
echo.

REM 로컬 모드 환경변수 설정
set MODE=local

echo 모드: 로컬 (config/proxies.json 사용)
echo.

REM npm 패키지 설치 확인
if not exist ..\node_modules (
    echo npm 패키지 설치 중...
    cd ..
    npm install
    cd scripts
    echo.
)

REM Playwright 브라우저 설치 확인
if not exist "%USERPROFILE%\AppData\Local\ms-playwright" (
    echo Playwright 브라우저 설치 중...
    cd ..
    npx playwright install
    cd scripts
    echo.
)

REM 로컬 모드로 실행
cd ..
node index.js %*
cd scripts

pause