# Utility Scripts Guide

자율석 예매 시스템에서 제공하는 유틸리티 스크립트들에 대한 가이드입니다.

## 스크립트 목록

### 데이터 초기화 및 관리

#### clean-all-data.ts
**명령어**: `npm run clean:all`

**설명**: 시스템의 모든 데이터를 완전히 초기화합니다.

**기능**:
- 모든 예약 로그 삭제
- 모든 예약 삭제
- 모든 구역 삭제
- 모든 사용자 삭제
- Redis의 모든 키 삭제 (slots, counters, locks, caches 등)

**사용 시나리오**:
- 개발 환경 초기화
- 테스트 환경 리셋
- 새로운 데이터로 시작하기 전

**주의사항**:
- ⚠️ 복구 불가능한 작업입니다
- 프로덕션 환경에서는 절대 사용하지 마세요

**예시**:
```bash
$ npm run clean:all

🧹 Starting complete data cleanup...

✅ Deleted 152 reservation logs
✅ Deleted 87 reservations
✅ Deleted 12 sections
✅ Deleted 5 users

🔧 Cleaning Redis data...

Found 234 Redis keys
✅ Deleted 12 section:seats: keys
✅ Deleted 156 section:slot: keys
✅ Deleted 23 lock: keys
✅ Deleted 15 cache: keys
✅ Deleted 28 miscellaneous keys

✨ All data has been cleaned successfully!
```

#### seed-guest-user.ts
**명령어**: `npm run seed:guest`

**설명**: 테스트용 게스트 사용자를 생성합니다.

**생성되는 사용자**:
- 이메일: guest@example.com
- 이름: Guest User
- 비밀번호: (없음 - 개발용)

**사용 시나리오**:
- 개발 환경에서 빠른 테스트
- 인증 없이 시스템 테스트

**예시**:
```bash
$ npm run seed:guest

Database connected
Checking for existing guest user...
Created guest user:
  ID: 123e4567-e89b-12d3-a456-426614174000
  Email: guest@example.com
  Name: Guest User
```

#### seed-sections.ts
**명령어**: `npm run seed:sections`

**설명**: 샘플 구역 데이터를 생성합니다.

**기능**:
- 12개의 다양한 구역 생성
- 현재 시스템 설정에 따라 자동으로 초기화
  - Lock 기반: Redis 카운터 초기화
  - Slot 기반: 1:1 매핑으로 slots 초기화
- 일부 구역에 샘플 예약 데이터 추가

**생성되는 구역**:
- 1층 스탠딩 A/B/C구역 (300-200석)
- 2층 자유석 A/B/C구역 (400-500석)
- 3층 자유석 A/B/C구역 (300-400석)
- VIP 박스석 (50석)
- 휠체어 구역 (20석)
- 4층 전망석 (200석, 유지보수 상태)

**예시**:
```bash
$ npm run seed:sections

Database connected
Found 12 sections to seed
Cleared 12 existing sections
Created 12 sections

System Mode: Slot-based (1:1 mapping)

Initialized slots for section: 1층 스탠딩 A구역 - 300 slots
Initialized slots for section: 2층 자유석 B구역 - 500 slots
...

Reserved and confirmed 120 slots for 1층 스탠딩 A구역
Set occupancy for 1층 스탠딩 A구역: 120/300

Section Summary:
- VIP 박스석: 5 available seats (90.0% occupied) - ₩350,000
- 1층 스탠딩 A구역: 180 available seats (40.0% occupied) - ₩180,000
...
```

#### seed:all (조합 스크립트)
**명령어**: `npm run seed:all`

**설명**: 게스트 사용자와 구역 데이터를 모두 생성합니다.

**실행 순서**:
1. seed:guest 실행
2. seed:sections 실행

**사용 시나리오**:
- 새로운 개발 환경 설정
- 데모 환경 준비
- clean:all 후 빠른 데이터 복구

### 마이그레이션 스크립트

#### migrate-to-slots.ts
**명령어**: `npm run migrate:slots`

**설명**: 전통적 lock 기반 시스템에서 slot 기반 시스템으로 마이그레이션합니다.

**기능**:
- 기존 예약 데이터 유지
- 각 구역을 1:1 slot 매핑으로 변환
- 기존 예약된 좌석을 confirmed slot으로 변환
- 기존 Redis 카운터 데이터 백업

**전제 조건**:
- .env에서 `USE_SLOT_BASED_RESERVATION=true` 설정

