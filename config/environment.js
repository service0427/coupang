// 환경 설정 파일
// OS 타입 및 기타 환경 변수 관리

module.exports = {
  // 현재 운영체제 타입 (win11, u24, u22)
  // 실제 사용시 이 값을 환경에 맞게 수정하거나 환경변수로 설정
  osType: process.env.OS_TYPE || 'win11',
  
  // 환경별 설정
  environments: {
    win11: {
      name: 'Windows 11',
      defaultBrowser: 'chrome',
      supportedBrowsers: ['chrome', 'firefox', 'webkit'],
      defaultProfile: 'default'
    },
    u24: {
      name: 'Ubuntu 24.04',
      defaultBrowser: 'chrome',
      supportedBrowsers: ['chrome', 'firefox'],
      defaultProfile: 'default'
    },
    u22: {
      name: 'Ubuntu 22.04',
      defaultBrowser: 'chrome',
      supportedBrowsers: ['chrome', 'firefox'],
      defaultProfile: 'default'
    }
  },

  // 현재 환경 정보 가져오기
  getCurrentEnvironment() {
    return this.environments[this.osType] || this.environments.win11;
  },

  // OS 타입 검증
  isValidOsType(osType) {
    return Object.keys(this.environments).includes(osType);
  },

  // 지원하는 브라우저 확인
  isSupportedBrowser(browser, osType = null) {
    const env = osType ? this.environments[osType] : this.getCurrentEnvironment();
    return env && env.supportedBrowsers.includes(browser);
  },

  // 환경 정보 출력
  printEnvironmentInfo() {
    const env = this.getCurrentEnvironment();
    console.log('🖥️  현재 환경 정보:');
    console.log(`   OS: ${env.name} (${this.osType})`);
    console.log(`   기본 브라우저: ${env.defaultBrowser}`);
    console.log(`   지원 브라우저: ${env.supportedBrowsers.join(', ')}`);
    console.log(`   기본 프로필: ${env.defaultProfile}`);
  }
};