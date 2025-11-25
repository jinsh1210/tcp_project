require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const TCPServer = require('./servers/tcpServer');
const UDPServer = require('./servers/udpServer');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const communityRoutes = require('./routes/community');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');

const app = express();

// View Engine 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET || 'auction-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // HTTPS 사용 시 true로 변경
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24시간
    }
}));

// API 라우트
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// 인증 미들웨어
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

// 페이지 라우트
app.get('/', requireAuth, (req, res) => {
    res.render('index', {
        user: {
            id: req.session.userId,
            username: req.session.username
        }
    });
});

app.get('/login', (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    res.render('login');
});

app.get('/register', (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    res.render('register');
});

app.get('/community', requireAuth, (req, res) => {
    res.render('community', {
        user: {
            id: req.session.userId,
            username: req.session.username
        }
    });
});

app.get('/chat', requireAuth, (req, res) => {
    res.render('chat', {
        user: {
            id: req.session.userId,
            username: req.session.username
        }
    });
});

app.get('/admin', requireAuth, async (req, res) => {
    try {
        const [users] = await require('./config/database').query(
            'SELECT role FROM users WHERE id = ?',
            [req.session.userId]
        );

        if (users.length === 0 || users[0].role !== 'admin') {
            return res.status(403).send('관리자 권한이 필요합니다.');
        }

        res.render('admin', {
            user: {
                id: req.session.userId,
                username: req.session.username
            }
        });
    } catch (error) {
        console.error('Admin 페이지 에러:', error);
        res.status(500).send('서버 오류가 발생했습니다.');
    }
});

// HTTP 서버 시작
const HTTP_PORT = process.env.HTTP_PORT || 3000;
app.listen(HTTP_PORT, () => {
    console.log(`HTTP 서버가 포트 ${HTTP_PORT}에서 실행 중입니다.`);
    console.log(`웹 인터페이스: http://localhost:${HTTP_PORT}`);
});

// TCP 서버 시작
const TCP_PORT = process.env.TCP_PORT || 4000;
const tcpServer = new TCPServer(TCP_PORT);
tcpServer.start();

// UDP 서버 시작
const UDP_PORT = process.env.UDP_PORT || 5000;
const udpServer = new UDPServer(UDP_PORT);
udpServer.start();

// 프로세스 종료 처리
process.on('SIGINT', () => {
    console.log('\n서버를 종료합니다...');
    udpServer.stop();
    process.exit(0);
});

console.log('\n=================================');
console.log('중고 경매 SaaS 플랫폼');
console.log('=================================');
console.log(`HTTP 서버: http://localhost:${HTTP_PORT}`);
console.log(`TCP 서버: localhost:${TCP_PORT}`);
console.log(`UDP 서버: localhost:${UDP_PORT}`);
console.log('=================================\n');
