-- 5단계: 세션 관련 옵션 추가 및 전체 컬럼 설명 추가
-- clear_session: 프로필은 사용하지만 쿠키/세션 초기화
-- use_persistent: false면 일회성 세션 (시크릿 모드처럼)

-- 1. 새로운 컬럼 추가
ALTER TABLE test_keywords 
ADD COLUMN IF NOT EXISTS clear_session BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS use_persistent BOOLEAN DEFAULT true;

-- 2. 기본값 설정
-- 기존 데이터는 모두 영구 프로필 사용으로 설정
UPDATE test_keywords 
SET 
  clear_session = false,
  use_persistent = true
WHERE clear_session IS NULL OR use_persistent IS NULL;

-- 3. 일부 테스트 데이터 업데이트 (예시)
-- ID 2번은 세션 초기화 모드로
UPDATE test_keywords 
SET clear_session = true 
WHERE id = 2;

-- ID 3번은 일회성 세션 모드로
UPDATE test_keywords 
SET use_persistent = false 
WHERE id = 3;

-- 4. 모든 컬럼에 상세 설명 추가
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
COMMENT ON COLUMN test_keywords.use_persistent IS 'true: 영구 프로필 사용 (캐시/쿠키 유지), false: 일회성 세션 (시크릿 모드처럼 매번 새로운 환경)';
COMMENT ON COLUMN test_keywords.clear_session IS 'true: 프로필은 사용하지만 실행 전 쿠키/세션 데이터 초기화';

-- 환경 설정
COMMENT ON COLUMN test_keywords.os_type IS '운영체제 타입 (win11: Windows 11, u24: Ubuntu 24.04, u22: Ubuntu 22.04)';
COMMENT ON COLUMN test_keywords.is_vmware IS 'VMware 가상머신에서 실행 여부';
COMMENT ON COLUMN test_keywords.ip_type IS 'IP 타입 (mobile: 모바일 IP, pc: PC IP)';
COMMENT ON COLUMN test_keywords.ip_change_enabled IS 'IP 변경 기능 사용 여부';
COMMENT ON COLUMN test_keywords.allow_duplicate_ip IS 'true: 동시 실행시 같은 IP 사용 허용 (프록시 없이), false: 각각 다른 프록시 사용';

-- 쿠팡 관련 옵션
COMMENT ON COLUMN test_keywords.cart_click_enabled IS 'true: 상품 페이지 진입 후 장바구니 버튼 클릭';

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

-- 5. 확인
SELECT 
  id, 
  keyword || COALESCE(suffix, '') as search_term,
  browser,
  use_persistent,
  clear_session,
  allow_duplicate_ip,
  CASE 
    WHEN use_persistent = false THEN '일회성 세션 (시크릿 모드)'
    WHEN clear_session = true THEN '프로필 사용 + 세션 초기화'
    ELSE '영구 프로필 (기본)'
  END as session_mode
FROM test_keywords
WHERE is_active = true
ORDER BY id;

-- 6. 컬럼 설명 확인 쿼리
SELECT 
  column_name,
  data_type,
  is_nullable,
  col_description(pgc.oid, a.attnum) as column_comment
FROM information_schema.columns c
JOIN pg_class pgc ON pgc.relname = c.table_name
JOIN pg_attribute a ON a.attrelid = pgc.oid AND a.attname = c.column_name
WHERE table_name = 'test_keywords'
ORDER BY ordinal_position;