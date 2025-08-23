# API Documentation - 자율석 예매 시스템

## Base URL
```
http://localhost:3000/api
```

## Authentication
현재는 간단한 userId 기반으로 동작합니다. 실제 운영 환경에서는 JWT 등의 인증 메커니즘이 필요합니다.

## Endpoints

### Sections (구역)

#### Get Available Sections
```http
GET /sections/available
```

예약 가능한 모든 구역과 실시간 잔여석 정보를 조회합니다.

**Response:**
```json
{
  "success": true,
  "data": {
    "sections": [
      {
        "id": "uuid",
        "name": "1층 스탠딩",
        "description": "무대 앞 스탠딩 구역",
        "totalCapacity": 500,
        "currentOccupancy": 150,
        "availableSeats": 350,
        "status": "open",
        "price": 150000,
        "location": "1층 중앙"
      }
    ],
    "count": 4
  }
}
```

#### Get Section by ID
```http
GET /sections/{id}
```

특정 구역의 상세 정보와 실시간 잔여석을 조회합니다.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "1층 스탠딩",
    "description": "무대 앞 스탠딩 구역",
    "totalCapacity": 500,
    "currentOccupancy": 150,
    "availableSeats": 350,
    "status": "open",
    "price": 150000,
    "location": "1층 중앙"
  }
}
```

#### Get Section Statistics
```http
GET /sections/stats
```

모든 구역의 점유율 통계를 조회합니다.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "1층 스탠딩",
      "totalCapacity": 500,
      "currentOccupancy": 150,
      "availableSeats": 350,
      "occupancyRate": 30.00
    }
  ]
}
```

#### Create Section (Admin)
```http
POST /sections
```

새로운 구역을 생성합니다.

**Request Body:**
```json
{
  "name": "VIP 라운지",
  "description": "프리미엄 라운지 구역",
  "totalCapacity": 50,
  "price": 300000,
  "location": "2층 VIP"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "VIP 라운지",
    "totalCapacity": 50,
    "currentOccupancy": 0,
    "status": "open"
  }
}
```

#### Update Section Status
```http
PATCH /sections/{id}/status
```

구역의 상태를 변경합니다.

**Request Body:**
```json
{
  "status": "closed"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "VIP 라운지",
    "status": "closed"
  }
}
```

**Available Status Values:**
- `open`: 예약 가능
- `closed`: 예약 불가
- `sold_out`: 매진

### Reservations

#### Create Reservation
```http
POST /reservations
```

구역에 대한 예약을 생성합니다.

**Request Body:**
```json
{
  "sectionId": "section-uuid",
  "quantity": 3,
  "userId": "user-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "reservation-uuid",
    "userId": "user-uuid",
    "sectionId": "section-uuid",
    "quantity": 3,
    "status": "pending",
    "confirmationCode": "AB12CD34",
    "totalPrice": 450000,
    "expiresAt": "2024-01-01T12:15:00Z",
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

#### Confirm Reservation
```http
POST /reservations/{id}/confirm
```

예약을 최종 확정합니다.

**Request Body:**
```json
{
  "userId": "user-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "reservation-uuid",
    "status": "confirmed",
    "confirmedAt": "2024-01-01T12:05:00Z"
  }
}
```

#### Cancel Reservation
```http
POST /reservations/{id}/cancel
```

예약을 취소하고 좌석을 반환합니다.

**Request Body:**
```json
{
  "userId": "user-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "reservation-uuid",
    "status": "cancelled",
    "cancelledAt": "2024-01-01T12:05:00Z"
  }
}
```

#### Get User Reservations
```http
GET /reservations/user?userId={userId}&status={status}
```

사용자의 예약 목록을 조회합니다.

**Query Parameters:**
- `userId` (required): 사용자 ID
- `status` (optional): 예약 상태 필터 (pending, confirmed, cancelled, expired)

**Response:**
```json
{
  "success": true,
  "data": {
    "reservations": [
      {
        "id": "reservation-uuid",
        "quantity": 2,
        "status": "confirmed",
        "totalPrice": 300000,
        "section": {
          "name": "1층 스탠딩",
          "location": "1층 중앙"
        },
        "createdAt": "2024-01-01T12:00:00Z"
      }
    ],
    "count": 1
  }
}
```

#### Get Reservation Statistics
```http
GET /reservations/stats?sectionId={sectionId}
```

예약 통계를 조회합니다.

**Query Parameters:**
- `sectionId` (optional): 특정 구역의 통계만 조회

**Response:**
```json
{
  "success": true,
  "data": {
    "pending": {
      "count": 5,
      "totalQuantity": 15
    },
    "confirmed": {
      "count": 20,
      "totalQuantity": 65
    },
    "cancelled": {
      "count": 3,
      "totalQuantity": 8
    }
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "Valid quantity is required (minimum 1)"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "message": "Section not found"
  }
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": {
    "message": "Not enough available seats"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "message": "Internal server error"
  }
}
```

## 예약 플로우

1. **구역 조회**: GET `/sections/available`로 예약 가능한 구역과 잔여석 확인
2. **예약 생성**: POST `/reservations`로 원하는 인원수만큼 예약 (15분 타임아웃)
3. **예약 확정**: POST `/reservations/{id}/confirm`로 최종 확정
4. **예약 취소**: 필요시 POST `/reservations/{id}/cancel`로 취소

## 특징

- **실시간 잔여석**: Redis 기반으로 밀리초 단위 응답
- **원자적 처리**: 동시 예약 시에도 오버부킹 없음
- **유연한 예약**: 1명부터 대량 예약까지 지원
- **자동 만료**: 15분 내 미확정 시 자동 취소
- **Slot 기반 시스템**: 1:1 좌석-슬롯 매핑으로 최대 동시성 보장 (선택적)

## Slot 기반 시스템

Slot 기반 시스템이 활성화되면 (`USE_SLOT_BASED_RESERVATION=true`), 각 좌석이 독립적인 슬롯으로 관리됩니다:

- **1:1 매핑**: 하나의 슬롯이 하나의 좌석을 대표
- **병렬 처리**: 좌석 수만큼 동시 예약 가능
- **Lock-free**: 원자적 연산으로 경합 없이 처리
- **자동 정리**: 만료된 슬롯 자동 해제