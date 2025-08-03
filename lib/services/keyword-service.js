const dbService = require('./db-service');

/**
 * 테스트 키워드 관리 서비스
 * - OS별 키워드 조회
 * - 실행 횟수 업데이트
 * - 자동 비활성화 (100회 도달시)
 */
class KeywordService {
  constructor() {
    this.initialized = false;
  }

  /**
   * 서비스 초기화
   */
  async init() {
    if (!this.initialized) {
      await dbService.init();
      this.initialized = true;
      console.log('✅ KeywordService 초기화 완료');
    }
  }

  /**
   * OS별 활성 키워드 조회
   * @param {string} osType - 운영체제 (win11, u24, u22)
   * @param {Object} options - 추가 필터 옵션
   * @returns {Array} 활성 키워드 목록
   */
  async getActiveKeywords(osType, options = {}) {
    try {
      let query = `
        SELECT 
          id, keyword, suffix, product_code, date,
          os_type, is_vmware, ip_type, 
          ip_change_enabled, allow_duplicate_ip, browser, profile_name,
          cart_click_enabled,
          max_executions, current_executions, 
          success_count, fail_count, last_executed_at
        FROM test_keywords 
        WHERE is_active = true AND os_type = $1
      `;
      
      const params = [osType];
      let paramIndex = 2;

      // 추가 필터링 옵션
      if (options.browser) {
        query += ` AND browser = $${paramIndex}`;
        params.push(options.browser);
        paramIndex++;
      }

      if (options.allowDuplicateIp !== undefined) {
        query += ` AND allow_duplicate_ip = $${paramIndex}`;
        params.push(options.allowDuplicateIp);
        paramIndex++;
      }

      if (options.ipType) {
        query += ` AND ip_type = $${paramIndex}`;
        params.push(options.ipType);
        paramIndex++;
      }

      // 날짜 필터 (기본값: 오늘)
      if (options.date !== false) {  // false가 아닌 경우에만 날짜 필터 적용
        query += ` AND date = $${paramIndex}`;
        params.push(options.date || new Date().toISOString().split('T')[0]);
        paramIndex++;
      }

      // 실행 횟수가 적은 순으로 정렬 (균등하게 테스트하기 위해)
      query += ` ORDER BY current_executions ASC, last_executed_at ASC NULLS FIRST`;

      console.log(`🔍 ${osType} 환경의 활성 키워드 조회중...`);
      const result = await dbService.query(query, params);
      
      console.log(`📋 활성 키워드 ${result.rows.length}개 발견`);
      return result.rows;

    } catch (error) {
      console.error('❌ 키워드 조회 실패:', error.message);
      throw error;
    }
  }

  /**
   * 다음 실행할 키워드 가져오기 (가장 적게 실행된 것 우선)
   * @param {string} osType - 운영체제
   * @param {Object} options - 필터 옵션
   * @returns {Object|null} 키워드 정보 또는 null
   */
  async getNextKeyword(osType, options = {}) {
    try {
      const keywords = await this.getActiveKeywords(osType, options);
      
      if (keywords.length === 0) {
        console.log(`⚠️  ${osType} 환경에 실행 가능한 키워드가 없습니다.`);
        return null;
      }

      // 실행 횟수가 가장 적은 키워드 선택
      const nextKeyword = keywords[0];
      
      console.log(`🎯 선택된 키워드: "${nextKeyword.keyword}${nextKeyword.suffix || ''}" (${nextKeyword.current_executions}/${nextKeyword.max_executions})`);
      
      return nextKeyword;

    } catch (error) {
      console.error('❌ 다음 키워드 조회 실패:', error.message);
      return null;
    }
  }

  /**
   * 키워드 실행 시작 기록
   * @param {number} keywordId - 키워드 ID
   * @returns {boolean} 성공 여부
   */
  async markKeywordStarted(keywordId) {
    try {
      // 실행 횟수 증가 및 마지막 실행 시간 업데이트
      const query = `
        UPDATE test_keywords 
        SET 
          current_executions = current_executions + 1,
          last_executed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING current_executions, max_executions
      `;

      const result = await dbService.query(query, [keywordId]);
      
      if (result.rows.length === 0) {
        console.log(`⚠️  키워드 ID ${keywordId}를 찾을 수 없거나 비활성 상태입니다.`);
        return false;
      }

      const row = result.rows[0];
      console.log(`📈 키워드 실행 기록: ${row.current_executions}/${row.max_executions}`);

      // 최대 실행 횟수 도달시 자동 비활성화
      if (row.current_executions >= row.max_executions) {
        await this.deactivateKeyword(keywordId);
        console.log(`🔒 키워드 ID ${keywordId} 최대 실행 횟수 도달로 비활성화`);
      }

      return true;

    } catch (error) {
      console.error('❌ 키워드 실행 시작 기록 실패:', error.message);
      return false;
    }
  }

