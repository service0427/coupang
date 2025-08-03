/**
 * 장바구니 클릭 핸들러
 */

/**
 * 장바구니에 상품 추가
 * @param {Page} page - Playwright 페이지 객체
 * @param {string} browserType - 브라우저 타입
 * @param {Object} proxyConfig - 프록시 설정
 * @returns {Object} 실행 결과
 */
async function addToCart(page, browserType, proxyConfig = null) {
  console.log(`🛒 [${browserType.toUpperCase()}] 장바구니 추가 시도...`);
  
  if (proxyConfig) {
    console.log(`   [${browserType.toUpperCase()}] ⚠️  프록시 사용 시 장바구니 API가 차단될 수 있습니다`);
  }
  
  const result = {
    cartClicked: false,
    errorMessage: null
  };
  
  try {
    // 장바구니 버튼 찾기
    const cartButton = await page.$('button.prod-cart-btn');
    
    if (!cartButton || !await cartButton.isVisible()) {
      console.log(`⚠️ [${browserType.toUpperCase()}] 장바구니 버튼을 찾을 수 없음`);
      result.errorMessage = '장바구니 버튼을 찾을 수 없음';
      return result;
    }
    
    // JavaScript로 직접 클릭
    console.log(`   [${browserType.toUpperCase()}] JavaScript로 장바구니 버튼 클릭...`);
    await page.evaluate(() => {
      const btn = document.querySelector('button.prod-cart-btn');
      if (btn) btn.click();
    });
    
    // 클릭 후 5초 대기
    console.log(`⏳ [${browserType.toUpperCase()}] 장바구니 처리를 위해 5초 대기...`);
    await page.waitForTimeout(5000);
    
    // 장바구니 링크 클릭으로 이동
    console.log(`🛒 [${browserType.toUpperCase()}] 장바구니 링크 클릭하여 이동...`);
    try {
      const cartLink = await page.$('#wa-cart-link, a[href*="cart.coupang.com/cartView.pang"]');
      
      if (!cartLink) {
        console.log(`⚠️ [${browserType.toUpperCase()}] 장바구니 링크를 찾을 수 없음`);
        result.errorMessage = '장바구니 링크를 찾을 수 없음';
        return result;
      }
      
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        cartLink.click()
      ]);
      
      await page.waitForTimeout(2000);
      
      // "장바구니에 담은 상품이 없습니다." 텍스트 확인
      const pageText = await page.evaluate(() => document.body.innerText);
      const isCartEmpty = pageText.includes('장바구니에 담은 상품이 없습니다');
      
      if (isCartEmpty) {
        console.log(`⚠️ [${browserType.toUpperCase()}] 장바구니가 비어있음 - "장바구니에 담은 상품이 없습니다." 메시지 확인`);
        result.cartClicked = false;
      } else {
        // 장바구니 상품 개수 확인
        const cartItems = await page.$$('.cart-item, [class*="cart-product"], .cart-list-item');
        const cartItemCount = cartItems.length;
        
        console.log(`   [${browserType.toUpperCase()}] 장바구니 페이지의 상품 수: ${cartItemCount}개`);
        
        if (cartItemCount > 0) {
          console.log(`✅ [${browserType.toUpperCase()}] 장바구니에 상품이 있음! (${cartItemCount}개)`);
          result.cartClicked = true;
        } else {
          console.log(`⚠️ [${browserType.toUpperCase()}] 장바구니 상품을 찾을 수 없음`);
          result.cartClicked = false;
        }
      }
      
      // 원래 페이지로 돌아가기
      await page.goBack();
      
    } catch (e) {
      console.log(`⚠️ [${browserType.toUpperCase()}] 장바구니 페이지 접근 실패:`, e.message);
      result.cartClicked = false;
      result.errorMessage = '장바구니 페이지 접근 실패';
    }
    
  } catch (e) {
    console.log(`⚠️ [${browserType.toUpperCase()}] 장바구니 추가 중 오류:`, e.message);
    result.cartClicked = false;
    result.errorMessage = `장바구니 추가 실패: ${e.message}`;
  }
  
  return result;
}

module.exports = {
  addToCart
};