const dbService = require('../lib/services/db-service');

async function testDatabaseConnection() {
  console.log('=================================');
  console.log('PostgreSQL 연결 테스트');
  console.log('=================================\n');

  try {
    // 1. 연결 초기화
    await dbService.init();
    
    console.log('\n📋 연결 테스트 시작...\n');

    // 2. 기본 쿼리 테스트
    console.log('1️⃣ 기본 쿼리 테스트 (현재 시간 조회)');
    const timeResult = await dbService.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('   현재 시간:', timeResult.rows[0].current_time);
    console.log('   PostgreSQL 버전:', timeResult.rows[0].pg_version.split(',')[0]);

    // 3. 테이블 목록 조회
    console.log('\n2️⃣ 테이블 목록 조회');
    const tablesResult = await dbService.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('   발견된 테이블:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('   테이블이 없습니다.');
    }

    // 4. 테이블 구조 확인 (tasks 테이블이 있다고 가정)
    console.log('\n3️⃣ 테이블 구조 확인');
    const hasTasksTable = tablesResult.rows.some(row => row.table_name === 'tasks');
    
    if (hasTasksTable) {
      const columnsResult = await dbService.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'tasks'
        ORDER BY ordinal_position
      `);
      
      console.log('   tasks 테이블 컬럼:');
      columnsResult.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

    // 5. 프록시 테이블 확인
    const hasProxiesTable = tablesResult.rows.some(row => row.table_name === 'proxies');
    
    if (hasProxiesTable) {
      console.log('\n4️⃣ 활성 프록시 조회');
      const proxies = await dbService.getActiveProxies();
      console.log(`   활성 프록시 수: ${proxies.length}개`);
      
      if (proxies.length > 0) {
        proxies.slice(0, 3).forEach(proxy => {
          console.log(`   - ${proxy.name}: ${proxy.server}`);
        });
      }
    }

    // 6. 연결 상태 확인
    console.log('\n5️⃣ 연결 상태 재확인');
    const isConnected = await dbService.checkConnection();
    console.log(`   연결 상태: ${isConnected ? '✅ 정상' : '❌ 끊김'}`);

    console.log('\n✅ 모든 테스트 완료!');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error('\n상세 에러:', error);
  } finally {
    // 연결 종료
    await dbService.close();
  }
}

// 테스트 실행
testDatabaseConnection();