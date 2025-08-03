/**
 * WebKit 대안 방법 - 장바구니 페이지로 직접 이동
 * JA3 차단을 우회하기 위한 대체 접근 방식
 */

const { webkit } = require('playwright');

async function webkitCartAlternative(keyword, productCode) {
  console.log('🔍 WebKit 대안 방법 테스트\n');
  
  let browser, context, page;
  
  try {
    browser = await webkit.launch({ headless: false });
    
    // 기본 Safari 설정 사용
    context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    });
    
    page = await context.newPage();
    
    console.log('방법 1: 상품 페이지 직접 접근');
    // 상품 페이지로 직접 이동
    const productUrl = `https://www.coupang.com/vp/products/${productCode}`;
    await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
    
    await page.waitForTimeout(3000);
    
    // 장바구니 버튼 확인만
    const cartButton = await page.$('button.prod-cart-btn');
    if (cartButton) {
      console.log('✅ 장바구니 버튼 발견');
      console.log('❌ 하지만 JA3 차단으로 API 호출 불가');
    }
    
    console.log('\n방법 2: 장바구니 페이지 직접 확인');
    // 장바구니 페이지로 이동
    await page.goto('https://cart.coupang.com/cartView.pang', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // 로그인 필요 여부 확인
    const loginRequired = await page.$('.login-form, [class*="login"]');
    if (loginRequired) {
      console.log('⚠️ 장바구니 확인을 위해 로그인 필요');
    } else {
      console.log('📊 장바구니 페이지 접근 가능');
    }
    
    console.log('\n📌 WebKit 제한사항:');
    console.log('1. JA3 fingerprinting으로 API 차단됨');
    console.log('2. 장바구니 추가 API 호출 불가');
    console.log('3. Chrome/Firefox 사용 권장');
    
    console.log('\n💡 해결 방법:');
    console.log('1. Chrome 또는 Firefox 사용');
    console.log('2. Playwright-extra with stealth plugin 사용');
    console.log('3. 프록시를 통한 우회 (제한적)');
    
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 직접 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('사용법: node webkit-alternative.js [keyword] [productCode]');
    process.exit(1);
  }
  
  const [keyword, productCode] = args;
  webkitCartAlternative(keyword, productCode);
}

module.exports = { webkitCartAlternative };