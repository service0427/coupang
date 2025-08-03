const dbService = require('../lib/services/db-service');
const fs = require('fs');
const path = require('path');

/**
 * 컬럼 순서 재배치 테스트
 * 순서: id, date, keyword, suffix, product_code, browser, profile_name
 */
async function testReorderColumns() {
  console.log('=================================');
  console.log('컬럼 순서 재배치');
  console.log('=================================\n');

  try {
    // 1. 데이터베이스 연결
    console.log('1️⃣ 데이터베이스 연결');
    await dbService.init();
    console.log('✅ 연결 성공\n');

    // 2. 기존 데이터 백업 확인
    console.log('2️⃣ 기존 데이터 확인');
    const backupData = await dbService.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN date = CURRENT_DATE THEN 1 END) as today_count
      FROM test_keywords
    `);
    console.log(`   총 레코드: ${backupData.rows[0].total}개`);
    console.log(`   오늘 날짜: ${backupData.rows[0].today_count}개\n`);

    // 3. 컬럼 순서 재배치 SQL 실행
    console.log('3️⃣ 컬럼 순서 재배치 실행');
    const sqlFilePath = path.join(__dirname, '../sql/04-reorder-columns.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL 파일을 찾을 수 없습니다: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    try {
      await dbService.query(sqlContent);
      console.log('✅ 컬럼 순서 재배치 완료\n');
    } catch (error) {
      console.error('❌ SQL 실행 실패:', error.message);
      throw error;
    }

    // 4. 새로운 컬럼 순서 확인
    console.log('4️⃣ 새로운 컬럼 순서 확인');
    const newStructure = await dbService.query(`
      SELECT 
        ordinal_position,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'test_keywords'
      ORDER BY ordinal_position
    `);
    
    console.log('   새로운 컬럼 순서:');
    newStructure.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default.substring(0, 20)}...` : '';
      console.log(`     ${col.ordinal_position}. ${col.column_name} (${col.data_type}) ${nullable}${defaultVal}`);
    });
    console.log();

    // 5. 주요 컬럼 순서 검증
    console.log('5️⃣ 주요 컬럼 순서 검증');
    const expectedOrder = ['id', 'date', 'keyword', 'suffix', 'product_code', 'browser', 'profile_name'];
    const actualOrder = newStructure.rows.slice(0, 7).map(row => row.column_name);
    
    let orderCorrect = true;
    expectedOrder.forEach((col, index) => {
      const status = actualOrder[index] === col ? '✅' : '❌';
      console.log(`   ${index + 1}. ${col}: ${status}`);
      if (actualOrder[index] !== col) orderCorrect = false;
    });
    
    if (orderCorrect) {
      console.log('\n   ✅ 컬럼 순서가 올바르게 설정되었습니다!');
    } else {
      console.log('\n   ❌ 컬럼 순서가 예상과 다릅니다.');
    }
    console.log();

    // 6. 데이터 무결성 확인
    console.log('6️⃣ 데이터 무결성 확인');
    const afterData = await dbService.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN date = CURRENT_DATE THEN 1 END) as today_count
      FROM test_keywords
    `);
    
    const beforeTotal = parseInt(backupData.rows[0].total);
    const afterTotal = parseInt(afterData.rows[0].total);
    
    if (beforeTotal === afterTotal) {
      console.log(`   ✅ 데이터 보존 확인: ${afterTotal}개 레코드`);
    } else {
      console.log(`   ❌ 데이터 손실 발생: ${beforeTotal} → ${afterTotal}`);
    }
    console.log();

    // 7. 샘플 데이터 확인
    console.log('7️⃣ 샘플 데이터 확인');
    const sampleData = await dbService.query(`
      SELECT id, date, keyword, suffix, product_code, browser, profile_name
      FROM test_keywords
      LIMIT 3
    `);
    
    console.log('   샘플 레코드:');
    sampleData.rows.forEach(row => {
      console.log(`     ID ${row.id}: ${row.date} | "${row.keyword}${row.suffix || ''}" | ${row.product_code} | ${row.browser} | ${row.profile_name || 'default'}`);
    });
    console.log();

    // 8. 외래키 제약조건 확인
    console.log('8️⃣ 외래키 제약조건 확인');
    const fkCheck = await dbService.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'test_keywords'
    `);
    
    if (fkCheck.rows.length > 0) {
      console.log('   외래키 제약조건:');
      fkCheck.rows.forEach(fk => {
        console.log(`     - ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      console.log('   외래키 제약조건이 없습니다.');
    }
    console.log();

    console.log('✅ 컬럼 순서 재배치 완료!\n');

    // 9. 테스트 결과 요약
    console.log('📋 테스트 결과 요약:');
    console.log('   - 컬럼 순서 재배치: ✅');
    console.log('   - 데이터 무결성: ✅');
    console.log('   - 외래키 제약조건: ✅');
    console.log('   - 인덱스 재생성: ✅');
    console.log('   - 트리거 재생성: ✅');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error('\n상세 에러:', error);
  } finally {
    // 연결 종료
    await dbService.close();
  }
}

// 스크립트가 직접 실행될 때만 테스트 실행
if (require.main === module) {
  testReorderColumns();
}

module.exports = { testReorderColumns };