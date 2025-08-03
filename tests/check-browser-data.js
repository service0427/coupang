const dbService = require('../lib/services/db-service');

async function checkBrowserData() {
  console.log('=================================');
  console.log('브라우저별 키워드 데이터 확인');
  console.log('=================================\n');

  try {
    await dbService.init();

    // 브라우저별 활성 키워드 확인
    const query = `
      SELECT 
        id, date, keyword, suffix, product_code, browser, 
        os_type, current_executions, max_executions,
        cart_click_enabled
      FROM test_keywords
      WHERE is_active = true AND date = CURRENT_DATE
      ORDER BY browser, id
    `;

    const result = await dbService.query(query);
    
    console.log(`오늘 날짜의 활성 키워드: ${result.rows.length}개\n`);

    // 브라우저별로 그룹화
    const byBrowser = {};
    result.rows.forEach(row => {
      if (!byBrowser[row.browser]) {
        byBrowser[row.browser] = [];
      }
      byBrowser[row.browser].push(row);
    });

    // 브라우저별 출력
    Object.keys(byBrowser).sort().forEach(browser => {
      console.log(`📌 ${browser.toUpperCase()} 브라우저:`);
      byBrowser[browser].forEach(keyword => {
        const searchTerm = `${keyword.keyword}${keyword.suffix || ''}`;
        const progress = `${keyword.current_executions}/${keyword.max_executions}`;
        const cart = keyword.cart_click_enabled ? '🛒' : '  ';
        console.log(`   ID ${keyword.id}: "${searchTerm}" [${keyword.product_code}] ${cart} (${progress}) - ${keyword.os_type}`);
      });
      console.log();
    });

  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    await dbService.close();
  }
}

if (require.main === module) {
  checkBrowserData();
}

module.exports = { checkBrowserData };