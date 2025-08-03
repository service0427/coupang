-- 1단계: 테스트 키워드 및 환경 설정 테이블
-- 키워드와 모든 테스트 조건을 하나의 테이블에서 관리

CREATE TABLE IF NOT EXISTS test_keywords (
  id SERIAL PRIMARY KEY,
  
  -- 검색 키워드 관련
  keyword VARCHAR(100) NOT NULL,           -- 기본 검색어 (예: "노트북")
  suffix VARCHAR(20),                      -- 추가 문구 (예: "aa", "bb", "cc")
  
  -- 환경 설정
  os_type VARCHAR(10) NOT NULL,            -- win11, u24, u22
  is_vmware BOOLEAN DEFAULT false,         -- VMware 환경 여부
  ip_type VARCHAR(10) NOT NULL,            -- mobile, pc (IP 타입)
  ip_change_enabled BOOLEAN DEFAULT false, -- IP 변경 여부
  allow_duplicate_ip BOOLEAN DEFAULT false, -- 중복 IP 사용 허용 (동시 브라우저 실행시)
  
  -- 브라우저 및 프로필 설정
  browser VARCHAR(20) DEFAULT 'chrome',    -- chrome, firefox, webkit
  profile_name VARCHAR(50),                -- 프로필명 (예: "work", "default")
  
  -- 실행 관리
  max_executions INTEGER DEFAULT 100,      -- 최대 실행 횟수
  current_executions INTEGER DEFAULT 0,    -- 현재 실행 횟수
  is_active BOOLEAN DEFAULT true,          -- 활성 상태 (100회 도달시 자동 false)
  
  -- 통계
  success_count INTEGER DEFAULT 0,         -- 성공 횟수
  fail_count INTEGER DEFAULT 0,           -- 실패 횟수
  
  -- 시간 추적
  last_executed_at TIMESTAMP,             -- 마지막 실행 시간
  created_at TIMESTAMP DEFAULT NOW(),      -- 생성 시간
  updated_at TIMESTAMP DEFAULT NOW()       -- 수정 시간
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_test_keywords_active 
ON test_keywords (is_active, os_type) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_test_keywords_os_type 
ON test_keywords (os_type);

CREATE INDEX IF NOT EXISTS idx_test_keywords_last_executed 
ON test_keywords (last_executed_at);

-- 트리거는 별도로 관리 (복잡한 함수 정의 제외)

-- 샘플 데이터 삽입
INSERT INTO test_keywords (keyword, suffix, os_type, is_vmware, ip_type, ip_change_enabled, allow_duplicate_ip, browser, profile_name) VALUES
-- Windows 11 환경
('노트북', 'aa', 'win11', false, 'pc', false, false, 'chrome', 'default'),
('노트북', 'bb', 'win11', false, 'pc', false, true, 'firefox', 'default'),
('노트북', 'cc', 'win11', true, 'mobile', true, false, 'webkit', 'work'),

-- Ubuntu 24 환경  
('노트북', 'aa', 'u24', false, 'pc', false, false, 'chrome', 'default'),
('노트북', 'bb', 'u24', true, 'mobile', true, true, 'firefox', 'work'),

-- Ubuntu 22 환경
('노트북', 'aa', 'u22', false, 'pc', false, false, 'chrome', 'default'),
('노트북', 'bb', 'u22', false, 'mobile', false, true, 'webkit', 'default');

-- 테이블 생성 확인
SELECT 
    'test_keywords 테이블이 성공적으로 생성되었습니다.' as message,
    COUNT(*) as sample_data_count
FROM test_keywords;