export const clz32 = Math.clz32 ? Math.clz32 : clz32Fallback;

// Count leading zeros.
// Based on:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32
const log = Math.log;
const LN2 = Math.LN2;

function clz32Fallback(x: number): number {
  const asUint = x >>> 0;
  if (asUint === 0) {
    return 32;
  }
  return (31 - ((log(asUint) / LN2) | 0)) | 0;
}

class SlotAllocator {
  private masks: Uint32Array;
  private readonly slotsPerMask = 32;
  private totalSlots: number;

  constructor(totalSlots: number) {
    this.totalSlots = totalSlots;
    const maskCount = Math.ceil(totalSlots / this.slotsPerMask);
    this.masks = new Uint32Array(maskCount);
  }

  private findFirstZeroBit(mask: number): number {
    const inverted = ~mask;
    if (inverted === 0) return -1;
    
    const isolatedBit = inverted & -inverted;
    return 31 - clz32(isolatedBit);
  }

  allocateSlot(): number {
    for (let i = 0; i < this.masks.length; i++) {
      const mask = this.masks[i];
      
      if (mask !== 0xFFFFFFFF) {
        const bitIndex = this.findFirstZeroBit(mask);
        if (bitIndex === -1) continue;
        
        const globalIndex = i * this.slotsPerMask + bitIndex;
        if (globalIndex >= this.totalSlots) return -1;
        
        this.masks[i] |= (1 << bitIndex);
        return globalIndex;
      }
    }
    return -1;
  }

  freeSlot(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.totalSlots) return false;
    
    const maskIndex = Math.floor(slotIndex / this.slotsPerMask);
    const bitIndex = slotIndex % this.slotsPerMask;
    
    const isAllocated = (this.masks[maskIndex] & (1 << bitIndex)) !== 0;
    if (isAllocated) {
      this.masks[maskIndex] &= ~(1 << bitIndex);
      return true;
    }
    return false;
  }

  isSlotFree(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.totalSlots) return false;
    
    const maskIndex = Math.floor(slotIndex / this.slotsPerMask);
    const bitIndex = slotIndex % this.slotsPerMask;
    
    return (this.masks[maskIndex] & (1 << bitIndex)) === 0;
  }

  countFreeSlots(): number {
    let freeCount = 0;
    
    for (let i = 0; i < this.masks.length; i++) {
      const mask = this.masks[i];
      const usedBits = this.popcount(mask);
      
      if (i === this.masks.length - 1) {
        const slotsInLastMask = this.totalSlots % this.slotsPerMask || this.slotsPerMask;
        freeCount += slotsInLastMask - usedBits;
      } else {
        freeCount += this.slotsPerMask - usedBits;
      }
    }
    
    return freeCount;
  }

  private popcount(n: number): number {
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    return (((n + (n >>> 4)) & 0xF0F0F0F) * 0x1010101) >>> 24;
  }

  getAllocatedSlots(): number[] {
    const allocated: number[] = [];
    
    for (let i = 0; i < this.masks.length; i++) {
      const mask = this.masks[i];
      for (let bit = 0; bit < this.slotsPerMask; bit++) {
        if (mask & (1 << bit)) {
          const globalIndex = i * this.slotsPerMask + bit;
          if (globalIndex < this.totalSlots) {
            allocated.push(globalIndex);
          }
        }
      }
    }
    
    return allocated;
  }
}

// CLZ 테스트
console.log("=== CLZ32 Test ===");
for(let i = 0 ; i < 10 ; i++) {
  const num = 1 << i;
  console.log(`clz32(${num}):`, clz32(num));
}

// SlotAllocator 테스트
console.log("\n=== SlotAllocator Test ===");

const allocator = new SlotAllocator(100);
console.log("Initial free slots:", allocator.countFreeSlots());

// 슬롯 할당 테스트
const allocated: number[] = [];
for (let i = 0; i < 10; i++) {
  const slot = allocator.allocateSlot();
  if (slot !== -1) {
    allocated.push(slot);
    console.log(`Allocated slot: ${slot}`);
  }
}

console.log("Free slots after allocation:", allocator.countFreeSlots());
console.log("Allocated slots:", allocator.getAllocatedSlots());

// 슬롯 해제 테스트
console.log("\n=== Free Slot Test ===");
for (let i = 0; i < 5; i++) {
  const slotToFree = allocated[i];
  const freed = allocator.freeSlot(slotToFree);
  console.log(`Free slot ${slotToFree}: ${freed}`);
}