**마이그레이션 프로세스**:
1. 모든 구역 조회
2. 각 구역별로:
   - 현재 예약 상태 확인
   - 총 좌석 수만큼 slot 생성 (1:1 매핑)
   - 기존 예약된 수만큼 slot을 confirmed 상태로 변경
3. 기존 카운터 데이터 백업 (backup: prefix로 저장)

**예시**:
```bash
$ npm run migrate:slots

Starting migration to slot-based system...
Found 12 sections to migrate

Migrating section: 1층 스탠딩 A구역 (ID: 123...)
  Total capacity: 300
  Current occupancy: 120
  Available seats (Redis): 180
  Creating 300 slots (1:1 mapping with seats)
  Marking 120 slots as confirmed for existing reservations
  Successfully migrated 120 slots to confirmed state

Migration complete for 1층 스탠딩 A구역:
  - Available slots: 180
  - Reserved slots: 0
  - Confirmed slots: 120
  - Available seats: 180

Creating backup of old seat counter data...
  Backed up: section:seats:123... → backup:section:seats:123...

✅ Migration completed successfully!
```

## 사용 워크플로우

### 1. 새로운 개발 환경 설정
```bash
# 1. Docker 컨테이너 시작
docker-compose up -d

# 2. 모든 시드 데이터 생성
npm run seed:all

# 3. 개발 서버 시작
npm run dev
```

### 2. 기존 데이터 리셋 후 재시작
```bash
# 1. 모든 데이터 삭제
npm run clean:all

# 2. 새로운 시드 데이터 생성
npm run seed:all

# 3. 필요시 slot 시스템으로 마이그레이션
npm run migrate:slots
```

### 3. Lock 기반에서 Slot 기반으로 전환
```bash
# 1. .env 파일 수정
# USE_SLOT_BASED_RESERVATION=true

# 2. 마이그레이션 실행
npm run migrate:slots

# 3. 서버 재시작
npm run dev
```

### 4. 성능 테스트 준비
```bash
# 1. 깨끗한 상태로 시작
npm run clean:all

# 2. 대량의 테스트 데이터 생성
npm run seed:sections

# 3. Slot 시스템 활성화
npm run migrate:slots
```

## 스크립트 개발 가이드

### 새로운 스크립트 추가 시

1. **위치**: `/scripts` 디렉토리에 TypeScript 파일로 생성
2. **명명 규칙**: `{action}-{target}.ts` (예: clean-redis.ts)
3. **구조**:
```typescript
import { AppDataSource } from '../src/config/database';
import { redisClient } from '../src/config/redis';

async function yourScript() {
  try {
    // 데이터베이스 연결
    await AppDataSource.initialize();
    console.log('Database connected');

    // 스크립트 로직
    // ...

    console.log('✅ Script completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    // 정리 작업
    await redisClient.quit();
    await AppDataSource.destroy();
  }
}

// 직접 실행 시에만 동작
if (require.main === module) {
  yourScript();
}
```

4. **package.json에 추가**:
```json
{
  "scripts": {
    "your:script": "ts-node scripts/your-script.ts"
  }
}
```

### 베스트 프랙티스

1. **명확한 로깅**: 각 단계별로 진행 상황 출력
2. **에러 처리**: try-catch로 에러 처리 및 명확한 에러 메시지
3. **정리 작업**: finally 블록에서 연결 종료
4. **확인 메시지**: 위험한 작업 전 사용자 확인 (production 환경)
5. **백업**: 데이터 변경 전 백업 생성

## 주의사항

1. **프로덕션 환경**:
   - `clean:all`은 절대 사용 금지
   - 마이그레이션 전 반드시 백업
   - 점검 시간에만 실행

2. **개발 환경**:
   - 주기적으로 clean:all로 깨끗한 상태 유지
   - 테스트 후 데이터 정리

3. **성능 고려사항**:
   - 대용량 구역의 경우 slot 초기화에 시간 소요
   - Redis 메모리 사용량 모니터링 필요

## 문제 해결

### "Database connection failed" 에러
- PostgreSQL 서버 실행 확인
- .env 파일의 DB 설정 확인
- docker-compose up -d 실행 확인

### "Redis connection failed" 에러
- Redis 서버 실행 확인
- .env 파일의 Redis 설정 확인
- Redis 메모리 부족 확인

### 마이그레이션 실패
- 충분한 Redis 메모리 확인
- 기존 데이터 백업 확인
- 로그에서 구체적인 에러 확인