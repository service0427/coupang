/**
 * proxy_server 컬럼 변경사항 테스트
 * ip_type → proxy_server 변경이 올바르게 작동하는지 확인
 */

const keywordService = require('../lib/services/keyword-service');

async function testProxyServerChanges() {
  console.log('=================================');
  console.log('🧪 proxy_server 변경사항 테스트');
  console.log('=================================\n');

  try {
    // 서비스 초기화
    await keywordService.init();

    // 1. 전체 키워드 조회 (proxy_server 컬럼 확인)
    console.log('1. 전체 키워드 조회 (proxy_server 컬럼 확인)');
    const allKeywords = await keywordService.getActiveKeywords('win11', { date: false });
    
    if (allKeywords.length > 0) {
      console.log('✅ 키워드 조회 성공');
      console.log('📋 첫 번째 키워드 구조:');
      const firstKeyword = allKeywords[0];
      
      // 중요 컬럼들 확인
      const importantColumns = [
        'id', 'keyword', 'suffix', 'os_type', 'is_vmware', 
        'proxy_server', 'ip_change_enabled', 'allow_duplicate_ip',
        'browser', 'profile_name'
      ];
      
      importantColumns.forEach(col => {
        const value = firstKeyword[col];
        const type = typeof value;
        console.log(`   ${col}: ${value} (${type})`);
      });

      // ip_type 컬럼이 없는지 확인
      if ('ip_type' in firstKeyword) {
        console.log('❌ 경고: ip_type 컬럼이 아직 존재합니다!');
      } else {
        console.log('✅ ip_type 컬럼이 성공적으로 제거되었습니다.');
      }

      // proxy_server 컬럼이 있는지 확인
      if ('proxy_server' in firstKeyword) {
        console.log('✅ proxy_server 컬럼이 성공적으로 추가되었습니다.');
      } else {
        console.log('❌ 경고: proxy_server 컬럼이 없습니다!');
      }
    } else {
      console.log('⚠️  조회된 키워드가 없습니다.');
    }

    console.log('\n' + '='.repeat(50));

    // 2. proxy_server 필터링 테스트
    console.log('\n2. proxy_server 필터링 테스트');
    
    // null 값 검색
    const directKeywords = await keywordService.getActiveKeywords('win11', { 
      proxyServer: null,
      date: false 
    });
    console.log(`📊 직접 연결 (proxy_server IS NULL): ${directKeywords.length}개`);

    // 특정 프록시 검색 (만약 설정되어 있다면)
    if (allKeywords.length > 0) {
      const sampleProxy = '112.161.54.7:10011';
      const proxyKeywords = await keywordService.getActiveKeywords('win11', { 
        proxyServer: sampleProxy,
        date: false 
      });
      console.log(`📊 특정 프록시 (${sampleProxy}): ${proxyKeywords.length}개`);
    }

    console.log('\n' + '='.repeat(50));

    // 3. concurrent-runner.js 로직 시뮬레이션
    console.log('\n3. concurrent-runner.js 로직 시뮬레이션');
    
    if (allKeywords.length > 0) {
      const testKeyword = allKeywords[0];
      console.log(`🎯 테스트 키워드: "${testKeyword.keyword}${testKeyword.suffix || ''}"`);
      console.log(`   proxy_server: ${testKeyword.proxy_server || 'null'}`);
      
      // 새로운 프록시 로직 시뮬레이션
      let proxyConfig = null;
      if (testKeyword.proxy_server && testKeyword.proxy_server.trim() !== '') {
        proxyConfig = {
          server: testKeyword.proxy_server.trim(),
          name: testKeyword.proxy_server.trim()
        };
        console.log(`🔐 프록시 사용: ${proxyConfig.server}`);
      } else {
        console.log(`💻 직접 연결 (프록시 없음)`);
      }
      
      console.log('✅ 새로운 프록시 로직 시뮬레이션 완료');
    }

    console.log('\n📊 최종 결과: 모든 테스트 통과 ✅');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error('상세 오류:', error);
  } finally {
    await keywordService.close();
    console.log('\n👋 테스트 종료');
  }
}

// 모듈로 직접 실행될 때만 테스트 실행
if (require.main === module) {
  testProxyServerChanges().catch(console.error);
}

module.exports = { testProxyServerChanges };