console.log("Free slots after freeing:", allocator.countFreeSlots());

// 성능 벤치마크
console.log("\n=== Performance Benchmark ===");

function benchmark(name: string, fn: () => void) {
  const start = performance.now();
  fn();
  const end = performance.now();
  console.log(`${name}: ${(end - start).toFixed(3)}ms`);
}

// 대규모 할당/해제 벤치마크
const largeSeatCount = 10000;
const largeAllocator = new SlotAllocator(largeSeatCount);

benchmark("Allocate 10,000 slots", () => {
  for (let i = 0; i < largeSeatCount; i++) {
    largeAllocator.allocateSlot();
  }
});

benchmark("Count free slots (when full)", () => {
  largeAllocator.countFreeSlots();
});

// 랜덤 패턴 테스트
const randomAllocator = new SlotAllocator(1000);
const randomSlots: number[] = [];

benchmark("Random allocate/free pattern (1000 ops)", () => {
  for (let i = 0; i < 1000; i++) {
    if (Math.random() > 0.5 && randomSlots.length > 0) {
      const idx = Math.floor(Math.random() * randomSlots.length);
      randomAllocator.freeSlot(randomSlots[idx]);
      randomSlots.splice(idx, 1);
    } else {
      const slot = randomAllocator.allocateSlot();
      if (slot !== -1) randomSlots.push(slot);
    }
  }
});

console.log("\n=== Edge Cases Test ===");

// 작은 크기 테스트
const tinyAllocator = new SlotAllocator(5);
console.log("Tiny allocator (5 slots):");
for (let i = 0; i < 7; i++) {
  const slot = tinyAllocator.allocateSlot();
  console.log(`Attempt ${i}: ${slot}`);
}

// 정확히 32개 테스트
const exact32Allocator = new SlotAllocator(32);
console.log("\nExact 32 slots allocator:");
for (let i = 0; i < 32; i++) {
  exact32Allocator.allocateSlot();
}
console.log("All 32 allocated, free count:", exact32Allocator.countFreeSlots());

// 33개 테스트 (2개 마스크 필요)
const multiMaskAllocator = new SlotAllocator(33);
console.log("\n33 slots allocator (needs 2 masks):");
for (let i = 0; i < 33; i++) {
  multiMaskAllocator.allocateSlot();
}
console.log("All 33 allocated, free count:", multiMaskAllocator.countFreeSlots());

// ===== 계층적 비트맵 할당자 =====
class HierarchicalBitmapAllocator {
  private topLevel: number = 0;  // 32비트: 각 비트가 하위 그룹의 가용성 표시
  private groups: Uint32Array;   // 각 그룹은 32개 슬롯 관리
  private totalSlots: number;
  private readonly SLOTS_PER_GROUP = 32;
  private readonly MAX_GROUPS = 32;

  constructor(totalSlots: number) {
    this.totalSlots = totalSlots;
    const groupCount = Math.min(
      Math.ceil(totalSlots / this.SLOTS_PER_GROUP),
      this.MAX_GROUPS
    );
    this.groups = new Uint32Array(groupCount);
    
    // 초기화: 모든 그룹을 사용 가능으로 표시
    this.topLevel = (1 << groupCount) - 1;
  }

  allocateSlot(): number {
    if (this.topLevel === 0) return -1; // 모든 그룹이 가득 참
    
    // 1단계: CLZ로 사용 가능한 첫 번째 그룹 찾기
    const groupIndex = 31 - clz32(this.topLevel);
    const groupMask = this.groups[groupIndex];
    
    if (groupMask === 0xFFFFFFFF) {
      // 이 그룹이 실제로는 가득 참 - topLevel 업데이트
      this.topLevel &= ~(1 << groupIndex);
      return this.allocateSlot(); // 재귀적으로 다시 시도
    }
    
    // 2단계: 그룹 내에서 빈 슬롯 찾기
    const inverted = ~groupMask;
    const isolatedBit = inverted & -inverted;
    const slotIndex = 31 - clz32(isolatedBit);
    
    const globalIndex = groupIndex * this.SLOTS_PER_GROUP + slotIndex;
    if (globalIndex >= this.totalSlots) return -1;
    
    // 슬롯 할당
    this.groups[groupIndex] |= (1 << slotIndex);
    
    // 그룹이 가득 찼으면 topLevel 업데이트
    if (this.groups[groupIndex] === 0xFFFFFFFF) {
      this.topLevel &= ~(1 << groupIndex);
    }
    
    return globalIndex;
  }

