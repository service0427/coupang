/**
 * 쿠팡 웹사이트 자동화 핸들러
 * - 상품 코드로 검색 및 클릭
 * - 순위 측정
 * - 장바구니 클릭 옵션
 */

/**
 * IP 확인
 */
async function checkIP(page, browserType) {
  try {
    console.log(`🔍 [${browserType.toUpperCase()}] 프록시 IP 확인 중...`);
    await page.goto('http://techb.kr/ip.php', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    const ipInfo = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log(`📌 [${browserType.toUpperCase()}] 프록시 정보:`);
    console.log(ipInfo);
    console.log('');
    
    return ipInfo;
  } catch (error) {
    console.log(`⚠️ [${browserType.toUpperCase()}] IP 확인 실패:`, error.message);
    return null;
  }
}

/**
 * WebDriver 상태 확인
 */
async function checkWebDriverStatus(page, browserType) {
  console.log(`🔍 [${browserType.toUpperCase()}] WebDriver 상태 확인 중...`);
  
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
    maxPages = 10,
    proxyConfig = null
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
    await checkIP(page, browserType);
    
    // 검색어 조합
    const searchQuery = suffix ? `${keyword} ${suffix}` : keyword;
    console.log(`🔍 [${browserType.toUpperCase()}] 검색어: "${searchQuery}"`);
    console.log(`🎯 [${browserType.toUpperCase()}] 찾을 상품 코드: ${productCode}`);
    console.log('');
    
    // 쿠팡 검색
    const searchUrl = `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(searchQuery)}&channel=user`;
    console.log(`🌐 [${browserType.toUpperCase()}] 쿠팡 검색 페이지 접속 중...`);
    
    let gotoSuccess = false;
    try {
      await page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      gotoSuccess = true;
      
      // 최초 로딩 대기시간 3초 추가
      console.log(`⏳ [${browserType.toUpperCase()}] 페이지 로딩 안정화를 위해 3초 대기...`);
      await page.waitForTimeout(3000);
    } catch (gotoError) {
      console.error(`❌ [${browserType.toUpperCase()}] 페이지 접속 실패:`, gotoError.message);
      
      // 차단 관련 오류 메시지 분석
      if (gotoError.message.includes('ERR_HTTP2_PROTOCOL_ERROR') || 
          gotoError.message.includes('NS_ERROR_NET_INTERRUPT') ||
          gotoError.message.includes('ERR_CONNECTION_REFUSED') ||
          gotoError.message.includes('ERR_NETWORK_CHANGED')) {
        console.log(`⏳ [${browserType.toUpperCase()}] 차단 오류 화면 확인을 위해 3초 대기...`);
        await page.waitForTimeout(3000);
      }
      
      // 페이지 접속 실패해도 계속 진행 시도
      console.log(`🔄 [${browserType.toUpperCase()}] 현재 페이지에서 계속 진행 시도...`);
    }
    
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
      
      // 검색 결과 없음 감지
      const noResultElement = document.querySelector('[class^=no-result_magnifier]');
      const noResultText = bodyText.includes('에 대한 검색결과가 없습니다') ||
                          bodyText.includes('검색 결과가 없습니다');
      
      return {
        isErrorPage,
        hasNoResult: noResultElement !== null || noResultText,
        bodyText: bodyText.substring(0, 500), // 디버깅용
        pageTitle
      };
    });
    
    // 차단 상태 처리
    if (quickCheck.isErrorPage) {
      console.log(`❌ [${browserType.toUpperCase()}] 쿠팡 접속 차단됨: 에러 페이지 감지`);
      console.log(`   [${browserType.toUpperCase()}] 페이지 제목: ${quickCheck.pageTitle}`);
      console.log(`   [${browserType.toUpperCase()}] 내용 일부: ${quickCheck.bodyText.substring(0, 200)}...`);
      console.log(`⏳ [${browserType.toUpperCase()}] 차단 화면 확인을 위해 3초 대기...`);
      await page.waitForTimeout(3000);
      result.errorMessage = '쿠팡 접속 차단됨';
      return result;
    }
    
    if (quickCheck.hasNoResult) {
      console.log(`⚠️  [${browserType.toUpperCase()}] "${searchQuery}"에 대한 검색 결과가 없습니다.`);
      result.errorMessage = '검색 결과 없음';
      return result;
    }
    
    // WebDriver 상태 확인
    await checkWebDriverStatus(page, browserType);
    
    // 상품 검색 시작
    console.log(`📦 [${browserType.toUpperCase()}] 상품 코드 ${productCode} 검색 시작...\n`);
    
    let productFound = false;
    let productRank = 0;
    let currentPage = 1;
    
    while (!productFound && currentPage <= maxPages) {
      console.log(`📄 [${browserType.toUpperCase()}] ${currentPage}페이지 검색 중...`);
      result.pagesSearched = currentPage;
      
      // 상품 목록 로드 대기
      try {
        await page.waitForSelector('#product-list > li[data-id]', { timeout: 10000 });
      } catch (e) {
        console.log(`⚠️ [${browserType.toUpperCase()}] 상품 목록 로드 실패`);
        // 페이지가 닫혔는지 확인
        if (page.isClosed()) {
          console.log(`❌ [${browserType.toUpperCase()}] 페이지가 닫혔습니다`);
          break;
        }
        // 재시도 대신 다음 페이지로 이동
        console.log(`  [${browserType.toUpperCase()}] 다음 페이지로 이동 시도...`);
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
        console.log(`⚠️ [${browserType.toUpperCase()}] 상품 목록 파싱 실패:`, e.message);
        if (page.isClosed()) {
          console.log(`❌ [${browserType.toUpperCase()}] 페이지가 닫혔습니다`);
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
        
        console.log(`\n✅ [${browserType.toUpperCase()}] 상품 발견!`);
        console.log(`📊 [${browserType.toUpperCase()}] 순위: ${productRank}위 (${currentPage}페이지 ${targetProduct.index}번째)`);
        console.log(`📦 [${browserType.toUpperCase()}] 상품명: ${targetProduct.name}`);
        console.log(`🔢 [${browserType.toUpperCase()}] 상품코드: ${targetProduct.code}\n`);
        
        // 상품 클릭
        const productLink = await page.$(`a[href*="/vp/products/${productCode}"]`);
        if (productLink) {
          // target="_self"로 설정
          await productLink.evaluate(el => el.setAttribute('target', '_self'));
          
          // 스크롤
          await productLink.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
          
          console.log(`🖱️ [${browserType.toUpperCase()}] 상품 클릭 시도...`);
          
          // 네비게이션 대기와 클릭을 동시에 수행
          const [response] = await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
            productLink.click()
          ]);
          
          if (response && response.ok()) {
            console.log(`✅ [${browserType.toUpperCase()}] 상품 페이지로 이동 완료!`);
            console.log(`📍 [${browserType.toUpperCase()}] URL: ${page.url()}\n`);
            
            await page.waitForTimeout(2000);
            
            // 장바구니 클릭 옵션 (WebKit은 JA3 차단으로 제외)
            if (cartClickEnabled && browserType !== 'webkit') {
              console.log(`🛒 [${browserType.toUpperCase()}] 장바구니 추가 시도...`);
              console.log(`   [${browserType.toUpperCase()}] 브라우저: ${browserType}`);
              console.log(`   [${browserType.toUpperCase()}] 프록시 사용: ${proxyConfig ? proxyConfig.server : '직접 연결'}`);
              
              try {
                // 현재 장바구니 수량 확인
                let beforeCount = 0;
                try {
                  beforeCount = await page.$eval('#headerCartCount', el => parseInt(el.textContent) || 0);
                  console.log(`   [${browserType.toUpperCase()}] 현재 장바구니 수량: ${beforeCount}`);
                } catch (e) {
                  console.log(`   [${browserType.toUpperCase()}] 장바구니 카운트 확인 불가 (비로그인 상태일 수 있음)`);
                  console.log(`   [${browserType.toUpperCase()}] 카운트 확인 오류: ${e.message}`);
                }
                
                // 장바구니 버튼 찾기
                console.log(`   [${browserType.toUpperCase()}] 장바구니 버튼 검색 중...`);
                const cartButton = await page.$('button.prod-cart-btn');
                
                if (cartButton && await cartButton.isVisible()) {
                  console.log(`   [${browserType.toUpperCase()}] ✅ 장바구니 버튼 발견`);
                  
                  // 버튼 상태 확인
                  const buttonState = await cartButton.evaluate(el => ({
                    disabled: el.disabled,
                    text: el.textContent.trim(),
                    className: el.className,
                    onclick: el.onclick ? 'has onclick' : 'no onclick'
                  }));
                  console.log(`   [${browserType.toUpperCase()}] 버튼 상태: ${JSON.stringify(buttonState)}`);
                  
                  // 버튼 스크롤 및 클릭
                  await cartButton.scrollIntoViewIfNeeded();
                  await page.waitForTimeout(500);
                  
                  // WebKit의 경우 특별 처리
                  if (browserType === 'webkit') {
                    console.log(`   [${browserType.toUpperCase()}] WebKit 특별 처리 적용...`);
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
                    // 네트워크 모니터링 시작
                    const networkPromise = page.waitForResponse(response => 
                      response.url().includes('cart') || 
                      response.url().includes('add') ||
                      response.url().includes('basket'),
                      { timeout: 5000 }
                    ).catch(e => {
                      console.log(`   [${browserType.toUpperCase()}] ⚠️ 장바구니 API 응답 대기 시간 초과: ${e.message}`);
                      return null;
                    });
                    
                    await cartButton.click();
                    console.log(`   [${browserType.toUpperCase()}] 장바구니 버튼 클릭 완료`);
                    
                    // 네트워크 응답 확인
                    const response = await networkPromise;
                    if (response) {
                      console.log(`   [${browserType.toUpperCase()}] 📡 API 응답: ${response.status()} ${response.url()}`);
                      if (!response.ok()) {
                        const responseText = await response.text().catch(() => 'N/A');
                        console.log(`   [${browserType.toUpperCase()}] ❌ API 에러 응답: ${responseText.substring(0, 200)}`);
                      }
                    }
                  }
                  
                  // 클릭 후 대기 (WebKit은 더 길게)
                  await page.waitForTimeout(browserType === 'webkit' ? 5000 : 3000);
                  
                  // 성공 여부 확인
                  try {
                    const afterCount = await page.$eval('#headerCartCount', el => parseInt(el.textContent) || 0);
                    console.log(`   [${browserType.toUpperCase()}] 클릭 후 장바구니 수량: ${afterCount}`);
                    
                    if (afterCount > beforeCount) {
                      console.log(`✅ [${browserType.toUpperCase()}] 장바구니에 추가됨! (수량: ${beforeCount} → ${afterCount})`);
                      result.cartClicked = true;
                    } else {
                      console.log(`   [${browserType.toUpperCase()}] ⚠️ 카운트 변화 없음, 추가 확인 진행...`);
                      
                      // 페이지 상태 확인
                      const pageState = await page.evaluate(() => {
                        const bodyText = document.body?.innerText || '';
                        return {
                          hasLoginModal: document.querySelector('.login-modal, [class*="login-popup"]') !== null,
                          hasErrorMessage: bodyText.includes('오류') || bodyText.includes('실패'),
                          hasBlockedMessage: bodyText.includes('차단') || bodyText.includes('blocked'),
                          url: window.location.href,
                          title: document.title
                        };
                      });
                      console.log(`   [${browserType.toUpperCase()}] 페이지 상태: ${JSON.stringify(pageState)}`);
                      
                      // 로그인 필요 메시지 확인
                      const loginRequired = await page.$('.login-required-message, [class*="login"]');
                      if (loginRequired || pageState.hasLoginModal) {
                        console.log(`⚠️ [${browserType.toUpperCase()}] 로그인이 필요합니다`);
                        result.cartClicked = false;
                        result.errorMessage = '장바구니 추가 실패: 로그인 필요';
                      } else if (pageState.hasBlockedMessage) {
                        console.log(`⚠️ [${browserType.toUpperCase()}] 요청이 차단되었습니다`);
                        result.cartClicked = false;
                        result.errorMessage = '장바구니 추가 실패: 요청 차단됨';
                      } else {
                        console.log(`⚠️ [${browserType.toUpperCase()}] 장바구니 추가 실패 (카운트 변화 없음)`);
                        result.cartClicked = false;
                      }
                    }
                  } catch (e) {
                    // 카운트 확인 실패 시 다른 방법으로 성공 여부 확인
                    console.log(`   [${browserType.toUpperCase()}] 카운트 확인 실패: ${e.message}`);
                    console.log(`   [${browserType.toUpperCase()}] 다른 방법으로 확인...`);
                    
                    // 1. 성공 메시지 확인
                    const successMessage = await page.$('[class*="success"], [class*="added"], .cart-success-message');
                    if (successMessage) {
                      console.log(`✅ [${browserType.toUpperCase()}] 장바구니 추가 성공 (메시지 확인)`);
                      result.cartClicked = true;
                    } 
                    // 2. 토스트 메시지 확인
                    else if (await page.$('.toast-message:has-text("장바구니"), [class*="toast"]:has-text("담기")')) {
                      console.log(`✅ [${browserType.toUpperCase()}] 장바구니 추가 성공 (토스트 확인)`);
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
                        console.log(`✅ [${browserType.toUpperCase()}] 장바구니 추가 성공 (버튼 상태 변경 확인)`);
                        result.cartClicked = true;
                      } else {
                        // 4. 네트워크 요청 성공 여부로 판단
                        console.log(`   [${browserType.toUpperCase()}] WebKit: UI 액션은 완료되었으므로 성공으로 간주`);
                        result.cartClicked = true;
                      }
                    } else {
                      console.log(`⚠️ [${browserType.toUpperCase()}] 장바구니 추가 결과 확인 불가`);
                      result.cartClicked = false;
                    }
                  }
                  
                  // 팝업이나 모달 닫기
                  const closeButton = await page.$('button[class*="close"], .modal-close, [aria-label*="닫기"]');
                  if (closeButton && await closeButton.isVisible()) {
                    await closeButton.click();
                    console.log(`   [${browserType.toUpperCase()}] 팝업 닫기 완료`);
                  }
                  
                } else {
                  console.log(`⚠️ [${browserType.toUpperCase()}] 장바구니 버튼을 찾을 수 없음`);
                  
                  // 버튼이 없는 이유 파악
                  const buttonAnalysis = await page.evaluate(() => {
                    const possibleButtons = document.querySelectorAll('button');
                    const cartRelated = [];
                    possibleButtons.forEach(btn => {
                      const text = btn.textContent.toLowerCase();
                      if (text.includes('장바구니') || text.includes('cart') || text.includes('담기')) {
                        cartRelated.push({
                          text: btn.textContent.trim(),
                          className: btn.className,
                          visible: btn.offsetParent !== null,
                          disabled: btn.disabled
                        });
                      }
                    });
                    return {
                      totalButtons: possibleButtons.length,
                      cartRelatedButtons: cartRelated
                    };
                  });
                  console.log(`   [${browserType.toUpperCase()}] 페이지의 버튼 분석: ${JSON.stringify(buttonAnalysis)}`);
                  
                  // 옵션 선택이 필요한지 확인
                  const optionSelect = await page.$('.option-select, select[class*="option"]');
                  if (optionSelect) {
                    console.log(`   [${browserType.toUpperCase()}] → 상품 옵션 선택이 필요합니다`);
                  }
                  
                  // 품절 상태 확인
                  const soldOut = await page.$('[class*="sold-out"], [class*="품절"]');
                  if (soldOut) {
                    console.log(`   [${browserType.toUpperCase()}] → 상품이 품절 상태입니다`);
                  }
                }
              } catch (e) {
                console.log(`⚠️ [${browserType.toUpperCase()}] 장바구니 추가 중 오류:`, e.message);
                console.log(`   [${browserType.toUpperCase()}] 오류 스택: ${e.stack}`);
                result.cartClicked = false;
                result.errorMessage = `장바구니 추가 실패: ${e.message}`;
              }
            } else if (cartClickEnabled && browserType === 'webkit') {
              console.log(`⚠️  [${browserType.toUpperCase()}] WebKit은 JA3 차단으로 장바구니 클릭 제외`);
              console.log(`   [${browserType.toUpperCase()}] → Chrome/Firefox에서 장바구니 기능 사용 가능`);
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
              console.log(`📊 [${browserType.toUpperCase()}] URL rank 값: ${result.urlRank}`);
            }
            result.finalUrl = finalUrl;
            
            // 상품 페이지 정보 확인
            try {
              await page.waitForSelector('.prod-buy-header__title, h1', { timeout: 10000 });
              const productTitle = await page.locator('.prod-buy-header__title, h1').first().textContent();
              
              console.log(`\n🎉 [${browserType.toUpperCase()}] 테스트 성공!`);
              console.log(`📊 [${browserType.toUpperCase()}] 최종 결과:`);
              console.log(`  - [${browserType.toUpperCase()}] 검색어: ${searchQuery}`);
              console.log(`  - [${browserType.toUpperCase()}] 상품 순위: ${productRank}위`);
              console.log(`  - [${browserType.toUpperCase()}] 검색한 페이지 수: ${currentPage}`);
              console.log(`  - [${browserType.toUpperCase()}] 클릭한 상품: ${targetProduct.name}`);
              console.log(`  - [${browserType.toUpperCase()}] 상품 코드: ${productCode}`);
              console.log(`  - [${browserType.toUpperCase()}] 장바구니 클릭: ${result.cartClicked ? '✅' : browserType === 'webkit' ? '⏭️ WebKit 제외' : '❌'}`);
              console.log(`  - [${browserType.toUpperCase()}] 최종 URL: ${page.url()}`);
            } catch (e) {
              console.log(`⚠️ [${browserType.toUpperCase()}] 상품 페이지 정보 추출 중 오류:`, e.message);
            }
            
            await page.waitForTimeout(3000);
          } else {
            console.log(`❌ [${browserType.toUpperCase()}] 페이지 이동 실패`);
            result.errorMessage = '상품 페이지 이동 실패';
          }
        }
      } else {
        console.log(`  [${browserType.toUpperCase()}] ${products.length}개 상품 확인 - 타겟 상품 없음`);
        
        // 최대 페이지에 도달했는지 확인
        if (currentPage >= maxPages) {
          console.log(`  [${browserType.toUpperCase()}] ℹ️ 최대 검색 페이지(${maxPages})에 도달했습니다`);
          break;
        }
        
        // 다음 페이지로 이동
        // 심플하고 안정적인 셀렉터 사용
        const nextButton = await page.$('a[title="다음"]');
        
        if (nextButton) {
          console.log(`  [${browserType.toUpperCase()}] 다음 페이지로 이동...\n`);
          
          // 현재 URL 저장
          const currentUrl = page.url();
          
          // 버튼 클릭
          await nextButton.click();
          await page.waitForTimeout(3000);
          
          // URL 변경 확인
          const newUrl = page.url();
          if (currentUrl === newUrl) {
            console.log(`  [${browserType.toUpperCase()}] ⚠️ 페이지가 변경되지 않았습니다. 마지막 페이지일 수 있습니다.`);
            break;
          }
          
          currentPage++;
          
          // 페이지 증가 후 다시 최대 페이지 체크
          if (currentPage > maxPages) {
            console.log(`  [${browserType.toUpperCase()}] ℹ️ 최대 검색 페이지(${maxPages})를 초과했습니다`);
            break;
          }
        } else {
          // a 태그가 없으면 span 확인 (마지막 페이지)
          const disabledNext = await page.$('span[title="다음"]');
          if (disabledNext) {
            console.log(`  [${browserType.toUpperCase()}] ℹ️ 마지막 페이지입니다`);
          } else {
            console.log(`  [${browserType.toUpperCase()}] ❌ 다음 버튼을 찾을 수 없음`);
          }
          break;
        }
      }
    }
    
    if (!productFound) {
      console.log(`\n❌ [${browserType.toUpperCase()}] 상품을 찾을 수 없음 (${currentPage}페이지 검색)`);
      result.errorMessage = `상품 코드 ${productCode}를 찾을 수 없음`;
    }
    
  } catch (error) {
    console.error(`❌ [${browserType.toUpperCase()}] 테스트 중 오류 발생:`, error.message);
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