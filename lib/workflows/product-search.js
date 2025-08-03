// 상품 검색 워크플로우

async function productSearch(page, browserType, options = {}) {
  const { 
    searchKeyword = '노트북', 
    minPrice = null,
    maxPrice = null,
    sortBy = 'ranking', // ranking, lowPrice, highPrice, saleCount, latestAsc
    categoryFilter = null
  } = options;
  
  try {
    // IP 확인
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
    
    // 쿠팡 메인 페이지 접속
    console.log('🌐 쿠팡 메인 페이지 접속 중...');
    await page.goto('https://www.coupang.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    console.log('✅ 메인 페이지 로드 완료\n');
    
    // 검색창 찾기
    console.log(`🔍 "${searchKeyword}" 검색 중...`);
    const searchInput = await page.locator('input[name="q"], input#searchInput, input.search-input').first();
    
    if (await searchInput.count() === 0) {
      console.log('❌ 검색창을 찾을 수 없습니다');
      return false;
    }
    
    // 검색어 입력
    await searchInput.click();
    await searchInput.fill(searchKeyword);
    await page.waitForTimeout(500);
    
    // 검색 버튼 클릭 또는 Enter 키
    const searchButton = await page.locator('button[type="submit"], button.search-button').first();
    if (await searchButton.count() > 0) {
      await searchButton.click();
    } else {
      await searchInput.press('Enter');
    }
    
    // 검색 결과 페이지 대기
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    console.log('✅ 검색 완료');
    console.log(`📍 URL: ${page.url()}\n`);
    
    // 검색 결과 분석
    console.log('📊 검색 결과 분석 중...');
    
    // 상품 개수 확인
    const productCount = await page.locator('#product-list > li[data-id]').count();
    console.log(`총 ${productCount}개의 상품이 검색되었습니다.`);
    
    // 가격 필터 적용
    if (minPrice || maxPrice) {
      console.log('\n💰 가격 필터 적용 중...');
      
      // 가격 필터 UI 찾기
      const priceFilterButton = await page.locator('button:has-text("가격"), a:has-text("가격")').first();
      if (await priceFilterButton.count() > 0) {
        await priceFilterButton.click();
        await page.waitForTimeout(1000);
        
        // 최소/최대 가격 입력
        if (minPrice) {
          const minPriceInput = await page.locator('input[placeholder*="최소"], input[name*="min"]').first();
          if (await minPriceInput.count() > 0) {
            await minPriceInput.fill(minPrice.toString());
          }
        }
        
        if (maxPrice) {
          const maxPriceInput = await page.locator('input[placeholder*="최대"], input[name*="max"]').first();
          if (await maxPriceInput.count() > 0) {
            await maxPriceInput.fill(maxPrice.toString());
          }
        }
        
        // 적용 버튼 클릭
        const applyButton = await page.locator('button:has-text("적용")').first();
        if (await applyButton.count() > 0) {
          await applyButton.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    
    // 정렬 옵션 변경
    if (sortBy !== 'ranking') {
      console.log(`\n🔄 정렬 기준 변경: ${sortBy}`);
      
      const sortOptions = {
        'lowPrice': '낮은가격순',
        'highPrice': '높은가격순',
        'saleCount': '판매량순',
        'latestAsc': '최신순'
      };
      
      const sortText = sortOptions[sortBy];
      if (sortText) {
        const sortButton = await page.locator(`a:has-text("${sortText}"), button:has-text("${sortText}")`).first();
        if (await sortButton.count() > 0) {
          await sortButton.click();
          await page.waitForTimeout(2000);
          console.log(`✅ ${sortText}으로 정렬 완료`);
        }
      }
    }
    
    // 상위 5개 상품 정보 수집
    console.log('\n📋 상위 5개 상품 정보:');
    const products = await page.locator('#product-list > li[data-id]').all();
    const topProducts = products.slice(0, 5);
    
    for (let i = 0; i < topProducts.length; i++) {
      const product = topProducts[i];
      
      try {
        const name = await product.locator('.name').textContent();
        const price = await product.locator('.price-value').first().textContent();
        const rating = await product.locator('.rating').textContent().catch(() => '평점 없음');
        
        console.log(`\n${i + 1}. ${name.trim()}`);
        console.log(`   가격: ${price.trim()}원`);
        console.log(`   평점: ${rating.trim()}`);
      } catch (e) {
        console.log(`${i + 1}. 상품 정보 추출 실패`);
      }
    }
    
    // 카테고리 필터 정보
    console.log('\n📂 사용 가능한 카테고리:');
    const categories = await page.locator('.search-filter-options li').all();
    const categoryNames = [];
    
    for (const category of categories.slice(0, 5)) {
      try {
        const catName = await category.textContent();
        categoryNames.push(catName.trim());
      } catch (e) {
        // 무시
      }
    }
    
    if (categoryNames.length > 0) {
      categoryNames.forEach(cat => console.log(`  - ${cat}`));
    }
    
    console.log('\n✅ 상품 검색 워크플로우 완료!');
    
    return {
      success: true,
      keyword: searchKeyword,
      productCount: productCount,
      url: page.url()
    };
    
  } catch (error) {
    console.error('❌ 상품 검색 워크플로우 중 오류:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  id: 'product-search',
  name: '상품 검색',
  description: '키워드로 상품을 검색하고 필터/정렬 옵션을 적용합니다',
  handler: productSearch
};