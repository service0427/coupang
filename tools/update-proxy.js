/**
 * 프록시 설정 업데이트 도구
 */

const dbService = require('../lib/services/db-service');

async function updateProxy() {
  try {
    await dbService.init();
    
    console.log('\n📋 프록시 설정 업데이트');
    console.log('━'.repeat(50));
    
    // ID 7,8,9에 프록시 설정
    const query = `
      UPDATE test_keywords 
      SET proxy_server = 'socks5://112.161.54.7:10011' 
      WHERE id IN (7, 8, 9)
    `;
    
    const result = await dbService.query(query);
    console.log(`✅ ${result.rowCount}개 키워드의 프록시 설정 완료`);
    
    // 업데이트 확인
    const checkResult = await dbService.query(`
      SELECT id, keyword, suffix, browser, proxy_server
      FROM test_keywords
      WHERE id IN (7, 8, 9)
      ORDER BY id
    `);
    
    console.log('\n📊 업데이트된 키워드:');
    console.log('ID | 키워드     | suffix | 브라우저 | 프록시');
    console.log('━'.repeat(50));
    
    checkResult.rows.forEach(row => {
      console.log(
        `${row.id.toString().padEnd(2)} | ` +
        `${(row.keyword || '').substring(0, 10).padEnd(10)} | ` +
        `${(row.suffix || '').padEnd(6)} | ` +
        `${row.browser.padEnd(8)} | ` +
        `${row.proxy_server}`
      );
    });
    
    console.log('\n✅ 프록시 설정 완료!');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await dbService.close();
  }
}

// 직접 실행
if (require.main === module) {
  updateProxy();
}

module.exports = { updateProxy };