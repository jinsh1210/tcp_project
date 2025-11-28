# 중고 경매 플랫폼

Node.js + Express + Socket.IO 기반의 실시간 중고 경매 플랫폼입니다. WebSocket을 통한 실시간 양방향 통신을 지원합니다.

## 주요 기능

- **실시간 경매**: Socket.IO를 통한 실시간 입찰 및 상태 업데이트
- **웹 인터페이스**: EJS 템플릿 엔진과 직관적인 UI
- **입찰 시스템**: 실시간 입찰 및 가격 업데이트, 즉시 구매 기능
- **상품 관리**: 경매 상품 등록, 이미지 업로드 및 관리
- **사용자 시스템**: 회원가입/로그인, 잔액 관리, 입찰 내역 조회
- **커뮤니티**: 게시판 및 댓글, 익명 작성 기능
- **관리자 기능**: 사용자/상품/입찰 관리, 통계 대시보드
- **자동 경매 종료**: 스케줄러를 통한 경매 자동 종료 및 낙찰 처리

## 기술 스택

- **Backend**: Node.js, Express
- **Database**: MySQL2 (with Promise)
- **Real-time Communication**: Socket.IO
- **Authentication**: Express-Session, Bcrypt
- **Template Engine**: EJS
- **Frontend**: HTML, CSS, JavaScript
- **Package Manager**: npm

## 프로젝트 구조

```
tcp_project/
├── server.js                # 메인 서버 (HTTP + WebSocket)
├── package.json             # 프로젝트 설정
├── .env                     # 환경 변수
├── config/
│   └── database.js          # MySQL 연결 풀 설정
├── routes/
│   ├── api.js               # 경매 관련 REST API
│   ├── auth.js              # 인증 관련 API (로그인/회원가입)
│   ├── admin.js             # 관리자 전용 API
│   ├── community.js         # 커뮤니티 게시판 API
│   └── pages.js             # 페이지 라우팅 (뷰 렌더링)
├── utils/
│   ├── auth.js              # 인증 미들웨어 (requireAuth, requireAdmin)
│   └── asyncHandler.js      # 비동기 에러 핸들링 래퍼
├── views/
│   ├── index.ejs            # 메인 경매 페이지
│   ├── login.ejs            # 로그인 페이지
│   ├── register.ejs         # 회원가입 페이지
│   └── admin.ejs            # 관리자 대시보드
├── public/
│   ├── css/                 # 스타일시트
│   └── js/
│       └── main.js          # 프론트엔드 JavaScript (Socket.IO 클라이언트)
├── database/
│   └── schema.sql           # 데이터베이스 스키마
└── scripts/
    └── migratePasswords.js  # 비밀번호 암호화 마이그레이션
```

## 설치 및 실행

### 1. 필수 요구사항

- Node.js (v14 이상)
- MySQL (v5.7 이상)
- npm 또는 yarn

### 2. 패키지 설치

```bash
npm install
```

### 3. 데이터베이스 설정

MySQL에 접속하여 스키마를 실행합니다:

### 4. 환경 변수 설정

`.env` 파일을 생성하고 다음과 같이 설정:

```env
# 데이터베이스 설정
DB_HOST=localhost
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_PORT=

# 서버 포트
HTTP_PORT=8080

# 세션 시크릿 키 (프로덕션에서는 반드시 변경)
SESSION_SECRET=auction-secret-key-change-in-production
```

**참고**: 현재 설정된 HTTP 포트는 `8080`입니다. 다른 포트를 사용하려면 `HTTP_PORT` 값을 변경하세요.

### 5. 서버 실행

```bash
npm start
```

또는 개발 모드 (nodemon):

```bash
npm run dev
```

### 6. 접속

웹 브라우저에서 다음 주소로 접속:

```
http://localhost:8080
```

**초기 로그인 정보**:

- 일반 사용자: `buyer1@test.com` / `password123`
- 관리자: `admin@test.com` / `admin123`

## 서버 구조

### HTTP 서버 (포트 8080)

- 웹 페이지 렌더링 (EJS 템플릿)
- REST API 엔드포인트
- 정적 파일 제공 (CSS, JavaScript, 이미지 등)
- Express-Session 기반 세션 관리

### WebSocket 서버 (Socket.IO)

- 실시간 양방향 통신
- 입찰 시 전체 사용자에게 즉시 알림
- 접속자 수 실시간 업데이트
- 경매 종료 이벤트 브로드캐스트
- 새 상품 등록 알림
- 즉시 구매 완료 알림

