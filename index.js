const { launchBrowser, launchBrowserPersistent } = require('./lib/core/browser-launcher');
const { searchAndClick } = require('./lib/handlers/coupang-handler');
const downloadTracker = require('./lib/trackers/download-tracker');
const cookieTracker = require('./lib/trackers/cookie-tracker');
const proxyManager = require('./lib/services/proxy-manager');
const workflowManager = require('./lib/core/workflow-manager');
const readline = require('readline');

(async () => {
  const args = process.argv.slice(2);
  let browserType = 'chrome';
  let proxyMode = null; // null이면 기본 모드 사용
  let usePersistent = true; // 기본값: 영구 프로필 사용
  let profileName = null; // null이면 브라우저명 사용
  let clearSession = false; // 기본값: 세션 데이터 유지
  let useTracker = false; // 기본값: 트래커 사용 안 함
  let workflowId = 'search-click'; // 기본 워크플로우
  let workflowOptions = {}; // 워크플로우 옵션
  
  // 워크플로우 매니저 초기화 및 로드
  await workflowManager.loadAll();
  
  // 도움말 표시
  if (args.includes('--help') || args.includes('-h')) {
    console.log('사용법: node index.js [옵션]');
    console.log('옵션:');
    console.log('  --browser <브라우저>     브라우저 선택 (chrome, firefox, webkit)');
    console.log('  --proxy <모드>          프록시 모드 (sequential, random, <id>, none)');
    console.log('  --no-persistent         일회성 세션 사용 (프로필 재사용 안 함)');
    console.log('  --clear-session         쿠키/세션/스토리지 초기화');
    console.log('  --profile-name <이름>    프로필 폴더명 지정 (형식: 브라우저명_프로필명)');
    console.log('  --tracker               다운로드 및 쿠키 추적 활성화');
    console.log('  --workflow <ID>         워크플로우 선택 (기본: search-click)');
    console.log('  --workflow-help         사용 가능한 워크플로우 목록 표시');
    console.log('  --help, -h              도움말 표시');
    console.log('\n예시:');
    console.log('  node index.js --browser firefox');
    console.log('  node index.js --browser chrome --proxy none');
    console.log('  node index.js --browser chrome --profile-name work');
    console.log('  node index.js --browser chrome --proxy sequential');
    console.log('  node index.js --browser firefox --clear-session');
    console.log('  node index.js --workflow signup');
    console.log('  node index.js --workflow product-search --browser chrome');
    console.log('\n프로필 경로 예시:');
    console.log('  기본: data/browser-profiles/chrome/');
    console.log('  커스텀: data/browser-profiles/chrome_work/');
    process.exit(0);
  }
  
  // 워크플로우 도움말
  if (args.includes('--workflow-help')) {
    workflowManager.printHelp();
    process.exit(0);
  }
  
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--browser' || args[i] === '-b') && i + 1 < args.length) {
      browserType = args[i + 1];
      i++;
    } else if (args[i] === '--proxy' && i + 1 < args.length) {
      proxyMode = args[i + 1];
      i++;
    } else if (args[i] === '--no-persistent') {
      usePersistent = false;
    } else if (args[i] === '--profile-name' && i + 1 < args.length) {
      profileName = args[i + 1];
      i++;
    } else if (args[i] === '--clear-session') {
      clearSession = true;
    } else if (args[i] === '--no-proxy') {
      // 하위 호환성을 위해 유지
      proxyMode = 'none';
    } else if (args[i] === '--tracker') {
      useTracker = true;
    } else if (args[i] === '--workflow' && i + 1 < args.length) {
      workflowId = args[i + 1];
      i++;
    }
  }
  
  // 프로필명 처리: 브라우저명_프로필명 형식
  const actualProfileName = profileName ? `${browserType}_${profileName}` : browserType;
  
  // 프록시 매니저 초기화
  await proxyManager.init();
  const proxy = await proxyManager.getProxy(proxyMode);
  
  // 영구 프로필 모드 또는 일반 모드 선택
  const { browser, page, context } = usePersistent 
    ? await launchBrowserPersistent(browserType, proxy, actualProfileName, clearSession, useTracker)
    : await launchBrowser(browserType, proxy, false, null, false, useTracker);
  
  // 트래커 사용 시 초기 쿠키 저장
  let initialCookies = [];
  if (useTracker) {
    initialCookies = await cookieTracker.saveInitialCookies(context);
  }
  
  try {
    // 워크플로우 실행
    await workflowManager.execute(workflowId, page, browserType, workflowOptions);
    
    // 작업 완료 후 대기
    console.log('\n⏸️  작업이 완료되었습니다. 계속하려면 Enter를 누르거나 브라우저를 닫으세요...');
    
    // readline 인터페이스 생성
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Promise로 대기
    let isResolved = false;
    await new Promise((resolve) => {
      const handleClose = () => {
        if (!isResolved) {
          isResolved = true;
          console.log('✅ 브라우저가 닫혔습니다. 종료합니다...');
          rl.close();
          resolve();
        }
      };
      
      // Enter 키 입력 대기
      rl.once('line', () => {
        if (!isResolved) {
          isResolved = true;
          console.log('✅ 사용자 입력 감지됨. 종료합니다...');
          rl.close();
          resolve();
        }
      });
      
      // 브라우저가 닫히면 자동으로 resolve
      page.on('close', handleClose);
      
      // 브라우저 context가 닫히면 자동으로 resolve
      context.on('close', handleClose);
    });
    
  } catch (error) {
    console.error('❌ 워크플로우 실행 중 오류:', error.message);
  } finally {
    // 트래커 사용 시 최종 쿠키 저장 및 비교
    if (useTracker) {
      const finalCookies = await cookieTracker.saveFinalCookies(context);
      const comparison = await cookieTracker.compareCookies(initialCookies, finalCookies);
      
      // 쿠키 변화 분석 출력
      cookieTracker.printComparison(comparison);
    }
    
    // 브라우저가 아직 열려있으면 닫기
    if (browser.isConnected()) {
      await browser.close();
      console.log('\n🌐 브라우저 종료');
    }
    
    // 트래커 사용 시 다운로드 통계 출력
    if (useTracker) {
      await downloadTracker.printStatistics();
    }
  }
})();