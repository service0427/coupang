/**
 * 날짜 확인 도구
 */

const dbService = require('../lib/services/db-service');

async function checkDates() {
  try {
    await dbService.init();
    
    console.log('\n📅 날짜 확인');
    console.log('━'.repeat(50));
    
    // 현재 DB 날짜
    const currentDate = await dbService.query('SELECT CURRENT_DATE, NOW()');
    console.log('DB 현재 날짜:', currentDate.rows[0].current_date);
    console.log('DB 현재 시간:', currentDate.rows[0].now);
    
    // 키워드 날짜 확인
    console.log('\n📊 키워드 ID 7, 8, 9의 날짜:');
    const keywords = await dbService.query(`
      SELECT id, date, agent, current_executions, ip_change_enabled
      FROM test_keywords
      WHERE id IN (7, 8, 9)
      ORDER BY id
    `);
    
    keywords.rows.forEach(row => {
      console.log(`ID ${row.id}: ${row.date} (agent: ${row.agent}, 실행: ${row.current_executions}, IP변경: ${row.ip_change_enabled})`);
    });
    
    // 오늘 날짜 키워드 확인
    console.log('\n📊 오늘 날짜 키워드:');
    const todayKeywords = await dbService.query(`
      SELECT COUNT(*) as count, 
             COUNT(CASE WHEN agent = 'default' OR agent IS NULL THEN 1 END) as default_count
      FROM test_keywords
      WHERE date = CURRENT_DATE
    `);
    
    console.log(`총 ${todayKeywords.rows[0].count}개 (default: ${todayKeywords.rows[0].default_count}개)`);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await dbService.close();
  }
}

// 직접 실행
if (require.main === module) {
  checkDates();
}

module.exports = { checkDates };