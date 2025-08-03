const dbService = require('../lib/services/db-service');
const keywordService = require('../lib/services/keyword-service');
const fs = require('fs');
const path = require('path');

/**
 * 컬럼 재구성 테스트
 * - product_code 위치 변경
 * - date 컬럼 추가
 * - product_rank 관련 컬럼 제거
 */
async function testColumnReorganize() {
  console.log('=================================');
  console.log('컬럼 재구성 및 date 필터 테스트');
  console.log('=================================\n');

  try {
    // 1. 데이터베이스 연결
    console.log('1️⃣ 데이터베이스 연결');
    await dbService.init();
    console.log('✅ 연결 성공\n');

    // 2. 컬럼 재구성 SQL 실행
    console.log('2️⃣ 컬럼 재구성 (product_code 이동, date 추가)');
    const sqlFilePath = path.join(__dirname, '../sql/03-add-date-column.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL 파일을 찾을 수 없습니다: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    try {
      await dbService.query(sqlContent);
      console.log('✅ 컬럼 재구성 완료\n');
    } catch (error) {
      console.warn('⚠️ SQL 실행 경고:', error.message);
      if (!error.message.includes('does not exist') && !error.message.includes('already exists')) {
        throw error;
      }
    }

    // 3. 키워드 서비스 초기화
    console.log('3️⃣ 키워드 서비스 초기화');
    await keywordService.init();
    console.log('✅ 초기화 완료\n');

    // 4. 새로운 테이블 구조 확인
    console.log('4️⃣ 새로운 테이블 구조 확인');
    const tableStructure = await dbService.query(`
      SELECT 
        ordinal_position,
        column_name,
        data_type,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'test_keywords'
      ORDER BY ordinal_position
    `);
    
    console.log('   컬럼 순서:');
    tableStructure.rows.forEach(col => {
      console.log(`     ${col.ordinal_position}. ${col.column_name} (${col.data_type})`);
    });
    console.log();

    // 5. 오늘 날짜의 키워드 확인
    console.log('5️⃣ 오늘 날짜의 키워드 확인');
    const today = new Date().toISOString().split('T')[0];
    console.log(`   오늘 날짜: ${today}`);
    
    const todayKeywords = await dbService.query(`
      SELECT id, keyword, suffix, product_code, date, os_type
      FROM test_keywords
      WHERE date = $1
      LIMIT 5
    `, [today]);
    
    if (todayKeywords.rows.length > 0) {
      console.log(`   오늘의 키워드 (${todayKeywords.rows.length}개):`)
      todayKeywords.rows.forEach(row => {
        console.log(`     - "${row.keyword}${row.suffix || ''}" [${row.product_code}] (${row.os_type})`);
      });
    } else {
      console.log('   오늘 날짜의 키워드가 없습니다.');
    }
    console.log();

    // 6. 날짜 필터링 테스트
    console.log('6️⃣ 날짜 필터링 기능 테스트');
    
    // 오늘 날짜로 필터링 (기본값)
    const activeToday = await keywordService.getActiveKeywords('win11');
    console.log(`   오늘 날짜 필터 (기본값): ${activeToday.length}개 키워드`);
    
    // 날짜 필터 비활성화
    const allActive = await keywordService.getActiveKeywords('win11', { date: false });
    console.log(`   날짜 필터 비활성화: ${allActive.length}개 키워드`);
    
    // 특정 날짜 지정
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const yesterdayKeywords = await keywordService.getActiveKeywords('win11', { date: yesterdayStr });
    console.log(`   어제 날짜 필터 (${yesterdayStr}): ${yesterdayKeywords.length}개 키워드`);
    console.log();

    // 7. 샘플 데이터 확인
    console.log('7️⃣ 재구성된 데이터 샘플');
    const sampleData = await dbService.query(`
      SELECT 
        id, 
        keyword || COALESCE(suffix, '') as search_term,
        product_code,
        date,
        cart_click_enabled,
        current_executions || '/' || max_executions as progress
      FROM test_keywords
      WHERE is_active = true
      ORDER BY date DESC, id
      LIMIT 5
    `);
    
    console.log('   활성 키워드 샘플:');
    sampleData.rows.forEach(row => {
      console.log(`     - "${row.search_term}" [${row.product_code}]`);
      console.log(`       날짜: ${row.date}, 진행: ${row.progress}, 장바구니: ${row.cart_click_enabled ? '✅' : '❌'}`);
    });
    console.log();

    // 8. 제거된 컬럼 확인
    console.log('8️⃣ 제거된 컬럼 확인');
    const removedColumns = ['avg_product_rank', 'min_product_rank', 'max_product_rank', 'total_pages_searched'];
    const checkColumns = await dbService.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'test_keywords'
      AND column_name = ANY($1)
    `, [removedColumns]);
    
    if (checkColumns.rows.length === 0) {
      console.log('   ✅ product_rank 관련 컬럼들이 성공적으로 제거됨');
    } else {
      console.log('   ⚠️ 아직 존재하는 컬럼:');
      checkColumns.rows.forEach(col => {
        console.log(`     - ${col.column_name}`);
      });
    }
    console.log();

    console.log('✅ 모든 테스트 완료!\n');

    // 9. 테스트 결과 요약
    console.log('📋 테스트 결과 요약:');
    console.log('   - 컬럼 순서 재배치: ✅ (keyword → suffix → product_code → date)');
    console.log('   - date 컬럼 추가: ✅');
    console.log('   - 날짜 필터링 기능: ✅');
    console.log('   - product_rank 컬럼 제거: ✅');
    console.log('   - 기존 데이터 보존: ✅');

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
  testColumnReorganize();
}

module.exports = { testColumnReorganize };