/**
 * execution_logs 테이블 업데이트 테스트
 * - 새로운 컬럼들이 정상적으로 저장되는지 확인
 */

const dbService = require('../lib/services/db-service');
const keywordService = require('../lib/services/keyword-service');

async function testExecutionLogs() {
  try {
    await keywordService.init();
    
    console.log('\n📊 execution_logs 테이블 구조 확인');
    console.log('━'.repeat(80));
    
    // 컬럼 구조 확인
    const columnsResult = await dbService.query(`
      SELECT 
        ordinal_position,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'execution_logs'
      ORDER BY ordinal_position
    `);
    
    console.log('순서 | 컬럼명               | 타입                 | NULL');
    console.log('━'.repeat(80));
    
    columnsResult.rows.forEach(col => {
      console.log(
        `${col.ordinal_position.toString().padEnd(4)} | ` +
        `${col.column_name.padEnd(20)} | ` +
        `${col.data_type.padEnd(20)} | ` +
        `${col.is_nullable}`
      );
    });
    
    // 테스트 로그 저장
    console.log('\n\n📝 테스트 로그 저장');
    console.log('━'.repeat(80));
    
    const testLog = {
      keywordId: 7,  // 기존 키워드 ID 사용
      agent: 'test-agent',
      success: true,
      productFound: true,
      productRank: 15,
      urlRank: 3,
      pagesSearched: 2,
      cartClicked: true,
      errorMessage: null,
      durationMs: 12345,
      browserUsed: 'chrome',
      proxyUsed: 'socks5://112.161.54.7:10011',
      actualIp: '112.161.54.123',
      finalUrl: 'https://www.coupang.com/vp/products/7890123?rank=3'
    };
    
    console.log('저장할 데이터:');
    Object.entries(testLog).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    const saved = await keywordService.saveExecutionLog(testLog);
    console.log(`\n✅ 저장 결과: ${saved ? '성공' : '실패'}`);
    
    // 저장된 로그 확인
    console.log('\n\n📊 최근 저장된 로그 확인');
    console.log('━'.repeat(80));
    
    const recentLogs = await dbService.query(`
      SELECT 
        id, keyword_id, agent, success, product_found, 
        product_rank, url_rank, actual_ip,
        SUBSTRING(final_url, 1, 50) as final_url_short,
        executed_at
      FROM execution_logs
      ORDER BY id DESC
      LIMIT 5
    `);
    
    console.log('ID | KW_ID | agent       | 성공 | 상품 | P_RANK | U_RANK | IP              | URL');
    console.log('━'.repeat(80));
    
    recentLogs.rows.forEach(log => {
      console.log(
        `${log.id.toString().padEnd(2)} | ` +
        `${log.keyword_id.toString().padEnd(5)} | ` +
        `${(log.agent || 'NULL').padEnd(11)} | ` +
        `${log.success ? '✅' : '❌'}   | ` +
        `${log.product_found ? '✅' : '❌'}   | ` +
        `${(log.product_rank || '-').toString().padEnd(6)} | ` +
        `${(log.url_rank || '-').toString().padEnd(6)} | ` +
        `${(log.actual_ip || 'NULL').padEnd(15)} | ` +
        `${(log.final_url_short || 'NULL').substring(0, 20)}...`
      );
    });
    
    // 에이전트별 통계
    console.log('\n\n📊 에이전트별 실행 통계');
    console.log('━'.repeat(80));
    
    const agentStats = await dbService.query(`
      SELECT 
        COALESCE(agent, 'NULL') as agent_name,
        COUNT(*) as total_logs,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
        ROUND(AVG(duration_ms)) as avg_duration_ms
      FROM execution_logs
      WHERE executed_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY agent
      ORDER BY total_logs DESC
    `);
    
    console.log('에이전트     | 총 로그 | 성공 | 평균 시간(ms)');
    console.log('━'.repeat(50));
    
    agentStats.rows.forEach(stat => {
      console.log(
        `${stat.agent_name.padEnd(12)} | ` +
        `${stat.total_logs.toString().padEnd(7)} | ` +
        `${stat.success_count.toString().padEnd(4)} | ` +
        `${stat.avg_duration_ms || 0}`
      );
    });
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await keywordService.close();
  }
}

// 직접 실행
if (require.main === module) {
  testExecutionLogs();
}

module.exports = { testExecutionLogs };