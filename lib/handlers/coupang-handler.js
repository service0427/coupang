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
    
    // 페이지 차단 상태 확인
    const quickCheck = await page.evaluate(() => {
      const bodyText = document.body?.innerText || '';
      const pageTitle = document.title || '';
      
      // 에러 페이지 감지
      const isErrorPage = bodyText.includes('Secure Connection Failed') || 
                         bodyText.includes('NS_ERROR_NET_INTERRUPT') ||
                         bodyText.includes('Stream error') ||
                         bodyText.includes('ERR_') ||
                         bodyText.includes('차단') ||
                         bodyText.includes('blocked') ||
                         bodyText.includes('접근이 거부') ||
                         pageTitle.includes('Error') ||
                         pageTitle.includes('오류');
      
      // Captcha 감지
      const hasCaptcha = bodyText.toLowerCase().includes('captcha') ||
                        bodyText.includes('로봇') ||
                        bodyText.includes('robot') ||
                        bodyText.includes('보안 문자') ||
                        document.querySelector('[class*="captcha"]') !== null ||
                        document.querySelector('#captcha') !== null;
      
      // 검색 결과 없음 감지
      const noResultElement = document.querySelector('[class^=no-result_magnifier]');
      const noResultText = bodyText.includes('에 대한 검색결과가 없습니다') ||
                          bodyText.includes('검색 결과가 없습니다');
      
      return {
        isErrorPage,
        hasCaptcha,
        hasNoResult: noResultElement !== null || noResultText,
        bodyText: bodyText.substring(0, 500), // 디버깅용
        pageTitle
      };
    });
    
    // 차단 상태 처리
    if (quickCheck.isErrorPage) {
      console.log('❌ 쿠팡 접속 차단됨: 에러 페이지 감지');
      console.log(`   페이지 제목: ${quickCheck.pageTitle}`);
      console.log(`   내용 일부: ${quickCheck.bodyText.substring(0, 200)}...`);
      result.errorMessage = '쿠팡 접속 차단됨';
      return result;
    }
    
    if (quickCheck.hasCaptcha) {
      console.log('🔒 Captcha 감지됨!');
      console.log('   수동으로 Captcha를 해결해주세요.');
      result.errorMessage = 'Captcha 감지됨';
      // Captcha 해결을 위해 30초 대기
      await page.waitForTimeout(30000);
    }
    
    if (quickCheck.hasNoResult) {
      console.log(`⚠️  "${searchQuery}"에 대한 검색 결과가 없습니다.`);
      result.errorMessage = '검색 결과 없음';
      return result;
    }
    
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
        console.log('⚠️ 상품 목록 로드 실패');
        // 페이지가 닫혔는지 확인
        if (page.isClosed()) {
          console.log('❌ 페이지가 닫혔습니다');
          break;
        }
        // 재시도 대신 다음 페이지로 이동
        console.log('  다음 페이지로 이동 시도...');
      }
      
      // 현재 페이지의 모든 상품 확인
      let products = [];
      try {
        products = await page.$$eval('#product-list > li[data-id]', (items, targetCode) => {
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
      } catch (e) {
        console.log('⚠️ 상품 목록 파싱 실패:', e.message);
        if (page.isClosed()) {
          console.log('❌ 페이지가 닫혔습니다');
          break;
        }
        // 상품이 없으면 빈 배열로 진행
        products = [];
      }
      
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
            
            // 장바구니 클릭 옵션 (WebKit은 JA3 차단으로 제외)
            if (cartClickEnabled && browserType !== 'webkit') {
              console.log('🛒 장바구니 추가 시도...');
              try {
                // 현재 장바구니 수량 확인
                let beforeCount = 0;
                try {
                  beforeCount = await page.$eval('#headerCartCount', el => parseInt(el.textContent) || 0);
                  console.log(`   현재 장바구니 수량: ${beforeCount}`);
                } catch (e) {
                  console.log('   장바구니 카운트 확인 불가 (비로그인 상태일 수 있음)');
                }
                
                // 장바구니 버튼 찾기
                const cartButton = await page.$('button.prod-cart-btn');
                
                if (cartButton && await cartButton.isVisible()) {
                  // 버튼 스크롤 및 클릭
                  await cartButton.scrollIntoViewIfNeeded();
                  await page.waitForTimeout(500);
                  
                  // WebKit의 경우 특별 처리
                  if (browserType === 'webkit') {
                    console.log('   WebKit 특별 처리 적용...');
                    // JavaScript로 직접 클릭 이벤트 발생
                    await page.evaluate(() => {
                      const btn = document.querySelector('button.prod-cart-btn');
                      if (btn) {
                        // 포커스 주기
                        btn.focus();
                        // 클릭 이벤트 발생
                        const clickEvent = new MouseEvent('click', {
                          view: window,
                          bubbles: true,
                          cancelable: true,
                          buttons: 1
                        });
                        btn.dispatchEvent(clickEvent);
                      }
                    });
                  } else {
                    await cartButton.click();
                  }
                  console.log('   장바구니 버튼 클릭 완료');
                  
                  // 클릭 후 대기 (WebKit은 더 길게)
                  await page.waitForTimeout(browserType === 'webkit' ? 5000 : 3000);
                  
                  // 성공 여부 확인
                  try {
                    const afterCount = await page.$eval('#headerCartCount', el => parseInt(el.textContent) || 0);
                    
                    if (afterCount > beforeCount) {
                      console.log(`✅ 장바구니에 추가됨! (수량: ${beforeCount} → ${afterCount})`);
                      result.cartClicked = true;
                    } else {
                      // 카운트가 변하지 않았을 때 추가 확인
                      // 로그인 필요 메시지 확인
                      const loginRequired = await page.$('.login-required-message, [class*="login"]');
                      if (loginRequired) {
                        console.log('⚠️ 로그인이 필요합니다');
                        result.cartClicked = false;
                        result.errorMessage = '장바구니 추가 실패: 로그인 필요';
                      } else {
                        console.log('⚠️ 장바구니 추가 실패 (카운트 변화 없음)');
                        result.cartClicked = false;
                      }
                    }
                  } catch (e) {
                    // 카운트 확인 실패 시 다른 방법으로 성공 여부 확인
                    console.log('   카운트 확인 실패, 다른 방법으로 확인...');
                    
                    // 1. 성공 메시지 확인
                    const successMessage = await page.$('[class*="success"], [class*="added"], .cart-success-message');
                    if (successMessage) {
                      console.log('✅ 장바구니 추가 성공 (메시지 확인)');
                      result.cartClicked = true;
                    } 
                    // 2. 토스트 메시지 확인
                    else if (await page.$('.toast-message:has-text("장바구니"), [class*="toast"]:has-text("담기")')) {
                      console.log('✅ 장바구니 추가 성공 (토스트 확인)');
                      result.cartClicked = true;
                    }
                    // 3. WebKit의 경우 버튼 상태 변경 확인
                    else if (browserType === 'webkit') {
                      const buttonStateChanged = await page.evaluate(() => {
                        const btn = document.querySelector('button.prod-cart-btn');
                        if (btn) {
                          // 버튼 텍스트가 변경되었는지 확인
                          const text = btn.textContent.trim();
                          return text.includes('담김') || text.includes('추가됨') || btn.disabled;
                        }
                        return false;
                      });
                      
                      if (buttonStateChanged) {
                        console.log('✅ 장바구니 추가 성공 (버튼 상태 변경 확인)');
                        result.cartClicked = true;
                      } else {
                        // 4. 네트워크 요청 성공 여부로 판단
                        console.log('   WebKit: UI 액션은 완료되었으므로 성공으로 간주');
                        result.cartClicked = true;
                      }
                    } else {
                      console.log('⚠️ 장바구니 추가 결과 확인 불가');
                      result.cartClicked = false;
                    }
                  }
                  
                  // 팝업이나 모달 닫기
                  const closeButton = await page.$('button[class*="close"], .modal-close, [aria-label*="닫기"]');
                  if (closeButton && await closeButton.isVisible()) {
                    await closeButton.click();
                    console.log('   팝업 닫기 완료');
                  }
                  
                } else {
                  console.log('⚠️ 장바구니 버튼을 찾을 수 없음');
                  
                  // 옵션 선택이 필요한지 확인
                  const optionSelect = await page.$('.option-select, select[class*="option"]');
                  if (optionSelect) {
                    console.log('   → 상품 옵션 선택이 필요합니다');
                  }
                  
                  // 품절 상태 확인
                  const soldOut = await page.$('[class*="sold-out"], [class*="품절"]');
                  if (soldOut) {
                    console.log('   → 상품이 품절 상태입니다');
                  }
                }
              } catch (e) {
                console.log('⚠️ 장바구니 추가 중 오류:', e.message);
                result.cartClicked = false;
                result.errorMessage = `장바구니 추가 실패: ${e.message}`;
              }
            } else if (cartClickEnabled && browserType === 'webkit') {
              console.log('⚠️  WebKit은 JA3 차단으로 장바구니 클릭 제외');
              console.log('   → Chrome/Firefox에서 장바구니 기능 사용 가능');
              result.cartClicked = false;
              result.errorMessage = 'WebKit은 장바구니 API 차단됨';
            }
            
            result.success = true;
            result.productFound = true;
            result.productRank = productRank;
            
            // URL에서 rank 파라미터 추출
            const finalUrl = page.url();
            const urlMatch = finalUrl.match(/[?&]rank=(\d+)/);
            if (urlMatch) {
              result.urlRank = parseInt(urlMatch[1]);
              console.log(`📊 URL rank 값: ${result.urlRank}`);
            }
            result.finalUrl = finalUrl;
            
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
              console.log(`  - 장바구니 클릭: ${result.cartClicked ? '✅' : browserType === 'webkit' ? '⏭️ WebKit 제외' : '❌'}`);
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
        
        // 최대 페이지에 도달했는지 확인
        if (currentPage >= maxPages) {
          console.log(`  ℹ️ 최대 검색 페이지(${maxPages})에 도달했습니다`);
          break;
        }
        
        // 다음 페이지로 이동
        // 심플하고 안정적인 셀렉터 사용
        const nextButton = await page.$('a[title="다음"]');
        
        if (nextButton) {
          console.log('  다음 페이지로 이동...\n');
          
          // 현재 URL 저장
          const currentUrl = page.url();
          
          // 버튼 클릭
          await nextButton.click();
          await page.waitForTimeout(3000);
          
          // URL 변경 확인
          const newUrl = page.url();
          if (currentUrl === newUrl) {
            console.log('  ⚠️ 페이지가 변경되지 않았습니다. 마지막 페이지일 수 있습니다.');
            break;
          }
          
          currentPage++;
          
          // 페이지 증가 후 다시 최대 페이지 체크
          if (currentPage > maxPages) {
            console.log(`  ℹ️ 최대 검색 페이지(${maxPages})를 초과했습니다`);
            break;
          }
        } else {
          // a 태그가 없으면 span 확인 (마지막 페이지)
          const disabledNext = await page.$('span[title="다음"]');
          if (disabledNext) {
            console.log('  ℹ️ 마지막 페이지입니다');
          } else {
            console.log('  ❌ 다음 버튼을 찾을 수 없음');
          }
          break;
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