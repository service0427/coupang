-- 8단계: ip_type 컬럼을 proxy_server 컬럼으로 변경
-- ip_type (mobile/pc)에서 proxy_server (실제 프록시 주소)로 변경하여 직접 프록시 설정 가능

-- 1. 새로운 proxy_server 컬럼 추가
ALTER TABLE test_keywords 
ADD COLUMN proxy_server VARCHAR(255);

-- 2. 기존 ip_type 데이터를 proxy_server로 마이그레이션
-- mobile → null (프록시 주소는 별도 설정 필요)
-- pc → null (직접 연결)
UPDATE test_keywords 
SET proxy_server = CASE 
    WHEN ip_type = 'mobile' THEN NULL  -- 모바일 IP는 프록시 주소를 별도로 설정해야 함
    WHEN ip_type = 'pc' THEN NULL      -- PC IP는 직접 연결 (프록시 없음)
    ELSE NULL
END;

-- 3. ip_type 컬럼 제거
ALTER TABLE test_keywords 
DROP COLUMN ip_type;

-- 4. proxy_server 컬럼에 설명 추가
COMMENT ON COLUMN test_keywords.proxy_server IS 'Proxy server address. null or empty: direct connection, "host:port": HTTP proxy, "socks5://host:port": SOCKS5 proxy';

-- 5. 인덱스 추가 (성능 최적화 - 프록시별 쿼리용)
CREATE INDEX IF NOT EXISTS idx_test_keywords_proxy_server 
ON test_keywords (proxy_server);

-- 6. 마이그레이션 결과 확인
SELECT 
    'ip_type → proxy_server 마이그레이션 완료' as message,
    COUNT(*) as total_records,
    COUNT(CASE WHEN proxy_server IS NULL THEN 1 END) as direct_connections,
    COUNT(CASE WHEN proxy_server IS NOT NULL THEN 1 END) as proxy_connections
FROM test_keywords;

-- 7. 컬럼 정보 확인
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'test_keywords'
AND column_name IN ('proxy_server', 'ip_change_enabled', 'allow_duplicate_ip')
ORDER BY ordinal_position;

-- 8. 샘플 데이터 업데이트 예시 (참고용 - 실제 실행하지 않음)
/*
-- 특정 키워드에 프록시 설정 예시:
UPDATE test_keywords 
SET proxy_server = '112.161.54.7:10011' 
WHERE id = 1;

UPDATE test_keywords 
SET proxy_server = 'socks5://112.161.54.7:10016' 
WHERE id = 2;

-- 프록시 없이 직접 연결
UPDATE test_keywords 
SET proxy_server = NULL 
WHERE id = 3;
*/