const { chromium, firefox, webkit } = require('playwright');
const config = require('../../config/config');
const { setupBrowser, printBrowserInfo } = require('./browser-common');
const downloadTracker = require('../trackers/download-tracker');
const cookieTracker = require('../trackers/cookie-tracker');
const path = require('path');
const fs = require('fs').promises;

/**
 * 브라우저별 유저 데이터 디렉토리 경로
 */
function getUserDataDir(profileName) {
  const baseDir = path.join(process.cwd(), 'browser-data');
  return path.join(baseDir, profileName);
}

/**
 * 쿠키와 로컬 스토리지 초기화 (쿠팡 검색 기록 포함)
 */
async function clearCookiesAndStorage(context) {
  try {
    // 모든 쿠키 삭제
    await context.clearCookies();
    console.log('🧹 쿠키 초기화 완료');
    
    // 페이지를 생성해서 스토리지 초기화
    const tempPage = await context.newPage();
    
    // 쿠팡 메인 페이지에서 스토리지 초기화 (검색 기록 삭제)
    try {
      await tempPage.goto('https://www.coupang.com', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      // 쿠팡 도메인에서 모든 스토리지 초기화
      await tempPage.evaluate(() => {
        try {
          // localStorage 초기화
          localStorage.clear();
          
          // sessionStorage 초기화
          sessionStorage.clear();
          
          // 검색 기록 관련 키 확인 및 삭제
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('search') || key.includes('query') || key.includes('history'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          
          // IndexedDB 삭제 시도
          if (window.indexedDB && window.indexedDB.databases) {
            window.indexedDB.databases().then(databases => {
              databases.forEach(db => {
                window.indexedDB.deleteDatabase(db.name);
              });
            });
          }
        } catch (e) {
          console.error('Storage clear error:', e);
        }
      });
      
      console.log('🧹 쿠팡 스토리지 및 검색 기록 초기화 완료');
    } catch (e) {
      // 쿠팡 접속 실패 시 일반 초기화
      await tempPage.goto('about:blank');
      await tempPage.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          // 무시
        }
      });
      console.log('🧹 일반 스토리지 초기화 완료 (쿠팡 접속 실패)');
    }
    
    await tempPage.close();
  } catch (error) {
    console.error('⚠️ 쿠키/스토리지 초기화 중 오류:', error.message);
  }
}

/**
 * 통합된 브라우저 실행 함수
 * @param {string} browserType - 브라우저 타입 (chrome, firefox, webkit)
 * @param {Object} proxy - 프록시 설정 객체
 * @param {boolean} persistent - 영구 프로필 사용 여부
 * @param {string} profileName - 프로필 이름
 * @param {boolean} clearSession - 세션 초기화 여부
 * @param {boolean} useTracker - 트래커 사용 여부
 * @param {boolean} gpuDisabled - GPU 비활성화 여부
 */
