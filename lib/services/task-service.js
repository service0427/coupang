const apiClient = require('./api-client');
const apiConfig = require('../../config/api.config');

class TaskService {
  constructor() {
    this.currentTask = null;
  }
  
  /**
   * 다음 작업 가져오기
   */
  async getNextTask() {
    if (apiConfig.mode !== 'api') {
      return null; // 로컬 모드에서는 작업 큐 사용 안 함
    }
    
    try {
      const response = await apiClient.requestWithRetry('GET', apiConfig.endpoints.getTask);
      
      if (response.task) {
        this.currentTask = response.task;
        console.log(`\n📋 새 작업 할당: ${response.task.id}`);
        console.log(`   워크플로우: ${response.task.workflow}`);
        console.log(`   옵션: ${JSON.stringify(response.task.options)}`);
        
        return response.task;
      }
      
      console.log('⏸️ 대기 중인 작업이 없습니다');
      return null;
    } catch (error) {
      console.error('❌ 작업 가져오기 실패:', error.message);
      return null;
    }
  }
  
  /**
   * 작업 결과 보고
   */
  async reportResult(taskId, result) {
    if (apiConfig.mode !== 'api') {
      return;
    }
    
    try {
      const endpoint = apiConfig.endpoints.reportResult.replace(':id', taskId);
      await apiClient.post(endpoint, {
        status: result.success ? 'completed' : 'failed',
        result: result,
        completedAt: new Date().toISOString()
      });
      
      console.log(`✅ 작업 결과 보고 완료: ${taskId}`);
    } catch (error) {
      console.error('❌ 작업 결과 보고 실패:', error.message);
    }
  }
  
  /**
   * 상품 정보 가져오기
   */
  async getProduct(productId) {
    try {
      const endpoint = apiConfig.endpoints.getProduct.replace(':id', productId);
      const product = await apiClient.get(endpoint);
      
      return product;
    } catch (error) {
      console.error('❌ 상품 정보 가져오기 실패:', error.message);
      return null;
    }
  }
  
  /**
   * 상품 검색
   */
  async searchProducts(query, options = {}) {
    try {
      const products = await apiClient.get(apiConfig.endpoints.searchProducts, {
        q: query,
        ...options
      });
      
      return products;
    } catch (error) {
      console.error('❌ 상품 검색 실패:', error.message);
      return [];
    }
  }
  
  /**
   * 워크플로우 설정 가져오기
   */
  async getWorkflowConfig(workflowId) {
    try {
      const endpoint = apiConfig.endpoints.getWorkflowConfig.replace(':id', workflowId);
      const config = await apiClient.get(endpoint);
      
      return config;
    } catch (error) {
      console.error('❌ 워크플로우 설정 가져오기 실패:', error.message);
      return null;
    }
  }
  
  /**
   * 현재 작업 정보 반환
   */
  getCurrentTask() {
    return this.currentTask;
  }
  
  /**
   * 작업 초기화
   */
  reset() {
    this.currentTask = null;
  }
}

module.exports = new TaskService();