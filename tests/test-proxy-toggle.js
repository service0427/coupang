/**
 * 프록시 IP 변경 토글 테스트
 */

const proxyToggleService = require('../lib/services/proxy-toggle-service');

async function testProxyToggle() {
  console.log('🧪 프록시 IP 변경 토글 테스트\n');
  
  const testProxies = [
    'socks5://112.161.54.7:10011',
    'http://112.161.54.7:10016',
    '112.161.54.7:8080'
  ];
  
  console.log('1️⃣ 포트 번호 추출 테스트:');
  testProxies.forEach(proxy => {
    const port = proxyToggleService.extractPortNumber(proxy);
    console.log(`   ${proxy} → 포트: ${port || 'N/A'}`);
  });
  
  console.log('\n2️⃣ IP 변경 토글 테스트:');
  const proxyToTest = 'socks5://112.161.54.7:10011';
  
  try {
    // 첫 번째 토글
    console.log(`\n첫 번째 토글 시도: ${proxyToTest}`);
    const result1 = await proxyToggleService.toggleIp(proxyToTest);
    
    if (result1.success) {
      console.log(`✅ 성공: ${result1.message}`);
      console.log(`   응답: ${JSON.stringify(result1.response)}`);
    } else {
      console.log(`❌ 실패: ${result1.error}`);
      if (result1.details) {
        console.log(`   상세: ${JSON.stringify(result1.details)}`);
      }
    }
    
    // 즉시 재시도 (15초 이내 실패 예상)
    console.log('\n즉시 재시도 (15초 이내 차단 예상):');
    const result2 = await proxyToggleService.toggleIp(proxyToTest);
    
    if (result2.success) {
      console.log(`✅ 성공: ${result2.message}`);
    } else {
      console.log(`❌ 예상된 실패: ${result2.error}`);
      if (result2.remainingTime) {
        console.log(`   → ${result2.remainingTime}초 후 재시도 가능`);
      }
    }
    
    // 대기 시간 확인
    const port = proxyToggleService.extractPortNumber(proxyToTest);
    const waitTime = proxyToggleService.getRemainingWaitTime(port);
    console.log(`\n⏱️  남은 대기 시간: ${waitTime}초`);
    
  } catch (error) {
    console.error('❌ 테스트 중 오류:', error.message);
  }
  
  console.log('\n✅ 테스트 완료!');
}

// 직접 실행
if (require.main === module) {
  testProxyToggle();
}

module.exports = { testProxyToggle };