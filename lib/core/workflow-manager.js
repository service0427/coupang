const path = require('path');
const fs = require('fs').promises;

class WorkflowManager {
  constructor() {
    this.workflows = new Map();
    this.workflowDir = path.join(__dirname, '..', 'workflows');
  }

  /**
   * 워크플로우 등록
   * @param {string} id - 워크플로우 ID
   * @param {string} name - 워크플로우 이름
   * @param {string} description - 워크플로우 설명
   * @param {Function} handler - 워크플로우 실행 함수
   */
  register(id, name, description, handler) {
    this.workflows.set(id, {
      id,
      name,
      description,
      handler
    });
  }

  /**
   * 사용 가능한 워크플로우 목록 반환
   */
  list() {
    return Array.from(this.workflows.values()).map(w => ({
      id: w.id,
      name: w.name,
      description: w.description
    }));
  }

  /**
   * 워크플로우 실행
   * @param {string} id - 워크플로우 ID
   * @param {Object} page - Playwright page 객체
   * @param {string} browserType - 브라우저 타입
   * @param {Object} options - 추가 옵션
   */
  async execute(id, page, browserType, options = {}) {
    const workflow = this.workflows.get(id);
    if (!workflow) {
      throw new Error(`워크플로우를 찾을 수 없습니다: ${id}`);
    }

    console.log(`\n🔄 워크플로우 실행: ${workflow.name}`);
    console.log(`📋 설명: ${workflow.description}\n`);

    try {
      const result = await workflow.handler(page, browserType, options);
      console.log(`\n✅ 워크플로우 완료: ${workflow.name}`);
      return result;
    } catch (error) {
      console.error(`\n❌ 워크플로우 실패: ${workflow.name}`);
      console.error(`오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 워크플로우 디렉토리에서 모든 워크플로우 자동 로드
   */
  async loadAll() {
    try {
      const files = await fs.readdir(this.workflowDir);
      const workflowFiles = files.filter(f => f.endsWith('.js'));
      
      for (const file of workflowFiles) {
        const workflowPath = path.join(this.workflowDir, file);
        const workflow = require(workflowPath);
        
        if (workflow.id && workflow.name && workflow.handler) {
          this.register(
            workflow.id,
            workflow.name,
            workflow.description || '',
            workflow.handler
          );
          console.log(`📦 워크플로우 로드됨: ${workflow.name} (${workflow.id})`);
        }
      }
      
      console.log(`\n✅ 총 ${this.workflows.size}개의 워크플로우가 로드되었습니다.`);
    } catch (error) {
      console.error('❌ 워크플로우 로드 중 오류:', error.message);
    }
  }

  /**
   * 도움말 표시
   */
  printHelp() {
    console.log('\n사용 가능한 워크플로우:');
    console.log('====================');
    
    const workflows = this.list();
    workflows.forEach(w => {
      console.log(`\n  ${w.id}:`);
      console.log(`    이름: ${w.name}`);
      console.log(`    설명: ${w.description}`);
    });
    
    console.log('\n사용법:');
    console.log('  node index.js --workflow <워크플로우ID>');
    console.log('\n예시:');
    console.log('  node index.js --workflow search-click  # 기본 검색 및 클릭');
    console.log('  node index.js --workflow signup        # 회원가입');
    console.log('  node index.js --workflow product-search # 상품 검색');
  }
}

module.exports = new WorkflowManager();