// 환경 설정 파일
// OS 타입 및 기타 환경 변수 관리

module.exports = {
  // 현재 운영체제 타입 (win11, u24, u22)
  // 실제 사용시 이 값을 환경에 맞게 수정하거나 환경변수로 설정
  osType: process.env.OS_TYPE || 'win11',
  
  // VMware 가상머신 실행 여부
  isVMware: process.env.VMWARE_ENV === 'true',
  
  // 화면 크기 설정
  screenWidth: parseInt(process.env.SCREEN_WIDTH || '1200'),
  screenHeight: parseInt(process.env.SCREEN_HEIGHT || '800'),
  
  // 환경별 설정
  environments: {
    win11: {
      name: 'Windows 11',
      defaultBrowser: 'chrome',
      defaultProfile: 'default'
    },
    u24: {
      name: 'Ubuntu 24.04',
      defaultBrowser: 'chrome',
      defaultProfile: 'default'
    },
    u22: {
      name: 'Ubuntu 22.04',
      defaultBrowser: 'chrome',
      defaultProfile: 'default'
    }
  },
  
  // 모든 OS에서 지원하는 브라우저
  supportedBrowsers: ['chrome', 'firefox', 'webkit'],

  // 현재 환경 정보 가져오기
  getCurrentEnvironment() {
    return this.environments[this.osType] || this.environments.win11;
  },

  // OS 타입 검증
  isValidOsType(osType) {
    return Object.keys(this.environments).includes(osType);
  },

  // 지원하는 브라우저 확인 (모든 OS에서 3개 브라우저 지원)
  isSupportedBrowser(browser) {
    return this.supportedBrowsers.includes(browser);
  },

  // 환경 정보 출력
  printEnvironmentInfo() {
    const env = this.getCurrentEnvironment();
    console.log('🖥️  현재 환경 정보:');
    console.log(`   OS: ${env.name} (${this.osType})`);
    console.log(`   VMware: ${this.isVMware ? '예' : '아니오'}`);
    console.log(`   화면 크기: ${this.screenWidth} x ${this.screenHeight}`);
    console.log(`   기본 브라우저: ${env.defaultBrowser}`);
    console.log(`   지원 브라우저: ${this.supportedBrowsers.join(', ')}`);
    console.log(`   기본 프로필: ${env.defaultProfile}`);
  }
};