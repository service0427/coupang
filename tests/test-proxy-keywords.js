/**
 * 프록시 설정된 키워드 테스트
 */

const { launchBrowserPersistent } = require('../lib/core/browser-launcher');
const { searchAndClickProduct } = require('../lib/handlers/coupang-handler');
const dbService = require('../lib/services/db-service');

async function testProxyKeyword(keywordId) {
  try {
    await dbService.init();
    
    // 키워드 정보 조회
    const result = await dbService.query(
      'SELECT * FROM test_keywords WHERE id = $1',
      [keywordId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ 키워드를 찾을 수 없습니다.');
      return;
    }
    
    const keyword = result.rows[0];
    console.log('\n📊 테스트할 키워드:');
    console.log(`   ID: ${keyword.id}`);
    console.log(`   키워드: ${keyword.keyword} ${keyword.suffix || ''}`);
    console.log(`   브라우저: ${keyword.browser}`);
    console.log(`   프록시: ${keyword.proxy_server || 'NULL'}`);
    console.log(`   상품코드: ${keyword.product_code}`);
    
    // 프록시 설정
    let proxyConfig = null;
    if (keyword.proxy_server) {
      proxyConfig = {
        server: keyword.proxy_server
      };
      console.log(`\n🔐 프록시 사용: ${keyword.proxy_server}`);
    } else {
      console.log('\n💻 직접 연결 (프록시 없음)');
    }
    
    // 브라우저 실행
    console.log(`\n🚀 ${keyword.browser} 브라우저 실행...`);
    const launchResult = await launchBrowserPersistent(
      keyword.browser,
      proxyConfig,
      'test_proxy',
      false,
      false
    );
    
    const { browser, context, page } = launchResult;
    
    // 쿠팡 자동화 실행
    const executionResult = await searchAndClickProduct(page, keyword.browser, {
      keyword: keyword.keyword,
      suffix: keyword.suffix,
      productCode: keyword.product_code,
      cartClickEnabled: keyword.cart_click_enabled,
      maxPages: 10
    });
    
    console.log('\n📊 실행 결과:');
    console.log(`   성공: ${executionResult.success ? '✅' : '❌'}`);
    console.log(`   상품 발견: ${executionResult.productFound ? '✅' : '❌'}`);
    console.log(`   순위: ${executionResult.productRank || 'N/A'}`);
    console.log(`   장바구니: ${executionResult.cartClicked ? '✅' : '❌'}`);
    
    if (executionResult.errorMessage) {
      console.log(`   오류: ${executionResult.errorMessage}`);
    }
    
    // 10초 대기
    console.log('\n⏳ 10초 후 종료...');
    await page.waitForTimeout(10000);
    
    // 브라우저 종료
    await browser.close();
    
  } catch (error) {
    console.error('❌ 테스트 중 오류:', error.message);
  } finally {
    await dbService.close();
  }
}

// 직접 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('사용법: node test-proxy-keywords.js [keywordId]');
    console.log('예시: node test-proxy-keywords.js 7');
    process.exit(1);
  }
  
  const keywordId = parseInt(args[0]);
  testProxyKeyword(keywordId);
}

module.exports = { testProxyKeyword };