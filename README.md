# 자율석 예매 시스템

동시성 제어와 확장성을 고려한 자율석(Free Seating) 예매 시스템입니다.

## 주요 특징

- **자율석 시스템**: 지정석이 아닌 구역별 수용 인원 기반 예매
- **동시성 제어**: Redis 기반 원자적 연산으로 오버부킹 방지
- **실시간 잔여석 관리**: Redis 카운터로 빠른 좌석 현황 조회
- **확장성**: 수평적 확장 가능한 아키텍처

## 기술 스택

- Node.js + TypeScript
- Express.js
- PostgreSQL (with TypeORM)
- Redis (원자적 카운터 & 캐싱)
- Docker (optional)

## 시스템 구조

### 핵심 개념

1. **Section (구역)**: 자율석 구역 (예: 1층 스탠딩, 2층 자유석)
   - 총 수용 인원(totalCapacity)과 현재 예약 인원(currentOccupancy) 관리
   - 구역별 가격 설정 가능

2. **Reservation (예약)**: 구역 예약 정보
   - 예약 인원수(quantity) 포함
   - 개별 좌석 번호 없음

### 동시성 제어 메커니즘

#### 전통적 Lock 기반 시스템 (기본값)
1. **Redis 원자적 카운터**
   - Lua 스크립트로 잔여 좌석 확인과 차감을 원자적으로 처리
   - 오버부킹 완벽 방지

2. **분산 락**
   - 구역별 예약 생성 시 분산 락 사용
   - 동시 요청 순차 처리

3. **트랜잭션 보장**
   - Redis와 PostgreSQL 간 데이터 일관성 유지
   - 실패 시 자동 롤백

#### Slot 기반 시스템 (고성능 옵션)
1. **1:1 Slot 매핑**
   - 각 좌석이 하나의 독립적인 slot으로 매핑 (1:1 관계)
   - 좌석 수만큼의 slot으로 최대 동시성 보장
   - 오버부킹 완벽 방지 - 한 번 사용된 slot은 재사용 불가
   - 각 slot은 고유한 좌석 번호를 가짐
   - 슬롯 할당을 위해 `비트 마스크`를 적용하여 O(1) 가능(구현필요)

2. **Lock-free 설계**
   - 원자적 연산으로 동시성 제어
   - 예매와 확정이 독립적으로 처리
   - 병목 현상 대폭 감소

3. **병렬 처리**
   - 좌석 수만큼 동시 예약 처리 가능
   - 높은 트래픽 상황에서도 효율적 처리
   - 대규모 구역을 위한 배치 초기화 지원

## 설치 및 실행

### 1. 사전 요구사항

- Node.js 18+ 
- Docker & Docker Compose
- npm 또는 yarn

### 2. 프로젝트 설정

```bash
# 저장소 클론
git clone [repository-url]
cd ga_seat_reservation

# 환경 변수 설정
cp .env.example .env

# 의존성 설치
npm install
cd client && npm install && cd ..
```

### 3. Docker로 PostgreSQL & Redis 실행

```bash
# Docker 컨테이너 시작
docker-compose up -d

# 또는 Make 명령어 사용
make up
```

서비스 접속 정보:
- PostgreSQL: `localhost:5432` (user: postgres, password: password)
- Redis: `localhost:6379`
- pgAdmin: `http://localhost:5050` (email: admin@example.com, password: admin)

### 4. 개발 서버 실행

**방법 1: 개별 실행**
```bash
# 터미널 1 - 백엔드 서버
npm run dev

# 터미널 2 - 프론트엔드 서버
cd client
npm run dev
```

**방법 2: Make 명령어 사용**
```bash
# 백엔드와 프론트엔드 동시 실행
make start-all
```

### 5. 초기 데이터 생성

```bash
# 게스트 사용자 및 구역 데이터 생성
npm run seed:all

# Slot 기반 시스템으로 마이그레이션 (선택사항)
npm run migrate:slots
```

### 6. Slot 기반 시스템 활성화 (선택사항)

`.env` 파일에서 다음 설정을 변경:

```env
# Slot-based Reservation System
USE_SLOT_BASED_RESERVATION=true
DEFAULT_SLOTS_PER_SECTION=10  # ⚠️ Deprecated - 이제 자동으로 1:1 매핑 사용
ENABLE_PARALLEL_SLOT_RESERVATION=true  # 병렬 slot 예약 활성화
SLOT_RESERVATION_TIMEOUT=900  # slot 예약 타임아웃 (초)
ENABLE_AUTO_SLOT_CLEANUP=true  # 만료된 slot 자동 정리
```

### 7. 접속 URL

- 프론트엔드: http://localhost:5173
- pgAdmin: http://localhost:5050

### 8. 프로덕션 빌드

```bash
npm run build
cd client && npm run build
```

## Docker 명령어

```bash
# 컨테이너 시작
docker-compose up -d

# 컨테이너 중지
docker-compose down

# 로그 확인
docker-compose logs -f

# 컨테이너 및 볼륨 삭제
docker-compose down -v
```

## 유틸리티 스크립트

```bash
# 모든 데이터 초기화 (DB + Redis)
npm run clean:all

# 게스트 사용자 생성
npm run seed:guest

# 구역 데이터 생성 (현재 활성화된 시스템에 맞춰 자동 초기화)
npm run seed:sections

# 모든 시드 데이터 생성
npm run seed:all

# Slot 기반 시스템으로 마이그레이션 (기존 데이터 유지)
npm run migrate:slots
```

### 스크립트 세부 설명

- **clean:all**: 모든 데이터베이스 테이블과 Redis 키를 삭제합니다. 시스템을 완전히 초기화할 때 사용합니다.
- **seed:sections**: 구역 데이터를 생성하며, 현재 시스템 설정(전통적/Slot 기반)에 따라 적절한 Redis 구조를 초기화합니다.
- **migrate:slots**: 전통적 시스템에서 Slot 기반 시스템으로 마이그레이션합니다. 기존 예약 데이터를 유지하면서 변환합니다.

## Make 명령어

```bash
make help      # 사용 가능한 명령어 목록
make up        # Docker 컨테이너 시작
make down      # Docker 컨테이너 중지
make dev       # 백엔드 개발 서버 실행
make seed      # 데이터베이스 초기 데이터 생성
make start-all # 모든 서비스 실행
make clean     # 모든 데이터 초기화
```

## API 엔드포인트

### 구역 관련

- `GET /api/sections/available` - 예약 가능한 구역 및 잔여석 조회
- `GET /api/sections/:id` - 특정 구역 정보 조회
- `GET /api/sections/stats` - 구역별 통계 조회
- `POST /api/sections` - 구역 생성 (관리자용)
- `PATCH /api/sections/:id/status` - 구역 상태 변경

### 예약 관련

- `POST /api/reservations` - 예약 생성
  ```json
  {
    "sectionId": "uuid",
    "quantity": 2,
    "userId": "uuid"
  }
  ```
- `POST /api/reservations/:id/confirm` - 예약 확정
- `POST /api/reservations/:id/cancel` - 예약 취소
- `GET /api/reservations/:id` - 예약 정보 조회
- `GET /api/reservations/user` - 사용자별 예약 목록
- `GET /api/reservations/stats` - 예약 통계

## 주요 기능

1. **실시간 잔여석 조회**
   - Redis 카운터로 밀리초 단위 응답
   - 구역별 점유율 실시간 확인

2. **다중 인원 예약**
   - 한 번에 여러 명 예약 가능
   - 원자적 처리로 부분 예약 방지

3. **자동 만료 처리**
   - 15분 후 미확정 예약 자동 취소
   - 좌석 자동 반환
   - 만료된 slot 자동 정리 (Slot 시스템)

4. **통계 및 모니터링**
   - 구역별 점유율 통계
   - 예약 현황 실시간 모니터링
   - Slot 상태별 통계 제공

## 확장성 고려사항

1. **수평적 확장**
   - 무상태 API 서버
   - Redis 클러스터 지원

2. **대용량 처리**
   - 개별 좌석 관리 불필요로 성능 향상
   - 배치 처리 최적화

3. **캐싱 전략**
   - 구역 정보 적극적 캐싱
   - 실시간 데이터는 Redis에서 직접 조회

## 테스트

```bash
npm test
```

동시성 시나리오에 대한 종합적인 테스트가 포함되어 있습니다.
