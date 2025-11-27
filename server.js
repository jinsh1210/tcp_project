require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const apiRoutes = require("./routes/api");
const authRoutes = require("./routes/auth");
const communityRoutes = require("./routes/community");
const adminRoutes = require("./routes/admin");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// View Engine 설정
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// 세션 설정
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "auction-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // HTTPS 사용 시 true로 변경
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24시간
    },
  })
);

// API 라우트
app.use("/api", apiRoutes);
app.use("/auth", authRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/admin", adminRoutes);

// 인증 미들웨어
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }
  next();
}

// 페이지 라우트
app.get("/", requireAuth, (req, res) => {
  res.render("index", {
    user: {
      id: req.session.userId,
      username: req.session.username,
    },
  });
});

app.get("/login", (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/");
  }
  res.render("login");
});

app.get("/register", (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/");
  }
  res.render("register");
});

app.get("/community", requireAuth, (req, res) => {
  res.render("index", {
    user: {
      id: req.session.userId,
      username: req.session.username,
    },
  });
});

app.get("/admin", requireAuth, async (req, res) => {
  try {
    const [users] = await require("./config/database").query(
      "SELECT role FROM users WHERE id = ?",
      [req.session.userId]
    );

    if (users.length === 0 || users[0].role !== "admin") {
      return res.status(403).send("관리자 권한이 필요합니다.");
    }

    res.render("admin", {
      user: {
        id: req.session.userId,
        username: req.session.username,
      },
    });
  } catch (error) {
    console.error("Admin 페이지 에러:", error);
    res.status(500).send("서버 오류가 발생했습니다.");
  }
});

// WebSocket 연결 관리
let connectedUsers = 0;

io.on('connection', (socket) => {
  connectedUsers++;
  console.log(`✓ 사용자 연결: ${socket.id} (현재 ${connectedUsers}명 접속)`);

  // 모든 클라이언트에게 접속자 수 전송
  io.emit('user_count', connectedUsers);

  socket.on('disconnect', () => {
    connectedUsers--;
    console.log(`✗ 사용자 연결 해제: ${socket.id} (현재 ${connectedUsers}명 접속)`);
    io.emit('user_count', connectedUsers);
  });
});

// Socket.IO를 apiRoutes에 전달
apiRoutes.setSocketIO(io);

// 경매 종료 처리 스케줄러 (30초마다 실행)
const AUCTION_CHECK_INTERVAL = 30 * 1000; // 30초
setInterval(() => {
  apiRoutes.processExpiredAuctions();
}, AUCTION_CHECK_INTERVAL);

// 서버 시작 시 한 번 실행
apiRoutes.processExpiredAuctions();

console.log("경매 종료 처리 스케줄러 시작 (30초마다 확인)");

// 전역 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('서버 오류가 발생했습니다.');
});

// HTTP + WebSocket 서버 시작
const HTTP_PORT = process.env.HTTP_PORT || 3000;
server.listen(HTTP_PORT, () => {
  console.log("=================================");
  console.log(`✓ HTTP 서버 실행: http://localhost:${HTTP_PORT}`);
  console.log(`✓ WebSocket 서버 실행 중`);
  console.log("=================================\n");
});

// 프로세스 종료 처리
process.on("SIGINT", () => {
  console.log("\n서버를 종료합니다...");
  io.close();
  process.exit(0);
});