  freeSlot(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.totalSlots) return false;
    
    const groupIndex = Math.floor(slotIndex / this.SLOTS_PER_GROUP);
    const bitIndex = slotIndex % this.SLOTS_PER_GROUP;
    
    const wasAllocated = (this.groups[groupIndex] & (1 << bitIndex)) !== 0;
    if (!wasAllocated) return false;
    
    // 슬롯 해제
    this.groups[groupIndex] &= ~(1 << bitIndex);
    
    // 그룹이 이전에 가득 찼었다면 topLevel 업데이트
    this.topLevel |= (1 << groupIndex);
    
    return true;
  }

  countFreeSlots(): number {
    let freeCount = 0;
    
    for (let i = 0; i < this.groups.length; i++) {
      if ((this.topLevel & (1 << i)) !== 0) {
        const groupMask = this.groups[i];
        const usedBits = this.popcount(groupMask);
        
        if (i === this.groups.length - 1) {
          const slotsInLastGroup = this.totalSlots % this.SLOTS_PER_GROUP || this.SLOTS_PER_GROUP;
          freeCount += slotsInLastGroup - usedBits;
        } else {
          freeCount += this.SLOTS_PER_GROUP - usedBits;
        }
      }
    }
    
    return freeCount;
  }

  private popcount(n: number): number {
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    return (((n + (n >>> 4)) & 0xF0F0F0F) * 0x1010101) >>> 24;
  }
}

// De Bruijn 시퀀스를 사용한 비트 위치 찾기
const DeBruijnSequence = 0x077CB531;
const DeBruijnTable = [
  0, 1, 28, 2, 29, 14, 24, 3, 30, 22, 20, 15, 25, 17, 4, 8,
  31, 27, 13, 23, 21, 19, 16, 7, 26, 12, 18, 6, 11, 5, 10, 9
];

function findFirstSetBitDeBruijn(n: number): number {
  if (n === 0) return -1;
  const isolated = n & -n;
  return DeBruijnTable[(isolated * DeBruijnSequence) >>> 27];
}

// ===== 구역별 좌석 할당자 =====
interface SeatSection {
  name: string;
  bitmap: Uint32Array;
  capacity: number;
  preferenceScore: number;
  priceMultiplier: number;
  lastAllocatedIndex: number;
}

class SectionedSeatAllocator {
  private sections: Map<string, SeatSection> = new Map();
  private totalCapacity: number = 0;

  addSection(name: string, capacity: number, preferenceScore: number, priceMultiplier: number = 1.0) {
    const maskCount = Math.ceil(capacity / 32);
    this.sections.set(name, {
      name,
      bitmap: new Uint32Array(maskCount),
      capacity,
      preferenceScore,
      priceMultiplier,
      lastAllocatedIndex: 0
    });
    this.totalCapacity += capacity;
  }

  allocateBestSeat(): { section: string; seatNumber: number } | null {
    // 선호도 순으로 정렬된 섹션들
    const sortedSections = Array.from(this.sections.values())
      .sort((a, b) => b.preferenceScore - a.preferenceScore);
    
    for (const section of sortedSections) {
      const seatIndex = this.allocateInSection(section);
      if (seatIndex !== -1) {
        return { section: section.name, seatNumber: seatIndex };
      }
    }
    
    return null;
  }

  private allocateInSection(section: SeatSection): number {
    // 마지막 할당 위치부터 검색 (캐시 효과)
    const startMask = Math.floor(section.lastAllocatedIndex / 32);
    
    for (let i = startMask; i < section.bitmap.length; i++) {
      const mask = section.bitmap[i];
      if (mask !== 0xFFFFFFFF) {
        const bitIndex = findFirstSetBitDeBruijn(~mask);
        if (bitIndex === -1) continue;
        
        const globalIndex = i * 32 + bitIndex;
        if (globalIndex >= section.capacity) break;
        
        section.bitmap[i] |= (1 << bitIndex);
        section.lastAllocatedIndex = globalIndex;
        return globalIndex;
      }
    }
    
    // 처음부터 다시 검색
    if (startMask > 0) {
      for (let i = 0; i < startMask; i++) {
        const mask = section.bitmap[i];
        if (mask !== 0xFFFFFFFF) {
          const bitIndex = findFirstSetBitDeBruijn(~mask);
          if (bitIndex === -1) continue;
          
          const globalIndex = i * 32 + bitIndex;
          section.bitmap[i] |= (1 << bitIndex);
          section.lastAllocatedIndex = globalIndex;
          return globalIndex;
        }
      }
    }
    
    return -1;
  }

