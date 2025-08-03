/**
 * 실행 로그 상세 조회 도구
 * - 새로운 필드들을 포함한 상세 정보 출력
 */

const dbService = require('../lib/services/db-service');

async function viewExecutionLogs(options = {}) {
  try {
    await dbService.init();
    
    const {
      limit = 10,
      agent = null,
      keywordId = null,
      onlySuccess = false,
      today = false
    } = options;
    
    console.log('\n📊 실행 로그 상세 조회');
    console.log('━'.repeat(100));
    
    // 쿼리 구성
    let query = `
      SELECT 
        el.id,
        el.keyword_id,
        tk.keyword,
        tk.suffix,
        tk.product_code,
        el.agent,
        el.success,
        el.product_found,
        el.product_rank,
        el.url_rank,
        el.pages_searched,
        el.cart_clicked,
        el.error_message,
        el.duration_ms,
        el.browser_used,
        el.proxy_used,
        el.actual_ip,
        el.final_url,
        el.executed_at
      FROM execution_logs el
      JOIN test_keywords tk ON el.keyword_id = tk.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (agent) {
      params.push(agent);
      query += ` AND el.agent = $${params.length}`;
    }
    
    if (keywordId) {
      params.push(keywordId);
      query += ` AND el.keyword_id = $${params.length}`;
    }
    
    if (onlySuccess) {
      query += ` AND el.success = true`;
    }
    
    if (today) {
      query += ` AND el.executed_at >= CURRENT_DATE`;
    }
    
    query += ` ORDER BY el.executed_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await dbService.query(query, params);
    
    console.log(`총 ${result.rows.length}개 로그 조회\n`);
    
    // 상세 출력
    result.rows.forEach((log, index) => {
      console.log(`━━━━ 로그 #${log.id} ━━━━`);
      console.log(`📅 실행 시간: ${new Date(log.executed_at).toLocaleString('ko-KR')}`);
      console.log(`🏷️  에이전트: ${log.agent || 'default'}`);
      console.log(`🔍 키워드: "${log.keyword}${log.suffix || ''}" (ID: ${log.keyword_id})`);
      console.log(`📦 상품 코드: ${log.product_code}`);
      console.log(`🌐 브라우저: ${log.browser_used}`);
      
      if (log.proxy_used && log.proxy_used !== 'direct') {
        console.log(`🔐 프록시: ${log.proxy_used}`);
        if (log.actual_ip) {
          console.log(`📡 실제 IP: ${log.actual_ip}`);
        }
      } else {
        console.log(`💻 직접 연결`);
      }
      
      console.log(`\n📊 실행 결과:`);
      console.log(`   - 전체 성공: ${log.success ? '✅ 성공' : '❌ 실패'}`);
      console.log(`   - 상품 발견: ${log.product_found ? '✅ 발견' : '❌ 미발견'}`);
      
      if (log.product_found && log.product_rank) {
        console.log(`   - 검색 순위: ${log.product_rank}위`);
        if (log.url_rank) {
          console.log(`   - URL rank 값: ${log.url_rank}`);
        }
      }
      
      console.log(`   - 검색 페이지: ${log.pages_searched}페이지`);
      console.log(`   - 장바구니: ${log.cart_clicked ? '✅ 클릭됨' : '❌ 클릭 안함'}`);
      console.log(`   - 실행 시간: ${(log.duration_ms / 1000).toFixed(1)}초`);
      
      if (log.error_message) {
        console.log(`   - ❌ 에러: ${log.error_message}`);
      }
      
      if (log.final_url) {
        console.log(`\n🔗 최종 URL: ${log.final_url}`);
      }
      
      if (index < result.rows.length - 1) {
        console.log('');
      }
    });
    
    // 요약 통계
    console.log(`\n${'━'.repeat(100)}`);
    console.log('📊 요약 통계:');
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
        ROUND(AVG(duration_ms) / 1000, 1) as avg_duration_sec,
        ROUND(AVG(CASE WHEN product_found THEN product_rank ELSE NULL END), 1) as avg_rank,
        COUNT(DISTINCT actual_ip) as unique_ips
      FROM execution_logs el
      WHERE el.executed_at >= CURRENT_DATE - INTERVAL '24 hours'
    `;
    
    const stats = await dbService.query(statsQuery);
    const stat = stats.rows[0];
    
    console.log(`   - 최근 24시간 실행: ${stat.total}건`);
    console.log(`   - 성공률: ${stat.total > 0 ? Math.round(stat.success_count / stat.total * 100) : 0}%`);
    console.log(`   - 평균 실행 시간: ${stat.avg_duration_sec || 0}초`);
    console.log(`   - 평균 상품 순위: ${stat.avg_rank || '-'}위`);
    console.log(`   - 사용된 고유 IP: ${stat.unique_ips}개`);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await dbService.close();
  }
}

// 명령줄 인자 처리
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--limit':
        options.limit = parseInt(args[i + 1]) || 10;
        i++;
        break;
      case '--agent':
        options.agent = args[i + 1];
        i++;
        break;
      case '--keyword-id':
        options.keywordId = parseInt(args[i + 1]);
        i++;
        break;
      case '--success-only':
        options.onlySuccess = true;
        break;
      case '--today':
        options.today = true;
        break;
      case '--help':
        console.log(`
사용법: node tools/view-execution-logs.js [옵션]

옵션:
  --limit <숫자>      조회할 로그 수 (기본: 10)
  --agent <이름>      특정 에이전트의 로그만 조회
  --keyword-id <ID>   특정 키워드의 로그만 조회
  --success-only      성공한 로그만 조회
  --today            오늘 실행된 로그만 조회
  --help             도움말 표시

예시:
  node tools/view-execution-logs.js
  node tools/view-execution-logs.js --limit 5 --agent default
  node tools/view-execution-logs.js --today --success-only
  node tools/view-execution-logs.js --keyword-id 7
`);
        process.exit(0);
    }
  }
  
  viewExecutionLogs(options);
}

module.exports = { viewExecutionLogs };