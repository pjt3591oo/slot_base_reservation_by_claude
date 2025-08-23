# 자율석 예매 시스템 아키텍처

## 시스템 개요

자율석 예매 시스템은 대규모 동시 접속 환경에서 안정적인 좌석 예매를 제공하는 시스템입니다. 
지정석이 아닌 구역(Section) 단위로 좌석을 관리하며, 동시성 제어를 통해 오버부킹을 방지합니다.

## 전체 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Client  │────▶│  Express Server │────▶│   PostgreSQL    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                         │
                               ▼                         │
                        ┌─────────────┐                  │
                        │    Redis    │◀─────────────────┘
                        └─────────────┘     (Sync)
```

## 주요 컴포넌트

### 1. Frontend (React + TypeScript)
- **기술 스택**: React 19, TypeScript, Vite, Tailwind CSS
- **상태 관리**: Zustand
- **주요 기능**:
  - 구역 선택 및 실시간 잔여석 표시
  - 예매 생성/확정/취소
  - 사용자 예매 내역 조회

### 2. Backend (Node.js + Express)
- **기술 스택**: Node.js, Express, TypeScript
- **ORM**: TypeORM
- **주요 계층**:
  - **Controller Layer**: HTTP 요청 처리 및 응답
  - **Service Layer**: 비즈니스 로직 구현
  - **Repository Layer**: 데이터베이스 접근
  - **Utility Layer**: 
    - **SeatCounter**: 전통적 Redis 카운터 기반 좌석 관리
    - **SlotManager**: Slot 기반 좌석 관리 (1:1 매핑)
    - **DistributedLock**: 분산 락 구현
    - **CacheService**: 캐싱 로직

### 3. 데이터베이스 (PostgreSQL)
- **주요 테이블**:
  - `sections`: 구역 정보 (수용인원, 현재 예약 수 등)
  - `reservations`: 예약 정보
  - `users`: 사용자 정보
  - `reservation_logs`: 예약 변경 이력

### 4. 캐시 & 동시성 제어 (Redis)
- **용도**:
  - 실시간 잔여석 카운터 (SeatCounter)
  - 분산 락 (Distributed Lock)
  - API 응답 캐싱 (CacheService)
  - Slot 기반 예약 관리 (SlotManager)
- **데이터 구조**:
  - `section:seats:{id}` - 전통적 카운터
  - `lock:{key}` - 분산 락
  - `cache:{key}` - 캐시된 응답
  - `section:slot:{id}:{slotId}` - 개별 slot 정보
  - `section:slot:index:{id}:{status}` - slot 상태별 인덱스

## 데이터 흐름

### 예매 생성 플로우 (Lock 기반)
```
1. Client → POST /api/reservations
2. Controller → ReservationService.createReservation()
3. Service → 분산 락 획득 (DistributedLock)
4. Service → Redis 잔여석 확인 및 차감 (SeatCounter)
5. Service → DB 트랜잭션 시작
6. Service → Section 업데이트 (pessimistic lock)
7. Service → Reservation 생성
8. Service → ReservationLog 기록
9. Service → Cache 무효화
10. Service → 분산 락 해제
11. Controller → Client 응답
```

### 예매 생성 플로우 (Slot 기반)
```
1. Client → POST /api/reservations
2. Controller → SlotReservationService.createReservation()
3. Service → DB에 Reservation 생성 (pending)
4. Service → SlotManager.reserveSlots() 호출
5. SlotManager → 필요한 수만큼 slot 예약 (Lua Script)
6. Service → DB 트랜잭션으로 Section 업데이트
7. Service → ReservationLog 기록
8. Service → Cache 무효화
9. Controller → Client 응답
```

### 실시간 잔여석 조회
```
1. Client → GET /api/sections/available
2. Controller → SectionService.findAvailableSections()
3. Service → Cache 확인
4. Service → DB 조회 (cache miss 시)
5. Service → Redis 잔여석 정보 병합
6. Service → Cache 저장 (30초)
7. Controller → Client 응답
```

## 동시성 제어 전략

### 1. Lock 기반 시스템 (기본)
- **분산 락**: Redis SET NX 명령어 활용
- **DB 락**: PostgreSQL Pessimistic Lock
- **장점**: 구현이 간단하고 일관성 보장
- **단점**: 높은 트래픽 시 병목 발생 가능

### 2. Slot 기반 시스템 (고급)
- **1:1 매핑**: 각 좌석이 하나의 독립된 slot으로 매핑
- **Atomic Operation**: Redis Lua Script 활용
- **Lock-free 설계**: 원자적 연산으로 동시성 제어
- **장점**: 
  - 최대 병렬 처리 (좌석 수만큼 동시 처리)
  - 100% 오버부킹 방지
  - 락 경합 제거
- **단점**: 
  - 메모리 사용량 증가 (좌석당 1 slot)
  - 초기화 시간 증가 (대용량 구역)

## 캐싱 전략

### 캐시 계층
1. **HTTP 응답 캐시**: 자주 조회되는 데이터
2. **Redis 캐시**: 
   - 구역 정보 (5분)
   - 예약 정보 (5분)
   - 사용자별 예약 목록 (1분)

### 캐시 무효화
- **Write-through**: 데이터 변경 시 즉시 캐시 삭제
- **영향 범위**: 
  - 예약 생성/수정 → 해당 구역 캐시 삭제
  - 구역 상태 변경 → 전체 구역 목록 캐시 삭제

## 확장성 고려사항

### 수평적 확장
- **Stateless 서버**: 세션 정보를 Redis에 저장
- **로드 밸런싱**: 여러 서버 인스턴스 운영 가능
- **DB 커넥션 풀**: 효율적인 연결 관리

### 성능 최적화
- **배치 조회**: 여러 구역의 잔여석을 한 번에 조회
- **비동기 처리**: 예약 만료 등 백그라운드 작업
- **인덱싱**: 주요 쿼리 경로에 대한 DB 인덱스

## 성능 지표

### Lock 기반 시스템
- 동시 처리: ~200 req/s
- 평균 응답: 850ms
- 최대 동시 접속: ~1,000명

### Slot 기반 시스템 (1:1 매핑)
- 동시 처리: ~3,500 req/s
- 평균 응답: 45ms
- 최대 동시 접속: ~10,000명
- 메모리 사용: 좌석당 ~200 bytes
- 초기화 시간: 1,000석 기준 ~2초

## 장애 대응

### 복구 메커니즘
- **Redis 장애**: DB 기반 fallback
- **트랜잭션 실패**: Redis 카운터 자동 롤백
- **예약 만료**: 주기적인 정리 작업 (5분마다)

### 모니터링 포인트
- Redis 연결 상태
- DB 커넥션 풀 상태
- API 응답 시간
- 동시 접속자 수