// 기본 검색 및 클릭 워크플로우
const { searchAndClickProduct } = require('../handlers/coupang-handler');

module.exports = {
  id: 'search-click',
  name: '상품 검색 및 클릭',
  description: '쿠팡에서 키워드로 검색하고 상품 코드로 특정 상품을 찾아 클릭합니다',
  
  // 워크플로우 핸들러
  handler: async (page, browserType, options = {}) => {
    // 기본 옵션 설정
    const workflowOptions = {
      keyword: options.keyword || '노트북',
      suffix: options.suffix || '',
      productCode: options.productCode || '1234567',  // 기본 상품 코드
      cartClickEnabled: options.cartClickEnabled || false,
      maxPages: options.maxPages || 10
    };
    
    console.log('🚀 검색 및 클릭 워크플로우 시작');
    console.log(`   키워드: "${workflowOptions.keyword}${workflowOptions.suffix ? ' ' + workflowOptions.suffix : ''}"`);
    console.log(`   상품 코드: ${workflowOptions.productCode}`);
    console.log(`   장바구니 클릭: ${workflowOptions.cartClickEnabled ? '활성' : '비활성'}`);
    console.log('');
    
    // 핸들러 실행
    const result = await searchAndClickProduct(page, browserType, workflowOptions);
    
    // 결과 반환
    return {
      success: result.success,
      data: {
        productFound: result.productFound,
        productRank: result.productRank,
        pagesSearched: result.pagesSearched,
        cartClicked: result.cartClicked,
        durationMs: result.durationMs,
        errorMessage: result.errorMessage
      }
    };
  }
};