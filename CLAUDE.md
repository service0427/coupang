# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

쿠팡 상품 클릭 자동화 도구 - Playwright를 사용하여 쿠팡에서 특정 상품 코드를 검색하고 클릭하는 자동화 도구입니다. 원래 Ubuntu 22에서 개발되었으며, Windows 11에서도 동작하도록 최적화되었습니다.

## 개발 환경 설정

```bash
# 의존성 설치
npm install

# Playwright 브라우저 설치
npx playwright install

# Windows에서 빠른 실행
run.bat              # 기본 실행
```

## 주요 명령어

```bash
# 기본 실행 (Chrome, 영구 프로필, 세션 유지, 프록시 없음)
npm start

# 특정 브라우저로 실행
node index.js --browser chrome
node index.js --browser firefox
node index.js --browser webkit

# 프록시 설정
node index.js --browser chrome --proxy sequential  # 순차적 프록시 사용
node index.js --browser chrome --proxy random      # 랜덤 프록시 사용
node index.js --browser chrome --proxy proxy1      # 특정 프록시 지정
node index.js --browser chrome --proxy none        # 프록시 없이

# 프로필 관리
node index.js --browser chrome --profile-name work  # browser-data/chrome_work/
node index.js --browser firefox --profile-name test # browser-data/firefox_test/

# 세션 관리
node index.js --browser chrome --clear-session     # 쿠키/세션 초기화
node index.js --browser chrome --no-persistent     # 일회성 세션

# 트래킹 기능
node index.js --browser chrome --tracker           # 다운로드 및 쿠키 추적 활성화

# 워크플로우 선택
node index.js --workflow search-click              # 기본 검색 및 클릭
node index.js --workflow signup                    # 회원가입 페이지 접근
node index.js --workflow product-search            # 상품 검색 및 필터링

# 도움말
node index.js --help
node index.js --workflow-help                      # 사용 가능한 워크플로우 목록

# npm 스크립트 사용
npm test              # Chrome 테스트
npm run test:firefox  # Firefox 테스트
npm run test:webkit   # WebKit 테스트
```

## 프로젝트 구조

```
dev_playwright/
├── index.js              # 메인 실행 파일
├── config.js            # Windows 11 환경 설정
├── proxies.json         # 프록시 목록 설정
├── lib/
│   ├── browser-launcher.js  # 통합 브라우저 실행 모듈
│   ├── coupang-handler.js   # 쿠팡 사이트 자동화 로직
│   ├── browser-common.js    # 브라우저 공통 설정
│   ├── proxy-manager.js     # 프록시 관리 모듈
│   ├── resource-blocker.js  # 리소스 차단 모듈 (미사용)
│   ├── download-tracker.js  # 다운로드 추적 모듈
│   ├── cookie-tracker.js    # 쿠키 상태 추적 모듈
│   └── workflow-manager.js  # 워크플로우 관리 모듈
├── lib/workflows/        # 워크플로우 모듈들
│   ├── search-click.js   # 기본 검색 및 클릭
│   ├── signup.js         # 회원가입 프로세스
│   └── product-search.js # 상품 검색 및 필터링
├── browser-data/        # 브라우저 프로필 데이터
│   ├── chrome/          # Chrome 기본 프로필
│   ├── chrome_work/     # Chrome work 프로필
│   └── firefox/         # Firefox 기본 프로필
├── download-data/       # 다운로드 추적 데이터 (프로필별)
│   └── [profile_name]/
│       ├── downloads.json
│       └── statistics.json
├── cookie-data/         # 쿠키 추적 데이터 (프로필별)
│   └── [profile_name]/
│       ├── initial-cookies.json
│       ├── final-cookies.json
│       └── cookie-comparison.json
├── run.bat              # Windows 실행 스크립트
└── package.json         # 프로젝트 의존성
```

## 핵심 아키텍처

1. **워크플로우 매니저 (workflow-manager.js)**
   - 다양한 작업 흐름을 모듈화하여 관리
   - 동적 워크플로우 로드 및 실행
   - 확장 가능한 구조로 새로운 워크플로우 추가 용이

2. **사용 가능한 워크플로우**
   - **search-click**: 기본 워크플로우 - 노트북 검색 후 랜덤 상품 클릭
   - **signup**: 회원가입 페이지 접근 및 폼 필드 확인
   - **product-search**: 키워드 기반 상품 검색 및 필터/정렬

