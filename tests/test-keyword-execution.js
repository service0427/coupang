const keywordService = require('../lib/services/keyword-service');
const environment = require('../config/environment');

/**
 * 키워드 기반 테스트 실행 시뮬레이션
 * 실제 브라우저 실행 없이 키워드 관리 기능만 테스트
 */
async function testKeywordExecution() {
  console.log('=================================');
  console.log('키워드 기반 테스트 실행 시뮬레이션');
  console.log('=================================\n');

  try {
    // 1. 환경 정보 출력
    environment.printEnvironmentInfo();
    console.log();

    // 2. 키워드 서비스 초기화
    await keywordService.init();

    // 3. 현재 OS의 활성 키워드 수 확인
    const currentOs = environment.osType;
    const activeCount = await keywordService.getActiveKeywordCount(currentOs);
    
    console.log(`📊 ${currentOs} 환경의 활성 키워드: ${activeCount}개\n`);

    if (activeCount === 0) {
      console.log('⚠️  실행 가능한 키워드가 없습니다. 프로그램을 종료합니다.');
      return;
    }

    // 4. 시뮬레이션 실행 (최대 5회)
    console.log('🚀 키워드 실행 시뮬레이션 시작 (최대 5회)\n');
    
    for (let i = 1; i <= 5; i++) {
      console.log(`--- 시뮬레이션 ${i}회차 ---`);
      
      // 다음 키워드 가져오기
      const keyword = await keywordService.getNextKeyword(currentOs);
      
      if (!keyword) {
        console.log('✅ 더 이상 실행할 키워드가 없습니다. 시뮬레이션 종료.');
        break;
      }

      console.log(`🎯 실행할 키워드: "${keyword.keyword}${keyword.suffix || ''}" (ID: ${keyword.id})`);
      console.log(`   설정: ${keyword.browser} 브라우저, ${keyword.ip_type} IP${keyword.is_vmware ? ', VMware' : ''}`);
      console.log(`   중복 IP 허용: ${keyword.allow_duplicate_ip ? 'Yes' : 'No'}`);
      console.log(`   진행률: ${keyword.current_executions}/${keyword.max_executions}`);

      // 실행 시작 기록
      const startResult = await keywordService.markKeywordStarted(keyword.id);
      if (!startResult) {
        console.log('❌ 실행 시작 기록 실패');
        continue;
      }

      // 성공/실패 랜덤 시뮬레이션 (80% 성공률)
      const success = Math.random() > 0.2;
      const errorMessage = success ? null : '시뮬레이션 랜덤 실패';

      // 실행 결과 기록
      await keywordService.recordExecutionResult(keyword.id, success, errorMessage);
      
      console.log(`📊 실행 결과: ${success ? '✅ 성공' : '❌ 실패'}`);
      
      // 잠시 대기 (실제 실행 시간 시뮬레이션)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log();
    }

    // 5. 최종 통계 출력
    console.log('📈 최종 통계:');
    const stats = await keywordService.getKeywordStats(currentOs);
    
    if (stats.length > 0) {
      const stat = stats[0];
      console.log(`   활성 키워드: ${stat.active_keywords}/${stat.total_keywords}개`);
      console.log(`   총 실행 횟수: ${stat.total_executions}회`);
      console.log(`   성공: ${stat.total_success}회, 실패: ${stat.total_failures}회`);
      console.log(`   성공률: ${stat.success_rate}%`);
    }

    // 6. 현재 상태의 키워드 목록 출력
    console.log('\n📋 현재 키워드 상태:');
    const currentKeywords = await keywordService.getActiveKeywords(currentOs);
    
    if (currentKeywords.length > 0) {
      currentKeywords.forEach(kw => {
        const progress = `${kw.current_executions}/${kw.max_executions}`;
        const successRate = kw.current_executions > 0 
          ? Math.round((kw.success_count / (kw.success_count + kw.fail_count)) * 100) 
          : 0;
        
        console.log(`   - "${kw.keyword}${kw.suffix || ''}" (${progress}) 성공률: ${successRate}%`);
      });
    } else {
      console.log('   모든 키워드가 비활성화되었습니다.');
    }

    console.log('\n✅ 키워드 실행 시뮬레이션 완료!');

  } catch (error) {
    console.error('❌ 시뮬레이션 실패:', error.message);
  } finally {
    await keywordService.close();
  }
}

// 명령행 인자로 OS 타입 변경 가능
if (process.argv[2]) {
  const osType = process.argv[2];
  if (environment.isValidOsType(osType)) {
    environment.osType = osType;
    console.log(`OS 타입이 ${osType}로 설정되었습니다.`);
  } else {
    console.log(`⚠️  잘못된 OS 타입: ${osType}`);
    console.log(`지원하는 OS 타입: ${Object.keys(environment.environments).join(', ')}`);
    process.exit(1);
  }
}

// 스크립트가 직접 실행될 때만 테스트 실행
if (require.main === module) {
  testKeywordExecution();
}

module.exports = { testKeywordExecution };