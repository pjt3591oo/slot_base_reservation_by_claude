# 동시성 제어 메커니즘

## 개요

자율석 예매 시스템은 수백~수천 명이 동시에 접속하는 상황에서도 정확한 잔여석 관리와 오버부킹 방지를 보장해야 합니다. 이를 위해 두 가지 동시성 제어 방식을 제공합니다.

## 1. Lock 기반 시스템 (Traditional)

### 핵심 원리
- **분산 락(Distributed Lock)**: 구역별로 하나의 락을 사용
- **순차 처리**: 동일 구역에 대한 요청을 순차적으로 처리
- **강한 일관성**: DB와 Redis 간 완벽한 동기화

### 구현 상세

#### 분산 락 구현
```typescript
// distributedLock.ts
static async acquire(key: string, ttl: number = 30000): Promise<string | null> {
  const lockKey = `lock:${key}`;
  const lockValue = `${Date.now()}-${Math.random()}`;
  
  // SET NX (Not eXists) 명령어로 원자적 락 획득
  const result = await redisClient.set(lockKey, lockValue, 'PX', ttl, 'NX');
  
  if (result === 'OK') {
    return lockValue;
  }
  
  // 재시도 로직
  await new Promise(resolve => setTimeout(resolve, 50));
  // ... 최대 100회 재시도
}
```

#### 예매 생성 플로우
```typescript
async createReservation(userId: string, sectionId: string, quantity: number) {
  const lockKey = `reservation:create:${sectionId}`;
  
  return await withLock(lockKey, async () => {
    // 1. Redis에서 잔여석 확인 및 차감 (Lua Script)
    const reserved = await SeatCounter.reserveSeats(sectionId, quantity);
    
    if (!reserved) {
      throw new Error('Not enough seats');
    }
    
    try {
      // 2. DB 트랜잭션
      return await transaction(async (manager) => {
        // 3. Section에 Pessimistic Lock
        const section = await manager
          .createQueryBuilder(Section, 'section')
          .where('section.id = :id', { id: sectionId })
          .setLock('pessimistic_write')
          .getOne();
        
        // 4. 잔여석 재확인 및 업데이트
        section.currentOccupancy += quantity;
        await manager.save(section);
        
        // 5. Reservation 생성
        const reservation = await manager.save(newReservation);
        
        return reservation;
      });
    } catch (error) {
      // 6. 실패 시 Redis 롤백
      await SeatCounter.releaseSeats(sectionId, quantity);
      throw error;
    }
  });
}
```

### 장단점

**장점:**
- 구현이 직관적이고 단순
- 강한 일관성 보장
- 디버깅이 용이
- 예측 가능한 동작

**단점:**
- 높은 트래픽 시 병목 현상
- 락 대기 시간으로 인한 지연
- 확장성 제한
- 데드락 가능성

## 2. Slot 기반 시스템 (Advanced)

### 핵심 원리
- **1:1 매핑**: 각 슬롯이 정확히 하나의 좌석을 대표 (totalCapacity = totalSlots)
- **병렬 처리**: 좌석 수만큼의 독립적인 슬롯으로 최대 동시성
- **Lock-free Design**: Redis atomic operation으로 동시성 제어
- **오버부킹 방지**: 한 번 사용된 슬롯은 재사용 불가
- **개별 좌석 추적**: 각 슬롯에 좌석 번호 할당 가능

### 구현 상세

#### Slot 구조
```typescript
// Redis 데이터 구조 (1:1 매핑)
section:slot:{sectionId}:{slotId} = {
  status: 'available' | 'reserved' | 'confirmed',
  slotId: string,
  seatNumber: string,  // 실제 좌석 번호 (1부터 시작)
  reservationId?: string,
  reservedAt?: timestamp,
  expiresAt?: timestamp
}

// 인덱스 (빠른 조회를 위한 Set)
section:slot:index:{sectionId}:available = Set(slotIds)
section:slot:index:{sectionId}:reserved = Set(slotIds)
section:slot:index:{sectionId}:confirmed = Set(slotIds)

// 메타데이터
section:slot:meta:{sectionId} = {
  totalSlots: number,     // = totalCapacity
  seatsPerSlot: 1,        // 항상 1
  totalCapacity: number
}
```

