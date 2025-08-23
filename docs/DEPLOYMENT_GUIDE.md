# 배포 가이드

## 환경 구성

### 1. 시스템 요구사항

**최소 사양 (동시 접속 ~1000명)**
- CPU: 4 cores
- RAM: 8GB
- Storage: 50GB SSD
- Network: 100Mbps

**권장 사양 (동시 접속 ~10000명)**
- CPU: 16 cores
- RAM: 32GB
- Storage: 200GB SSD
- Network: 1Gbps

### 2. 필수 소프트웨어
- Node.js 18.x or higher
- PostgreSQL 14.x or higher
- Redis 7.x or higher
- Nginx (reverse proxy)
- PM2 (process manager)

## 프로덕션 환경 설정

### 1. 환경 변수 (.env.production)
```env
# Server
NODE_ENV=production
PORT=3000

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_USERNAME=prod_user
DB_PASSWORD=strong_password
DB_DATABASE=seat_reservation
DB_SSL=true
DB_POOL_MIN=10
DB_POOL_MAX=50

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_CLUSTER_MODE=true

# Security
JWT_SECRET=your-very-long-random-string
CORS_ORIGIN=https://your-domain.com

# Performance
RESERVATION_TIMEOUT_MINUTES=15
EXPIRED_RESERVATIONS_CHECK_INTERVAL=300000

# Slot System (고트래픽 환경)
USE_SLOT_BASED_RESERVATION=true
DEFAULT_SLOTS_PER_SECTION=50
ENABLE_PARALLEL_SLOT_RESERVATION=true
SLOT_RESERVATION_TIMEOUT=900
ENABLE_AUTO_SLOT_CLEANUP=true
```

### 2. 데이터베이스 최적화

#### PostgreSQL 설정 (postgresql.conf)
```ini
# Connection Settings
max_connections = 200
shared_buffers = 4GB
effective_cache_size = 12GB

# Query Planner
random_page_cost = 1.1
effective_io_concurrency = 200

# Write Performance
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

# Logging
log_duration = on
log_statement = 'mod'
```

#### 인덱스 생성
```sql
-- 예약 조회 성능 향상
CREATE INDEX idx_reservations_user_status ON reservations(user_id, status);
CREATE INDEX idx_reservations_section_status ON reservations(section_id, status);
CREATE INDEX idx_reservations_expires_at ON reservations(expires_at) WHERE status = 'pending';

-- 구역 조회 성능 향상
CREATE INDEX idx_sections_status ON sections(status);
CREATE INDEX idx_sections_occupancy ON sections(current_occupancy, total_capacity);
```

### 3. Redis 최적화

#### Redis 설정 (redis.conf)
```ini
# Memory
maxmemory 4gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Performance
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Cluster (고가용성)
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000
```

## 배포 프로세스

### 1. 코드 빌드
```bash
# 백엔드 빌드
npm run build

# 프론트엔드 빌드
cd client
npm run build
```

### 2. PM2 설정 (ecosystem.config.js)
```javascript
module.exports = {
  apps: [{
    name: 'seat-reservation-api',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 3. Nginx 설정
```nginx
upstream api_servers {
    least_conn;
    server 127.0.0.1:3000 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3002 weight=1 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # API
    location /api {
        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static Files
    location / {
        root /var/www/seat-reservation/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### 4. 시스템 서비스 설정
```bash
# PM2 시작
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Nginx 재시작
sudo systemctl restart nginx
```

## 모니터링

### 1. Health Check Endpoint
```typescript
// health.controller.ts
app.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'OK',
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      memory: process.memoryUsage(),
    }
  };
  
  res.status(200).json(health);
});
```

### 2. Prometheus Metrics
```typescript
// metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

export const reservationCounter = new Counter({
  name: 'reservations_total',
  help: 'Total number of reservations',
  labelNames: ['status']
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});
```

### 3. 로그 수집 (Winston)
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

## 성능 튜닝

### 1. Node.js 최적화
```bash
# 메모리 할당 증가
NODE_OPTIONS="--max-old-space-size=4096"

# UV 스레드 풀 크기 조정
UV_THREADPOOL_SIZE=128
```

### 2. 데이터베이스 커넥션 풀
```typescript
{
  type: 'postgres',
  // ... other config
  extra: {
    min: 10,
    max: 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
}
```

### 3. Redis 커넥션 풀
```typescript
{
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  lazyConnect: true,
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  }
}
```

## 보안 설정

### 1. Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

const reservationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests
  message: 'Too many reservation requests'
});

app.use('/api/reservations', reservationLimiter);
```

### 2. Helmet.js
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 3. CORS 설정
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  optionsSuccessStatus: 200
}));
```

## 백업 및 복구

### 1. 데이터베이스 백업
```bash
# 일일 백업 스크립트
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/postgres"
DB_NAME="seat_reservation"

pg_dump -h localhost -U postgres -d $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# 7일 이상된 백업 삭제
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

### 2. Redis 백업
```bash
# Redis RDB 백업
cp /var/lib/redis/dump.rdb /backup/redis/dump_$DATE.rdb
```

### 3. 복구 절차
```bash
# PostgreSQL 복구
gunzip < backup_20240823_120000.sql.gz | psql -h localhost -U postgres -d seat_reservation

# Redis 복구
systemctl stop redis
cp /backup/redis/dump_20240823_120000.rdb /var/lib/redis/dump.rdb
systemctl start redis
```

## 트러블슈팅

### 1. 높은 CPU 사용률
- PM2 클러스터 모드 인스턴스 수 조정
- Node.js 프로파일링으로 병목 지점 확인
- 캐시 TTL 증가

### 2. 메모리 누수
- PM2 max_memory_restart 설정
- 힙 덤프 분석
- 이벤트 리스너 정리 확인

### 3. 데이터베이스 연결 오류
- 커넥션 풀 크기 조정
- 타임아웃 설정 검토
- Slow query 분석

### 4. Redis 메모리 부족
- maxmemory-policy 검토
- 불필요한 키 정리
- 데이터 구조 최적화