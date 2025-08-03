const dbService = require('../lib/services/db-service');
const fs = require('fs');
const path = require('path');

/**
 * 세션 옵션 추가 및 컬럼 설명 테스트
 */
async function testSessionOptions() {
  console.log('=================================');
  console.log('세션 옵션 추가 및 컬럼 설명 테스트');
  console.log('=================================\n');

  try {
    await dbService.init();

    // 1. 세션 옵션 컬럼 추가
    console.log('1️⃣ 세션 옵션 컬럼 추가');
    const sqlFilePath = path.join(__dirname, '../sql/05-add-session-options-with-comments.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL 파일을 찾을 수 없습니다: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    try {
      await dbService.query(sqlContent);
      console.log('✅ 세션 옵션 추가 완료\n');
    } catch (error) {
      console.warn('⚠️ SQL 실행 경고:', error.message);
    }

    // 2. execution_logs 컬럼 설명 추가
    console.log('2️⃣ execution_logs 컬럼 설명 추가');
    const logsCommentPath = path.join(__dirname, '../sql/06-add-execution-logs-comments.sql');
    
    if (fs.existsSync(logsCommentPath)) {
      const logsCommentSql = fs.readFileSync(logsCommentPath, 'utf8');
      try {
        await dbService.query(logsCommentSql);
        console.log('✅ 실행 로그 설명 추가 완료\n');
      } catch (error) {
        console.warn('⚠️ 실행 로그 설명 추가 경고:', error.message);
      }
    }

    // 3. 업데이트된 데이터 확인
    console.log('3️⃣ 업데이트된 키워드 확인');
    const keywords = await dbService.query(`
      SELECT 
        id, 
        keyword || COALESCE(suffix, '') as search_term,
        browser,
        use_persistent,
        clear_session,
        CASE 
          WHEN use_persistent = false THEN '일회성 세션 (시크릿 모드)'
          WHEN clear_session = true THEN '프로필 사용 + 세션 초기화'
          ELSE '영구 프로필 (기본)'
        END as session_mode
      FROM test_keywords
      WHERE is_active = true AND date = CURRENT_DATE
      ORDER BY id
    `);

    console.log('   활성 키워드의 세션 모드:');
    keywords.rows.forEach(row => {
      console.log(`   ID ${row.id}: "${row.search_term}" [${row.browser}] - ${row.session_mode}`);
    });
    console.log();

    // 4. 컬럼 설명 확인
    console.log('4️⃣ test_keywords 테이블 컬럼 설명 확인');
    const columnComments = await dbService.query(`
      SELECT 
        column_name,
        data_type,
        col_description(pgc.oid, a.attnum) as column_comment
      FROM information_schema.columns c
      JOIN pg_class pgc ON pgc.relname = c.table_name
      JOIN pg_attribute a ON a.attrelid = pgc.oid AND a.attname = c.column_name
      WHERE table_name = 'test_keywords'
        AND col_description(pgc.oid, a.attnum) IS NOT NULL
      ORDER BY ordinal_position
      LIMIT 10
    `);

    console.log('   주요 컬럼 설명:');
    columnComments.rows.forEach(col => {
      console.log(`   • ${col.column_name}: ${col.column_comment}`);
    });
    console.log();

    // 5. 세션 옵션별 분포 확인
    console.log('5️⃣ 세션 옵션별 분포');
    const sessionStats = await dbService.query(`
      SELECT 
        use_persistent,
        clear_session,
        COUNT(*) as count,
        STRING_AGG(DISTINCT browser, ', ') as browsers
      FROM test_keywords
      WHERE is_active = true
      GROUP BY use_persistent, clear_session
      ORDER BY count DESC
    `);

    console.log('   세션 모드 통계:');
    sessionStats.rows.forEach(stat => {
      const mode = stat.use_persistent === false ? '일회성 세션' : 
                   stat.clear_session === true ? '세션 초기화' : '영구 프로필';
      console.log(`   - ${mode}: ${stat.count}개 (${stat.browsers})`);
    });
    console.log();

    // 6. 새로운 컬럼 확인
    console.log('6️⃣ 새로운 컬럼 확인');
    const newColumns = await dbService.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'test_keywords'
        AND column_name IN ('use_persistent', 'clear_session')
      ORDER BY column_name
    `);

    if (newColumns.rows.length === 2) {
      console.log('   ✅ 세션 관련 컬럼이 성공적으로 추가됨:');
      newColumns.rows.forEach(col => {
        console.log(`     - ${col.column_name} (${col.data_type}) DEFAULT ${col.column_default}`);
      });
    } else {
      console.log('   ⚠️ 일부 컬럼이 누락되었습니다.');
    }
    console.log();

    console.log('✅ 모든 테스트 완료!\n');

    // 7. 사용 예시
    console.log('💡 사용 예시:');
    console.log('   일반 모드: 프로필 사용, 쿠키/캐시 유지');
    console.log('   세션 초기화: 프로필은 사용하지만 쿠키/세션 초기화');
    console.log('   일회성 세션: 시크릿 모드처럼 매번 새로운 환경');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error('\n상세 에러:', error);
  } finally {
    await dbService.close();
  }
}

if (require.main === module) {
  testSessionOptions();
}

module.exports = { testSessionOptions };