### 에러 핸들링

- **asyncHandler**: 모든 비동기 라우트 핸들러를 래핑하여 에러를 자동으로 처리
- **전역 에러 미들웨어**: 예상치 못한 에러를 통합 처리
- **클라이언트 에러 처리**: apiRequest 함수에서 중앙집중식 에러 관리

## API 엔드포인트

### 인증 관련 (/auth)

- `POST /auth/register` - 회원가입 (asyncHandler 적용)
- `POST /auth/login` - 로그인 (asyncHandler 적용)
- `POST /auth/logout` - 로그아웃
- `GET /auth/me` - 현재 로그인한 사용자 정보 조회 (asyncHandler 적용)

### 경매 상품 (/api)

- `GET /api/items` - 전체 경매 상품 목록 (입찰 수, 최고가 포함)
- `GET /api/items/:id` - 특정 상품 상세 정보 및 최근 입찰 내역
- `POST /api/items` - 새 상품 등록 (즉시 구매가 선택 가능)
- `DELETE /api/items/:id` - 상품 삭제

### 입찰 관련 (/api)

- `POST /api/bids` - 입찰하기 (WebSocket으로 실시간 브로드캐스트)
- `POST /api/buy-now` - 즉시 구매 (WebSocket으로 실시간 알림)
- `GET /api/items/:id/bids` - 특정 상품의 입찰 내역

### 관리자 전용 (/api/admin)

**모든 엔드포인트는 requireAdmin 미들웨어로 보호되며, asyncHandler가 적용되어 있습니다.**

- `GET /api/admin/stats` - 통계 대시보드 (사용자/상품/입찰/거래 수)
- `GET /api/admin/users` - 전체 사용자 목록
- `PUT /api/admin/users/:id/role` - 사용자 역할 변경 (user/admin)
- `PUT /api/admin/users/:id/balance` - 사용자 잔액 변경
- `DELETE /api/admin/users/:id` - 사용자 삭제 (자기 자신 삭제 불가)
- `GET /api/admin/items` - 전체 상품 목록 (판매자 정보 포함)
- `DELETE /api/admin/items/:id` - 상품 삭제

### 커뮤니티 (/api/community)

- `GET /api/community/posts` - 게시글 목록 (댓글 수 포함)
- `POST /api/community/posts` - 게시글 작성 (익명 가능)
- `GET /api/community/posts/:id` - 게시글 상세 (조회수 자동 증가, 댓글 포함)
- `DELETE /api/community/posts/:id` - 게시글 삭제 (본인만 가능)
- `POST /api/community/comments` - 댓글 작성 (익명 가능)
- `DELETE /api/community/comments/:id` - 댓글 삭제 (본인만 가능)

### 페이지 라우팅 (/)

- `GET /` - 메인 경매 페이지 (로그인 필요)
- `GET /login` - 로그인 페이지
- `GET /register` - 회원가입 페이지
- `GET /admin` - 관리자 대시보드 (관리자 권한 필요)

## WebSocket 이벤트

### 서버 → 클라이언트

- `user_count` - 현재 접속자 수 (연결/해제 시 전송)
- `new_item` - 새로운 상품 등록 (상품명, 판매자명 포함)
- `new_bid` - 새로운 입찰 발생 (입찰자, 상품명, 입찰가 포함)
- `auction_ended` - 경매 종료 (낙찰자, 최종가격 포함)
- `item_sold` - 즉시 구매 완료 (구매자, 상품명 포함)

### 클라이언트 → 서버

- `connect` - WebSocket 연결 성공
- `disconnect` - WebSocket 연결 해제

### 이벤트 처리 흐름

1. **새 상품 등록**: API 호출 → DB 저장 → Socket.IO `new_item` 이벤트 브로드캐스트
2. **입찰**: API 호출 → DB 저장 → Socket.IO `new_bid` 이벤트 브로드캐스트
3. **즉시 구매**: API 호출 → DB 저장 → Socket.IO `item_sold` 이벤트 브로드캐스트
4. **경매 종료**: 스케줄러(30초마다) → DB 확인 → Socket.IO `auction_ended` 이벤트 브로드캐스트

## 데이터베이스 스키마

### users - 사용자

