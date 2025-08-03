-- 3단계: date 컬럼 추가 및 불필요한 컬럼 제거
-- 테이블 재생성 대신 ALTER TABLE 사용

-- 1. date 컬럼 추가 (오늘 날짜로 필터링용)
ALTER TABLE test_keywords 
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;

-- 2. product_rank 관련 불필요한 컬럼 제거
ALTER TABLE test_keywords 
DROP COLUMN IF EXISTS avg_product_rank,
DROP COLUMN IF EXISTS min_product_rank,
DROP COLUMN IF EXISTS max_product_rank,
DROP COLUMN IF EXISTS total_pages_searched;

-- 3. 기존 데이터의 date 업데이트 (NULL인 경우)
UPDATE test_keywords 
SET date = CURRENT_DATE 
WHERE date IS NULL;

-- 4. date 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_test_keywords_date
ON test_keywords (date);

CREATE INDEX IF NOT EXISTS idx_test_keywords_active_date 
ON test_keywords (is_active, date, os_type) 
WHERE is_active = true;

-- 5. 확인
SELECT 
    'date 컬럼 추가 및 product_rank 컬럼 제거 완료' as message,
    COUNT(*) as total_records,
    COUNT(CASE WHEN date = CURRENT_DATE THEN 1 END) as today_records
FROM test_keywords;

-- 6. 컬럼 확인 (product_code가 suffix 뒤에 있는지 확인)
SELECT 
    column_name,
    ordinal_position,
    data_type
FROM information_schema.columns
WHERE table_name = 'test_keywords'
AND column_name IN ('keyword', 'suffix', 'product_code', 'date')
ORDER BY ordinal_position;