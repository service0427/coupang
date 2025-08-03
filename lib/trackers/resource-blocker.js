/**
 * 리소스 차단 모듈
 * 페이지 로딩 최적화를 위한 리소스 차단 로직
 */

class ResourceBlocker {
  constructor() {
    // 차단할 도메인 목록
    this.blockedDomains = [
      // Mercury 추적
      'mercury.coupang.com',
      
      // 추천 및 위젯
      'reco.coupang.com',
      
      // 장바구니 관련
      'cart.coupang.com',
      
      // 기타 쿠팡 추적
      'ljc.coupang.com',
      
      // 광고 네트워크
      'criteo.com',
      'facebook.com',
      'facebook.net',
      'fbcdn.net',
      'doubleclick.net',
      'google-analytics.com',
      'googletagmanager.com',
      'googlesyndication.com',
      'googleadservices.com',
      'amazon-adsystem.com',
      'adsrvr.org',
      'adsystem.com'
    ];
    
    // 차단할 특정 파일 패턴
    this.blockedPatterns = [
      'seo-js-sdk',
      'criteo',
      'fbevents.js',
      '/tr/',
      '/submit?',
      'viewed-products',
      'recommend/widget',
      'omp-widget',
      'jikgu-promotion'
    ];
    
    // 허용할 CSS 파일 (핵심 스타일만)
    this.allowedCSS = [
      '6cf0b079951c8fe0.css',
      'd4bf06b33998c8e4.css', 
      '27009eec4e834559.css',
      '0e01c3335b64967d.css',
      '379676f96186df68.css',
      '93724a93c41077ec.css'
    ];
    
    // 무조건 차단할 리소스 타입
    this.blockedResourceTypes = ['image', 'font', 'media'];
    
    // 무조건 허용해야 하는 리소스 타입
    this.allowedResourceTypes = ['fetch', 'xhr', 'document', 'script'];
  }
  
  /**
   * 요청을 차단해야 하는지 확인
   * @param {Request} request - Playwright request 객체
   * @returns {boolean} - 차단 여부
   */
  shouldBlock(request) {
    const url = request.url();
    const resourceType = request.resourceType();
    
    // 0. 무조건 허용해야 하는 타입 체크 (fetch, xhr, document, script)
    if (this.allowedResourceTypes.includes(resourceType)) {
      return false;
    }
    
    // 1. 리소스 타입 체크 (이미지, 폰트, 미디어)
    if (this.blockedResourceTypes.includes(resourceType)) {
      return true;
    }
    
    // 2. 차단 도메인 체크
    if (this.blockedDomains.some(domain => url.includes(domain))) {
      return true;
    }
    
    // 3. 특정 파일 패턴 체크
    if (this.blockedPatterns.some(pattern => url.includes(pattern))) {
      return true;
    }
    
    // 4. CSS 필터링
    if (resourceType === 'stylesheet' || url.endsWith('.css')) {
      return !this.allowedCSS.some(name => url.includes(name));
    }
    
    // 나머지는 허용
    return false;
  }
  
  /**
   * 페이지에 리소스 차단 설정 적용
   * @param {Page} page - Playwright page 객체
   */
  async applyToPage(page) {
    await page.route('**/*', async route => {
      const request = route.request();
      
      if (this.shouldBlock(request)) {
        return route.abort();
      }
      
      return route.continue();
    });
    
    console.log('🚫 리소스 차단 활성화: 이미지/폰트/추적 차단, 핵심 리소스만 허용');
  }
  
  /**
   * 차단 통계 수집을 위한 상세 차단 적용
   * @param {Page} page - Playwright page 객체
   * @returns {Object} - 차단 통계 수집 객체
   */
  async applyWithStats(page) {
    const stats = {
      blocked: {
        byType: {},
        byDomain: {},
        byPattern: {},
        total: 0
      },
      allowed: {
        total: 0
      }
    };
    
    await page.route('**/*', async route => {
      const request = route.request();
      const url = request.url();
      const resourceType = request.resourceType();
      
      if (this.shouldBlock(request)) {
        // 차단 통계 수집
        stats.blocked.total++;
        
        // 타입별 통계
        if (this.blockedResourceTypes.includes(resourceType)) {
          stats.blocked.byType[resourceType] = (stats.blocked.byType[resourceType] || 0) + 1;
        }
        
        // 도메인별 통계
        const blockedDomain = this.blockedDomains.find(domain => url.includes(domain));
        if (blockedDomain) {
          stats.blocked.byDomain[blockedDomain] = (stats.blocked.byDomain[blockedDomain] || 0) + 1;
        }
        
        // 패턴별 통계
        const blockedPattern = this.blockedPatterns.find(pattern => url.includes(pattern));
        if (blockedPattern) {
          stats.blocked.byPattern[blockedPattern] = (stats.blocked.byPattern[blockedPattern] || 0) + 1;
        }
        
        return route.abort();
      }
      
      stats.allowed.total++;
      return route.continue();
    });
    
    console.log('🚫 리소스 차단 활성화 (통계 수집 모드)');
    return stats;
  }
  
  /**
   * 차단 설정 업데이트
   */
  updateBlockedDomains(domains) {
    this.blockedDomains = domains;
  }
  
  updateBlockedPatterns(patterns) {
    this.blockedPatterns = patterns;
  }
  
  updateAllowedCSS(cssFiles) {
    this.allowedCSS = cssFiles;
  }
  
  updateBlockedResourceTypes(types) {
    this.blockedResourceTypes = types;
  }
  
  /**
   * 현재 차단 설정 반환
   */
  getConfig() {
    return {
      blockedDomains: this.blockedDomains,
      blockedPatterns: this.blockedPatterns,
      allowedCSS: this.allowedCSS,
      blockedResourceTypes: this.blockedResourceTypes
    };
  }
}

module.exports = new ResourceBlocker();