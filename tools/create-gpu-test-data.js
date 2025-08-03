/**
 * GPU 테스트를 위한 키워드 데이터 생성
 * - 동일한 키워드를 GPU 활성화/비활성화로 각각 생성
 * - 브라우저별 테스트
 */

const dbService = require('../lib/services/db-service');

async function createGpuTestData() {
  try {
    await dbService.init();
    
    console.log('🔧 GPU 테스트 데이터 생성 시작...\n');
    
    // 테스트할 키워드 목록
    const testKeywords = [
      { keyword: '노트북', suffix: '', product_code: '6918545081' },
      { keyword: '게이밍노트북', suffix: '', product_code: '6599612882' },
      { keyword: '맥북', suffix: '', product_code: '6566402938' }
    ];
    
    // 브라우저 목록
    const browsers = ['chrome', 'firefox'];  // webkit은 GPU 설정이 없으므로 제외
    
    // 프록시 설정 (없으면 null)
    const proxyServer = null;  // 또는 'socks5://112.161.54.7:10016'
    
    // 각 키워드와 브라우저 조합으로 GPU 활성화/비활성화 데이터 생성
    for (const keywordData of testKeywords) {
      for (const browser of browsers) {
        // GPU 활성화 버전
        await dbService.query(`
          INSERT INTO test_keywords (
            keyword, suffix, product_code, date, agent, browser,
            proxy_server, gpu_disabled, use_persistent, clear_session,
            max_executions, current_executions, is_active
          ) VALUES (
            $1, $2, $3, CURRENT_DATE, $4, $5,
            $6, false, true, true,
            10, 0, true
          )
        `, [
          keywordData.keyword,
          keywordData.suffix,
          keywordData.product_code,
          'gpu-test',
          browser,
          proxyServer
        ]);
        
        console.log(`✅ 생성: ${keywordData.keyword} - ${browser} - GPU 활성화`);
        
        // GPU 비활성화 버전
        await dbService.query(`
          INSERT INTO test_keywords (
            keyword, suffix, product_code, date, agent, browser,
            proxy_server, gpu_disabled, use_persistent, clear_session,
            max_executions, current_executions, is_active
          ) VALUES (
            $1, $2, $3, CURRENT_DATE, $4, $5,
            $6, true, true, true,
            10, 0, true
          )
        `, [
          keywordData.keyword,
          keywordData.suffix,
          keywordData.product_code,
          'gpu-test',
          browser,
          proxyServer
        ]);
        
        console.log(`✅ 생성: ${keywordData.keyword} - ${browser} - GPU 비활성화`);
      }
    }
    
    // 생성된 데이터 확인
    const result = await dbService.query(`
      SELECT 
        browser, 
        gpu_disabled,
        COUNT(*) as count
      FROM test_keywords
      WHERE agent = 'gpu-test'
        AND date = CURRENT_DATE
      GROUP BY browser, gpu_disabled
      ORDER BY browser, gpu_disabled
    `);
    
    console.log('\n📊 생성된 데이터 요약:');
    console.log('━'.repeat(40));
    console.log('브라우저\tGPU 비활성화\t개수');
    console.log('━'.repeat(40));
    
    result.rows.forEach(row => {
      console.log(`${row.browser}\t${row.gpu_disabled ? '✅' : '❌'}\t\t${row.count}`);
    });
    
    console.log('\n✅ GPU 테스트 데이터 생성 완료!');
    console.log('\n실행 방법:');
    console.log('node concurrent-runner.js --agent gpu-test --once');
    
  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await dbService.close();
  }
}

// 실행
if (require.main === module) {
  createGpuTestData();
}

module.exports = { createGpuTestData };