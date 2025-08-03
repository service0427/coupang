/**
 * 테스트를 위한 키워드 업데이트
 */

const dbService = require('../lib/services/db-service');

async function updateKeywordsForTest() {
  try {
    await dbService.init();
    
    console.log('\n📋 테스트를 위한 키워드 업데이트');
    console.log('━'.repeat(50));
    
    // 날짜를 오늘로 업데이트하고 실행횟수 초기화
    const result1 = await dbService.query(`
      UPDATE test_keywords 
      SET date = CURRENT_DATE,
          current_executions = 0,
          agent = 'default'
      WHERE id IN (7, 8, 9)
      RETURNING id, date
    `);
    
    console.log(`✅ ${result1.rowCount}개 키워드 업데이트 완료`);
    
    // IP 변경 토글은 이미 활성화되어 있음
    // 확인
    const checkResult = await dbService.query(`
      SELECT id, date, keyword, suffix, product_code, agent, browser, 
             proxy_server, ip_change_enabled, current_executions, max_executions
      FROM test_keywords
      WHERE id IN (7, 8, 9)
      ORDER BY id
    `);
    
    console.log('\n📊 업데이트된 키워드:');
    console.log('ID | 날짜       | agent   | 브라우저 | 프록시                      | IP변경 | 실행');
    console.log('━'.repeat(80));
    
    checkResult.rows.forEach(row => {
      console.log(
        `${row.id.toString().padEnd(2)} | ` +
        `${new Date(row.date).toISOString().split('T')[0]} | ` +
        `${(row.agent || 'NULL').padEnd(7)} | ` +
        `${row.browser.padEnd(8)} | ` +
        `${(row.proxy_server || '').padEnd(27)} | ` +
        `${row.ip_change_enabled ? '✅' : '❌'}     | ` +
        `${row.current_executions}/${row.max_executions}`
      );
    });
    
    // 현재 날짜 확인
    const dateResult = await dbService.query('SELECT CURRENT_DATE');
    console.log(`\n⏰ DB 서버 현재 날짜: ${dateResult.rows[0].current_date}`);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await dbService.close();
  }
}

// 직접 실행
if (require.main === module) {
  updateKeywordsForTest();
}

module.exports = { updateKeywordsForTest };