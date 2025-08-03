@echo off
echo =====================================
echo 동시 구동 프로그램 실행
echo =====================================
echo.

REM 현재 OS 타입 설정 (기본값: win11)
set OS_TYPE=win11

REM Node.js로 동시 구동 프로그램 실행
node concurrent-runner.js

echo.
echo 프로그램이 종료되었습니다.
pause