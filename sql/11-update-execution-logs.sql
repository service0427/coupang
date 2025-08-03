-- 11단계: execution_logs 테이블 업데이트
-- test_keywords 구조 변경에 맞춰 업데이트하고 IP, URL rank 정보 추가

BEGIN;

-- 기존 테이블 백업
CREATE TABLE execution_logs_backup AS SELECT * FROM execution_logs;

-- 기존 테이블 삭제
DROP TABLE execution_logs CASCADE;

-- 새로운 구조로 재생성
CREATE TABLE execution_logs (
    id SERIAL PRIMARY KEY,
    keyword_id INTEGER NOT NULL,
    agent VARCHAR(30),
    success BOOLEAN NOT NULL DEFAULT false,
    product_found BOOLEAN DEFAULT false,
    product_rank INTEGER,
    url_rank INTEGER,  -- URL에서 추출한 rank 값
    pages_searched INTEGER DEFAULT 1,
    cart_clicked BOOLEAN DEFAULT false,
    error_message TEXT,
    duration_ms INTEGER,
    browser_used VARCHAR(50),
    proxy_used VARCHAR(255),
    actual_ip VARCHAR(50),  -- 실제 사용된 IP 주소
    final_url TEXT,  -- 최종 상품 페이지 URL
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (keyword_id) REFERENCES test_keywords(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX idx_execution_logs_keyword ON execution_logs(keyword_id);
CREATE INDEX idx_execution_logs_executed_at ON execution_logs(executed_at);
CREATE INDEX idx_execution_logs_agent ON execution_logs(agent);
CREATE INDEX idx_execution_logs_success ON execution_logs(success);

-- 컬럼 설명 추가
COMMENT ON COLUMN execution_logs.id IS '실행 로그 고유 ID';
COMMENT ON COLUMN execution_logs.keyword_id IS 'test_keywords 테이블 참조 ID';
COMMENT ON COLUMN execution_logs.agent IS '실행한 에이전트 이름';
COMMENT ON COLUMN execution_logs.success IS '전체 작업 성공 여부';
COMMENT ON COLUMN execution_logs.product_found IS '상품 발견 여부';
COMMENT ON COLUMN execution_logs.product_rank IS '검색 결과에서의 상품 순위';
COMMENT ON COLUMN execution_logs.url_rank IS 'URL의 rank 파라미터 값';
COMMENT ON COLUMN execution_logs.pages_searched IS '검색한 페이지 수';
COMMENT ON COLUMN execution_logs.cart_clicked IS '장바구니 클릭 성공 여부';
COMMENT ON COLUMN execution_logs.error_message IS '오류 발생 시 메시지';
COMMENT ON COLUMN execution_logs.duration_ms IS '전체 실행 시간 (밀리초)';
COMMENT ON COLUMN execution_logs.browser_used IS '사용된 브라우저 종류';
COMMENT ON COLUMN execution_logs.proxy_used IS '사용된 프록시 서버 주소';
COMMENT ON COLUMN execution_logs.actual_ip IS '실제 접속에 사용된 IP 주소';
COMMENT ON COLUMN execution_logs.final_url IS '최종 도달한 상품 페이지 URL';
COMMENT ON COLUMN execution_logs.executed_at IS '실행 시간';

-- 기존 데이터 복원 (새로운 컬럼은 NULL)
INSERT INTO execution_logs (
    id, keyword_id, success, product_found, product_rank,
    pages_searched, cart_clicked, error_message,
    duration_ms, browser_used, proxy_used, executed_at
)
SELECT 
    id, keyword_id, success, product_found, product_rank,
    pages_searched, cart_clicked, error_message,
    duration_ms, browser_used, proxy_used, executed_at
FROM execution_logs_backup;

-- 시퀀스 재설정
SELECT setval('execution_logs_id_seq', (SELECT MAX(id) FROM execution_logs));

-- 백업 테이블 삭제
DROP TABLE execution_logs_backup;

COMMIT;

-- 구조 확인
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'execution_logs'
ORDER BY ordinal_position;