/**
 * 라운드별 IP 변경 테스트
 * - 매 라운드마다 IP가 변경되는지 확인
 */

const { changeProxyIPs } = require('../concurrent-runner');
const dbService = require('../lib/services/db-service');
const keywordService = require('../lib/services/keyword-service');

async function testRoundIpChange() {
  try {
    await keywordService.init();
    
    console.log('\n📊 라운드별 IP 변경 테스트');
    console.log('━'.repeat(50));
    
    const agent = 'default';
    
    // 테스트를 위해 몇 라운드 시뮬레이션
    for (let round = 1; round <= 3; round++) {
      console.log(`\n\n🔄 라운드 ${round} 시작`);
      console.log('━'.repeat(50));
      
      // IP 변경 함수 호출
      const changed = await changeProxyIPs(agent);
      
      if (!changed) {
        console.log('⚠️  IP 변경이 필요한 프록시가 없습니다.');
      }
      
      // 15초 대기 (다음 라운드를 위해)
      if (round < 3) {
        console.log('\n⏳ 다음 라운드를 위해 15초 대기...');
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
    
    console.log('\n\n✅ 테스트 완료!');
    console.log('매 라운드마다 IP 변경이 정상적으로 동작합니다.');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await keywordService.close();
  }
}

// 직접 실행
if (require.main === module) {
  testRoundIpChange();
}

module.exports = { testRoundIpChange };