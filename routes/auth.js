const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { hashPassword, verifyPassword } = require('../utils/auth');

// 회원가입
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 입력값 검증
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: '모든 필드를 입력해주세요.'
            });
        }

        // 이메일 중복 확인
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: '이미 사용 중인 이메일 또는 사용자명입니다.'
            });
        }

        // 비밀번호 암호화
        const hashedPassword = await hashPassword(password);

        // 사용자 생성
        const [result] = await db.query(
            'INSERT INTO users (username, email, password, balance) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, 10000.00]
        );

        // 세션에 사용자 정보 저장
        req.session.userId = result.insertId;
        req.session.username = username;

        res.json({
            success: true,
            message: '회원가입이 완료되었습니다.',
            user: {
                id: result.insertId,
                username,
                email
            }
        });
    } catch (error) {
        console.error('회원가입 에러:', error);
        res.status(500).json({
            success: false,
            message: '회원가입 중 오류가 발생했습니다.'
        });
    }
});

// 로그인
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 입력값 검증
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: '이메일과 비밀번호를 입력해주세요.'
            });
        }

        // 사용자 조회
        const [users] = await db.query(
            'SELECT id, username, email, password, balance, role FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: '이메일 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        const user = users[0];

        // 비밀번호 검증
        const isPasswordValid = await verifyPassword(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: '이메일 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        // 세션에 사용자 정보 저장
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        res.json({
            success: true,
            message: '로그인에 성공했습니다.',
            redirectTo: user.role === 'admin' ? '/admin' : '/',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                balance: user.balance,
                role: user.role
            }
        });
    } catch (error) {
        console.error('로그인 에러:', error);
        res.status(500).json({
            success: false,
            message: '로그인 중 오류가 발생했습니다.'
        });
    }
});

// 로그아웃
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: '로그아웃 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            message: '로그아웃되었습니다.'
        });
    });
});

// 현재 로그인한 사용자 정보 조회
router.get('/me', async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            message: '로그인이 필요합니다.'
        });
    }

    try {
        const [users] = await db.query(
            'SELECT id, username, email, balance, created_at FROM users WHERE id = ?',
            [req.session.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            user: users[0]
        });
    } catch (error) {
        console.error('사용자 정보 조회 에러:', error);
        res.status(500).json({
            success: false,
            message: '사용자 정보 조회 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router;
