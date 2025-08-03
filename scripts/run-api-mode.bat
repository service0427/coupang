@echo off
echo ========================================
echo 쿠팡 자동화 - API 모드
echo ========================================
echo.

REM API 모드 환경변수 설정
set MODE=api

REM API URL 설정 (필요시 수정)
if "%API_URL%"=="" (
    set API_URL=http://localhost:3000
)

echo API 서버: %API_URL%
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

REM API 모드로 실행
cd ..
node index.js %*
cd scripts

pause