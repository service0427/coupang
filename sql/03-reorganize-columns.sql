-- 3단계: 컬럼 순서 재배치 및 date 추가
-- product_rank 관련 컬럼 제거, date 컬럼 추가

-- 1. date 컬럼 추가 (오늘 날짜로 필터링용)
ALTER TABLE test_keywords 
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;

-- 2. product_rank 관련 불필요한 컬럼 제거
ALTER TABLE test_keywords 
DROP COLUMN IF EXISTS avg_product_rank,
DROP COLUMN IF EXISTS min_product_rank,
DROP COLUMN IF EXISTS max_product_rank,
DROP COLUMN IF EXISTS total_pages_searched;

-- 3. 새로운 테이블로 데이터 이동 (컬럼 순서 재배치)
-- 임시 테이블 생성
CREATE TABLE test_keywords_new (
  id SERIAL PRIMARY KEY,
  
  -- 검색 키워드 관련 (순서 변경: keyword, suffix, product_code, date)
  keyword VARCHAR(100) NOT NULL,
  suffix VARCHAR(20),
  product_code VARCHAR(50) NOT NULL DEFAULT '',
  date DATE DEFAULT CURRENT_DATE,
  
  -- 환경 설정
  os_type VARCHAR(10) NOT NULL,
  is_vmware BOOLEAN DEFAULT false,
  ip_type VARCHAR(10) NOT NULL,
  ip_change_enabled BOOLEAN DEFAULT false,
  allow_duplicate_ip BOOLEAN DEFAULT false,
  
  -- 브라우저 및 옵션
  browser VARCHAR(20) DEFAULT 'chrome',
  profile_name VARCHAR(50),
  cart_click_enabled BOOLEAN DEFAULT false,
  
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

-- 기존 데이터 복사
INSERT INTO test_keywords_new (
  id, keyword, suffix, product_code, date,
  os_type, is_vmware, ip_type, ip_change_enabled, allow_duplicate_ip,
  browser, profile_name, cart_click_enabled,
  max_executions, current_executions, is_active,
  success_count, fail_count,
  last_executed_at, created_at, updated_at
)
SELECT 
  id, keyword, suffix, product_code, COALESCE(date, CURRENT_DATE),
  os_type, is_vmware, ip_type, ip_change_enabled, allow_duplicate_ip,
  browser, profile_name, cart_click_enabled,
  max_executions, current_executions, is_active,
  success_count, fail_count,
  last_executed_at, created_at, updated_at
FROM test_keywords;

-- 기존 테이블 삭제 및 이름 변경
DROP TABLE test_keywords CASCADE;  -- CASCADE로 의존 객체도 함께 삭제
ALTER TABLE test_keywords_new RENAME TO test_keywords;

-- 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_test_keywords_active_date 
ON test_keywords (is_active, date, os_type) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_test_keywords_os_type 
ON test_keywords (os_type);

CREATE INDEX IF NOT EXISTS idx_test_keywords_last_executed 
ON test_keywords (last_executed_at);

CREATE INDEX IF NOT EXISTS idx_test_keywords_date
ON test_keywords (date);

-- 트리거 재생성
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

-- 확인
SELECT 
    'test_keywords 테이블 재구성 완료' as message,
    COUNT(*) as total_records
FROM test_keywords;

-- 컬럼 순서 확인
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'test_keywords'
ORDER BY ordinal_position;