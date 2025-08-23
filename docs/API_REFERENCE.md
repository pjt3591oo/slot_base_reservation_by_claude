# API Reference

## Base URL
```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication
현재는 `userId`를 요청 파라미터로 전달하는 방식을 사용합니다.
프로덕션에서는 JWT 토큰 기반 인증을 구현해야 합니다.

## Endpoints

### 1. Sections (구역)

#### Get Available Sections
구매 가능한 모든 구역 목록을 조회합니다.

```http
GET /sections/available
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sections": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "1층 스탠딩 A구역",
        "description": "무대 앞 중앙 스탠딩 구역",
        "totalCapacity": 300,
        "currentOccupancy": 120,
        "availableSeats": 180,
        "status": "open",
        "price": 180000,
        "location": "1층 중앙 앞"
      }
    ],
    "count": 12
  }
}
```

#### Get Section by ID
특정 구역의 상세 정보를 조회합니다.

```http
GET /sections/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "1층 스탠딩 A구역",
    "totalCapacity": 300,
    "currentOccupancy": 120,
    "availableSeats": 180,
    "status": "open",
    "price": 180000
  }
}
```

#### Get Section Statistics
구역별 예약 통계를 조회합니다.

```http
GET /sections/stats
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "1층 스탠딩 A구역",
      "totalCapacity": 300,
      "currentOccupancy": 120,
      "availableSeats": 180,
      "occupancyRate": 40.00
    }
  ]
}
```

#### Create Section
새로운 구역을 생성합니다. (관리자 전용)

```http
POST /sections
Content-Type: application/json

{
  "name": "4층 발코니석",
  "description": "4층 발코니 구역",
  "totalCapacity": 100,
  "price": 70000,
  "location": "4층 좌측",
  "status": "open"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "750e8400-e29b-41d4-a716-446655440003",
    "name": "4층 발코니석",
    "description": "4층 발코니 구역",
    "totalCapacity": 100,
    "currentOccupancy": 0,
    "price": 70000,
    "location": "4층 좌측",
    "status": "open",
    "createdAt": "2024-08-23T10:00:00.000Z"
  }
}
```

#### Update Section Status
구역의 상태를 변경합니다. (관리자 전용)

```http
PATCH /sections/:id/status
Content-Type: application/json

{
  "status": "maintenance"
}
```

**Status Values:**
- `open`: 예약 가능
- `closed`: 예약 불가
- `maintenance`: 유지보수 중

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "maintenance",
    "updatedAt": "2024-08-23T11:00:00.000Z"
  }
}
```

### 2. Reservations (예약)

#### Create Reservation
새로운 예약을 생성합니다.

```http
POST /reservations
Content-Type: application/json

{
  "sectionId": "550e8400-e29b-41d4-a716-446655440001",
  "quantity": 2,
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "650e8400-e29b-41d4-a716-446655440002",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "sectionId": "550e8400-e29b-41d4-a716-446655440001",
    "quantity": 2,
    "status": "pending",
    "confirmationCode": "A1B2C3D4",
    "totalPrice": 360000,
    "expiresAt": "2024-08-23T10:30:00.000Z",
    "createdAt": "2024-08-23T10:15:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: 잔여석 부족, 잘못된 수량
- `404 Not Found`: 구역을 찾을 수 없음
- `500 Internal Server Error`: 서버 오류

#### Confirm Reservation
대기 중인 예약을 확정합니다.

```http
POST /reservations/:id/confirm
Content-Type: application/json

{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "650e8400-e29b-41d4-a716-446655440002",
    "status": "confirmed",
    "confirmedAt": "2024-08-23T10:20:00.000Z",
    "confirmationCode": "A1B2C3D4"
  }
}
```

**Error Responses:**
- `400 Bad Request`: 이미 확정됨, 만료됨
- `403 Forbidden`: 권한 없음
- `404 Not Found`: 예약을 찾을 수 없음

#### Cancel Reservation
예약을 취소합니다.

```http
POST /reservations/:id/cancel
Content-Type: application/json

