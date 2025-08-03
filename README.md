# 쿠팡 자동화 도구

Playwright 기반 쿠팡 웹사이트 자동화 도구입니다.

## 빠른 시작

```bash
# 의존성 설치
npm install

# 브라우저 설치
npx playwright install

# 실행
npm start
```

## 실행 옵션

### 브라우저 선택
```bash
node index.js --browser chrome
node index.js --browser firefox
node index.js --browser webkit
```

### 워크플로우 선택
```bash
node index.js --workflow search-click  # 기본: 상품 검색 및 클릭
node index.js --workflow signup        # 회원가입 페이지 접근
node index.js --workflow product-search # 상품 검색 및 필터링
```

### 프록시 설정
```bash
node index.js --proxy sequential  # 순차적 프록시
node index.js --proxy random      # 랜덤 프록시
node index.js --proxy proxy1      # 특정 프록시 ID
node index.js --proxy none        # 프록시 없이
```

### 프로필 관리
```bash
node index.js --profile-name work  # work 프로필 사용
node index.js --clear-session      # 세션 초기화
node index.js --no-persistent      # 일회성 세션
```

### 추적 기능
```bash
node index.js --tracker  # 다운로드 및 쿠키 추적 활성화
```

## 실행 모드

### 로컬 모드 (기본)
```bash
npm run local
# 또는
scripts/run-local-mode.bat
```

### API 모드
```bash
set API_URL=http://your-api-server.com
npm run api
# 또는
scripts/run-api-mode.bat
```

## 프로젝트 구조

- `config/` - 설정 파일
- `lib/` - 핵심 모듈
  - `core/` - 브라우저 및 워크플로우 관리
  - `handlers/` - 사이트별 핸들러
  - `services/` - API 및 프록시 서비스
  - `trackers/` - 추적 모듈
  - `workflows/` - 워크플로우 정의
- `data/` - 런타임 데이터 (git 제외)
- `scripts/` - 실행 스크립트

## 데이터베이스 기반 테스트 자동화

### 테스트 키워드 관리

PostgreSQL 데이터베이스를 사용하여 체계적인 A/B 테스트를 지원합니다.

```bash
# 데이터베이스 연결 테스트
npm run test:db

# 키워드 테이블 생성 및 테스트
npm run test:keywords

# 키워드 실행 시뮬레이션
npm run test:keyword-exec          # Windows 11
npm run test:keyword-exec:u24      # Ubuntu 24.04
npm run test:keyword-exec:u22      # Ubuntu 22.04

# 테이블 업데이트 (상품코드, 장바구니 추가)
npm run test:table-update
```

### 키워드 테이블 구조

- **검색어 관리**: 기본 키워드 + 추가 문구 ("노트북 aa", "노트북 bb")
- **상품 관리**: 상품 코드로 특정 상품 검색, 순위 측정
- **환경 설정**: OS 타입 (win11, u24, u22), VMware 여부, IP 타입 (mobile/pc)
- **브라우저 설정**: Chrome, Firefox, WebKit 지원
- **실행 관리**: 최대 100회 실행 후 자동 비활성화
- **장바구니 옵션**: 상품 클릭 후 장바구니 추가 기능
- **통계 추적**: 성공률, 상품 순위 (평균/최고/최저), 실행 시간

### 주요 기능

- 🔄 **균등 실행**: 실행 횟수가 적은 키워드 우선 선택
- 📊 **실시간 통계**: OS별, 키워드별 성공률 추적
- 🎯 **자동 종료**: 활성 키워드 소진시 프로그램 자동 종료
- 🔍 **환경별 분석**: Windows/Ubuntu, VMware, IP 타입별 성능 비교

### 환경 설정

`config/environment.js`에서 현재 OS 타입을 설정:

```javascript
// 현재 운영체제 설정
osType: process.env.OS_TYPE || 'win11'
```

## 도움말

```bash
node index.js --help
node index.js --workflow-help
```

자세한 내용은 [CLAUDE.md](CLAUDE.md)를 참조하세요.