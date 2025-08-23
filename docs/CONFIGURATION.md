# Configuration Guide

자율석 예매 시스템의 모든 환경 변수 및 설정 옵션에 대한 가이드입니다.

## 환경 변수

### 서버 설정

#### PORT
- **설명**: Express 서버가 실행될 포트 번호
- **기본값**: 3000
- **타입**: number
- **예시**: `PORT=3000`

#### NODE_ENV
- **설명**: 애플리케이션 실행 환경
- **기본값**: development
- **타입**: string
- **가능한 값**: development, production, test
- **예시**: `NODE_ENV=production`

### 데이터베이스 (PostgreSQL)

#### DB_HOST
- **설명**: PostgreSQL 서버 호스트 주소
- **기본값**: localhost
- **타입**: string
- **예시**: `DB_HOST=localhost`

#### DB_PORT
- **설명**: PostgreSQL 서버 포트 번호
- **기본값**: 5432
- **타입**: number
- **예시**: `DB_PORT=5432`

#### DB_USERNAME
- **설명**: PostgreSQL 사용자명
- **기본값**: postgres
- **타입**: string
- **예시**: `DB_USERNAME=postgres`

#### DB_PASSWORD
- **설명**: PostgreSQL 비밀번호
- **기본값**: password
- **타입**: string
- **예시**: `DB_PASSWORD=password`

#### DB_DATABASE
- **설명**: 사용할 데이터베이스 이름
- **기본값**: seat_reservation
- **타입**: string
- **예시**: `DB_DATABASE=seat_reservation`

### 캐시 (Redis)

#### REDIS_HOST
- **설명**: Redis 서버 호스트 주소
- **기본값**: localhost
- **타입**: string
- **예시**: `REDIS_HOST=localhost`

#### REDIS_PORT
- **설명**: Redis 서버 포트 번호
- **기본값**: 6379
- **타입**: number
- **예시**: `REDIS_PORT=6379`

#### REDIS_PASSWORD
- **설명**: Redis 비밀번호 (설정된 경우)
- **기본값**: (빈 문자열)
- **타입**: string
- **예시**: `REDIS_PASSWORD=your-redis-password`

### 인증 (JWT)

#### JWT_SECRET
- **설명**: JWT 토큰 서명에 사용할 비밀 키
- **기본값**: your-secret-key
- **타입**: string
- **보안**: 프로덕션에서는 반드시 강력한 랜덤 문자열 사용
- **예시**: `JWT_SECRET=your-very-long-random-string`

#### JWT_EXPIRES_IN
- **설명**: JWT 토큰 만료 시간
- **기본값**: 1d
- **타입**: string
- **형식**: zeit/ms 라이브러리 형식 (예: 60, "2 days", "10h", "7d")
- **예시**: `JWT_EXPIRES_IN=7d`

### 예약 시스템

#### RESERVATION_TIMEOUT_MINUTES
- **설명**: 예약 확정 전 대기 시간 (분)
- **기본값**: 15
- **타입**: number
- **범위**: 5-60 (권장)
- **예시**: `RESERVATION_TIMEOUT_MINUTES=15`

### Slot 기반 예약 시스템

#### USE_SLOT_BASED_RESERVATION
- **설명**: Slot 기반 예약 시스템 활성화 여부
- **기본값**: false
- **타입**: boolean
- **가능한 값**: true, false
- **예시**: `USE_SLOT_BASED_RESERVATION=true`
- **참고**: true일 경우 높은 동시성 처리 가능, false일 경우 전통적 lock 기반 시스템 사용

#### DEFAULT_SLOTS_PER_SECTION (⚠️ Deprecated)
- **설명**: ~~구역당 기본 slot 수~~
- **상태**: **Deprecated** - 이제 자동으로 1:1 매핑 사용 (slots = totalCapacity)
- **기본값**: 10 (무시됨)
- **타입**: number
- **예시**: `DEFAULT_SLOTS_PER_SECTION=10`
- **마이그레이션**: 이 설정은 더 이상 사용되지 않으며, 각 좌석이 하나의 slot으로 자동 매핑됩니다

#### ENABLE_PARALLEL_SLOT_RESERVATION
- **설명**: 병렬 slot 예약 활성화 여부
- **기본값**: true
- **타입**: boolean
- **가능한 값**: true, false
- **예시**: `ENABLE_PARALLEL_SLOT_RESERVATION=true`
- **성능**: true 권장 (병렬 처리로 성능 향상)