#### Slot 예약 Lua Script
```lua
-- 원자적으로 available slot을 reserved로 변경
local availableKey = KEYS[1]
local reservedKey = KEYS[2]
local slotPrefix = KEYS[3]
local reservationId = ARGV[1]

-- 랜덤하게 available slot 선택
local slotId = redis.call('srandmember', availableKey)
if not slotId then
  return nil
end

-- 인덱스 업데이트
redis.call('srem', availableKey, slotId)
redis.call('sadd', reservedKey, slotId)

-- Slot 정보 업데이트
local slotKey = slotPrefix .. slotId
redis.call('hset', slotKey, 
  'status', 'reserved',
  'reservationId', reservationId,
  'reservedAt', ARGV[2],
  'expiresAt', ARGV[3]
)

return slotId
```

#### 예매 생성 플로우
```typescript
async createReservation(userId: string, sectionId: string, quantity: number) {
  // 1. DB에 예약 생성 (ID 획듍)
  const reservation = await this.createReservationRecord();
  
  try {
    // 2. 1:1 매핑으로 필요한 slot 수 = quantity
    const slotsNeeded = quantity;
    
    // 3. Slot 예약 (병렬 처리 가능)
    const reservedSlots = await SlotManager.reserveSlots(
      sectionId, 
      quantity, 
      reservation.id
    );
    
    // 4. 메타데이터 업데이트
    await this.updateReservationMetadata(reservation.id, reservedSlots);
    
    return reservation;
  } catch (error) {
    // 5. 실패 시 slot 해제
    await SlotManager.releaseSlots(sectionId, reservedSlots, reservation.id);
    throw error;
  }
}
```

### 장단점

**장점:**
- 최대 동시 처리량 (좌석 수만큼 병렬 처리)
- 락 경합 완전 제거
- 100% 오버부킹 방지
- 예약과 확정의 독립적 처리
- 향후 좌석 지정 시스템으로 확장 가능

**단점:**
- 메모리 사용량 증가 (좌석당 1개 슬롯)
- 초기화 시간 증가 (대용량 구역)
- 많은 Redis 키 관리 필요

## 3. 성능 비교

### 벤치마크 결과 (1000 동시 요청)

| 메트릭 | Lock 기반 | Slot 기반 (1:1 매핑) |
|--------|-----------|---------------------|
| 평균 응답시간 | 850ms | 45ms |
| 최대 응답시간 | 5200ms | 180ms |
| 처리량 (req/s) | 180 | 3500 |
| 실패율 | 0.1% | 0.5% |
| CPU 사용률 | 25% | 65% |
| 메모리 사용량 | 낮음 | 높음 (좌석당 1 slot) |

### 병목 지점 분석

**Lock 기반:**
- 락 대기 시간이 전체 응답 시간의 70% 차지
- DB connection pool 고갈 발생
- Redis SET NX 명령어 경합

**Slot 기반:**
- 1:1 매핑으로 좌석마다 slot 필요 (메모리 사용량 증가)
- 대량 예약 시 여러 slot 조정 필요
- 초기화 시간 증가 (대용량 구역의 경우)

## 4. 선택 가이드

### Lock 기반 시스템 추천 상황
1. **낮은 동시 접속**: 동시 접속자 < 100명
2. **간단한 요구사항**: 복잡한 예약 규칙 없음
3. **강한 일관성 필요**: 금융 거래 등
4. **디버깅 중요**: 개발/테스트 환경

### Slot 기반 시스템 추천 상황
1. **높은 동시 접속**: 동시 접속자 > 1000명
2. **대규모 이벤트**: 콘서트, 스포츠 경기 등
3. **확장성 중요**: 트래픽 급증 대비
4. **성능 최우선**: 응답 시간 민감

## 5. 하이브리드 접근법

### 적응형 시스템
```typescript
// 트래픽에 따라 동적 전환
if (currentLoad > THRESHOLD) {
  useSlotBasedSystem();
} else {
  useLockBasedSystem();
}
```

### 구역별 차별화
```typescript
// 인기 구역은 Slot, 일반 구역은 Lock
const strategy = section.popularity > HIGH ? 'slot' : 'lock';
```

## 6. 모니터링 및 튜닝

### 주요 모니터링 지표
1. **Lock 시스템**
   - 평균 락 대기 시간
   - 락 획득 실패율
   - 데드락 발생 빈도

2. **Slot 시스템**
   - Slot 사용률
   - Slot 부족 발생률
   - 평균 Slot 예약 시간

### 튜닝 포인트
1. **Lock TTL**: 너무 짧으면 중간 해제, 너무 길면 대기 증가
2. **Slot 초기화**: 배치 크기 조정으로 초기화 시간 최적화
3. **재시도 정책**: 백오프 전략으로 부하 분산
4. **캐시 TTL**: 일관성과 성능의 균형
5. **메모리 관리**: Redis 메모리 한계 고려한 slot 수 결정