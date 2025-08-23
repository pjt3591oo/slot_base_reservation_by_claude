# 자율석 예매 시스템 문서

## 개요
이 문서는 자율석 예매 시스템의 아키텍처, 동작 방식, API 사용법, 배포 가이드를 포함합니다.

## 문서 목록

### 1. [시스템 아키텍처](./ARCHITECTURE.md)
- 전체 시스템 구조
- 주요 컴포넌트 설명
- 데이터 흐름
- 기술 스택
- 캐싱 전략
- 확장성 고려사항

### 2. [예매 프로세스](./RESERVATION_FLOW.md)
- 예매 생성 플로우
- 예매 확정 프로세스
- 예매 취소/만료 처리
- 상태 전이도
- 예외 처리 및 복구

### 3. [동시성 제어](./CONCURRENCY_CONTROL.md)
- Lock 기반 시스템 (전통적 방식)
- Slot 기반 시스템 (1:1 매핑 방식)
- 성능 비교 및 벤치마크
- 선택 가이드
- 모니터링 및 튜닝

### 4. [API Reference](./API_REFERENCE.md)
- 전체 엔드포인트 목록
- 요청/응답 형식
- 에러 코드
- 사용 예제
- Slot 기반 시스템 API

### 5. [환경 설정 가이드](./CONFIGURATION.md)
- 모든 환경 변수 설명
- 설정 예시 (개발/프로덕션)
- 성능 튜닝 가이드
- 주의사항 및 문제 해결

### 6. [유틸리티 스크립트](./UTILITIES.md)
- 데이터 초기화 도구
- 시드 데이터 생성
- Slot 시스템 마이그레이션
- 백업 및 복구 방법

### 7. [배포 가이드](./DEPLOYMENT_GUIDE.md)
- 시스템 요구사항
- 환경 설정
- 성능 최적화
- 모니터링
- 백업 및 복구
- 트러블슈팅

## 빠른 시작

### 개발 환경
```bash
# 의존성 설치
npm install
cd client && npm install

# 환경 변수 설정
cp .env.example .env

# Docker 컨테이너 실행
docker-compose up -d

# 시드 데이터 생성
npm run seed:all

# 개발 서버 실행
npm run dev
```

### Slot 기반 시스템 활성화 (1:1 매핑)
```bash
# 1. 데이터 마이그레이션
npm run migrate:slots

# 2. 환경 변수 수정 (.env)
USE_SLOT_BASED_RESERVATION=true
ENABLE_PARALLEL_SLOT_RESERVATION=true
SLOT_RESERVATION_TIMEOUT=900
ENABLE_AUTO_SLOT_CLEANUP=true

# 3. 서버 재시작
npm run dev
```

**참고**: Slot 시스템은 이제 1:1 매핑을 사용합니다 (1 slot = 1 좌석)

## 주요 기능

### 1. 실시간 잔여석 관리
- Redis 기반 원자적 카운터
- 밀리초 단위 응답 시간
- 100% 오버부킹 방지

### 2. 동시성 제어
- 수천 명 동시 접속 처리
- 두 가지 동시성 모델 제공
- 트래픽에 따른 자동 확장

### 3. 예약 생명주기 관리
- 자동 만료 처리
- 상태 기반 워크플로우
- 완벽한 감사 추적

### 4. 고가용성
- 무중단 배포 지원
- 자동 장애 복구
- 수평적 확장 가능

## 성능 지표

### Lock 기반 시스템
- 동시 처리: ~200 req/s
- 평균 응답: 850ms
- 최대 동시 접속: ~1,000명
- 메모리 사용: 낮음

### Slot 기반 시스템 (1:1 매핑)
- 동시 처리: ~3,500 req/s
- 평균 응답: 45ms
- 최대 동시 접속: ~10,000명
- 메모리 사용: 좌석당 ~200 bytes

## 문제 해결

### 일반적인 문제
1. **높은 응답 시간**: Slot 시스템 활성화 검토
2. **Redis 메모리 부족**: 캐시 TTL 조정
3. **DB 연결 오류**: 커넥션 풀 크기 증가

### 지원
- GitHub Issues: [프로젝트 저장소]/issues
- 이메일: support@example.com

## 라이선스
MIT License