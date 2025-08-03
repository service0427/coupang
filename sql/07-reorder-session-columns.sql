-- 7단계: clear_session, use_persistent 컬럼을 cart_click_enabled 뒤로 이동

-- 1. 새로운 순서로 테이블 생성
CREATE TABLE test_keywords_reordered_v2 (
  -- 주요 컬럼 (기존 순서 유지)
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  keyword VARCHAR(100) NOT NULL,
  suffix VARCHAR(20),
  product_code VARCHAR(50) NOT NULL DEFAULT '',
  browser VARCHAR(20) DEFAULT 'chrome',
  profile_name VARCHAR(50),
  
  -- 환경 설정
  os_type VARCHAR(10) NOT NULL,
  is_vmware BOOLEAN DEFAULT false,
  ip_type VARCHAR(10) NOT NULL,
  ip_change_enabled BOOLEAN DEFAULT false,
  allow_duplicate_ip BOOLEAN DEFAULT false,
  
  -- 쿠팡 관련 옵션 (cart_click_enabled 먼저, 그 다음 세션 옵션)
  cart_click_enabled BOOLEAN DEFAULT false,
  clear_session BOOLEAN DEFAULT false,
  use_persistent BOOLEAN DEFAULT true,
  
  -- 실행 관리
  max_executions INTEGER DEFAULT 100,
  current_executions INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  -- 통계
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  
  -- 시간 추적
  last_executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 기존 데이터 복사
INSERT INTO test_keywords_reordered_v2 (
  id, date, keyword, suffix, product_code, browser, profile_name,
  os_type, is_vmware, ip_type, ip_change_enabled, allow_duplicate_ip,
  cart_click_enabled, clear_session, use_persistent,
  max_executions, current_executions, is_active,
  success_count, fail_count, last_executed_at, created_at, updated_at
)
SELECT 
  id, date, keyword, suffix, product_code, browser, profile_name,
  os_type, is_vmware, ip_type, ip_change_enabled, allow_duplicate_ip,
  cart_click_enabled, clear_session, use_persistent,
  max_executions, current_executions, is_active,
  success_count, fail_count, last_executed_at, created_at, updated_at
FROM test_keywords;

-- 3. 외래키 제약조건 처리
BEGIN;

-- execution_logs의 외래키 제약조건 삭제
ALTER TABLE execution_logs DROP CONSTRAINT IF EXISTS execution_logs_keyword_id_fkey;

-- 기존 테이블 삭제 및 이름 변경
DROP TABLE test_keywords;
ALTER TABLE test_keywords_reordered_v2 RENAME TO test_keywords;

-- 외래키 제약조건 재생성
ALTER TABLE execution_logs 
ADD CONSTRAINT execution_logs_keyword_id_fkey 
FOREIGN KEY (keyword_id) REFERENCES test_keywords(id);

COMMIT;

-- 4. 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_test_keywords_date
ON test_keywords (date);

CREATE INDEX IF NOT EXISTS idx_test_keywords_active_date 
ON test_keywords (is_active, date, os_type) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_test_keywords_os_type 
ON test_keywords (os_type);

CREATE INDEX IF NOT EXISTS idx_test_keywords_last_executed 
ON test_keywords (last_executed_at);

-- 5. 트리거 재생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_test_keywords_updated_at ON test_keywords;
CREATE TRIGGER update_test_keywords_updated_at
    BEFORE UPDATE ON test_keywords
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. 모든 컬럼 설명 재적용
COMMENT ON TABLE test_keywords IS '쿠팡 자동화 테스트를 위한 키워드 및 환경 설정 테이블';

-- 기본 정보
COMMENT ON COLUMN test_keywords.id IS '고유 식별자 (자동 증가)';
COMMENT ON COLUMN test_keywords.date IS '키워드가 실행될 날짜. 오늘 날짜의 키워드만 활성화됨';
COMMENT ON COLUMN test_keywords.keyword IS '기본 검색어 (예: 노트북, 마우스, 키보드)';
COMMENT ON COLUMN test_keywords.suffix IS '검색어 뒤에 붙는 추가 문구. 검색시 공백과 함께 추가됨 (예: aa → 노트북 aa)';
COMMENT ON COLUMN test_keywords.product_code IS '찾아서 클릭할 쿠팡 상품 코드. 여러 페이지에 걸쳐 검색함';

-- 브라우저 및 프로필 설정
COMMENT ON COLUMN test_keywords.browser IS '사용할 브라우저 타입 (chrome, firefox, webkit)';
COMMENT ON COLUMN test_keywords.profile_name IS '브라우저 프로필명. null이면 default 사용. 프로필별로 쿠키/캐시 독립 관리';

-- 환경 설정
COMMENT ON COLUMN test_keywords.os_type IS '운영체제 타입 (win11: Windows 11, u24: Ubuntu 24.04, u22: Ubuntu 22.04)';
COMMENT ON COLUMN test_keywords.is_vmware IS 'VMware 가상머신에서 실행 여부';
COMMENT ON COLUMN test_keywords.ip_type IS 'IP 타입 (mobile: 모바일 IP, pc: PC IP)';
COMMENT ON COLUMN test_keywords.ip_change_enabled IS 'IP 변경 기능 사용 여부';
COMMENT ON COLUMN test_keywords.allow_duplicate_ip IS 'true: 동시 실행시 같은 IP 사용 허용 (프록시 없이), false: 각각 다른 프록시 사용';

-- 쿠팡 관련 옵션 + 세션 옵션 (새로운 순서)
COMMENT ON COLUMN test_keywords.cart_click_enabled IS 'true: 상품 페이지 진입 후 장바구니 버튼 클릭';
COMMENT ON COLUMN test_keywords.clear_session IS 'true: 프로필은 사용하지만 실행 전 쿠키/세션 데이터 초기화';
COMMENT ON COLUMN test_keywords.use_persistent IS 'true: 영구 프로필 사용 (캐시/쿠키 유지), false: 일회성 세션 (시크릿 모드처럼 매번 새로운 환경)';

-- 실행 관리
COMMENT ON COLUMN test_keywords.max_executions IS '최대 실행 횟수. 이 횟수에 도달하면 자동으로 비활성화됨';
COMMENT ON COLUMN test_keywords.current_executions IS '현재까지 실행된 횟수';
COMMENT ON COLUMN test_keywords.is_active IS 'true: 활성 상태 (실행 가능), false: 비활성 상태 (실행 불가)';

-- 통계
COMMENT ON COLUMN test_keywords.success_count IS '성공한 실행 횟수 (상품을 찾아서 클릭한 경우)';
COMMENT ON COLUMN test_keywords.fail_count IS '실패한 실행 횟수 (오류 발생 또는 상품을 찾지 못한 경우)';

-- 시간 추적
COMMENT ON COLUMN test_keywords.last_executed_at IS '마지막으로 실행된 시간';
COMMENT ON COLUMN test_keywords.created_at IS '키워드가 생성된 시간';
COMMENT ON COLUMN test_keywords.updated_at IS '키워드 정보가 수정된 시간 (자동 갱신)';

-- 7. 확인
SELECT 
    '컬럼 순서 재배치 완료' as message,
    COUNT(*) as total_records
FROM test_keywords;

-- 8. 새로운 컬럼 순서 확인 (cart_click_enabled, clear_session, use_persistent 부분)
SELECT 
    ordinal_position,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'test_keywords'
AND column_name IN ('cart_click_enabled', 'clear_session', 'use_persistent')
ORDER BY ordinal_position;