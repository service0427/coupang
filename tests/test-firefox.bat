@echo off
echo Firefox 테스트 (프록시 없이)
set PROXY_SERVER=
node index.js -b firefox
pause