```sql
id INT PRIMARY KEY AUTO_INCREMENT
username VARCHAR(50) UNIQUE NOT NULL
email VARCHAR(100) UNIQUE NOT NULL
password VARCHAR(255) NOT NULL        # bcrypt로 암호화
balance DECIMAL(15, 2) DEFAULT 0.00   # 최대 약 9999조원까지 저장 가능
role ENUM('user', 'admin') DEFAULT 'user'
created_at TIMESTAMP
```

### items - 경매 상품

```sql
id INT PRIMARY KEY AUTO_INCREMENT
seller_id INT FOREIGN KEY → users(id)
title VARCHAR(200) NOT NULL
description TEXT
starting_price DECIMAL(15, 2) NOT NULL
current_price DECIMAL(15, 2) NOT NULL
buy_now_price DECIMAL(15, 2) NULL     # 즉시 구매가 (선택)
image_url VARCHAR(500)
status ENUM('active', 'sold', 'expired') DEFAULT 'active'
end_time DATETIME NOT NULL
created_at TIMESTAMP
```

### bids - 입찰 내역

```sql
id INT PRIMARY KEY AUTO_INCREMENT
item_id INT FOREIGN KEY → items(id)
user_id INT FOREIGN KEY → users(id)
bid_amount DECIMAL(15, 2) NOT NULL
bid_time TIMESTAMP
```

### transactions - 거래 내역

```sql
id INT PRIMARY KEY AUTO_INCREMENT
item_id INT FOREIGN KEY → items(id)
buyer_id INT FOREIGN KEY → users(id)
seller_id INT FOREIGN KEY → users(id)
final_price DECIMAL(15, 2) NOT NULL
transaction_time TIMESTAMP
status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending'
```

### community_posts - 커뮤니티 게시글

```sql
id INT PRIMARY KEY AUTO_INCREMENT
user_id INT FOREIGN KEY → users(id)
title VARCHAR(200) NOT NULL
content TEXT NOT NULL
views INT DEFAULT 0
is_anonymous TINYINT DEFAULT 0       # 익명 여부
created_at TIMESTAMP
updated_at TIMESTAMP
```

### community_comments - 커뮤니티 댓글

```sql
id INT PRIMARY KEY AUTO_INCREMENT
post_id INT FOREIGN KEY → community_posts(id)
user_id INT FOREIGN KEY → users(id)
content TEXT NOT NULL
is_anonymous TINYINT DEFAULT 0       # 익명 여부
created_at TIMESTAMP
```

## 주요 기능 설명

### 1. 실시간 입찰 시스템

- Socket.IO를 통해 입찰 시 모든 접속자에게 즉시 알림
- 현재가보다 높은 금액만 입찰 가능
- 즉시 구매가 이상 입찰 시 즉시 구매 확인 메시지 표시
- 입찰 시 잔액 홀드 (낙찰 실패 시 자동 환불)

### 2. 즉시 구매 기능

- 경매 대기 없이 바로 구매 가능
- 즉시 구매 시 경매 자동 종료 및 거래 완료
- 이전 입찰자들에게 자동 환불 처리
- 판매자에게 즉시 금액 지급

### 3. 자동 경매 종료

- 30초마다 만료된 경매 자동 확인
- 입찰이 있으면 최고가 낙찰자에게 자동 거래 생성
- 입찰이 없으면 경매 만료 처리
- 낙찰 실패 입찰자들에게 자동 환불

### 4. 인증 시스템

- **bcrypt**를 이용한 안전한 비밀번호 암호화 (SALT_ROUNDS: 10)
- **Express-Session** 기반 세션 관리 (24시간 유효)
- **requireAuth**: 일반 사용자 인증 미들웨어
- **requireAdmin**: 관리자 권한 확인 미들웨어
- 세션 쿠키: httpOnly, 개발 환경에서 secure: false

### 5. 에러 핸들링 체계

- **asyncHandler**: 모든 비동기 라우트에 적용되어 에러를 자동으로 캐치
- 일관된 에러 응답 포맷: `{ success: false, message: "..." }`
- 서버 에러는 콘솔에 자동 로깅
- 클라이언트에는 안전한 에러 메시지만 전송

### 6. 커뮤니티 기능

- 게시글 및 댓글 작성/삭제
- 익명 작성 기능 지원 (is_anonymous 플래그)
- 조회수 자동 증가
- 작성자만 본인 게시글/댓글 삭제 가능

### 7. 관리자 대시보드

