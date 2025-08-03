/**
 * SQL 스크립트 실행 도구
 * 사용법: node tools/run-sql.js [sql파일명]
 */

const fs = require('fs').promises;
const path = require('path');
const dbService = require('../lib/services/db-service');

async function runSqlFile(filename) {
  try {
    // DB 연결
    await dbService.init();
    
    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, '..', 'sql', filename);
    const sqlContent = await fs.readFile(sqlPath, 'utf8');
    
    console.log(`\n📄 SQL 파일 실행: ${filename}`);
    console.log('━'.repeat(50));
    
    // SQL 실행
    const result = await dbService.query(sqlContent);
    
    console.log('✅ SQL 실행 성공!');
    if (result.rowCount !== null) {
      console.log(`   영향받은 행: ${result.rowCount}`);
    }
    
    // 변경사항 확인
    if (filename.includes('proxy-server')) {
      console.log('\n📊 proxy_server 컬럼 확인:');
      const checkResult = await dbService.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'test_keywords' 
        AND column_name = 'proxy_server'
      `);
      
      if (checkResult.rows.length > 0) {
        console.log('   ✅ proxy_server 컬럼이 성공적으로 추가되었습니다.');
        console.log(`   데이터 타입: ${checkResult.rows[0].data_type}`);
      }
    }
    
  } catch (error) {
    console.error('❌ SQL 실행 실패:', error.message);
    console.error(error.detail || '');
  } finally {
    await dbService.close();
  }
}

// 직접 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('사용법: node tools/run-sql.js [sql파일명]');
    console.log('예시: node tools/run-sql.js 08-change-ip-type-to-proxy-server.sql');
    process.exit(1);
  }
  
  runSqlFile(args[0]);
}

module.exports = { runSqlFile };