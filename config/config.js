// Windows 11 환경 설정
const os = require('os');

const config = {
  
  // 브라우저 창 크기 (1920x1080)
  browserSize: {
    width: 1200,
    height: 800
  },
  
  // 브라우저별 설정
  browsers: {
    chrome: {
      channel: 'chrome', // Windows에서는 'chrome' 또는 'msedge' 사용 가능
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox', // Windows에서 권한 문제 해결
        '--disable-setuid-sandbox',
        '--disable-gpu' // GPU 가속 비활성화
      ]
    },
    firefox: {
      args: [
        // Firefox 추가 인자 (필요시)
      ],
      firefoxUserPrefs: {
        'dom.webdriver.enabled': false,
        'useAutomationExtension': false
      }
    },
    webkit: {
      // WebKit은 추가 설정 불필요
    }
  },
  
  // 타임아웃 설정
  timeouts: {
    navigation: 30000,
    selector: 10000,
    delay: {
      short: 1000,
      medium: 2000,
      long: 3000
    }
  }
};

module.exports = config;