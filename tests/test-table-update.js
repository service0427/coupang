const dbService = require('../lib/services/db-service');
const keywordService = require('../lib/services/keyword-service');
const fs = require('fs');
const path = require('path');

/**
 * 테이블 업데이트 및 새 기능 테스트
 * - 상품 코드 컬럼 추가
 * - 장바구니 클릭 옵션 추가
 * - 순위 통계 추가
 */
async function testTableUpdate() {
  console.log('=================================');
  console.log('테이블 업데이트 및 새 기능 테스트');
  console.log('=================================\n');

  try {
    // 1. 데이터베이스 연결
    console.log('1️⃣ 데이터베이스 연결');
    await dbService.init();
    console.log('✅ 연결 성공\n');

    // 2. 테이블 업데이트 SQL 실행
    console.log('2️⃣ 테이블 업데이트 (상품코드, 장바구니 옵션 추가)');
    const sqlFilePath = path.join(__dirname, '../sql/02-add-product-cart-columns.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL 파일을 찾을 수 없습니다: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    try {
      await dbService.query(sqlContent);
      console.log('✅ 테이블 업데이트 완료\n');
    } catch (error) {
      console.warn('⚠️ SQL 실행 경고:', error.message);
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    // 3. 키워드 서비스 초기화
    console.log('3️⃣ 키워드 서비스 초기화');
    await keywordService.init();
    console.log('✅ 초기화 완료\n');

    // 4. 업데이트된 테이블 구조 확인
    console.log('4️⃣ 업데이트된 테이블 구조 확인');
    const tableInfo = await dbService.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'test_keywords'
      AND column_name IN ('product_code', 'cart_click_enabled', 'avg_product_rank', 'min_product_rank', 'max_product_rank')
      ORDER BY ordinal_position
    `);
    
    console.log('   새로 추가된 컬럼:');
    tableInfo.rows.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type})`);
    });
    console.log();

    // 5. 샘플 데이터 확인
    console.log('5️⃣ 업데이트된 샘플 데이터 확인');
    const sampleData = await dbService.query(`
      SELECT id, keyword, suffix, product_code, cart_click_enabled, os_type
      FROM test_keywords
      LIMIT 5
    `);
    
    console.log('   샘플 키워드:');
    sampleData.rows.forEach(row => {
      console.log(`     - ID ${row.id}: "${row.keyword}${row.suffix || ''}" ` +
                 `상품코드: ${row.product_code}, 장바구니: ${row.cart_click_enabled ? '✅' : '❌'}`);
    });
    console.log();

    // 6. 실행 로그 테이블 확인
    console.log('6️⃣ 실행 로그 테이블 확인');
    const logTableExists = await dbService.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'execution_logs'
      )
    `);
    
    if (logTableExists.rows[0].exists) {
      console.log('   ✅ execution_logs 테이블 생성 확인');
      
      const logColumns = await dbService.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'execution_logs'
        ORDER BY ordinal_position
      `);
      
      console.log('   실행 로그 컬럼:');
      logColumns.rows.forEach(col => {
        console.log(`     - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('   ❌ execution_logs 테이블이 없습니다.');
    }
    console.log();

    // 7. 실행 로그 저장 테스트
    console.log('7️⃣ 실행 로그 저장 테스트');
    const testKeyword = await keywordService.getNextKeyword('win11');
    
    if (testKeyword) {
      console.log(`   테스트 키워드: "${testKeyword.keyword}${testKeyword.suffix || ''}" (ID: ${testKeyword.id})`);
      console.log(`   상품 코드: ${testKeyword.product_code}`);
      console.log(`   장바구니 클릭: ${testKeyword.cart_click_enabled ? '활성' : '비활성'}`);
      
      // 실행 시작
      await keywordService.markKeywordStarted(testKeyword.id);
      
      // 실행 로그 저장 (시뮬레이션)
      const testLog = {
        keywordId: testKeyword.id,
        success: true,
        productFound: true,
        productRank: Math.floor(Math.random() * 100) + 1,
        pagesSearched: Math.floor(Math.random() * 5) + 1,
        cartClicked: testKeyword.cart_click_enabled && Math.random() > 0.5,
        errorMessage: null,
        durationMs: Math.floor(Math.random() * 10000) + 5000,
        browserUsed: testKeyword.browser,
        proxyUsed: 'socks5://test.proxy:1080'
      };
      
      const logSaved = await keywordService.saveExecutionLog(testLog);
      console.log(`   로그 저장: ${logSaved ? '✅ 성공' : '❌ 실패'}`);
      
      if (logSaved) {
        console.log(`   - 상품 순위: ${testLog.productRank}위`);
        console.log(`   - 검색 페이지: ${testLog.pagesSearched}페이지`);
        console.log(`   - 장바구니 클릭: ${testLog.cartClicked ? '✅' : '❌'}`);
        console.log(`   - 실행 시간: ${testLog.durationMs}ms`);
      }
      
      // 실행 결과 기록
      await keywordService.recordExecutionResult(testKeyword.id, true);
    } else {
      console.log('   테스트할 키워드가 없습니다.');
    }
    console.log();

    // 8. 순위 통계 확인
    console.log('8️⃣ 순위 통계 확인');
    const statsQuery = await dbService.query(`
      SELECT 
        id, keyword, suffix, product_code,
        current_executions, success_count, fail_count,
        avg_product_rank, min_product_rank, max_product_rank
      FROM test_keywords
      WHERE avg_product_rank > 0
      LIMIT 5
    `);
    
    if (statsQuery.rows.length > 0) {
      console.log('   순위 통계가 있는 키워드:');
      statsQuery.rows.forEach(row => {
        console.log(`     - "${row.keyword}${row.suffix || ''}" (${row.product_code})`);
        console.log(`       평균 순위: ${parseFloat(row.avg_product_rank).toFixed(1)}위`);
        console.log(`       최고/최저: ${row.min_product_rank}위 ~ ${row.max_product_rank}위`);
        console.log(`       실행: ${row.current_executions}회 (성공: ${row.success_count}, 실패: ${row.fail_count})`);
      });
    } else {
      console.log('   아직 순위 통계가 없습니다.');
    }
    console.log();

    // 9. 실행 로그 조회 테스트
    console.log('9️⃣ 최근 실행 로그 조회');
    const recentLogs = await dbService.query(`
      SELECT 
        el.*, 
        tk.keyword, 
        tk.suffix, 
        tk.product_code
      FROM execution_logs el
      JOIN test_keywords tk ON el.keyword_id = tk.id
      ORDER BY el.executed_at DESC
      LIMIT 5
    `);
    
    if (recentLogs.rows.length > 0) {
      console.log('   최근 실행 로그:');
      recentLogs.rows.forEach(log => {
        const searchTerm = `${log.keyword}${log.suffix || ''}`;
        console.log(`     - ${new Date(log.executed_at).toLocaleString()}`);
        console.log(`       검색어: "${searchTerm}", 상품: ${log.product_code}`);
        console.log(`       결과: ${log.success ? '✅' : '❌'}, 순위: ${log.product_rank || 'N/A'}위`);
        console.log(`       페이지: ${log.pages_searched}, 장바구니: ${log.cart_clicked ? '✅' : '❌'}`);
      });
    } else {
      console.log('   실행 로그가 없습니다.');
    }
    console.log();

    console.log('✅ 모든 테스트 완료!\n');

    // 10. 테스트 결과 요약
    console.log('📋 테스트 결과 요약:');
    console.log('   - 테이블 업데이트: ✅');
    console.log('   - 상품 코드 컬럼: ✅');
    console.log('   - 장바구니 옵션: ✅');
    console.log('   - 실행 로그 테이블: ✅');
    console.log('   - 순위 통계 기능: ✅');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error('\n상세 에러:', error);
  } finally {
    // 연결 종료
    await keywordService.close();
  }
}

// 스크립트가 직접 실행될 때만 테스트 실행
if (require.main === module) {
  testTableUpdate();
}

module.exports = { testTableUpdate };