const apiClient = require('./api-client');
const proxyManager = require('./proxy-manager');
const apiConfig = require('../../config/api.config');

class ProxyService {
  constructor() {
    this.mode = apiConfig.mode;
    this.currentProxy = null;
  }
  
  /**
   * 프록시 가져오기 (API 또는 로컬)
   */
  async getProxy(options = {}) {
    console.log(`🔄 프록시 가져오기 (모드: ${this.mode})`);
    
    if (this.mode === 'api') {
      return await this.getProxyFromAPI(options);
    } else {
      return await this.getProxyFromLocal(options);
    }
  }
  
  /**
   * API에서 프록시 가져오기
   */
  async getProxyFromAPI(options) {
    try {
      const response = await apiClient.requestWithRetry('GET', apiConfig.endpoints.getProxy, {
        ...options,
        lastProxyId: this.currentProxy?.id
      });
      
      if (response.proxy) {
        this.currentProxy = response.proxy;
        console.log(`✅ API 프록시 할당: ${response.proxy.name} (${response.proxy.server})`);
        
        return {
          server: response.proxy.server,
          username: response.proxy.username,
          password: response.proxy.password
        };
      }
      
      console.log('⚠️ API에서 사용 가능한 프록시가 없습니다');
      return null;
    } catch (error) {
      console.error('❌ API 프록시 가져오기 실패:', error.message);
      
      // 폴백: 로컬 모드로 전환
      if (options.fallback !== false) {
        console.log('💡 로컬 프록시로 폴백');
        return await this.getProxyFromLocal(options);
      }
      
      return null;
    }
  }
  
  /**
   * 로컬 JSON에서 프록시 가져오기
   */
  async getProxyFromLocal(options) {
    const mode = options.mode || options.proxyMode || null;
    return await proxyManager.getProxy(mode);
  }
  
  /**
   * 프록시 상태 보고 (API 모드)
   */
  async reportProxyStatus(status, error = null) {
    if (this.mode !== 'api' || !this.currentProxy) {
      return;
    }
    
    try {
      const endpoint = apiConfig.endpoints.reportProxyStatus.replace(':id', this.currentProxy.id);
      await apiClient.post(endpoint, {
        status: status, // 'success', 'failed', 'blocked', 'slow'
        error: error,
        timestamp: new Date().toISOString()
      });
      
      console.log(`📊 프록시 상태 보고: ${status}`);
    } catch (error) {
      console.error('❌ 프록시 상태 보고 실패:', error.message);
    }
  }
  
  /**
   * 현재 프록시 정보 반환
   */
  getCurrentProxy() {
    return this.currentProxy;
  }
  
  /**
   * 프록시 초기화
   */
  reset() {
    this.currentProxy = null;
  }
}

module.exports = new ProxyService();