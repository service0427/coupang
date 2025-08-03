/**
 * 쿠팡 웹사이트 자동화 핸들러
 * - 상품 코드로 검색 및 클릭
 * - 순위 측정
 * - 장바구니 클릭 옵션
 */

/**
 * IP 확인
 */
async function checkIP(page) {
  try {
    console.log('🔍 프록시 IP 확인 중...');
    await page.goto('http://techb.kr/ip.php', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    const ipInfo = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log('📌 프록시 정보:');
    console.log(ipInfo);
    console.log('');
    
    return ipInfo;
  } catch (error) {
    console.log('⚠️ IP 확인 실패:', error.message);
    return null;
  }
}

/**
 * WebDriver 상태 확인
 */
async function checkWebDriverStatus(page, browserType) {
  console.log(`🔍 ${browserType} WebDriver 상태 확인 중...`);
  
  const webdriverStatus = await page.evaluate(() => {
    const results = {};
    
    // navigator의 모든 속성 가져오기
    for (let prop in navigator) {
      try {
        const value = navigator[prop];
        const type = typeof value;
        
        if (type === 'string' || type === 'number' || type === 'boolean') {
          results[`navigator.${prop}`] = value;
        } else if (type === 'object' && value !== null) {
          results[`navigator.${prop}`] = `[${type}]`;
        } else if (type === 'function') {
          results[`navigator.${prop}`] = `[${type}]`;
        } else {
          results[`navigator.${prop}`] = value;
        }
      } catch (e) {
        results[`navigator.${prop}`] = `[Error: ${e.message}]`;
      }
    }
    
    return results;
  });
  
  // webdriver 관련 속성 확인
  const webdriverRelated = ['navigator.webdriver', 'navigator.webdriver (proto)'];
  webdriverRelated.forEach(key => {
    if (webdriverStatus[key] !== undefined) {
      const value = webdriverStatus[key];
      if (value === true) {
        console.log(`  ${key}: ⚠️ ${value} (감지됨)`);
      } else if (value === false) {
        console.log(`  ${key}: ✅ ${value} (정상)`);
      } else if (value === undefined) {
        console.log(`  ${key}: ✅ undefined (정상)`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
  });
  
  console.log('');
}

/**
 * 특정 상품 코드 검색 및 클릭
 * @param {Page} page - Playwright 페이지 객체
 * @param {string} browserType - 브라우저 타입
 * @param {Object} options - 검색 옵션
 * @returns {Object} 실행 결과
 */
async function searchAndClickProduct(page, browserType, options = {}) {
  const {
    keyword = '노트북',
    suffix = '',
    productCode = '',
    cartClickEnabled = false,
    maxPages = 10
  } = options;

  const startTime = Date.now();
  const result = {
    success: false,
    productFound: false,
    productRank: null,
    pagesSearched: 0,
    cartClicked: false,
    errorMessage: null,
    durationMs: 0
  };

  try {
    // IP 확인
    await checkIP(page);
    
    // 검색어 조합
    const searchQuery = suffix ? `${keyword} ${suffix}` : keyword;
    console.log(`🔍 검색어: "${searchQuery}"`);
    console.log(`🎯 찾을 상품 코드: ${productCode}`);
    console.log('');
    
    // 쿠팡 검색
    const searchUrl = `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(searchQuery)}&channel=user`;
    console.log('🌐 쿠팡 검색 페이지 접속 중...');
    
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    // WebDriver 상태 확인
    await checkWebDriverStatus(page, browserType);
    
    // 상품 검색 시작
    console.log(`📦 상품 코드 ${productCode} 검색 시작...\n`);
    
    let productFound = false;
    let productRank = 0;
    let currentPage = 1;
    
    while (!productFound && currentPage <= maxPages) {
      console.log(`📄 ${currentPage}페이지 검색 중...`);
      result.pagesSearched = currentPage;
      
      // 상품 목록 로드 대기
      try {
        await page.waitForSelector('#product-list > li[data-id]', { timeout: 10000 });
      } catch (e) {
        console.log('⚠️ 상품 목록 로드 실패, 재시도...');
        await page.reload();
        await page.waitForTimeout(3000);
      }
      
      // 현재 페이지의 모든 상품 확인
      const products = await page.$$eval('#product-list > li[data-id]', (items, targetCode) => {
        return items.map((item, index) => {
          const link = item.querySelector('a[href*="/vp/products/"]');
          if (!link) return null;
          
          const href = link.getAttribute('href');
          const match = href.match(/\/vp\/products\/(\d+)/);
          const code = match ? match[1] : null;
          
          return {
            index: index + 1,
            code: code,
            href: href,
            name: item.querySelector('.name') ? item.querySelector('.name').innerText.trim() : '알 수 없음',
            isTarget: code === targetCode
          };
        }).filter(item => item !== null);
      }, productCode);
      
      // 타겟 상품 찾기
      const targetProduct = products.find(p => p.isTarget);
      
      if (targetProduct) {
        productFound = true;
        productRank = (currentPage - 1) * products.length + targetProduct.index;
        
        console.log(`\n✅ 상품 발견!`);
        console.log(`📊 순위: ${productRank}위 (${currentPage}페이지 ${targetProduct.index}번째)`);
        console.log(`📦 상품명: ${targetProduct.name}`);
        console.log(`🔢 상품코드: ${targetProduct.code}\n`);
        
        // 상품 클릭
        const productLink = await page.$(`a[href*="/vp/products/${productCode}"]`);
        if (productLink) {
          // target="_self"로 설정
          await productLink.evaluate(el => el.setAttribute('target', '_self'));
          
          // 스크롤
          await productLink.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
          
          console.log('🖱️ 상품 클릭 시도...');
          
          // 네비게이션 대기와 클릭을 동시에 수행
          const [response] = await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
            productLink.click()
          ]);
          
          if (response && response.ok()) {
            console.log('✅ 상품 페이지로 이동 완료!');
            console.log(`📍 URL: ${page.url()}\n`);
            
            await page.waitForTimeout(2000);
            
            // 장바구니 클릭 옵션
            if (cartClickEnabled) {
              console.log('🛒 장바구니 추가 시도...');
              try {
                // 장바구니 버튼 찾기 (여러 가능한 셀렉터)
                const cartSelectors = [
                  '.prod-buy-btn__cart',
                  'button[class*="cart"]',
                  'button:has-text("장바구니")',
                  '.prod-buy-btn button:has(.cart-icon)'
                ];
                
                let cartClicked = false;
                for (const selector of cartSelectors) {
                  const cartButton = await page.$(selector);
                  if (cartButton && await cartButton.isVisible()) {
                    await cartButton.click();
                    cartClicked = true;
                    console.log('✅ 장바구니에 추가됨!');
                    result.cartClicked = true;
                    
                    // 장바구니 팝업 처리
                    await page.waitForTimeout(2000);
                    const closeButton = await page.$('button[class*="close"], .modal-close');
                    if (closeButton) {
                      await closeButton.click();
                    }
                    break;
                  }
                }
                
                if (!cartClicked) {
                  console.log('⚠️ 장바구니 버튼을 찾을 수 없음');
                }
              } catch (e) {
                console.log('⚠️ 장바구니 추가 실패:', e.message);
              }
            }
            
            result.success = true;
            result.productFound = true;
            result.productRank = productRank;
            
            // 상품 페이지 정보 확인
            try {
              await page.waitForSelector('.prod-buy-header__title, h1', { timeout: 10000 });
              const productTitle = await page.locator('.prod-buy-header__title, h1').first().textContent();
              
              console.log('\n🎉 테스트 성공!');
              console.log('📊 최종 결과:');
              console.log(`  - 검색어: ${searchQuery}`);
              console.log(`  - 상품 순위: ${productRank}위`);
              console.log(`  - 검색한 페이지 수: ${currentPage}`);
              console.log(`  - 클릭한 상품: ${targetProduct.name}`);
              console.log(`  - 상품 코드: ${productCode}`);
              console.log(`  - 장바구니 클릭: ${result.cartClicked ? '✅' : '❌'}`);
              console.log(`  - 최종 URL: ${page.url()}`);
            } catch (e) {
              console.log('⚠️ 상품 페이지 정보 추출 중 오류:', e.message);
            }
            
            await page.waitForTimeout(3000);
          } else {
            console.log('❌ 페이지 이동 실패');
            result.errorMessage = '상품 페이지 이동 실패';
          }
        }
      } else {
        console.log(`  ${products.length}개 상품 확인 - 타겟 상품 없음`);
        
        // 다음 페이지로 이동
        if (currentPage < maxPages) {
          const nextButton = await page.$('.next-page, a[title="다음 페이지"]');
          if (nextButton && await nextButton.isVisible()) {
            console.log('  다음 페이지로 이동...\n');
            await nextButton.click();
            await page.waitForTimeout(3000);
            currentPage++;
          } else {
            console.log('  ❌ 다음 페이지 버튼을 찾을 수 없음');
            break;
          }
        }
      }
    }
    
    if (!productFound) {
      console.log(`\n❌ 상품을 찾을 수 없음 (${currentPage}페이지 검색)`);
      result.errorMessage = `상품 코드 ${productCode}를 찾을 수 없음`;
    }
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error.message);
    result.errorMessage = error.message;
  } finally {
    result.durationMs = Date.now() - startTime;
  }
  
  return result;
}

/**
 * 기존 랜덤 상품 선택 함수 (하위 호환성)
 */
async function searchAndClick(page, browserType) {
  // 랜덤 상품 코드 생성 (예시)
  const randomCode = Math.floor(Math.random() * 9000000) + 1000000;
  
  return await searchAndClickProduct(page, browserType, {
    keyword: '노트북',
    productCode: randomCode.toString(),
    cartClickEnabled: false
  });
}

module.exports = { 
  searchAndClick,
  searchAndClickProduct,
  checkIP,
  checkWebDriverStatus
};