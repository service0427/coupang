-- 2단계: 상품 코드 및 장바구니 클릭 옵션 추가
-- 기존 test_keywords 테이블에 새로운 컬럼 추가

-- 상품 코드 컬럼 추가 (필수)
ALTER TABLE test_keywords 
ADD COLUMN IF NOT EXISTS product_code VARCHAR(50) NOT NULL DEFAULT '';

-- 장바구니 클릭 여부 컬럼 추가
ALTER TABLE test_keywords 
ADD COLUMN IF NOT EXISTS cart_click_enabled BOOLEAN DEFAULT false;

-- 상품 검색 관련 통계 컬럼 추가
ALTER TABLE test_keywords 
ADD COLUMN IF NOT EXISTS avg_product_rank DECIMAL(5,2) DEFAULT 0;  -- 평균 상품 순위
ALTER TABLE test_keywords 
ADD COLUMN IF NOT EXISTS min_product_rank INTEGER DEFAULT 0;       -- 최소 순위 (베스트)
ALTER TABLE test_keywords 
ADD COLUMN IF NOT EXISTS max_product_rank INTEGER DEFAULT 0;       -- 최대 순위 (워스트)
ALTER TABLE test_keywords 
ADD COLUMN IF NOT EXISTS total_pages_searched INTEGER DEFAULT 0;   -- 총 검색한 페이지 수

-- 실행 결과 로그 테이블 생성 (상세 기록용)
CREATE TABLE IF NOT EXISTS execution_logs (
  id SERIAL PRIMARY KEY,
  keyword_id INTEGER NOT NULL REFERENCES test_keywords(id),
  executed_at TIMESTAMP DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  product_found BOOLEAN DEFAULT false,        -- 상품 발견 여부
  product_rank INTEGER,                       -- 상품 순위 (발견시)
  pages_searched INTEGER DEFAULT 1,           -- 검색한 페이지 수
  cart_clicked BOOLEAN DEFAULT false,         -- 장바구니 클릭 여부
  error_message TEXT,                         -- 에러 메시지
  duration_ms INTEGER,                        -- 실행 시간 (밀리초)
  browser_used VARCHAR(20),                   -- 실제 사용된 브라우저
  proxy_used VARCHAR(100),                    -- 실제 사용된 프록시
  created_at TIMESTAMP DEFAULT NOW()
);

-- 실행 로그 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_execution_logs_keyword_id 
ON execution_logs (keyword_id);

CREATE INDEX IF NOT EXISTS idx_execution_logs_executed_at 
ON execution_logs (executed_at);

-- 기존 데이터에 샘플 상품 코드 업데이트
UPDATE test_keywords 
SET product_code = CASE 
  WHEN id % 3 = 0 THEN '8654321'  -- 샘플 상품 코드 1
  WHEN id % 3 = 1 THEN '1234567'  -- 샘플 상품 코드 2
  ELSE '9876543'                   -- 샘플 상품 코드 3
END
WHERE product_code = '';

-- 일부 키워드에 장바구니 클릭 활성화
UPDATE test_keywords 
SET cart_click_enabled = true
WHERE id % 2 = 0;  -- 짝수 ID만 장바구니 클릭 활성화

-- 업데이트 확인
SELECT 
  'test_keywords 테이블 업데이트 완료' as message,
  COUNT(*) as total_keywords,
  COUNT(CASE WHEN cart_click_enabled = true THEN 1 END) as cart_enabled_keywords
FROM test_keywords;