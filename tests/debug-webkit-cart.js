/**
 * WebKit 장바구니 문제 디버깅
 * 사용법: node debug-webkit-cart.js [keyword] [productCode]
 */

const { launchBrowserPersistent } = require('../lib/core/browser-launcher');
const { searchAndClickProduct } = require('../lib/handlers/coupang-handler');

async function debugWebkitCart(keyword, productCode) {
  console.log('🔍 WebKit 장바구니 디버깅 시작\n');
  
  let browser, context, page;
  
  try {
    // WebKit 브라우저 실행
    console.log('🚀 WebKit 브라우저 실행...\n');
    const launchResult = await launchBrowserPersistent(
      'webkit',
      null,
      'debug_webkit',
      false,
      true,
      false
    );
    
    browser = launchResult.browser;
    context = launchResult.context;
    page = launchResult.page;
    
    // 디버깅용 이벤트 리스너 추가
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ 콘솔 에러:', msg.text());
      }
    });
    
    page.on('requestfailed', request => {
      console.log('❌ 요청 실패:', request.url());
    });
    
    // 쿠팡 상품 검색
    console.log(`🔍 상품 검색: ${keyword} (코드: ${productCode})\n`);
    const searchUrl = `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(keyword)}&channel=user`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // 상품 찾기 및 클릭
    const productLink = await page.$(`a[href*="/vp/products/${productCode}"]`);
    if (!productLink) {
      console.log('❌ 상품을 찾을 수 없습니다');
      return;
    }
    
    await productLink.click();
    await page.waitForLoadState('domcontentloaded');
    console.log('✅ 상품 페이지 진입\n');
    
    // 페이지 대기
    await page.waitForTimeout(3000);
    
    // 장바구니 버튼 디버깅
    console.log('🛒 장바구니 버튼 분석...\n');
    
    // 1. 다양한 방법으로 버튼 찾기
    const buttonSelectors = [
      'button.prod-cart-btn',
      'button[class*="cart-btn"]',
      'button:has-text("장바구니")',
      'button:has-text("장바구니 담기")',
      '[data-gaclick*="addCartButton"]'
    ];
    
    for (const selector of buttonSelectors) {
      const button = await page.$(selector);
      if (button) {
        console.log(`✅ 발견: ${selector}`);
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        console.log(`   표시: ${isVisible}, 활성: ${isEnabled}`);
        
        // 버튼 속성 확인
        const attributes = await button.evaluate(el => {
          const attrs = {};
          for (const attr of el.attributes) {
            attrs[attr.name] = attr.value;
          }
          return attrs;
        });
        console.log('   속성:', JSON.stringify(attributes, null, 2));
      } else {
        console.log(`❌ 없음: ${selector}`);
      }
    }
    
    // 2. 장바구니 카운트 요소 확인
    console.log('\n📊 장바구니 카운트 확인...');
    const cartCount = await page.$('#headerCartCount');
    if (cartCount) {
      const count = await cartCount.textContent();
      console.log(`✅ 현재 카운트: ${count}`);
    } else {
      console.log('❌ 카운트 요소를 찾을 수 없음');
    }
    
    // 3. WebKit 특수 처리가 필요한지 확인
    console.log('\n🔧 WebKit 호환성 테스트...');
    
    // 클릭 이벤트 테스트
    const cartButton = await page.$('button.prod-cart-btn');
    if (cartButton) {
      console.log('장바구니 버튼으로 테스트 진행...');
      
      // 방법 1: 일반 클릭
      try {
        await cartButton.click();
        console.log('✅ 일반 클릭 성공');
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log('❌ 일반 클릭 실패:', e.message);
      }
      
      // 방법 2: JavaScript 클릭
      try {
        await page.evaluate(() => {
          const btn = document.querySelector('button.prod-cart-btn');
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });
        console.log('✅ JS 클릭 성공');
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log('❌ JS 클릭 실패:', e.message);
      }
      
      // 방법 3: dispatchEvent
      try {
        await page.evaluate(() => {
          const btn = document.querySelector('button.prod-cart-btn');
          if (btn) {
            const event = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            btn.dispatchEvent(event);
            return true;
          }
          return false;
        });
        console.log('✅ dispatchEvent 성공');
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log('❌ dispatchEvent 실패:', e.message);
      }
    }
    
    // 4. 네트워크 요청 모니터링
    console.log('\n📡 네트워크 요청 모니터링...');
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('cart') || request.url().includes('add')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
      }
    });
    
    // 5. 최종 카운트 확인
    await page.waitForTimeout(3000);
    const finalCount = await page.$eval('#headerCartCount', el => el.textContent).catch(() => 'N/A');
    console.log(`\n📊 최종 카운트: ${finalCount}`);
    
    // 6. 캡처된 요청 출력
    if (requests.length > 0) {
      console.log('\n📡 캡처된 장바구니 관련 요청:');
      requests.forEach((req, i) => {
        console.log(`${i + 1}. ${req.method} ${req.url}`);
      });
    }
    
    // 스크린샷 저장
    await page.screenshot({ path: 'webkit-cart-debug.png', fullPage: false });
    console.log('\n📸 스크린샷 저장: webkit-cart-debug.png');
    
    // 대기
    console.log('\n⏳ 10초 후 종료...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('\n✅ 디버깅 완료!');
  }
}

// 직접 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('사용법: node debug-webkit-cart.js [keyword] [productCode]');
    console.log('예시: node debug-webkit-cart.js "노트북" 7291381328');
    process.exit(1);
  }
  
  const [keyword, productCode] = args;
  debugWebkitCart(keyword, productCode);
}

module.exports = { debugWebkitCart };