const dbService = require('../lib/services/db-service');

async function checkColumnOrder() {
  console.log('📊 컬럼 순서 확인 중...');
  
  try {
    await dbService.init();
    
    // 전체 컬럼 순서 확인
    const allColumns = await dbService.query(`
      SELECT 
        ordinal_position,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'test_keywords'
      ORDER BY ordinal_position
    `);
    
    console.log('\n전체 컬럼 순서:');
    allColumns.rows.forEach(col => {
      console.log(`   ${col.ordinal_position}. ${col.column_name} (${col.data_type})`);
    });
    
    // 특정 컬럼들의 순서 확인
    const targetColumns = await dbService.query(`
      SELECT 
        ordinal_position,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'test_keywords'
      AND column_name IN ('cart_click_enabled', 'clear_session', 'use_persistent')
      ORDER BY ordinal_position
    `);
    
    console.log('\n✅ 재배치된 컬럼 순서:');
    targetColumns.rows.forEach(col => {
      console.log(`   ${col.ordinal_position}. ${col.column_name} (${col.data_type})`);
    });
    
    // 데이터 무결성 확인
    const dataCheck = await dbService.query('SELECT COUNT(*) as count FROM test_keywords');
    console.log(`\n✅ 데이터 무결성 확인: ${dataCheck.rows[0].count}개 레코드`);
    
    // 샘플 데이터 확인
    const sampleData = await dbService.query(`
      SELECT 
        id,
        keyword,
        cart_click_enabled,
        clear_session,
        use_persistent
      FROM test_keywords
      ORDER BY id
      LIMIT 3
    `);
    
    console.log('\n샘플 데이터:');
    sampleData.rows.forEach(row => {
      console.log(`   ID ${row.id}: ${row.keyword} - cart:${row.cart_click_enabled}, clear:${row.clear_session}, persist:${row.use_persistent}`);
    });
    
  } catch (error) {
    console.error('❌ 에러:', error.message);
  } finally {
    await dbService.close();
  }
}

if (require.main === module) {
  checkColumnOrder();
}

module.exports = { checkColumnOrder };