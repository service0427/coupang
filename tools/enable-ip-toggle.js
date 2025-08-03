/**
 * IP 변경 토글 기능 활성화 도구
 */

const dbService = require('../lib/services/db-service');

async function enableIpToggle() {
  try {
    await dbService.init();
    
    console.log('\n📋 IP 변경 토글 설정');
    console.log('━'.repeat(50));
    
    // 프록시가 설정된 키워드에 ip_change_enabled 활성화
    const result = await dbService.query(`
      UPDATE test_keywords 
      SET ip_change_enabled = true
      WHERE proxy_server IS NOT NULL 
        AND proxy_server != ''
        AND id IN (7, 8, 9)
    `);
    
    console.log(`✅ ${result.rowCount}개 키워드의 IP 변경 토글 활성화`);
    
    // 확인
    const checkResult = await dbService.query(`
      SELECT id, keyword, suffix, browser, proxy_server, ip_change_enabled
      FROM test_keywords
      WHERE proxy_server IS NOT NULL AND proxy_server != ''
      ORDER BY id
    `);
    
    console.log('\n📊 프록시 설정된 키워드:');
    console.log('ID | 키워드     | suffix | 브라우저 | 프록시                       | IP변경');
    console.log('━'.repeat(80));
    
    checkResult.rows.forEach(row => {
      console.log(
        `${row.id.toString().padEnd(2)} | ` +
        `${(row.keyword || '').substring(0, 10).padEnd(10)} | ` +
        `${(row.suffix || '').padEnd(6)} | ` +
        `${row.browser.padEnd(8)} | ` +
        `${(row.proxy_server || '').padEnd(28)} | ` +
        `${row.ip_change_enabled ? '✅' : '❌'}`
      );
    });
    
    console.log('\n💡 IP 변경 토글 테스트 정보:');
    console.log('   - 토글 API: http://112.161.54.7:8080/toggle/{포트끝2자리}');
    console.log('   - 예시: socks5://112.161.54.7:10011 → /toggle/11');
    console.log('   - 재실행 간격: 15초 이상');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await dbService.close();
  }
}

// 직접 실행
if (require.main === module) {
  enableIpToggle();
}

module.exports = { enableIpToggle };