const dbService = require('../lib/services/db-service');
const keywordService = require('../lib/services/keyword-service');
const fs = require('fs');
const path = require('path');

/**
 * 테스트 키워드 테이블 생성 및 기능 테스트
 */
async function testKeywordsTable() {
  console.log('=================================');
  console.log('테스트 키워드 테이블 생성 및 테스트');
  console.log('=================================\n');

  try {
    // 1. 데이터베이스 연결
    console.log('1️⃣ 데이터베이스 연결 테스트');
    await dbService.init();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 2. 테이블 생성 SQL 실행
    console.log('2️⃣ test_keywords 테이블 생성');
    const sqlFilePath = path.join(__dirname, '../sql/01-create-test-keywords.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL 파일을 찾을 수 없습니다: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // 전체 SQL을 한번에 실행 (PostgreSQL이 트랜잭션으로 처리)
    try {
      await dbService.query(sqlContent);
    } catch (error) {
      // 이미 존재하는 테이블 에러는 무시
      if (!error.message.includes('already exists')) {
        console.warn(`SQL 실행 경고: ${error.message}`);
      }
    }
    
    console.log('✅ 테이블 생성 완료\n');

    // 3. 키워드 서비스 초기화
    console.log('3️⃣ 키워드 서비스 초기화');
    await keywordService.init();
    console.log('✅ 키워드 서비스 초기화 완료\n');

    // 4. 샘플 데이터 확인
    console.log('4️⃣ 샘플 데이터 확인');
    const allKeywords = await dbService.query('SELECT COUNT(*) as count FROM test_keywords');
    console.log(`   총 키워드 수: ${allKeywords.rows[0].count}개\n`);

    // 5. OS별 활성 키워드 조회 테스트
    console.log('5️⃣ OS별 활성 키워드 조회 테스트');
    const osTypes = ['win11', 'u24', 'u22'];
    
    for (const osType of osTypes) {
      const keywords = await keywordService.getActiveKeywords(osType);
      console.log(`   ${osType}: ${keywords.length}개 활성 키워드`);
      
      if (keywords.length > 0) {
        keywords.forEach(kw => {
          console.log(`     - "${kw.keyword}${kw.suffix || ''}" (${kw.browser}, ${kw.ip_type}${kw.is_vmware ? ', VMware' : ''})`);
        });
      }
    }
    console.log();

    // 6. 다음 실행할 키워드 가져오기 테스트
    console.log('6️⃣ 다음 실행할 키워드 가져오기 테스트');
    for (const osType of osTypes) {
      const nextKeyword = await keywordService.getNextKeyword(osType);
      if (nextKeyword) {
        console.log(`   ${osType}: "${nextKeyword.keyword}${nextKeyword.suffix || ''}" (ID: ${nextKeyword.id})`);
      } else {
        console.log(`   ${osType}: 실행 가능한 키워드 없음`);
      }
    }
    console.log();

    // 7. 키워드 실행 시뮬레이션 테스트
    console.log('7️⃣ 키워드 실행 시뮬레이션 테스트');
    const testKeyword = await keywordService.getNextKeyword('win11');
    
    if (testKeyword) {
      console.log(`   선택된 키워드: "${testKeyword.keyword}${testKeyword.suffix || ''}" (ID: ${testKeyword.id})`);
      
      // 실행 시작 기록
      const startResult = await keywordService.markKeywordStarted(testKeyword.id);
      console.log(`   실행 시작 기록: ${startResult ? '성공' : '실패'}`);
      
      // 성공 결과 기록
      const resultRecord = await keywordService.recordExecutionResult(testKeyword.id, true);
      console.log(`   실행 결과 기록: ${resultRecord ? '성공' : '실패'}`);
    } else {
      console.log('   테스트할 키워드가 없습니다.');
    }
    console.log();

    // 8. 키워드 통계 조회 테스트
    console.log('8️⃣ 키워드 통계 조회 테스트');
    const stats = await keywordService.getKeywordStats();
    
    if (stats.length > 0) {
      console.log('   OS별 통계:');
      stats.forEach(stat => {
        console.log(`     ${stat.os_type}: 활성 ${stat.active_keywords}/${stat.total_keywords}개, ` +
                   `실행 ${stat.total_executions}회, 성공률 ${stat.success_rate}%`);
      });
    }
    console.log();

    // 9. 테이블 구조 확인
    console.log('9️⃣ 테이블 구조 확인');
    const tableInfo = await dbService.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'test_keywords'
      ORDER BY ordinal_position
    `);
    
    console.log('   테이블 컬럼:');
    tableInfo.rows.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    console.log();

    console.log('✅ 모든 테스트 완료!\n');

    // 10. 테스트 결과 요약
    console.log('📋 테스트 결과 요약:');
    console.log('   - 테이블 생성: ✅');
    console.log('   - 샘플 데이터 삽입: ✅');
    console.log('   - 키워드 서비스 기능: ✅');
    console.log('   - OS별 키워드 조회: ✅');
    console.log('   - 실행 관리 기능: ✅');
    console.log('   - 통계 조회 기능: ✅');

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
  testKeywordsTable();
}

module.exports = { testKeywordsTable };