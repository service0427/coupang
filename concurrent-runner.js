/**
 * 동시 구동 프로그램
 * - 브라우저별로 동시에 실행
 * - DB에서 직접 키워드를 가져와서 실행
 * - 동시성 제어를 위해 FOR UPDATE SKIP LOCKED 사용
 */

const { launchBrowserPersistent } = require('./lib/core/browser-launcher');
const { searchAndClickProduct } = require('./lib/handlers/coupang-handler');
const keywordService = require('./lib/services/keyword-service');
const dbService = require('./lib/services/db-service');
const proxyManager = require('./lib/services/proxy-manager');
const proxyToggleService = require('./lib/services/proxy-toggle-service');

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const options = {
  agent: 'default',  // 기본 에이전트
  screen: { width: 1200, height: 800 },
  debug: false,
  maxRounds: null,  // null = 무한, 숫자 = 최대 라운드 수
  once: false       // true = 각 키워드를 한 번만 실행
};

// 인자 처리
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--agent':
      if (args[i + 1]) {
        options.agent = args[i + 1];
        i++;
      }
      break;
    case '--screen':
      if (args[i + 1] && args[i + 2]) {
        options.screen.width = parseInt(args[i + 1]);
        options.screen.height = parseInt(args[i + 2]);
        i += 2;
      }
      break;
    case '--debug':
      options.debug = true;
      process.env.NODE_ENV = 'development';
      break;
    case '--max-rounds':
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        options.maxRounds = parseInt(args[i + 1]);
        i++;
      }
      break;
    case '--once':
      options.once = true;
      break;
    case '--help':
      console.log(`
사용법: node concurrent-runner.js [옵션]

옵션:
  --agent <이름>           에이전트 이름 설정 (기본값: default)
  --screen <너비> <높이>   브라우저 창 크기 설정 (기본값: 1200 800)
  --max-rounds <숫자>      최대 실행 라운드 수 (기본값: 무한)
  --once                   각 키워드를 한 번만 실행하고 종료
  --debug                  디버그 모드 활성화
  --help                   이 도움말 표시

예시:
  node concurrent-runner.js
  node concurrent-runner.js --agent agent1
  node concurrent-runner.js --agent test --screen 1920 1080
  node concurrent-runner.js --max-rounds 3
  node concurrent-runner.js --once
  node concurrent-runner.js --debug
`);
      process.exit(0);
  }
}

// 환경 변수 설정 (명령줄 인자가 우선순위 높음)
process.env.AGENT_NAME = options.agent;
process.env.SCREEN_WIDTH = options.screen.width.toString();
process.env.SCREEN_HEIGHT = options.screen.height.toString();

/**
 * 다음 실행할 키워드를 가져오고 즉시 실행 상태로 업데이트
 * FOR UPDATE SKIP LOCKED로 동시성 제어
 */
async function getAndLockNextKeyword(browser) {
  const agent = process.env.AGENT_NAME || 'default';
  
  const query = `
    UPDATE test_keywords 
    SET 
      last_executed_at = NOW(),
      current_executions = current_executions + 1
    WHERE id = (
      SELECT id 
      FROM test_keywords 
      WHERE browser = $1
        AND date = CURRENT_DATE
        AND (agent = $2 OR agent IS NULL)
        AND current_executions < max_executions
      ORDER BY current_executions ASC, last_executed_at ASC NULLS FIRST
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, date, keyword, suffix, product_code, agent, browser, profile_name,
              proxy_server, ip_change_enabled, allow_duplicate_ip,
              cart_click_enabled, use_persistent, clear_session,
              max_executions, current_executions,
              success_count, fail_count, last_executed_at;
  `;
  
  try {
    const result = await dbService.query(query, [browser, agent]);
    return result.rows[0] || null;
  } catch (error) {
    console.error(`❌ [${browser}] 키워드 잠금 실패:`, error.message);
    return null;
  }
}

/**
 * 단일 브라우저 실행
 */