  allocateAdjacentSeats(section: string, count: number): number[] | null {
    const sectionData = this.sections.get(section);
    if (!sectionData) return null;
    
    const seats: number[] = [];
    
    // 연속된 빈 좌석 찾기
    for (let i = 0; i < sectionData.bitmap.length; i++) {
      const mask = sectionData.bitmap[i];
      let consecutive = 0;
      let startBit = -1;
      
      for (let bit = 0; bit < 32; bit++) {
        const globalIndex = i * 32 + bit;
        if (globalIndex >= sectionData.capacity) break;
        
        if ((mask & (1 << bit)) === 0) {
          if (startBit === -1) startBit = bit;
          consecutive++;
          
          if (consecutive === count) {
            // 연속된 좌석 찾음 - 할당
            for (let j = 0; j < count; j++) {
              const allocBit = startBit + j;
              sectionData.bitmap[i] |= (1 << allocBit);
              seats.push(i * 32 + allocBit);
            }
            return seats;
          }
        } else {
          consecutive = 0;
          startBit = -1;
        }
      }
    }
    
    return null;
  }

  getOccupancyRate(section?: string): number {
    if (section) {
      const sectionData = this.sections.get(section);
      if (!sectionData) return 0;
      
      let allocated = 0;
      for (let i = 0; i < sectionData.bitmap.length; i++) {
        allocated += this.popcount(sectionData.bitmap[i]);
      }
      return (allocated / sectionData.capacity) * 100;
    } else {
      let totalAllocated = 0;
      for (const sectionData of this.sections.values()) {
        for (let i = 0; i < sectionData.bitmap.length; i++) {
          totalAllocated += this.popcount(sectionData.bitmap[i]);
        }
      }
      return (totalAllocated / this.totalCapacity) * 100;
    }
  }

  private popcount(n: number): number {
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    return (((n + (n >>> 4)) & 0xF0F0F0F) * 0x1010101) >>> 24;
  }
}

// ===== 성능 비교 테스트 =====
console.log("\n\n=== Hierarchical Bitmap Test ===");

const hierarchical = new HierarchicalBitmapAllocator(1000);
console.log("Hierarchical allocator with 1000 slots");

// 연속 할당 테스트
const hierSlots: number[] = [];
for (let i = 0; i < 50; i++) {
  const slot = hierarchical.allocateSlot();
  if (slot !== -1) hierSlots.push(slot);
}
console.log("Allocated 50 slots:", hierSlots.slice(0, 10), "...");
console.log("Free slots:", hierarchical.countFreeSlots());

// 일부 해제 후 재할당
for (let i = 0; i < 25; i++) {
  hierarchical.freeSlot(hierSlots[i]);
}
console.log("After freeing 25 slots, free count:", hierarchical.countFreeSlots());

// 성능 비교: 기본 vs 계층적
console.log("\n=== Performance Comparison: Basic vs Hierarchical ===");

const compareSize = 50000;
const basic50k = new SlotAllocator(compareSize);
const hier50k = new HierarchicalBitmapAllocator(compareSize);

benchmark("Basic allocator - allocate 50,000", () => {
  for (let i = 0; i < compareSize; i++) {
    basic50k.allocateSlot();
  }
});

benchmark("Hierarchical allocator - allocate 50,000", () => {
  for (let i = 0; i < compareSize; i++) {
    hier50k.allocateSlot();
  }
});

// De Bruijn vs CLZ 비교
console.log("\n=== De Bruijn vs CLZ Performance ===");

const testNumbers = Array.from({ length: 100000 }, () => Math.floor(Math.random() * 0xFFFFFFFF));

benchmark("CLZ-based bit finding", () => {
  for (const num of testNumbers) {
    const inverted = ~num;
    if (inverted !== 0) {
      const isolated = inverted & -inverted;
      const position = 31 - clz32(isolated);
    }
  }
});

