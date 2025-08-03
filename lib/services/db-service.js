const { Pool } = require('pg');
const apiConfig = require('../../config/api.config');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * 데이터베이스 연결 초기화
   */
  async init(config = null) {
    try {
      // 설정 우선순위: 매개변수 > 환경변수 > 기본값
      const dbConfig = config || {
        host: process.env.DB_HOST || 'mkt.techb.kr',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'coupang_test',
        user: process.env.DB_USER || 'techb_pp',
        password: process.env.DB_PASSWORD || 'Tech1324!',
        max: 20, // 최대 연결 수
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      };

      console.log('🔌 PostgreSQL 연결 시도...');
      console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
      console.log(`   Database: ${dbConfig.database}`);
      console.log(`   User: ${dbConfig.user}`);

      this.pool = new Pool(dbConfig);

      // 연결 테스트
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log('✅ PostgreSQL 연결 성공!');
      console.log(`   서버 시간: ${result.rows[0].now}`);

      return true;
    } catch (error) {
      console.error('❌ PostgreSQL 연결 실패:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * 쿼리 실행
   */
  async query(text, params = []) {
    if (!this.isConnected) {
      throw new Error('데이터베이스가 연결되지 않았습니다. init()를 먼저 호출하세요.');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      console.log(`📊 쿼리 실행 완료 (${duration}ms): ${text.substring(0, 50)}...`);
      
      return result;
    } catch (error) {
      console.error('❌ 쿼리 실행 실패:', error.message);
      throw error;
    }
  }

  /**
   * 트랜잭션 실행
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 작업 정보 조회
   */
  async getNextTask() {
    const query = `
      SELECT 
        t.id,
        t.workflow,
        t.options,
        t.status,
        t.created_at
      FROM tasks t
      WHERE t.status = 'pending'
      ORDER BY t.priority DESC, t.created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    try {
      const result = await this.query(query);
      
      if (result.rows.length > 0) {
        const task = result.rows[0];
        
        // 작업 상태를 'processing'으로 업데이트
        await this.query(
          'UPDATE tasks SET status = $1, started_at = NOW() WHERE id = $2',
          ['processing', task.id]
        );
        
        return task;
      }
      
      return null;
    } catch (error) {
      console.error('작업 조회 실패:', error);
      return null;
    }
  }

  /**
   * 작업 결과 저장
   */
  async saveTaskResult(taskId, result) {
    const query = `
      UPDATE tasks 
      SET 
        status = $1,
        result = $2,
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
    `;

    const status = result.success ? 'completed' : 'failed';
    
    try {
      await this.query(query, [status, JSON.stringify(result), taskId]);
      console.log(`✅ 작업 결과 저장 완료: ${taskId}`);
    } catch (error) {
      console.error('작업 결과 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 프록시 정보 조회
   */
  async getActiveProxies() {
    const query = `
      SELECT 
        id,
        server,
        username,
        password,
        name,
        location,
        last_used_at,
        success_count,
        fail_count
      FROM proxies
      WHERE active = true
      ORDER BY 
        CASE 
          WHEN last_used_at IS NULL THEN 0
          ELSE EXTRACT(EPOCH FROM (NOW() - last_used_at))
        END DESC,
        success_count DESC
    `;

    try {
      const result = await this.query(query);
      return result.rows;
    } catch (error) {
      console.error('프록시 조회 실패:', error);
      return [];
    }
  }

  /**
   * 프록시 사용 기록
   */
  async updateProxyUsage(proxyId, success = true) {
    const query = success
      ? 'UPDATE proxies SET last_used_at = NOW(), success_count = success_count + 1 WHERE id = $1'
      : 'UPDATE proxies SET last_used_at = NOW(), fail_count = fail_count + 1 WHERE id = $1';

    try {
      await this.query(query, [proxyId]);
    } catch (error) {
      console.error('프록시 사용 기록 업데이트 실패:', error);
    }
  }

  /**
   * 실행 로그 저장
   */
  async saveExecutionLog(data) {
    const query = `
      INSERT INTO execution_logs 
      (task_id, workflow, status, error_message, duration_ms, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `;

    try {
      const result = await this.query(query, [
        data.taskId || null,
        data.workflow,
        data.status,
        data.errorMessage || null,
        data.durationMs || null,
        JSON.stringify(data.metadata || {})
      ]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('실행 로그 저장 실패:', error);
      return null;
    }
  }

  /**
   * 연결 종료
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('🔌 PostgreSQL 연결 종료');
    }
  }

  /**
   * 연결 상태 확인
   */
  async checkConnection() {
    try {
      const result = await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new DatabaseService();