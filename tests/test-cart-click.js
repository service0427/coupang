/**
 * 장바구니 클릭 기능 테스트
 * 사용법: node test-cart-click.js [browser] [keyword] [productCode]
 * 예시: node test-cart-click.js chrome "노트북" 7291381328
 */

const { launchBrowserPersistent } = require('../lib/core/browser-launcher');
const { searchAndClickProduct } = require('../lib/handlers/coupang-handler');

async function testCartClick(browserType, keyword, productCode) {
  console.log('🛒 장바구니 클릭 기능 테스트 시작\n');
  
  let browser, context, page;
  
  try {
    console.log('📌 테스트 정보:');
    console.log(`   브라우저: ${browserType}`);
    console.log(`   키워드: ${keyword}`);
    console.log(`   상품코드: ${productCode}`);
    console.log(`   장바구니 클릭: ✅\n`);
    
    // 브라우저 실행
    console.log(`🚀 ${browserType} 브라우저 실행...\n`);
    const launchResult = await launchBrowserPersistent(
      browserType,
      null,
      'test_cart',
      false,
      true,
      false
    );
    
    browser = launchResult.browser;
    context = launchResult.context;
    page = launchResult.page;
    
    // 쿠팡 자동화 실행
    console.log('🔍 쿠팡 상품 검색 및 장바구니 테스트...\n');
    const result = await searchAndClickProduct(page, browserType, {
      keyword: keyword,
      suffix: '',
      productCode: productCode,
      cartClickEnabled: true,
      maxPages: 10
    });
    
    // 결과 출력
    console.log('\n📊 테스트 결과:');
    console.log(`   상품 검색: ${result.productFound ? '✅ 성공' : '❌ 실패'}`);
    console.log(`   상품 순위: ${result.productRank || 'N/A'}위`);
    console.log(`   검색 페이지: ${result.pagesSearched}페이지`);
    console.log(`   장바구니 추가: ${result.cartClicked ? '✅ 성공' : '❌ 실패'}`);
    
    if (result.errorMessage) {
      console.log(`   에러: ${result.errorMessage}`);
    }
    
    // 대기
    console.log('\n⏳ 10초 후 브라우저 종료...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ 테스트 중 오류:', error.message);
  } finally {
    // 정리
    if (browser) {
      await browser.close();
    }
    console.log('\n✅ 테스트 완료!');
  }
}

// 직접 실행 시
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('사용법: node test-cart-click.js [browser] [keyword] [productCode]');
    console.log('예시: node test-cart-click.js chrome "노트북" 7291381328');
    console.log('      node test-cart-click.js firefox "삼성 노트북" 8429938998');
    console.log('\n지원 브라우저: chrome, firefox, webkit');
    process.exit(1);
  }
  
  const [browserType, keyword, productCode] = args;
  
  // 브라우저 타입 검증
  const validBrowsers = ['chrome', 'firefox', 'webkit'];
  if (!validBrowsers.includes(browserType.toLowerCase())) {
    console.log(`❌ 잘못된 브라우저: ${browserType}`);
    console.log('지원 브라우저: chrome, firefox, webkit');
    process.exit(1);
  }
  
  testCartClick(browserType.toLowerCase(), keyword, productCode);
}

module.exports = { testCartClick };