benchmark("De Bruijn bit finding", () => {
  for (const num of testNumbers) {
    findFirstSetBitDeBruijn(~num);
  }
});

// 구역별 좌석 할당 테스트
console.log("\n\n=== Sectioned Seat Allocator Test ===");

const theater = new SectionedSeatAllocator();

// 극장 구역 설정
theater.addSection("VIP", 100, 10, 2.0);        // 100석, 선호도 10, 2배 가격
theater.addSection("Premium", 300, 8, 1.5);     // 300석, 선호도 8, 1.5배 가격
theater.addSection("Standard", 500, 5, 1.0);    // 500석, 선호도 5, 기본 가격
theater.addSection("Economy", 200, 3, 0.8);     // 200석, 선호도 3, 0.8배 가격

console.log("Theater configured with 4 sections, total capacity: 1100");

// 최고 좌석 할당 테스트
console.log("\nBest seat allocation test:");
for (let i = 0; i < 10; i++) {
  const seat = theater.allocateBestSeat();
  if (seat) {
    console.log(`Allocated: ${seat.section} - Seat ${seat.seatNumber}`);
  }
}

// 인접 좌석 할당 테스트
console.log("\nAdjacent seats allocation test:");
const adjacentVIP = theater.allocateAdjacentSeats("VIP", 4);
console.log("4 adjacent VIP seats:", adjacentVIP);

const adjacentStandard = theater.allocateAdjacentSeats("Standard", 6);
console.log("6 adjacent Standard seats:", adjacentStandard);

// 점유율 확인
console.log("\nOccupancy rates:");
console.log("VIP section:", theater.getOccupancyRate("VIP").toFixed(1) + "%");
console.log("Overall theater:", theater.getOccupancyRate().toFixed(1) + "%");

// 실제 예매 패턴 시뮬레이션
console.log("\n=== Real Booking Pattern Simulation ===");

const bookingSimulator = new SectionedSeatAllocator();
bookingSimulator.addSection("Orchestra", 500, 10, 2.5);
bookingSimulator.addSection("Mezzanine", 400, 8, 2.0);
bookingSimulator.addSection("Balcony", 300, 5, 1.5);
bookingSimulator.addSection("Gallery", 200, 3, 1.0);

// 예매 패턴: 초기에는 좋은 좌석 위주, 후반에는 가격 고려
let bookings = 0;
const startTime = performance.now();

// Phase 1: 초기 예매 (좋은 좌석 선호)
for (let i = 0; i < 500; i++) {
  if (Math.random() < 0.3) {
    // 30% 확률로 그룹 예매
    const groupSize = 2 + Math.floor(Math.random() * 4);
    const section = Math.random() < 0.7 ? "Orchestra" : "Mezzanine";
    const seats = bookingSimulator.allocateAdjacentSeats(section, groupSize);
    if (seats) bookings += groupSize;
  } else {
    // 70% 확률로 개인 예매
    const seat = bookingSimulator.allocateBestSeat();
    if (seat) bookings++;
  }
}

// Phase 2: 중간 예매 (다양한 선택)
for (let i = 0; i < 300; i++) {
  const seat = bookingSimulator.allocateBestSeat();
  if (seat) bookings++;
}

// Phase 3: 후기 예매 (남은 좌석)
for (let i = 0; i < 200; i++) {
  const sections = ["Balcony", "Gallery"];
  const section = sections[Math.floor(Math.random() * sections.length)];
  const seats = bookingSimulator.allocateAdjacentSeats(section, 2);
  if (seats) bookings += 2;
}

const endTime = performance.now();

console.log(`\nSimulation complete:`);
console.log(`Total bookings: ${bookings}`);
console.log(`Time taken: ${(endTime - startTime).toFixed(2)}ms`);
console.log(`\nFinal occupancy rates:`);
console.log(`Orchestra: ${bookingSimulator.getOccupancyRate("Orchestra").toFixed(1)}%`);
console.log(`Mezzanine: ${bookingSimulator.getOccupancyRate("Mezzanine").toFixed(1)}%`);
console.log(`Balcony: ${bookingSimulator.getOccupancyRate("Balcony").toFixed(1)}%`);
console.log(`Gallery: ${bookingSimulator.getOccupancyRate("Gallery").toFixed(1)}%`);
console.log(`Overall: ${bookingSimulator.getOccupancyRate().toFixed(1)}%`);