- 사용자/상품/입찰/거래 통계
- 사용자 역할 변경 (user ↔ admin)
- 사용자 잔액 조정
- 전체 데이터 관리 및 삭제 권한
- 자기 자신은 삭제 불가 (안전장치)

### 8. 프론트엔드 기능

- **XSS 방지**: escapeHtml 함수로 모든 사용자 입력 이스케이프
- **LocalStorage**: 작성 중인 폼 데이터 자동 저장/복원
- **Flatpickr**: 날짜/시간 선택 UI
- **Lucide Icons**: 아이콘 라이브러리
- **실시간 업데이트**: WebSocket 이벤트로 UI 자동 갱신

## 샘플 데이터

데이터베이스 스키마 파일에는 다음 샘플 데이터가 포함되어 있습니다:

- **사용자**:

  - buyer1 (일반 사용자, 잔액: 10,000원)
  - seller1 (일반 사용자, 잔액: 5,000원)
  - buyer2 (일반 사용자, 잔액: 15,000원)
  - admin (관리자, 비밀번호: admin123)

- **경매 상품**:
  - 아이폰 14 Pro (시작가: 800,000원, 즉시 구매: 1,000,000원)
  - 맥북 프로 2021 (시작가: 1,500,000원, 즉시 구매: 1,800,000원)
  - 에어팟 프로 2세대 (시작가: 200,000원)
  - 아이패드 에어 (시작가: 500,000원, 즉시 구매: 600,000원)

## 초기 설정

### 비밀번호 암호화

`database/schema.sql`로 DB를 생성한 후, 샘플 데이터의 비밀번호를 암호화하기 위해 **반드시 한 번** 실행:

```bash
npm run migrate-passwords
```

## 코드 아키텍처 특징

### 1. 모듈화된 라우터 구조

- 각 기능별로 독립된 라우터 파일 (auth, api, admin, community, pages)
- 관심사의 분리로 유지보수성 향상

### 2. 재사용 가능한 유틸리티

- **asyncHandler**: 모든 비동기 라우트의 에러 처리를 통일
- **auth.js**: 인증 관련 함수와 미들웨어를 한 곳에 집중

### 3. 실시간 통신 패턴

- Socket.IO를 API 라우터에 주입하여 사용
- 데이터 변경 시 즉시 모든 클라이언트에 브로드캐스트

### 4. 보안 고려사항

- 비밀번호 bcrypt 암호화
- SQL Injection 방지 (Prepared Statements)
- XSS 방지 (HTML 이스케이프)
- Session 기반 인증
- httpOnly 쿠키

### 5. 성능 최적화

- MySQL2 Connection Pool 사용
- WebSocket으로 폴링 없는 실시간 업데이트
- 프론트엔드에서 개별 아이템만 선택적으로 업데이트

## 개발 팁

### 디버깅

```bash
# 개발 모드 (nodemon으로 자동 재시작)
npm run dev

# 콘솔 로그로 디버깅
# - 서버: console.log() 사용
# - 클라이언트: 브라우저 개발자 도구 콘솔 확인
```

### 데이터베이스 초기화

```bash
# 데이터베이스 삭제 후 재생성
mysql -u alttap -p
DROP DATABASE auction_db;
source database/schema.sql;
exit

# 비밀번호 재암호화
npm run migrate-passwords
```

### 포트 변경

`.env` 파일에서 `HTTP_PORT` 값을 수정하면 됩니다.

## 트러블슈팅

### MySQL 연결 오류

- MySQL 서버가 실행 중인지 확인
- `.env` 파일의 데이터베이스 정보가 정확한지 확인
- MySQL 사용자 권한 확인

### 세션 문제

- `.env`의 `SESSION_SECRET`이 설정되어 있는지 확인
- 브라우저 쿠키를 삭제하고 다시 로그인

### WebSocket 연결 실패

- 방화벽에서 포트가 차단되어 있는지 확인
- CORS 설정 확인 (현재는 모든 출처 허용)

## 향후 개선 사항

- [ ] 이미지 업로드 기능 구현
- [ ] 결제 시스템 연동
- [ ] 이메일 인증 추가
- [ ] 거래 후기 시스템
- [ ] 검색 및 필터링 기능 강화
- [ ] 무한 스크롤 또는 페이지네이션
- [ ] 알림 기록 저장
- [ ] 모바일 반응형 디자인 개선

## 라이선스

MIT
