-- 6단계: execution_logs 테이블 컬럼 설명 추가
-- 실행 로그를 상세히 기록하는 테이블

-- 테이블 설명
COMMENT ON TABLE execution_logs IS '키워드별 실행 결과를 상세히 기록하는 로그 테이블';

-- 컬럼 설명
COMMENT ON COLUMN execution_logs.id IS '로그 고유 식별자 (자동 증가)';
COMMENT ON COLUMN execution_logs.keyword_id IS 'test_keywords 테이블의 id 참조. 어떤 키워드를 실행했는지';
COMMENT ON COLUMN execution_logs.executed_at IS '실행된 시간';
COMMENT ON COLUMN execution_logs.success IS 'true: 성공 (상품 찾아서 클릭), false: 실패';
COMMENT ON COLUMN execution_logs.product_found IS 'true: 상품을 찾음, false: 상품을 찾지 못함';
COMMENT ON COLUMN execution_logs.product_rank IS '상품이 검색 결과에서 몇 번째에 있었는지 (1페이지 1번 = 1위)';
COMMENT ON COLUMN execution_logs.pages_searched IS '상품을 찾기 위해 검색한 페이지 수';
COMMENT ON COLUMN execution_logs.cart_clicked IS 'true: 장바구니 버튼 클릭 성공, false: 클릭 안함/실패';
COMMENT ON COLUMN execution_logs.error_message IS '실패시 에러 메시지. 성공시 NULL';
COMMENT ON COLUMN execution_logs.duration_ms IS '전체 실행에 걸린 시간 (밀리초)';
COMMENT ON COLUMN execution_logs.browser_used IS '실제로 사용된 브라우저 (chrome, firefox, webkit)';
COMMENT ON COLUMN execution_logs.proxy_used IS '사용된 프록시 서버 주소. direct는 프록시 없이 직접 연결';
COMMENT ON COLUMN execution_logs.created_at IS '로그가 생성된 시간';

-- 실행 로그 컬럼 설명 확인
SELECT 
  column_name,
  data_type,
  is_nullable,
  col_description(pgc.oid, a.attnum) as column_comment
FROM information_schema.columns c
JOIN pg_class pgc ON pgc.relname = c.table_name
JOIN pg_attribute a ON a.attrelid = pgc.oid AND a.attname = c.column_name
WHERE table_name = 'execution_logs'
ORDER BY ordinal_position;

-- 유용한 통계 쿼리 예시
-- 1. 키워드별 평균 상품 순위
SELECT 
  tk.keyword || COALESCE(tk.suffix, '') as search_term,
  tk.product_code,
  COUNT(el.id) as total_executions,
  AVG(el.product_rank) as avg_rank,
  MIN(el.product_rank) as best_rank,
  MAX(el.product_rank) as worst_rank
FROM execution_logs el
JOIN test_keywords tk ON el.keyword_id = tk.id
WHERE el.product_found = true
GROUP BY tk.id, tk.keyword, tk.suffix, tk.product_code
ORDER BY avg_rank;

-- 2. 브라우저별 성공률
SELECT 
  browser_used,
  COUNT(*) as total,
  COUNT(CASE WHEN success = true THEN 1 END) as success_count,
  ROUND(COUNT(CASE WHEN success = true THEN 1 END)::decimal / COUNT(*) * 100, 2) as success_rate
FROM execution_logs
GROUP BY browser_used
ORDER BY success_rate DESC;