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
const environment = require('./config/environment');
const proxyManager = require('./lib/services/proxy-manager');

/**
 * 다음 실행할 키워드를 가져오고 즉시 실행 상태로 업데이트
 * FOR UPDATE SKIP LOCKED로 동시성 제어
 */
async function getAndLockNextKeyword(browser) {
  const osType = environment.osType;
  
  const query = `
    UPDATE test_keywords 
    SET 
      last_executed_at = NOW(),
      current_executions = current_executions + 1
    WHERE id = (
      SELECT id 
      FROM test_keywords 
      WHERE is_active = true 
        AND os_type = $1 
        AND browser = $2
        AND date = CURRENT_DATE
        AND current_executions < max_executions
      ORDER BY current_executions ASC, last_executed_at ASC NULLS FIRST
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `;
  
  try {
    const result = await dbService.query(query, [osType, browser]);
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
    
    // 2. 프록시 설정
    let proxyConfig = null;
    if (!keyword.allow_duplicate_ip) {
      const proxy = await proxyManager.getProxy({ strategy: 'sequential' });
      if (proxy) {
        proxyConfig = proxy;
        console.log(`🔐 [${browserType}] 프록시: ${proxy.name}`);
      }
    } else {
      console.log(`🔓 [${browserType}] 프록시 없이 실행 (중복 IP 허용)`);
    }
    
    // 3. 브라우저 실행
    const launchResult = await launchBrowserPersistent(browserType, {
      profileName: keyword.profile_name || 'default',
      proxy: proxyConfig,
      noProxy: !proxyConfig
    });
    
    browser = launchResult.browser;
    context = launchResult.context;
    page = launchResult.page;
    
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
      success: success,
      productFound: executionResult.productFound,
      productRank: executionResult.productRank,
      pagesSearched: executionResult.pagesSearched,
      cartClicked: executionResult.cartClicked,
      errorMessage: executionResult.errorMessage,
      durationMs: Date.now() - startTime,
      browserUsed: browserType,
      proxyUsed: proxyConfig ? proxyConfig.server : 'direct'
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
    environment.printEnvironmentInfo();
    console.log();
    
    // DB 연결
    await keywordService.init();
    
    // 활성 키워드 수 확인
    const activeCount = await keywordService.getActiveKeywordCount(environment.osType);
    console.log(`📊 활성 키워드: ${activeCount}개\n`);
    
    if (activeCount === 0) {
      console.log('⚠️  실행할 키워드가 없습니다. 프로그램을 종료합니다.');
      return;
    }
    
    // 사용 가능한 브라우저 확인
    const browsers = ['chrome', 'firefox', 'webkit'].filter(b => 
      environment.isSupportedBrowser(b)
    );
    
    console.log(`🌐 사용할 브라우저: ${browsers.join(', ')}\n`);
    
    // 계속 실행
    let round = 1;
    while (true) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📌 라운드 ${round} 시작`);
      console.log(`${'='.repeat(50)}`);
      
      // 현재 활성 키워드 확인
      const currentActive = await keywordService.getActiveKeywordCount(environment.osType);
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
    const stats = await keywordService.getKeywordStats(environment.osType);
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