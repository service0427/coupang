/**
 * 실행 횟수 초기화 도구
 */

const dbService = require('../lib/services/db-service');

async function resetExecutions() {
  try {
    await dbService.init();
    
    console.log('\n📋 실행 횟수 초기화');
    console.log('━'.repeat(50));
    
    // 모든 키워드의 실행 횟수 초기화
    const result = await dbService.query(`
      UPDATE test_keywords 
      SET current_executions = 0,
          last_executed_at = NULL
      WHERE is_active = true
    `);
    
    console.log(`✅ ${result.rowCount}개 키워드의 실행 횟수 초기화 완료`);
    
    // 확인
    const checkResult = await dbService.query(`
      SELECT id, keyword, suffix, browser, current_executions, max_executions, proxy_server
      FROM test_keywords
      WHERE is_active = true AND os_type = 'win11' AND is_vmware = false
      ORDER BY id
    `);
    
    console.log('\n📊 활성 키워드 상태:');
    console.log('ID | 키워드     | suffix | 브라우저 | 실행 | 프록시');
    console.log('━'.repeat(50));
    
    checkResult.rows.forEach(row => {
      console.log(
        `${row.id.toString().padEnd(2)} | ` +
        `${(row.keyword || '').substring(0, 10).padEnd(10)} | ` +
        `${(row.suffix || '').padEnd(6)} | ` +
        `${row.browser.padEnd(8)} | ` +
        `${row.current_executions}/${row.max_executions.toString().padEnd(3)} | ` +
        `${row.proxy_server || 'NULL'}`
      );
    });
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await dbService.close();
  }
}

// 직접 실행
if (require.main === module) {
  resetExecutions();
}

module.exports = { resetExecutions };