async function launchBrowser(browserType, proxy = null, persistent = false, profileName = null, clearSession = false, useTracker = false, gpuDisabled = false) {
  let browser;
  let page;
  let context;
  
  // 프록시 설정
  const proxyConfig = proxy || undefined;
  
  // 브라우저 창 크기 설정
  // 환경 설정에서 화면 크기 가져오기 (명령줄 인자 우선)
  const environment = require('../../config/environment');
  const browserWidth = environment.screenWidth;
  const browserHeight = environment.screenHeight;
  
  if (persistent) {
    // 영구 프로필 모드
    const actualProfileName = profileName || browserType;
    const userDataDir = getUserDataDir(actualProfileName);
    
    try {
      await fs.mkdir(userDataDir, { recursive: true });
    } catch (e) {
      // 디렉토리가 이미 존재하면 무시
    }
    
    console.log(`🚀 ${browserType.charAt(0).toUpperCase() + browserType.slice(1)} 영구 프로필 모드 시작...`);
    console.log(`📁 유저 데이터 디렉토리: ${userDataDir}\n`);
    
    if (browserType === 'chrome') {
      // clearSession 사용 시 추가 옵션
      const chromeArgs = [
        ...config.browsers.chrome.args,
        `--window-size=${browserWidth},${browserHeight}`,
      ];
      
      if (clearSession) {
        chromeArgs.push(
          '--disable-application-cache',
          '--disable-offline-load-stale-cache',
          '--disable-gpu-shader-disk-cache',
          '--media-cache-size=0',
          '--disk-cache-size=0'
        );
      }
      
      // GPU 비활성화 옵션
      if (gpuDisabled) {
        chromeArgs.push('--disable-gpu');
      }
      
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        channel: 'chrome',
        args: chromeArgs,
        viewport: { width: browserWidth, height: browserHeight },
        acceptDownloads: true,
        proxy: proxyConfig
      });
    } else if (browserType === 'firefox') {
      // Firefox preferences 복사
      const firefoxPrefs = { ...config.browsers.firefox.firefoxUserPrefs };
      
      // GPU 비활성화 옵션
      if (gpuDisabled) {
        firefoxPrefs['layers.acceleration.disabled'] = true;
        firefoxPrefs['gfx.direct2d.disabled'] = true;
        firefoxPrefs['gfx.direct3d11.enable-debug-layer'] = false;
        firefoxPrefs['webgl.disabled'] = true;
      }
      
      context = await firefox.launchPersistentContext(userDataDir, {
        headless: false,
        firefoxUserPrefs: firefoxPrefs,
        viewport: { width: browserWidth, height: browserHeight },
        acceptDownloads: true,
        proxy: proxyConfig
      });
    } else if (browserType === 'webkit') {
      // Ubuntu에서 WebKit persistent context의 viewport 문제 해결
      const isLinux = process.platform === 'linux';
      const contextOptions = {
        headless: false,
        acceptDownloads: true,
        proxy: proxyConfig
      };
      
      // Linux에서는 viewport 설정 제외
      if (!isLinux) {
        contextOptions.viewport = { width: browserWidth, height: browserHeight };
      }
      
      console.log(`🔧 [webkit] 플랫폼: ${process.platform}${isLinux ? ' (viewport 설정 제외)' : ''}`);
      
      try {
        context = await webkit.launchPersistentContext(userDataDir, contextOptions);
      } catch (error) {
        if (error.message.includes('Failed to resize window') && isLinux) {
          console.log(`⚠️ [webkit] Linux viewport 오류 감지, viewport 없이 재시도...`);
          // viewport 완전히 제거하고 재시도
          delete contextOptions.viewport;
          context = await webkit.launchPersistentContext(userDataDir, contextOptions);
        } else {
          throw error;
        }
      }
    }
    
    browser = context.browser();
    
    // clearSession 옵션에 따라 쿠키와 스토리지 초기화
    if (clearSession) {
      await clearCookiesAndStorage(context);
    } else {
      console.log('🔒 세션 데이터 유지');
    }
    
  } else {
    // 일반 모드 (비영구)
    if (browserType === 'chrome') {
      console.log('🚀 Chrome 테스트 시작...\n');
      
      const chromeArgs = [
        ...config.browsers.chrome.args,
        `--window-size=${browserWidth},${browserHeight}`,
      ];
      
      // GPU 비활성화 옵션
      if (gpuDisabled) {
        chromeArgs.push('--disable-gpu');
      }
      
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        args: chromeArgs,
        proxy: proxyConfig
      });
      
      context = await browser.newContext({
        viewport: { width: browserWidth, height: browserHeight },
        acceptDownloads: true
      });
      
    } else if (browserType === 'firefox') {
      console.log('🚀 Firefox 테스트 시작...\n');
      
      // Firefox preferences 복사
      const firefoxPrefs = { ...config.browsers.firefox.firefoxUserPrefs };
      
      // GPU 비활성화 옵션
      if (gpuDisabled) {
        firefoxPrefs['layers.acceleration.disabled'] = true;
        firefoxPrefs['gfx.direct2d.disabled'] = true;
        firefoxPrefs['gfx.direct3d11.enable-debug-layer'] = false;
        firefoxPrefs['webgl.disabled'] = true;
      }
      
      browser = await firefox.launch({
        headless: false,
        firefoxUserPrefs: firefoxPrefs
      });
      
      context = await browser.newContext({
        viewport: { width: browserWidth, height: browserHeight },
        proxy: proxyConfig,
        acceptDownloads: true
      });
      
    } else if (browserType === 'webkit') {
      console.log('🚀 WebKit 테스트 시작...\n');
      
      browser = await webkit.launch({
        headless: false,
        proxy: proxyConfig
      });
      
      // WebKit 컨텍스트 설정 - JA3 우회를 위한 설정 추가
      context = await browser.newContext({
        viewport: { width: browserWidth, height: browserHeight },
        acceptDownloads: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        // HTTP2 비활성화 시도
        ignoreHTTPSErrors: true,
        // 추가 헤더 설정
        extraHTTPHeaders: {
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
    }
  }
  
  // 트래커 사용 시 다운로드 및 쿠키 추적 초기화
  if (useTracker) {
    const trackerProfileName = profileName || browserType;
    await downloadTracker.init(trackerProfileName);
    await cookieTracker.init(trackerProfileName);
  }
  
  // 트래커 사용 시 다운로드 이벤트 리스너 추가
  if (useTracker) {
    context.on('download', async (download) => {
      try {
        const url = download.url();
        const suggestedFilename = download.suggestedFilename();
        
        // 파일 크기를 얻기 위해 다운로드 완료 대기 (최대 5초)
        let fileSize = null;
        try {
          const path = await download.path();
          if (path) {
            const fs = require('fs');
            const stats = fs.statSync(path);
            fileSize = stats.size;
          }
        } catch (e) {
          // 파일 크기를 얻지 못해도 계속 진행
        }
        
        await downloadTracker.addDownload(url, suggestedFilename, fileSize);
      } catch (error) {
        console.error('다운로드 추적 중 오류:', error);
      }
    });
  }
  
  // 페이지 가져오기 또는 생성
  if (persistent) {
    const pages = context.pages();
    if (pages.length > 0) {
      page = pages[0];
      // Linux WebKit에서 기존 페이지의 viewport 설정
      if (browserType === 'webkit' && process.platform === 'linux') {
        try {
          await page.setViewportSize({ width: browserWidth, height: browserHeight });
          console.log(`📐 [webkit] Linux - 기존 페이지 viewport 설정: ${browserWidth}x${browserHeight}`);
        } catch (e) {
          console.log(`⚠️ [webkit] Linux - viewport 설정 실패 (무시하고 계속): ${e.message}`);
        }
      }
    } else {
      page = await context.newPage();
      // Linux WebKit에서 새 페이지의 viewport 설정
      if (browserType === 'webkit' && process.platform === 'linux') {
        try {
          await page.setViewportSize({ width: browserWidth, height: browserHeight });
          console.log(`📐 [webkit] Linux - 새 페이지 viewport 설정: ${browserWidth}x${browserHeight}`);
        } catch (e) {
          console.log(`⚠️ [webkit] Linux - viewport 설정 실패 (무시하고 계속): ${e.message}`);
        }
      }
    }
  } else {
    page = await context.newPage();
  }
  
  // 트래커 사용 시 네트워크 응답 추적 (실제로 다운로드된 리소스만)
  if (useTracker) {
    page.on('response', async (response) => {
      try {
        const url = response.url();
        const status = response.status();
        const request = response.request();
        
        // 차단된 요청은 추적하지 않음
        if (request.failure()) {
          return;
        }
        
        // 성공적인 응답만 추적 (200-299) 또는 304 (Not Modified)
        if ((status >= 200 && status < 300) || status === 304) {
          const headers = response.headers();
          const contentType = headers['content-type'] || '';
          const contentLength = headers['content-length'];
          
          // 캐시 상태 확인
          let cacheStatus = null;
          if (status === 304) {
            cacheStatus = 'hit';
          } else if (headers['x-cache'] && headers['x-cache'].includes('Hit')) {
            cacheStatus = 'hit';
          } else if (headers['x-cache'] && headers['x-cache'].includes('Miss')) {
            cacheStatus = 'miss';
          } else if (headers['cache-control'] && headers['cache-control'].includes('no-cache')) {
            cacheStatus = 'miss';
          } else if (headers['etag'] || headers['last-modified']) {
            cacheStatus = 'revalidated';
          }
          
          // URL에서 파일명 추출
          const urlParts = url.split('/');
          const filename = urlParts[urlParts.length - 1].split('?')[0] || 'unknown';
          
          // 파일 크기 (content-length 헤더 사용)
          const fileSize = contentLength ? parseInt(contentLength) : null;
          
          // 실제로 다운로드된 리소스만 추적
          await downloadTracker.addDownload(url, filename, fileSize, cacheStatus);
        }
      } catch (error) {
        // 오류 무시 (너무 많은 로그 방지)
      }
    });
  }
  
  // 공통 브라우저 설정 적용
  const browserName = browserType.charAt(0).toUpperCase() + browserType.slice(1);
  await setupBrowser(page, browserName);
  
  // 브라우저 정보 출력
  printBrowserInfo(browserWidth, browserHeight, proxyConfig);
  
  return { browser, page, context };
}

// 하위 호환성을 위해 기존 함수로 래핑
async function launchBrowserPersistent(browserType, proxy, profileName, clearSession, useTracker = false, gpuDisabled = false) {
  return launchBrowser(browserType, proxy, true, profileName, clearSession, useTracker, gpuDisabled);
}

module.exports = { launchBrowser, launchBrowserPersistent };