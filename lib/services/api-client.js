const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const apiConfig = require('../../config/api.config');

class ApiClient {
  constructor() {
    this.baseURL = apiConfig.apiUrl;
    this.apiKey = apiConfig.apiKey;
    this.cacheDir = path.join(__dirname, '../../data/cache');
    
    // Axios 인스턴스 생성
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: apiConfig.timeout.request,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    });
    
    // 응답 인터셉터
    this.client.interceptors.response.use(
      response => response,
      error => this.handleError(error)
    );
  }
  
  /**
   * GET 요청
   */
  async get(endpoint, params = {}) {
    const cacheKey = this.getCacheKey('GET', endpoint, params);
    
    // 캐시 확인
    if (apiConfig.cache.enabled) {
      const cached = await this.getCache(cacheKey);
      if (cached) return cached;
    }
    
    try {
      const response = await this.client.get(endpoint, { params });
      
      // 캐시 저장
      if (apiConfig.cache.enabled) {
        await this.setCache(cacheKey, response.data);
      }
      
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * POST 요청
   */
  async post(endpoint, data = {}) {
    try {
      const response = await this.client.post(endpoint, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * PUT 요청
   */
  async put(endpoint, data = {}) {
    try {
      const response = await this.client.put(endpoint, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * 에러 처리
   */
  async handleError(error) {
    if (error.response) {
      // 서버 응답 에러
      console.error(`API 에러: ${error.response.status} - ${error.response.data.message || error.message}`);
    } else if (error.request) {
      // 네트워크 에러
      console.error('네트워크 에러:', error.message);
    } else {
      // 기타 에러
      console.error('요청 에러:', error.message);
    }
    
    return Promise.reject(error);
  }
  
  /**
   * 캐시 키 생성
   */
  getCacheKey(method, endpoint, params) {
    const paramStr = JSON.stringify(params);
    return `${method}_${endpoint}_${Buffer.from(paramStr).toString('base64')}`;
  }
  
  /**
   * 캐시 조회
   */
  async getCache(key) {
    try {
      const cachePath = path.join(this.cacheDir, `${key}.json`);
      const stat = await fs.stat(cachePath);
      
      // TTL 확인
      const age = Date.now() - stat.mtime.getTime();
      if (age > apiConfig.cache.ttl) {
        await fs.unlink(cachePath);
        return null;
      }
      
      const data = await fs.readFile(cachePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
  
  /**
   * 캐시 저장
   */
  async setCache(key, data) {
    try {
      const cachePath = path.join(this.cacheDir, `${key}.json`);
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('캐시 저장 실패:', error.message);
    }
  }
  
  /**
   * 재시도 로직이 포함된 요청
   */
  async requestWithRetry(method, endpoint, data = {}) {
    let lastError;
    
    for (let i = 0; i < apiConfig.retry.maxAttempts; i++) {
      try {
        if (method === 'GET') {
          return await this.get(endpoint, data);
        } else if (method === 'POST') {
          return await this.post(endpoint, data);
        } else if (method === 'PUT') {
          return await this.put(endpoint, data);
        }
      } catch (error) {
        lastError = error;
        
        // 재시도하지 않는 에러 코드
        if (error.response && [400, 401, 403, 404].includes(error.response.status)) {
          throw error;
        }
        
        // 재시도 대기
        if (i < apiConfig.retry.maxAttempts - 1) {
          const delay = apiConfig.retry.delay * Math.pow(apiConfig.retry.backoff, i);
          console.log(`재시도 ${i + 1}/${apiConfig.retry.maxAttempts} - ${delay}ms 대기`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}

module.exports = new ApiClient();