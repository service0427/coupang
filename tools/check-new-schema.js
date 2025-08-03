/**
 * 새로운 스키마 확인 도구
 * agent 컬럼 추가 및 제거된 컬럼 확인
 */

const dbService = require('../lib/services/db-service');

async function checkNewSchema() {
  try {
    await dbService.init();
    
    console.log('\n📊 test_keywords 테이블 구조 확인');
    console.log('━'.repeat(80));
    
    // 컬럼 구조 확인
    const columnsResult = await dbService.query(`
      SELECT 
        ordinal_position,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'test_keywords'
      ORDER BY ordinal_position
    `);
    
    console.log('순서 | 컬럼명               | 타입                 | NULL | 기본값');
    console.log('━'.repeat(80));
    
    columnsResult.rows.forEach(col => {
      console.log(
        `${col.ordinal_position.toString().padEnd(4)} | ` +
        `${col.column_name.padEnd(20)} | ` +
        `${col.data_type.padEnd(20)} | ` +
        `${col.is_nullable.padEnd(4)} | ` +
        `${col.column_default || 'NULL'}`
      );
    });
    
    // 전체 데이터 조회
    console.log('\n\n📊 현재 데이터 (agent 컬럼 포함):');
    console.log('━'.repeat(80));
    
    const dataResult = await dbService.query(`
      SELECT id, date, keyword, suffix, product_code, agent, browser, 
             proxy_server, current_executions, max_executions
      FROM test_keywords 
      ORDER BY id
    `);
    
    console.log('ID | 날짜       | 키워드     | suffix | 코드       | agent   | 브라우저 | 프록시              | 실행');
    console.log('━'.repeat(80));
    
    dataResult.rows.forEach(row => {
      console.log(
        `${row.id.toString().padEnd(2)} | ` +
        `${row.date ? new Date(row.date).toISOString().split('T')[0] : 'NULL'.padEnd(10)} | ` +
        `${(row.keyword || '').substring(0, 10).padEnd(10)} | ` +
        `${(row.suffix || '').padEnd(6)} | ` +
        `${(row.product_code || '').padEnd(10)} | ` +
        `${(row.agent || 'NULL').padEnd(7)} | ` +
        `${row.browser.padEnd(8)} | ` +
        `${(row.proxy_server || 'NULL').substring(0, 20).padEnd(20)} | ` +
        `${row.current_executions}/${row.max_executions}`
      );
    });
    
    // 제거된 컬럼 확인
    console.log('\n\n✅ 제거된 컬럼:');
    console.log('   - os_type');
    console.log('   - is_vmware');
    console.log('   - is_active');
    
    console.log('\n✅ 추가된 컬럼:');
    console.log('   - agent (product_code 다음 위치)');
    
    // 활성 키워드 수 확인 (agent별)
    console.log('\n\n📊 Agent별 활성 키워드:');
    const agentStats = await dbService.query(`
      SELECT 
        COALESCE(agent, 'NULL') as agent_name,
        COUNT(*) as total,
        SUM(CASE WHEN current_executions < max_executions THEN 1 ELSE 0 END) as active
      FROM test_keywords
      WHERE date = CURRENT_DATE
      GROUP BY agent
      ORDER BY agent
    `);
    
    agentStats.rows.forEach(stat => {
      console.log(`   ${stat.agent_name}: 총 ${stat.total}개 (활성 ${stat.active}개)`);
    });
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await dbService.close();
  }
}

// 직접 실행
if (require.main === module) {
  checkNewSchema();
}

module.exports = { checkNewSchema };