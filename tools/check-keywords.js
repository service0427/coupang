/**
 * 활성 키워드 확인 도구
 */

const dbService = require('../lib/services/db-service');

async function checkKeywords() {
  try {
    await dbService.init();
    
    // 전체 키워드 조회
    console.log('\n📊 전체 test_keywords 데이터:');
    console.log('━'.repeat(80));
    
    const allResult = await dbService.query(`
      SELECT id, date, keyword, suffix, product_code, browser, 
             os_type, is_vmware, proxy_server, is_active,
             current_executions, max_executions
      FROM test_keywords 
      ORDER BY id
    `);
    
    console.log('ID | 날짜       | 키워드    | suffix | 상품코드    | 브라우저 | OS    | VM  | 프록시         | 활성 | 실행');
    console.log('━'.repeat(80));
    
    allResult.rows.forEach(row => {
      console.log(
        `${row.id.toString().padEnd(2)} | ` +
        `${row.date ? new Date(row.date).toISOString().split('T')[0] : 'NULL'.padEnd(10)} | ` +
        `${(row.keyword || '').padEnd(10)} | ` +
        `${(row.suffix || '').padEnd(6)} | ` +
        `${(row.product_code || '').padEnd(11)} | ` +
        `${row.browser.padEnd(8)} | ` +
        `${row.os_type.padEnd(5)} | ` +
        `${row.is_vmware ? 'Y' : 'N'}   | ` +
        `${(row.proxy_server || 'NULL').padEnd(14)} | ` +
        `${row.is_active ? 'Y' : 'N'}    | ` +
        `${row.current_executions}/${row.max_executions}`
      );
    });
    
    // 오늘 날짜 활성 키워드
    console.log('\n\n📅 오늘 날짜 활성 키워드 (os: win11, vmware: false):');
    console.log('━'.repeat(80));
    
    const activeResult = await dbService.query(`
      SELECT id, keyword, suffix, product_code, browser, proxy_server
      FROM test_keywords 
      WHERE is_active = true 
        AND os_type = 'win11'
        AND is_vmware = false
        AND date = CURRENT_DATE
        AND current_executions < max_executions
      ORDER BY id
    `);
    
    if (activeResult.rows.length === 0) {
      console.log('⚠️  조건에 맞는 활성 키워드가 없습니다.');
      
      // 날짜 확인
      const dateCheck = await dbService.query(`
        SELECT DISTINCT date, COUNT(*) as count
        FROM test_keywords
        WHERE is_active = true
        GROUP BY date
        ORDER BY date DESC
      `);
      
      console.log('\n📅 활성 키워드의 날짜 분포:');
      dateCheck.rows.forEach(row => {
        console.log(`   ${row.date ? new Date(row.date).toISOString().split('T')[0] : 'NULL'}: ${row.count}개`);
      });
      
      // 현재 날짜 확인
      const currentDate = await dbService.query('SELECT CURRENT_DATE');
      console.log(`\n⏰ DB 서버 현재 날짜: ${currentDate.rows[0].current_date}`);
      
    } else {
      console.log('ID | 키워드     | suffix | 상품코드    | 브라우저 | 프록시');
      console.log('━'.repeat(80));
      
      activeResult.rows.forEach(row => {
        console.log(
          `${row.id.toString().padEnd(2)} | ` +
          `${row.keyword.padEnd(10)} | ` +
          `${(row.suffix || '').padEnd(6)} | ` +
          `${row.product_code.padEnd(11)} | ` +
          `${row.browser.padEnd(8)} | ` +
          `${row.proxy_server || 'NULL'}`
        );
      });
    }
    
    console.log('\n✅ 키워드 확인 완료');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await dbService.close();
  }
}

// 직접 실행
if (require.main === module) {
  checkKeywords();
}

module.exports = { checkKeywords };