3. **브라우저 런처 (browser-launcher.js)**
   - Chrome, Firefox, WebKit 지원
   - 영구 프로필 및 일회성 세션 모드
   - 프로필별 데이터 격리 (브라우저명_프로필명)
   - 브라우저 창 크기: 1200x800
   - 다운로드 파일 및 네트워크 리소스 추적

4. **쿠팡 핸들러 (coupang-handler.js)**
   - IP 확인 (프록시 작동 확인)
   - 노트북 검색 페이지 접속
   - rank 파라미터가 있는 상품 중 랜덤 선택
   - target="_self" 설정 후 클릭
   - WebDriver 감지 상태 확인 (모든 브라우저)

5. **설정 관리 (config.js)**
   - Windows 11 최적화 설정
   - 브라우저별 실행 인자 관리
   - 환경변수 지원 (SCREEN_WIDTH, SCREEN_HEIGHT)

6. **리소스 차단 모듈 (resource-blocker.js)**
   - 이미지, 폰트, 미디어 자동 차단
   - 광고 네트워크 및 추적 스크립트 차단
   - CSS 화이트리스트 기반 필터링
   - 차단 통계 수집 기능
   - 현재 미사용 (추후 트래픽 최적화 시 활용 예정)

7. **다운로드 추적 (download-tracker.js)**
   - 모든 네트워크 리소스 추적
   - 파일 크기 및 타입별 통계
   - 도메인별 분석
   - 프로필별로 독립된 통계 저장 (`download-data/[profile_name]/`)

8. **쿠키 추적 (cookie-tracker.js)**
   - 세션 시작/종료 시 쿠키 상태 비교
   - 신규/변경/삭제된 쿠키 분석
   - 프로필별로 독립된 쿠키 데이터 저장 (`cookie-data/[profile_name]/`)

9. **작업 완료 후 대기 기능**
   - 작업 완료 후 자동 일시정지
   - Enter 키를 누르거나 브라우저를 닫으면 종료
   - 로그 및 통계 확인을 위한 편의 기능

10. **트래킹 기능 (--tracker 옵션)**
    - 기본값은 비활성화 (성능 향상)
    - 다운로드 리소스 및 통계 추적
    - 쿠키 변화 분석
    - 캐시 효율성 분석

## Windows 11 특화 사항

- Firefox 실행 인자: `--new-instance` → `-new-instance`
- Chrome 추가 인자: `--no-sandbox`, `--disable-setuid-sandbox`
- 배치 파일로 쉬운 실행 지원
- Windows 경로 구분자 처리

## 프록시 관리

`proxies.json` 파일에서 프록시 목록을 관리합니다:

```json
{
  "proxies": [
    {
      "id": "proxy1",
      "server": "socks5://112.161.54.7:10016",
      "name": "Korea Proxy 1",
      "active": true
    }
  ],
  "defaultMode": "sequential"
}
```

- **기본값**: 프록시를 사용하지 않음 (--proxy 옵션 미지정 시)
- **sequential**: 프록시를 순차적으로 사용
- **random**: 매번 랜덤하게 프록시 선택
- **특정 ID**: 지정한 프록시만 사용
- **none**: 프록시 사용 안 함

## 프로필 및 세션 관리

### 영구 프로필 모드 (기본값)
브라우저 데이터를 재사용하여 효율적인 테스트:

- 프로필 디렉토리: `browser-data/{브라우저명}` 또는 `browser-data/{브라우저명}_{프로필명}`
- 캐시를 재사용하여 더 빠른 페이지 로딩
- 세션 데이터는 기본적으로 유지 (로그인 상태 보존)
- `--clear-session` 옵션으로 쿠키/스토리지 초기화 가능

### 프로필 예시
```
browser-data/
├── chrome/           # Chrome 기본 프로필
├── chrome_work/      # Chrome work 프로필
├── firefox/          # Firefox 기본 프로필
└── firefox_test/     # Firefox test 프로필
```

### 일회성 세션 모드
`--no-persistent` 옵션으로 매번 새로운 브라우저 환경에서 시작

## 워크플로우 확장 가이드

새로운 워크플로우를 추가하려면:

1. `lib/workflows/` 디렉토리에 새 파일 생성
2. 다음 구조로 워크플로우 모듈 작성:

```javascript
async function myWorkflow(page, browserType, options = {}) {
  // 워크플로우 로직 구현
}

module.exports = {
  id: 'my-workflow',
  name: '워크플로우 이름',
  description: '워크플로우 설명',
  handler: myWorkflow
};
```

3. 워크플로우는 자동으로 로드되어 사용 가능