{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "650e8400-e29b-41d4-a716-446655440002",
    "status": "cancelled",
    "cancelledAt": "2024-08-23T10:25:00.000Z"
  }
}
```

#### Get Reservation by ID
특정 예약의 상세 정보를 조회합니다.

```http
GET /reservations/:id?userId=550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "650e8400-e29b-41d4-a716-446655440002",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "section": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "1층 스탠딩 A구역",
      "price": 180000
    },
    "quantity": 2,
    "status": "confirmed",
    "confirmationCode": "A1B2C3D4",
    "totalPrice": 360000,
    "confirmedAt": "2024-08-23T10:20:00.000Z"
  }
}
```

#### Get User Reservations
사용자의 모든 예약을 조회합니다.

```http
GET /reservations/user?userId=550e8400-e29b-41d4-a716-446655440000&status=confirmed
```

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
        "id": "650e8400-e29b-41d4-a716-446655440002",
        "section": {
          "name": "1층 스탠딩 A구역"
        },
        "quantity": 2,
        "status": "confirmed",
        "totalPrice": 360000,
        "confirmedAt": "2024-08-23T10:20:00.000Z"
      }
    ],
    "count": 1
  }
}
```

#### Get Reservation Statistics
예약 통계를 조회합니다.

```http
GET /reservations/stats?sectionId=550e8400-e29b-41d4-a716-446655440001
```

**Query Parameters:**
- `sectionId` (optional): 특정 구역의 통계만 조회

**Response:**
```json
{
  "success": true,
  "data": {
    "pending": {
      "count": 15,
      "totalQuantity": 32
    },
    "confirmed": {
      "count": 120,
      "totalQuantity": 280
    },
    "cancelled": {
      "count": 25,
      "totalQuantity": 45
    },
    "expired": {
      "count": 10,
      "totalQuantity": 18
    }
  }
}
```

## Error Responses

모든 에러 응답은 다음 형식을 따릅니다:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "stack": "..." // Development mode only
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR`: 입력값 검증 실패
- `NOT_FOUND`: 리소스를 찾을 수 없음
- `UNAUTHORIZED`: 인증 필요
- `FORBIDDEN`: 권한 없음
- `CONFLICT`: 리소스 충돌 (예: 중복 예약)
- `INTERNAL_ERROR`: 서버 내부 오류

## Rate Limiting

프로덕션 환경에서는 다음 제한이 적용됩니다:
- 일반 API: 100 requests/minute per IP
- 예약 생성: 10 requests/minute per user
- 통계 조회: 30 requests/minute per IP

## Webhook Events (Future)

예약 상태 변경 시 웹훅 이벤트를 발송할 예정입니다:

```json
{
  "event": "reservation.confirmed",
  "data": {
    "reservationId": "650e8400-e29b-41d4-a716-446655440002",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "confirmed",
    "timestamp": "2024-08-23T10:20:00.000Z"
  }
}
```

### Event Types
- `reservation.created`
- `reservation.confirmed`
- `reservation.cancelled`
- `reservation.expired`

## SDK Examples

### JavaScript/TypeScript
```typescript
import { ReservationAPI } from '@your-org/reservation-sdk';

const api = new ReservationAPI({
  baseURL: 'http://localhost:3000/api',
  userId: '550e8400-e29b-41d4-a716-446655440000'
});

// 구역 조회
const sections = await api.sections.getAvailable();

// 예약 생성
const reservation = await api.reservations.create({
  sectionId: sections[0].id,
  quantity: 2
});

// 예약 확정
await api.reservations.confirm(reservation.id);
```

### cURL
```bash
# 구역 조회
curl -X GET http://localhost:3000/api/sections/available

# 예약 생성
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "sectionId": "550e8400-e29b-41d4-a716-446655440001",
    "quantity": 2,
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }'

# 예약 확정
curl -X POST http://localhost:3000/api/reservations/650e8400-e29b-41d4-a716-446655440002/confirm \
  -H "Content-Type: application/json" \
  -d '{"userId": "550e8400-e29b-41d4-a716-446655440000"}'
```