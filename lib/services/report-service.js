const apiClient = require('./api-client');
const apiConfig = require('../../config/api.config');
const fs = require('fs').promises;
const path = require('path');

class ReportService {
  constructor() {
    this.logsDir = path.join(__dirname, '../../data/logs');
  }
  
  /**
   * 실행 결과 보고
   */
  async reportExecution(data) {
    // 로컬 로그 저장
    await this.saveLocalLog(data);
    
    // API 모드일 경우 서버로 전송
    if (apiConfig.mode === 'api') {
      await this.sendToAPI(data);
    }
  }
  
  /**
   * 로컬 로그 저장
   */
  async saveLocalLog(data) {
    try {
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      const logDir = path.join(this.logsDir, dateStr);
      
      await fs.mkdir(logDir, { recursive: true });
      
      const filename = `${date.getTime()}_${data.workflow}_${data.status}.json`;
      const filepath = path.join(logDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify({
        ...data,
        savedAt: new Date().toISOString()
      }, null, 2));
      
      console.log(`📝 로그 저장: ${filepath}`);
    } catch (error) {
      console.error('❌ 로그 저장 실패:', error.message);
    }
  }
  
  /**
   * API로 결과 전송
   */
  async sendToAPI(data) {
    try {
      await apiClient.post('/api/reports/execution', data);
      console.log('📤 실행 결과 API 전송 완료');
    } catch (error) {
      console.error('❌ API 전송 실패:', error.message);
    }
  }
  
  /**
   * 스크린샷 업로드
   */
  async uploadScreenshot(filepath, metadata = {}) {
    if (apiConfig.mode !== 'api') {
      return null;
    }
    
    try {
      const formData = new FormData();
      const fileBuffer = await fs.readFile(filepath);
      
      formData.append('screenshot', new Blob([fileBuffer]), path.basename(filepath));
      formData.append('metadata', JSON.stringify(metadata));
      
      const response = await apiClient.post('/api/screenshots', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('📸 스크린샷 업로드 완료');
      return response.url;
    } catch (error) {
      console.error('❌ 스크린샷 업로드 실패:', error.message);
      return null;
    }
  }
  
  /**
   * 에러 보고
   */
  async reportError(error, context = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString()
    };
    
    // 로컬 저장
    await this.saveLocalLog({
      type: 'error',
      status: 'error',
      workflow: context.workflow || 'unknown',
      ...errorData
    });
    
    // API 전송
    if (apiConfig.mode === 'api') {
      try {
        await apiClient.post('/api/reports/error', errorData);
      } catch (err) {
        console.error('❌ 에러 보고 실패:', err.message);
      }
    }
  }
  
  /**
   * 통계 데이터 수집 및 전송
   */
  async reportStatistics(stats) {
    const statsData = {
      ...stats,
      timestamp: new Date().toISOString()
    };
    
    // 로컬 저장
    await this.saveLocalLog({
      type: 'statistics',
      status: 'completed',
      workflow: stats.workflow || 'unknown',
      ...statsData
    });
    
    // API 전송
    if (apiConfig.mode === 'api') {
      try {
        await apiClient.post('/api/reports/statistics', statsData);
        console.log('📊 통계 데이터 전송 완료');
      } catch (error) {
        console.error('❌ 통계 전송 실패:', error.message);
      }
    }
  }
}

module.exports = new ReportService();