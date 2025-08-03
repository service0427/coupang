const fs = require('fs').promises;
const path = require('path');

class DownloadTracker {
  constructor() {
    this.downloads = [];
    this.profileName = null;
    this.dataDir = null;
    this.dataFile = null;
    this.statsFile = null;
  }

  setProfile(profileName) {
    this.profileName = profileName || 'default';
    this.dataDir = path.join(__dirname, '..', '..', 'data', 'tracking', 'downloads', this.profileName);
    this.dataFile = path.join(this.dataDir, 'downloads.json');
    this.statsFile = path.join(this.dataDir, 'statistics.json');
  }

  async init(profileName) {
    try {
      this.setProfile(profileName);
      await fs.mkdir(this.dataDir, { recursive: true });
      await this.loadData();
    } catch (error) {
      console.error('❌ 다운로드 추적 모듈 초기화 실패:', error);
    }
  }

  async loadData() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      this.downloads = JSON.parse(data);
    } catch (error) {
      // 파일이 없으면 빈 배열로 시작
      this.downloads = [];
    }
  }

  async saveData() {
    try {
      await fs.writeFile(this.dataFile, JSON.stringify(this.downloads, null, 2));
    } catch (error) {
      console.error('❌ 다운로드 데이터 저장 실패:', error);
    }
  }

  async addDownload(url, suggestedFilename, fileSize, cacheStatus = null) {
    const download = {
      id: Date.now(),
      url: url,
      filename: suggestedFilename,
      fileSize: fileSize,
      fileSizeMB: fileSize ? (fileSize / (1024 * 1024)).toFixed(2) : null,
      cacheStatus: cacheStatus, // 'hit', 'miss', 'revalidated', null
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('ko-KR'),
      time: new Date().toLocaleTimeString('ko-KR')
    };

    this.downloads.push(download);
    await this.saveData();
    
    // 다운로드 로그는 디버그 모드에서만 출력
    // console.log('💾 다운로드 기록됨:');
    // console.log(`  - URL: ${url}`);
    // console.log(`  - 파일명: ${suggestedFilename || '알 수 없음'}`);
    // console.log(`  - 크기: ${download.fileSizeMB ? download.fileSizeMB + ' MB' : '알 수 없음'}`);
    // if (cacheStatus) {
    //   console.log(`  - 캐시: ${cacheStatus}`);
    // }
    
    return download;
  }

  async generateStatistics() {
    const stats = {
      totalDownloads: this.downloads.length,
      totalSizeMB: 0,
      avgSizeMB: 0,
      largestFile: null,
      smallestFile: null,
      downloadsByDate: {},
      downloadsByHour: {},
      fileTypes: {},
      domains: {},
      cacheStats: {
        hit: 0,
        miss: 0,
        revalidated: 0,
        unknown: 0
      },
      generatedAt: new Date().toISOString()
    };

    // 통계 계산
    this.downloads.forEach(download => {
      // 총 크기 계산
      if (download.fileSizeMB) {
        stats.totalSizeMB += parseFloat(download.fileSizeMB);
      }

      // 캐시 상태 통계
      if (download.cacheStatus) {
        if (stats.cacheStats[download.cacheStatus] !== undefined) {
          stats.cacheStats[download.cacheStatus]++;
        } else {
          stats.cacheStats.unknown++;
        }
      } else {
        stats.cacheStats.unknown++;
      }

      // 날짜별 다운로드
      if (!stats.downloadsByDate[download.date]) {
        stats.downloadsByDate[download.date] = 0;
      }
      stats.downloadsByDate[download.date]++;

      // 시간대별 다운로드
      const hour = new Date(download.timestamp).getHours();
      if (!stats.downloadsByHour[hour]) {
        stats.downloadsByHour[hour] = 0;
      }
      stats.downloadsByHour[hour]++;

      // 파일 타입별
      if (download.filename) {
        const ext = path.extname(download.filename).toLowerCase();
        if (!stats.fileTypes[ext]) {
          stats.fileTypes[ext] = 0;
        }
        stats.fileTypes[ext]++;
      }

      // 도메인별
      try {
        const domain = new URL(download.url).hostname;
        if (!stats.domains[domain]) {
          stats.domains[domain] = 0;
        }
        stats.domains[domain]++;
      } catch (e) {
        // URL 파싱 실패 무시
      }

      // 가장 큰/작은 파일
      if (download.fileSizeMB) {
        const sizeMB = parseFloat(download.fileSizeMB);
        if (!stats.largestFile || sizeMB > parseFloat(stats.largestFile.fileSizeMB)) {
          stats.largestFile = download;
        }
        if (!stats.smallestFile || sizeMB < parseFloat(stats.smallestFile.fileSizeMB)) {
          stats.smallestFile = download;
        }
      }
    });

    // 평균 크기 계산
    if (stats.totalDownloads > 0) {
      stats.avgSizeMB = (stats.totalSizeMB / stats.totalDownloads).toFixed(2);
    }
    stats.totalSizeMB = stats.totalSizeMB.toFixed(2);

    await fs.writeFile(this.statsFile, JSON.stringify(stats, null, 2));
    
    return stats;
  }

  async printStatistics() {
    const stats = await this.generateStatistics();
    
    console.log('\n📊 다운로드 통계 리포트');
    console.log('========================');
    console.log(`총 다운로드 수: ${stats.totalDownloads}개`);
    console.log(`총 다운로드 크기: ${stats.totalSizeMB} MB`);
    console.log(`평균 파일 크기: ${stats.avgSizeMB} MB`);
    
    // 리소스 타입별 분석
    const categories = {
      'JavaScript': ['.js'],
      'CSS': ['.css'],
      'Images': ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico'],
      'Fonts': ['.woff', '.woff2', '.ttf', '.eot', '.otf'],
      'Data/API': ['', '.json', '.xml'],
      'Video': ['.mp4', '.webm', '.m3u8'],
      'Other': []
    };
    
    const categoryStats = {};
    let totalCategorized = 0;
    
    Object.entries(categories).forEach(([category, extensions]) => {
      categoryStats[category] = { count: 0, size: 0 };
    });
    
    // 각 다운로드를 카테고리별로 분류
    this.downloads.forEach(download => {
      const ext = download.filename ? path.extname(download.filename).toLowerCase() : '';
      let categorized = false;
      
      for (const [category, extensions] of Object.entries(categories)) {
        if (extensions.includes(ext) || (category === 'Data/API' && ext === '')) {
          categoryStats[category].count++;
          if (download.fileSizeMB) {
            categoryStats[category].size += parseFloat(download.fileSizeMB);
          }
          categorized = true;
          totalCategorized++;
          break;
        }
      }
      
      if (!categorized) {
        categoryStats['Other'].count++;
        if (download.fileSizeMB) {
          categoryStats['Other'].size += parseFloat(download.fileSizeMB);
        }
      }
    });
    
    console.log(`\n📋 리소스 카테고리별 분석:`);
    Object.entries(categoryStats).forEach(([category, data]) => {
      if (data.count > 0) {
        const percentage = ((data.count / stats.totalDownloads) * 100).toFixed(1);
        console.log(`  ${category}: ${data.count}개 (${percentage}%) - ${data.size.toFixed(2)} MB`);
      }
    });
    
    // 이미지 리소스 상세 분석
    const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
    let imageCount = 0;
    let imageSize = 0;
    
    this.downloads.forEach(download => {
      const ext = download.filename ? path.extname(download.filename).toLowerCase() : '';
      if (imageTypes.includes(ext)) {
        imageCount++;
        if (download.fileSizeMB) {
          imageSize += parseFloat(download.fileSizeMB);
        }
      }
    });
    
    console.log(`\n🖼️ 이미지 리소스 분석:`);
    console.log(`  총 이미지: ${imageCount}개`);
    console.log(`  이미지 총 크기: ${imageSize.toFixed(2)} MB`);
    console.log(`  전체 대비 비율: ${((imageSize / parseFloat(stats.totalSizeMB)) * 100).toFixed(1)}%`);
    
    console.log(`\n📡 캐시 상태 분석:`);
    console.log(`  캐시 히트: ${stats.cacheStats.hit}개 (${((stats.cacheStats.hit / stats.totalDownloads) * 100).toFixed(1)}%)`);
    console.log(`  캐시 미스: ${stats.cacheStats.miss}개 (${((stats.cacheStats.miss / stats.totalDownloads) * 100).toFixed(1)}%)`);
    console.log(`  재검증: ${stats.cacheStats.revalidated}개 (${((stats.cacheStats.revalidated / stats.totalDownloads) * 100).toFixed(1)}%)`);
    console.log(`  알 수 없음: ${stats.cacheStats.unknown}개`);
    
    if (stats.largestFile) {
      console.log(`\n📈 가장 큰 파일:`);
      console.log(`  - 파일명: ${stats.largestFile.filename}`);
      console.log(`  - 크기: ${stats.largestFile.fileSizeMB} MB`);
      console.log(`  - URL: ${stats.largestFile.url}`);
    }
    
    console.log(`\n🌐 도메인별 다운로드 (상위 10개):`);
    const sortedDomains = Object.entries(stats.domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    sortedDomains.forEach(([domain, count]) => {
      const percentage = ((count / stats.totalDownloads) * 100).toFixed(1);
      console.log(`  ${domain}: ${count}건 (${percentage}%)`);
    });
    
    console.log(`\n📁 파일 타입별 (상위 10개):`);
    const sortedTypes = Object.entries(stats.fileTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    sortedTypes.forEach(([ext, count]) => {
      const displayExt = ext || '확장자 없음';
      const percentage = ((count / stats.totalDownloads) * 100).toFixed(1);
      console.log(`  ${displayExt}: ${count}건 (${percentage}%)`);
    });
    
    console.log(`\n✅ 통계 파일 저장됨: ${this.statsFile}`);
  }
}

module.exports = new DownloadTracker();