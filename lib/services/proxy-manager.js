const fs = require('fs').promises;
const path = require('path');

class ProxyManager {
  constructor() {
    this.proxiesFile = path.join(__dirname, '..', '..', 'config', 'proxies.json');
    this.stateFile = path.join(__dirname, '..', '..', 'data', 'state', 'proxy-state.json');
    this.proxies = [];
    this.defaultMode = 'sequential';
    this.currentIndex = 0;
  }

  async init() {
    try {
      // 프록시 목록 로드
      const data = await fs.readFile(this.proxiesFile, 'utf8');
      const config = JSON.parse(data);
      this.proxies = config.proxies.filter(p => p.active);
      this.defaultMode = config.defaultMode || 'sequential';

      // 상태 파일 로드 (순차 모드용)
      try {
        const stateData = await fs.readFile(this.stateFile, 'utf8');
        const state = JSON.parse(stateData);
        this.currentIndex = state.currentIndex || 0;
      } catch (e) {
        // 상태 파일이 없으면 0부터 시작
        this.currentIndex = 0;
      }
    } catch (error) {
      console.error('❌ 프록시 설정 로드 실패:', error.message);
      this.proxies = [];
    }
  }

  async saveState() {
    try {
      await fs.writeFile(this.stateFile, JSON.stringify({
        currentIndex: this.currentIndex,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    } catch (error) {
      console.error('❌ 프록시 상태 저장 실패:', error.message);
    }
  }

  async getProxy(mode) {
    // mode가 명시적으로 지정되지 않으면 프록시 사용 안 함
    if (!mode) {
      return null;
    }
    
    if (this.proxies.length === 0) {
      return null;
    }

    let proxy = null;
    const actualMode = mode;

    switch (actualMode) {
      case 'none':
        return null;

      case 'sequential':
        proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        await this.saveState();
        break;

      case 'random':
        const randomIndex = Math.floor(Math.random() * this.proxies.length);
        proxy = this.proxies[randomIndex];
        break;

      default:
        // 특정 ID로 프록시 찾기
        proxy = this.proxies.find(p => p.id === actualMode);
        if (!proxy) {
          console.error(`❌ 프록시 ID를 찾을 수 없음: ${actualMode}`);
          return null;
        }
    }

    if (proxy) {
      console.log(`🔐 프록시 사용: ${proxy.name} (${proxy.server})`);
      return { server: proxy.server };
    }

    return null;
  }

  getAvailableProxies() {
    return this.proxies.map(p => ({
      id: p.id,
      name: p.name
    }));
  }
}

module.exports = new ProxyManager();