#### SLOT_RESERVATION_TIMEOUT
- **설명**: Slot 예약 유지 시간 (초)
- **기본값**: 900 (15분)
- **타입**: number
- **범위**: 300-3600 (5분-1시간)
- **예시**: `SLOT_RESERVATION_TIMEOUT=900`
- **참고**: RESERVATION_TIMEOUT_MINUTES와 동일하게 설정 권장

#### ENABLE_AUTO_SLOT_CLEANUP
- **설명**: 만료된 slot 자동 정리 활성화
- **기본값**: true
- **타입**: boolean
- **가능한 값**: true, false
- **예시**: `ENABLE_AUTO_SLOT_CLEANUP=true`
- **참고**: 백그라운드에서 5분마다 만료된 slot 정리

## 설정 우선순위

1. 환경 변수 (.env 파일)
2. 시스템 환경 변수
3. 코드 내 기본값

## 환경별 권장 설정

### 개발 환경 (Development)
```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
REDIS_HOST=localhost
JWT_SECRET=dev-secret-key
USE_SLOT_BASED_RESERVATION=false
RESERVATION_TIMEOUT_MINUTES=5
```

### 테스트 환경 (Test)
```env
NODE_ENV=test
PORT=3001
DB_DATABASE=seat_reservation_test
JWT_SECRET=test-secret-key
USE_SLOT_BASED_RESERVATION=true
RESERVATION_TIMEOUT_MINUTES=1
```

### 프로덕션 환경 (Production)
```env
NODE_ENV=production
PORT=8080
DB_HOST=your-production-db-host
DB_PASSWORD=strong-db-password
REDIS_HOST=your-redis-cluster
REDIS_PASSWORD=strong-redis-password
JWT_SECRET=very-long-random-production-secret
USE_SLOT_BASED_RESERVATION=true
RESERVATION_TIMEOUT_MINUTES=15
ENABLE_AUTO_SLOT_CLEANUP=true
```

## 성능 튜닝

### 낮은 트래픽 (< 100 동시 사용자)
```env
USE_SLOT_BASED_RESERVATION=false
```

### 중간 트래픽 (100-1000 동시 사용자)
```env
USE_SLOT_BASED_RESERVATION=true
ENABLE_PARALLEL_SLOT_RESERVATION=true
```

### 높은 트래픽 (> 1000 동시 사용자)
```env
USE_SLOT_BASED_RESERVATION=true
ENABLE_PARALLEL_SLOT_RESERVATION=true
ENABLE_AUTO_SLOT_CLEANUP=true
```

## 보안 권장사항

1. **JWT_SECRET**: 
   - 최소 32자 이상의 랜덤 문자열 사용
   - 절대 소스 코드에 하드코딩하지 않음
   - 정기적으로 변경 (6개월-1년)

2. **데이터베이스 비밀번호**:
   - 강력한 비밀번호 사용
   - 환경별로 다른 비밀번호 사용
   - 접근 권한 최소화

3. **Redis 비밀번호**:
   - 프로덕션에서는 반드시 설정
   - ACL 사용 고려 (Redis 6.0+)

## 환경 변수 검증

시스템 시작 시 다음 환경 변수가 검증됩니다:

- 필수 환경 변수 존재 여부
- 타입 검증 (number, boolean 등)
- 범위 검증 (포트 번호, 타임아웃 등)

검증 실패 시 애플리케이션이 시작되지 않으며 명확한 에러 메시지가 표시됩니다.

## 마이그레이션 가이드

### Lock 기반에서 Slot 기반으로 전환

1. 현재 시스템 백업
2. `USE_SLOT_BASED_RESERVATION=true` 설정
3. `npm run migrate:slots` 실행
4. 시스템 재시작
5. 모니터링 강화

### 환경 변수 이름 변경 (향후)

다음 환경 변수들은 향후 버전에서 이름이 변경될 예정입니다:

- `DEFAULT_SLOTS_PER_SECTION` → (제거됨)
- `RESERVATION_TIMEOUT_MINUTES` → `RESERVATION_TIMEOUT_SECONDS` (일관성)

## 문제 해결

### Redis 연결 실패
```
Error: Redis connection failed
```
- REDIS_HOST와 REDIS_PORT 확인
- Redis 서버 실행 상태 확인
- 방화벽 설정 확인

### JWT 인증 실패
```
Error: Invalid JWT token
```
- JWT_SECRET이 모든 서버 인스턴스에서 동일한지 확인
- 토큰 만료 시간 확인

### Slot 초기화 실패
```
Error: Failed to initialize slots
```
- Redis 메모리 충분한지 확인
- 대용량 구역의 경우 초기화 시간이 오래 걸릴 수 있음