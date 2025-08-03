const config = require('../../config/config');
const os = require('os');
const resourceBlocker = require('../trackers/resource-blocker');

/**
 * 브라우저별 공통 설정
 */
async function setupBrowser(page, browserType) {
  
  // navigator.webdriver 숨기기
  await page.addInitScript((browserType) => {
    console.log(`🔍 ${browserType} navigator.webdriver (변경 전):`, navigator.webdriver);
    
    // webdriver 속성 숨기기
    if (browserType !== 'Chrome') {
      const proto = Object.getPrototypeOf(navigator);
      Object.defineProperty(proto, 'webdriver', {
        get: () => false,
        configurable: true
      });
    }
  }, browserType);
  
  // 리소스 차단 적용 (현재 비활성화 - 통계 수집 모드)
  // await resourceBlocker.applyToPage(page);
}

/**
 * 브라우저 정보 출력
 */
function printBrowserInfo(browserWidth, browserHeight, proxy) {
  console.log(`📏 브라우저 크기: ${browserWidth} x ${browserHeight}`);
  console.log(`💻 운영체제: ${os.platform()} ${os.release()}`);
  if (proxy) {
    console.log(`🔐 프록시 서버: ${proxy.server}`);
  } else {
    console.log('🌐 프록시 사용 안 함');
  }
}

module.exports = {
  setupBrowser,
  printBrowserInfo
};