  /**
   * 키워드 실행 결과 기록
   * @param {number} keywordId - 키워드 ID
   * @param {boolean} success - 성공 여부
   * @param {string} errorMessage - 에러 메시지 (실패시)
   * @returns {boolean} 성공 여부
   */
  async recordExecutionResult(keywordId, success, errorMessage = null) {
    try {
      const updateField = success ? 'success_count' : 'fail_count';
      
      const query = `
        UPDATE test_keywords 
        SET 
          ${updateField} = ${updateField} + 1,
          updated_at = NOW()
        WHERE id = $1
        RETURNING success_count, fail_count
      `;

      const result = await dbService.query(query, [keywordId]);
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const status = success ? '✅ 성공' : '❌ 실패';
        console.log(`📊 실행 결과 기록: ${status} (성공: ${row.success_count}, 실패: ${row.fail_count})`);
        
        if (!success && errorMessage) {
          console.log(`   에러: ${errorMessage}`);
        }
      }

      return true;

    } catch (error) {
      console.error('❌ 실행 결과 기록 실패:', error.message);
      return false;
    }
  }

  /**
   * 키워드 비활성화
   * @param {number} keywordId - 키워드 ID
   * @returns {boolean} 성공 여부
   */
  async deactivateKeyword(keywordId) {
    try {
      const query = `
        UPDATE test_keywords 
        SET 
          is_active = false,
          updated_at = NOW()
        WHERE id = $1
      `;

      await dbService.query(query, [keywordId]);
      console.log(`🔒 키워드 ID ${keywordId} 비활성화 완료`);
      return true;

    } catch (error) {
      console.error('❌ 키워드 비활성화 실패:', error.message);
      return false;
    }
  }

  /**
   * 키워드 통계 조회
   * @param {string} osType - 운영체제 (선택사항)
   * @returns {Object} 통계 정보
   */
  async getKeywordStats(osType = null) {
    try {
      let query = `
        SELECT 
          os_type,
          COUNT(*) as total_keywords,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_keywords,
          SUM(current_executions) as total_executions,
          SUM(success_count) as total_success,
          SUM(fail_count) as total_failures,
          ROUND(
            CASE 
              WHEN SUM(success_count + fail_count) > 0 
              THEN (SUM(success_count)::decimal / SUM(success_count + fail_count)) * 100 
              ELSE 0 
            END, 2
          ) as success_rate
        FROM test_keywords
      `;

      const params = [];
      if (osType) {
        query += ` WHERE os_type = $1`;
        params.push(osType);
      }

      query += ` GROUP BY os_type ORDER BY os_type`;

      const result = await dbService.query(query, params);
      return result.rows;

    } catch (error) {
      console.error('❌ 키워드 통계 조회 실패:', error.message);
      return [];
    }
  }

  /**
   * 전체 활성 키워드 수 조회 (OS별)
   * @param {string} osType - 운영체제
   * @returns {number} 활성 키워드 수
   */
  async getActiveKeywordCount(osType) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM test_keywords 
        WHERE is_active = true AND os_type = $1
      `;

      const result = await dbService.query(query, [osType]);
      return parseInt(result.rows[0].count);

    } catch (error) {
      console.error('❌ 활성 키워드 수 조회 실패:', error.message);
      return 0;
    }
  }

  /**
   * 실행 결과 상세 로그 저장
   * @param {Object} logData - 실행 로그 데이터
   * @returns {boolean} 성공 여부
   */
  async saveExecutionLog(logData) {
    try {
      const query = `
        INSERT INTO execution_logs (
          keyword_id, success, product_found, product_rank,
          pages_searched, cart_clicked, error_message,
          duration_ms, browser_used, proxy_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `;

      const params = [
        logData.keywordId,
        logData.success,
        logData.productFound || false,
        logData.productRank || null,
        logData.pagesSearched || 1,
        logData.cartClicked || false,
        logData.errorMessage || null,
        logData.durationMs || null,
        logData.browserUsed || null,
        logData.proxyUsed || null
      ];

      const result = await dbService.query(query, params);
      
      console.log(`📝 실행 로그 저장 완료 (ID: ${result.rows[0].id})`);
      return true;

    } catch (error) {
      console.error('❌ 실행 로그 저장 실패:', error.message);
      return false;
    }
  }

  /**
   * 키워드별 실행 로그 조회
   * @param {number} keywordId - 키워드 ID
   * @param {number} limit - 조회할 로그 수
   * @returns {Array} 실행 로그 목록
   */
  async getExecutionLogs(keywordId, limit = 10) {
    try {
      const query = `
        SELECT 
          id, executed_at, success, product_found, product_rank,
          pages_searched, cart_clicked, error_message,
          duration_ms, browser_used, proxy_used
        FROM execution_logs
        WHERE keyword_id = $1
        ORDER BY executed_at DESC
        LIMIT $2
      `;

      const result = await dbService.query(query, [keywordId, limit]);
      return result.rows;

    } catch (error) {
      console.error('❌ 실행 로그 조회 실패:', error.message);
      return [];
    }
  }

  /**
   * 서비스 종료
   */
  async close() {
    if (this.initialized) {
      await dbService.close();
      this.initialized = false;
      console.log('🔌 KeywordService 종료');
    }
  }
}

module.exports = new KeywordService();