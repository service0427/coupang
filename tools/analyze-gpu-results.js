/**
 * GPU 설정에 따른 실행 결과 분석
 */

const dbService = require('../lib/services/db-service');

async function analyzeGpuResults() {
  try {
    await dbService.init();
    
    console.log('📊 GPU 테스트 결과 분석\n');
    
    // 1. 전체 요약
    const summary = await dbService.query(`
      SELECT 
        k.browser,
        k.gpu_disabled,
        COUNT(*) as total_keywords,
        SUM(k.current_executions) as total_executions,
        SUM(k.success_count) as total_success,
        SUM(k.fail_count) as total_fail,
        ROUND(CASE 
          WHEN SUM(k.success_count + k.fail_count) > 0 
          THEN (SUM(k.success_count)::decimal / SUM(k.success_count + k.fail_count) * 100)
          ELSE 0 
        END, 2) as success_rate
      FROM test_keywords k
      WHERE k.agent = 'gpu-test'
        AND k.date = CURRENT_DATE
      GROUP BY k.browser, k.gpu_disabled
      ORDER BY k.browser, k.gpu_disabled
    `);
    
    console.log('=== 전체 요약 ===');
    console.log('브라우저\tGPU상태\t\t총실행\t성공\t실패\t성공률');
    console.log('━'.repeat(60));
    
    summary.rows.forEach(row => {
      const gpuStatus = row.gpu_disabled ? '비활성화' : '활성화';
      console.log(`${row.browser}\t${gpuStatus}\t${row.total_executions}\t${row.total_success}\t${row.total_fail}\t${row.success_rate}%`);
    });
    
    // 2. 차단 오류 분석
    const blockingErrors = await dbService.query(`
      SELECT 
        k.browser,
        k.gpu_disabled,
        el.error_message,
        COUNT(*) as error_count
      FROM test_keywords k
      JOIN execution_logs el ON k.id = el.keyword_id
      WHERE k.agent = 'gpu-test'
        AND k.date = CURRENT_DATE
        AND el.success = false
        AND (
          el.error_message LIKE '%차단%' OR
          el.error_message LIKE '%blocked%' OR
          el.error_message LIKE '%접속 차단%' OR
          el.error_message LIKE '%네트워크 차단%'
        )
      GROUP BY k.browser, k.gpu_disabled, el.error_message
      ORDER BY k.browser, k.gpu_disabled, error_count DESC
    `);
    
    console.log('\n\n=== 차단 오류 분석 ===');
    console.log('브라우저\tGPU상태\t\t오류 메시지\t\t\t횟수');
    console.log('━'.repeat(70));
    
    blockingErrors.rows.forEach(row => {
      const gpuStatus = row.gpu_disabled ? '비활성화' : '활성화';
      const errorMsg = row.error_message.substring(0, 30) + (row.error_message.length > 30 ? '...' : '');
      console.log(`${row.browser}\t${gpuStatus}\t${errorMsg}\t${row.error_count}`);
    });
    
    // 3. 키워드별 상세 비교
    const detailedComparison = await dbService.query(`
      SELECT 
        k.keyword,
        k.browser,
        MAX(CASE WHEN k.gpu_disabled = false THEN k.success_count ELSE 0 END) as gpu_on_success,
        MAX(CASE WHEN k.gpu_disabled = false THEN k.fail_count ELSE 0 END) as gpu_on_fail,
        MAX(CASE WHEN k.gpu_disabled = true THEN k.success_count ELSE 0 END) as gpu_off_success,
        MAX(CASE WHEN k.gpu_disabled = true THEN k.fail_count ELSE 0 END) as gpu_off_fail
      FROM test_keywords k
      WHERE k.agent = 'gpu-test'
        AND k.date = CURRENT_DATE
      GROUP BY k.keyword, k.browser
      ORDER BY k.keyword, k.browser
    `);
    
    console.log('\n\n=== 키워드별 상세 비교 ===');
    console.log('키워드\t\t브라우저\tGPU ON (성공/실패)\tGPU OFF (성공/실패)');
    console.log('━'.repeat(70));
    
    detailedComparison.rows.forEach(row => {
      console.log(`${row.keyword}\t\t${row.browser}\t${row.gpu_on_success}/${row.gpu_on_fail}\t\t\t${row.gpu_off_success}/${row.gpu_off_fail}`);
    });
    
    // 4. 시간대별 패턴
    const timePattern = await dbService.query(`
      SELECT 
        k.gpu_disabled,
        DATE_TRUNC('hour', el.executed_at) as hour,
        COUNT(CASE WHEN el.success = true THEN 1 END) as success_count,
        COUNT(CASE WHEN el.success = false THEN 1 END) as fail_count
      FROM test_keywords k
      JOIN execution_logs el ON k.id = el.keyword_id
      WHERE k.agent = 'gpu-test'
        AND k.date = CURRENT_DATE
      GROUP BY k.gpu_disabled, hour
      ORDER BY hour, k.gpu_disabled
    `);
    
    if (timePattern.rows.length > 0) {
      console.log('\n\n=== 시간대별 성공/실패 패턴 ===');
      console.log('시간\t\t\tGPU ON (성공/실패)\tGPU OFF (성공/실패)');
      console.log('━'.repeat(70));
      
      const timeData = {};
      timePattern.rows.forEach(row => {
        const hour = new Date(row.hour).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        if (!timeData[hour]) {
          timeData[hour] = { gpu_on: { success: 0, fail: 0 }, gpu_off: { success: 0, fail: 0 } };
        }
        
        if (row.gpu_disabled) {
          timeData[hour].gpu_off.success = row.success_count;
          timeData[hour].gpu_off.fail = row.fail_count;
        } else {
          timeData[hour].gpu_on.success = row.success_count;
          timeData[hour].gpu_on.fail = row.fail_count;
        }
      });
      
      Object.entries(timeData).forEach(([hour, data]) => {
        console.log(`${hour}\t\t${data.gpu_on.success}/${data.gpu_on.fail}\t\t\t${data.gpu_off.success}/${data.gpu_off.fail}`);
      });
    }
    
    // 5. 결론
    console.log('\n\n=== 분석 결론 ===');
    
    const chromeGpuOn = summary.rows.find(r => r.browser === 'chrome' && !r.gpu_disabled);
    const chromeGpuOff = summary.rows.find(r => r.browser === 'chrome' && r.gpu_disabled);
    const firefoxGpuOn = summary.rows.find(r => r.browser === 'firefox' && !r.gpu_disabled);
    const firefoxGpuOff = summary.rows.find(r => r.browser === 'firefox' && r.gpu_disabled);
    
    if (chromeGpuOn && chromeGpuOff) {
      const chromeDiff = parseFloat(chromeGpuOff.success_rate) - parseFloat(chromeGpuOn.success_rate);
      console.log(`Chrome: GPU 비활성화 시 성공률 ${chromeDiff > 0 ? '+' : ''}${chromeDiff.toFixed(2)}% 변화`);
    }
    
    if (firefoxGpuOn && firefoxGpuOff) {
      const firefoxDiff = parseFloat(firefoxGpuOff.success_rate) - parseFloat(firefoxGpuOn.success_rate);
      console.log(`Firefox: GPU 비활성화 시 성공률 ${firefoxDiff > 0 ? '+' : ''}${firefoxDiff.toFixed(2)}% 변화`);
    }
    
  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await dbService.close();
  }
}

// 실행
if (require.main === module) {
  analyzeGpuResults();
}

module.exports = { analyzeGpuResults };