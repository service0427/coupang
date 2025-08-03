-- 4단계: 컬럼 순서 재배치
-- 순서: id, date, keyword, suffix, product_code, browser, profile_name, 나머지

-- 1. 새로운 순서로 테이블 생성
CREATE TABLE test_keywords_reordered (
  -- 주요 컬럼 (요청된 순서)
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  keyword VARCHAR(100) NOT NULL,
  suffix VARCHAR(20),
  product_code VARCHAR(50) NOT NULL DEFAULT '',
  browser VARCHAR(20) DEFAULT 'chrome',
  profile_name VARCHAR(50),
  
  -- 나머지 컬럼들 (기존 순서 유지)
  os_type VARCHAR(10) NOT NULL,
  is_vmware BOOLEAN DEFAULT false,
  ip_type VARCHAR(10) NOT NULL,
  ip_change_enabled BOOLEAN DEFAULT false,
  allow_duplicate_ip BOOLEAN DEFAULT false,
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

-- 2. 기존 데이터 복사
INSERT INTO test_keywords_reordered (
  id, date, keyword, suffix, product_code, browser, profile_name,
  os_type, is_vmware, ip_type, ip_change_enabled, allow_duplicate_ip,
  cart_click_enabled, max_executions, current_executions, is_active,
  success_count, fail_count, last_executed_at, created_at, updated_at
)
SELECT 
  id, date, keyword, suffix, product_code, browser, profile_name,
  os_type, is_vmware, ip_type, ip_change_enabled, allow_duplicate_ip,
  cart_click_enabled, max_executions, current_executions, is_active,
  success_count, fail_count, last_executed_at, created_at, updated_at
FROM test_keywords;

-- 3. 외래키 제약조건 임시 비활성화 및 테이블 교체
BEGIN;

-- execution_logs의 외래키 제약조건 삭제
ALTER TABLE execution_logs DROP CONSTRAINT IF EXISTS execution_logs_keyword_id_fkey;

-- 기존 테이블 삭제 및 이름 변경
DROP TABLE test_keywords;
ALTER TABLE test_keywords_reordered RENAME TO test_keywords;

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

-- 6. 확인
SELECT 
    '컬럼 순서 재배치 완료' as message,
    COUNT(*) as total_records
FROM test_keywords;

-- 7. 새로운 컬럼 순서 확인
SELECT 
    ordinal_position,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'test_keywords'
AND ordinal_position <= 10
ORDER BY ordinal_position;