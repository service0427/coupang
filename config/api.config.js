// API 설정
module.exports = {
  // API 기본 URL
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  
  // API 인증 키
  apiKey: process.env.API_KEY || '',
  
  // 작동 모드: 'local' (JSON 파일) 또는 'api' (API 서버)
  mode: process.env.MODE || 'local',
  
  // API 엔드포인트
  endpoints: {
    // 작업 관련
    getTask: '/api/tasks/next',
    reportResult: '/api/tasks/:id/result',
    
    // 프록시 관련
    getProxy: '/api/proxies/next',
    reportProxyStatus: '/api/proxies/:id/status',
    
    // 상품 정보
    getProduct: '/api/products/:id',
    searchProducts: '/api/products/search',
    
    // 옵션 및 설정
    getOptions: '/api/options',
    getWorkflowConfig: '/api/workflows/:id/config'
  },
  
  // 재시도 설정
  retry: {
    maxAttempts: 3,
    delay: 1000, // ms
    backoff: 2 // 배수
  },
  
  // 타임아웃 설정
  timeout: {
    request: 30000, // 30초
    task: 600000 // 10분
  },
  
  // 캐시 설정
  cache: {
    enabled: true,
    ttl: 3600000, // 1시간
    maxSize: 100 // MB
  }
};