async function runSingleBrowser(browserType) {
  const startTime = Date.now();
  console.log(`\n🚀 [${browserType.toUpperCase()}] 브라우저 시작...`);
  
  let browser = null;
  let context = null;
  let page = null;
  let actualIp = null;  // 실제 사용된 IP
  
  try {
    // 1. 다음 키워드 가져오기 (동시성 안전)
    const keyword = await getAndLockNextKeyword(browserType);
    
    if (!keyword) {
      console.log(`⚠️  [${browserType}] 실행할 키워드가 없습니다.`);
      return { browser: browserType, success: false, reason: 'no_keyword' };
    }
    
    console.log(`📌 [${browserType}] 선택된 키워드: "${keyword.keyword}${keyword.suffix || ''}" (ID: ${keyword.id})`);
    console.log(`   상품 코드: ${keyword.product_code}`);
    console.log(`   진행 상황: ${keyword.current_executions}/${keyword.max_executions}`);
    
    // 2. 프록시 설정 (proxy_server 값에 따라)
    let proxyConfig = null;
    if (keyword.proxy_server && keyword.proxy_server.trim() !== '') {
      // proxy_server 값이 있으면 해당 프록시 사용
      proxyConfig = {
        server: keyword.proxy_server.trim(),
        name: keyword.proxy_server.trim()
      };
      console.log(`🔐 [${browserType}] 프록시 사용: ${proxyConfig.server}`);
      
      // IP 변경은 이미 시작 시 완료되었으므로 여기서는 상태만 표시
      if (keyword.ip_change_enabled) {
        console.log(`✅ [${browserType}] IP 변경 완료된 프록시 사용`);
      }
    } else {
      // proxy_server가 null이거나 빈 문자열이면 직접 연결
      console.log(`💻 [${browserType}] 직접 연결 (프록시 없음)`);
    }
    
    // 3. 브라우저 실행
    let launchResult;
    
    if (keyword.use_persistent) {
      // 영구 프로필 모드
      console.log(`📁 [${browserType}] 프로필 모드: ${keyword.profile_name || 'default'}`);
      if (keyword.clear_session) {
        console.log(`🧹 [${browserType}] 세션 초기화 모드`);
      }
      
      launchResult = await launchBrowserPersistent(
        browserType,
        proxyConfig,
        keyword.profile_name || 'default',
        keyword.clear_session || false,
        false // useTracker
      );
    } else {
      // 일회성 세션 모드 (시크릿 모드처럼)
      console.log(`🔒 [${browserType}] 일회성 세션 모드 (시크릿)`);
      
      const { launchBrowser } = require('./lib/core/browser-launcher');
      launchResult = await launchBrowser(
        browserType,
        proxyConfig,
        false, // usePersistent
        null,  // profileName
        false, // clearSession
        false  // useTracker
      );
    }
    
    browser = launchResult.browser;
    context = launchResult.context;
    page = launchResult.page;
    
    // 3.5. IP 정보 수집 (프록시 사용 시)
    if (proxyConfig) {
      try {
        const ipPage = await context.newPage();
        await ipPage.goto('http://techb.kr/ip.php', { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });
        const ipInfo = await ipPage.evaluate(() => document.body.innerText);
        actualIp = ipInfo.split('\n')[0].trim();
        console.log(`📡 [${browserType}] 실제 IP: ${actualIp}`);
        await ipPage.close();
      } catch (e) {
        console.log(`⚠️  [${browserType}] IP 확인 실패`);
      }
    }
    
    // 4. 쿠팡 자동화 실행
    const executionResult = await searchAndClickProduct(page, browserType, {
      keyword: keyword.keyword,
      suffix: keyword.suffix,
      productCode: keyword.product_code,
      cartClickEnabled: keyword.cart_click_enabled,
      maxPages: 10
    });
    
    // 5. 실행 결과 기록
    const success = executionResult.success;
    await keywordService.recordExecutionResult(keyword.id, success, executionResult.errorMessage);
    
    // 6. 실행 로그 저장
    await keywordService.saveExecutionLog({
      keywordId: keyword.id,
      agent: keyword.agent,
      success: success,
      productFound: executionResult.productFound,
      productRank: executionResult.productRank,
      urlRank: executionResult.urlRank,
      pagesSearched: executionResult.pagesSearched,
      cartClicked: executionResult.cartClicked,
      errorMessage: executionResult.errorMessage,
      durationMs: Date.now() - startTime,
      browserUsed: browserType,
      proxyUsed: proxyConfig ? proxyConfig.server : 'direct',
      actualIp: actualIp,
      finalUrl: executionResult.finalUrl
    });
    
    console.log(`\n✅ [${browserType}] 실행 완료! (${Math.round((Date.now() - startTime) / 1000)}초)`);
    
    return {
      browser: browserType,
      success: true,
      keyword: keyword,
      result: executionResult
    };
    
  } catch (error) {
    console.error(`\n❌ [${browserType}] 실행 중 오류:`, error.message);
    return {
      browser: browserType,
      success: false,
      error: error.message
    };
    
  } finally {
    // 브라우저 정리
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * 메인 동시 실행 함수
 */
async function runConcurrent() {
  console.log('=================================');
  console.log('🚀 동시 구동 프로그램 시작');
  console.log('=================================');
  
  try {
    // 환경 정보 출력
    console.log('🏷️  현재 에이전트:', process.env.AGENT_NAME || 'default');
    console.log(`📏 화면 크기: ${options.screen.width} x ${options.screen.height}`);
    console.log();
    
    // DB 연결
    await keywordService.init();
    
    // 활성 키워드 수 확인
    const agent = process.env.AGENT_NAME || 'default';
    const activeCount = await keywordService.getActiveKeywordCount(agent);
    console.log(`📊 활성 키워드: ${activeCount}개\n`);
    
    // IP 변경이 필요한 프록시 사전 체크
    console.log('🔍 IP 변경이 필요한 프록시 확인 중...\n');
    const ipChangeKeywords = await dbService.query(`
      SELECT DISTINCT proxy_server
      FROM test_keywords
      WHERE date = CURRENT_DATE
        AND (agent = $1 OR agent IS NULL)
        AND proxy_server IS NOT NULL
        AND ip_change_enabled = true
        AND current_executions < max_executions
    `, [agent]);
    
    if (ipChangeKeywords.rows.length > 0) {
      console.log(`📡 IP 변경이 필요한 프록시: ${ipChangeKeywords.rows.length}개\n`);
      
      for (const row of ipChangeKeywords.rows) {
        const proxyServer = row.proxy_server;
        console.log(`🔄 프록시 IP 변경 시도: ${proxyServer}`);
        
        const toggleResult = await proxyToggleService.toggleIp(proxyServer);
        
        if (toggleResult.success) {
          console.log(`✅ ${toggleResult.message}`);
          // IP 변경 후 안정화 대기
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // IP 확인
          console.log('   IP 확인 중...');
          try {
            const { chromium } = require('playwright');
            const browser = await chromium.launch({
              headless: true,
              proxy: { server: proxyServer }
            });
            
            const context = await browser.newContext();
            const page = await context.newPage();
            
            await page.goto('http://techb.kr/ip.php', { 
              waitUntil: 'domcontentloaded',
              timeout: 15000 
            });
            
            const ipInfo = await page.evaluate(() => document.body.innerText);
            console.log(`   ✅ 새 IP 확인됨: ${ipInfo.split('\n')[0]}`);
            
            await browser.close();
          } catch (error) {
            console.log(`   ❌ IP 확인 실패: ${error.message}`);
          }
        } else {
          console.log(`⚠️  IP 변경 실패: ${toggleResult.error}`);
          if (toggleResult.remainingTime) {
            console.log(`   → ${toggleResult.remainingTime}초 후 재시도 가능`);
          }
        }
        console.log();
      }
      
      console.log('✅ 프록시 사전 체크 완료\n');
      console.log('⏳ 5초 후 실행 시작...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    if (activeCount === 0) {
      console.log('⚠️  실행할 키워드가 없습니다. 프로그램을 종료합니다.');
      return;
    }
    
    // 모든 OS에서 3개 브라우저 사용
    const browsers = ['chrome', 'firefox', 'webkit'];
    
    console.log(`🌐 사용할 브라우저: ${browsers.join(', ')}\n`);
    
    // 계속 실행
    let round = 1;
    while (true) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📌 라운드 ${round} 시작`);
      if (options.maxRounds) {
        console.log(`   (${round}/${options.maxRounds} 라운드)`);
      }
      console.log(`${'='.repeat(50)}`);
      
      // 최대 라운드 수 체크
      if (options.maxRounds && round > options.maxRounds) {
        console.log('\n🏁 최대 라운드 수에 도달했습니다. 프로그램을 종료합니다.');
        break;
      }
      
      // --once 옵션 체크
      if (options.once && round > 1) {
        console.log('\n🏁 --once 옵션: 1회 실행 완료. 프로그램을 종료합니다.');
        break;
      }
      
      // 현재 활성 키워드 확인
      const currentActive = await keywordService.getActiveKeywordCount(agent);
      if (currentActive === 0) {
        console.log('\n✅ 모든 키워드 실행 완료! 프로그램을 종료합니다.');
        break;
      }
      
      console.log(`\n📊 남은 활성 키워드: ${currentActive}개`);
      
      // 브라우저별로 동시 실행
      const promises = browsers.map(browser => runSingleBrowser(browser));
      const results = await Promise.all(promises);
      
      // 결과 요약
      console.log('\n📊 라운드 결과:');
      results.forEach(result => {
        if (result.success && result.keyword) {
          console.log(`   ${result.browser}: ✅ 성공 - "${result.keyword.keyword}${result.keyword.suffix || ''}"`);
        } else if (result.reason === 'no_keyword') {
          console.log(`   ${result.browser}: ⏹️  키워드 없음`);
        } else {
          console.log(`   ${result.browser}: ❌ 실패`);
        }
      });
      
      // 모든 브라우저가 키워드를 찾지 못했으면 종료
      const allNoKeyword = results.every(r => r.reason === 'no_keyword');
      if (allNoKeyword) {
        console.log('\n✅ 더 이상 실행할 키워드가 없습니다. 프로그램을 종료합니다.');
        break;
      }
      
      // 다음 라운드 전 잠시 대기
      console.log('\n⏳ 5초 후 다음 라운드 시작...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      round++;
    }
    
    // 최종 통계
    console.log('\n📊 최종 통계:');
    const stats = await keywordService.getKeywordStats(agent);
    if (stats.length > 0) {
      const stat = stats[0];
      console.log(`   총 실행: ${stat.total_executions}회`);
      console.log(`   성공: ${stat.total_success}회`);
      console.log(`   실패: ${stat.total_failures}회`);
      console.log(`   성공률: ${stat.success_rate}%`);
    }
    
  } catch (error) {
    console.error('❌ 프로그램 오류:', error);
  } finally {
    await keywordService.close();
    console.log('\n👋 프로그램 종료');
  }
}

// 프로그램 실행
if (require.main === module) {
  runConcurrent().catch(console.error);
}

module.exports = { runConcurrent, runSingleBrowser, getAndLockNextKeyword };