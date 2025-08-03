-- 10단계: os_type, is_vmware, is_active 컬럼 제거 및 agent 컬럼 추가
-- agent 컬럼은 product_code 다음에 위치

BEGIN;

-- 새로운 테이블 생성 (원하는 컬럼 구조로)
CREATE TABLE test_keywords_new (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    keyword VARCHAR(255) NOT NULL,
    suffix VARCHAR(50),
    product_code VARCHAR(50) NOT NULL DEFAULT '',
    agent VARCHAR(30),  -- product_code 다음에 agent 추가
    browser VARCHAR(50) NOT NULL,
    profile_name VARCHAR(100),
    proxy_server VARCHAR(255),
    ip_change_enabled BOOLEAN DEFAULT false,
    allow_duplicate_ip BOOLEAN DEFAULT false,
    cart_click_enabled BOOLEAN DEFAULT false,
    clear_session BOOLEAN DEFAULT false,
    use_persistent BOOLEAN DEFAULT true,
    max_executions INTEGER DEFAULT 100,
    current_executions INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기존 데이터 복사 (제거되는 컬럼 제외)
INSERT INTO test_keywords_new (
    id, date, keyword, suffix, product_code, browser, profile_name,
    proxy_server, ip_change_enabled, allow_duplicate_ip,
    cart_click_enabled, clear_session, use_persistent,
    max_executions, current_executions, success_count, fail_count, 
    last_executed_at, created_at, updated_at
)
SELECT 
    id, date, keyword, suffix, product_code, browser, profile_name,
    proxy_server, ip_change_enabled, allow_duplicate_ip,
    cart_click_enabled, clear_session, use_persistent,
    max_executions, current_executions, success_count, fail_count,
    last_executed_at, created_at, updated_at
FROM test_keywords;

-- 기존 테이블 삭제 및 새 테이블 이름 변경
DROP TABLE test_keywords CASCADE;
ALTER TABLE test_keywords_new RENAME TO test_keywords;

-- 시퀀스 재설정
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'test_keywords_id_seq') THEN
        CREATE SEQUENCE test_keywords_id_seq;
    END IF;
END $$;

ALTER SEQUENCE test_keywords_id_seq OWNED BY test_keywords.id;
ALTER TABLE test_keywords ALTER COLUMN id SET DEFAULT nextval('test_keywords_id_seq');
SELECT setval('test_keywords_id_seq', COALESCE((SELECT MAX(id) FROM test_keywords), 1), true);

-- 인덱스 재생성
CREATE INDEX idx_test_keywords_date ON test_keywords(date);
CREATE INDEX idx_test_keywords_agent ON test_keywords(agent);
CREATE INDEX idx_test_keywords_date_agent ON test_keywords(date, agent);
CREATE INDEX idx_test_keywords_browser ON test_keywords(browser);
CREATE INDEX idx_test_keywords_proxy ON test_keywords(proxy_server);

-- 컬럼 설명 추가
COMMENT ON COLUMN test_keywords.id IS '고유 식별자 (자동 증가)';
COMMENT ON COLUMN test_keywords.date IS '키워드 생성/사용 날짜 (기본값: 오늘)';
COMMENT ON COLUMN test_keywords.keyword IS '검색할 메인 키워드';
COMMENT ON COLUMN test_keywords.suffix IS '키워드 뒤에 붙을 추가 문자 (공백 포함)';
COMMENT ON COLUMN test_keywords.product_code IS '찾을 쿠팡 상품 코드 (URL의 products/ 뒤 숫자)';
COMMENT ON COLUMN test_keywords.agent IS '에이전트 식별자 (최대 30자)';
COMMENT ON COLUMN test_keywords.browser IS '사용할 브라우저 (chrome/firefox/webkit)';
COMMENT ON COLUMN test_keywords.profile_name IS '브라우저 프로필명 (기본값: default)';
COMMENT ON COLUMN test_keywords.proxy_server IS '프록시 서버 주소 (예: socks5://ip:port, NULL=직접연결)';
COMMENT ON COLUMN test_keywords.ip_change_enabled IS 'IP 변경 토글 API 사용 여부';
COMMENT ON COLUMN test_keywords.allow_duplicate_ip IS '중복 IP 허용 여부';
COMMENT ON COLUMN test_keywords.cart_click_enabled IS '상품 페이지에서 장바구니 클릭 여부';
COMMENT ON COLUMN test_keywords.clear_session IS '실행 시 쿠키/세션 초기화 여부';
COMMENT ON COLUMN test_keywords.use_persistent IS '영구 프로필 사용 여부 (false=시크릿 모드)';
COMMENT ON COLUMN test_keywords.max_executions IS '최대 실행 횟수';
COMMENT ON COLUMN test_keywords.current_executions IS '현재까지 실행된 횟수';
COMMENT ON COLUMN test_keywords.success_count IS '성공 횟수';
COMMENT ON COLUMN test_keywords.fail_count IS '실패 횟수';
COMMENT ON COLUMN test_keywords.last_executed_at IS '마지막 실행 시간';
COMMENT ON COLUMN test_keywords.created_at IS '생성 시간';
COMMENT ON COLUMN test_keywords.updated_at IS '수정 시간';

-- 외래키 재생성 (execution_logs 테이블과의 관계)
ALTER TABLE execution_logs 
ADD CONSTRAINT fk_execution_logs_keyword 
FOREIGN KEY (keyword_id) REFERENCES test_keywords(id) ON DELETE CASCADE;

-- 트리거 재생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_test_keywords_updated_at BEFORE UPDATE
ON test_keywords FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 기본 agent 값 설정 (기존 데이터용)
UPDATE test_keywords SET agent = 'default' WHERE agent IS NULL;

COMMIT;

-- 변경 사항 확인
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'test_keywords'
ORDER BY ordinal_position;