const bcrypt = require('bcrypt');
const db = require('../config/database');

const SALT_ROUNDS = 10;

/**
 * 비밀번호 해시화
 */
async function hashPassword(password) {
    try {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const hash = await bcrypt.hash(password, salt);
        return hash;
    } catch (error) {
        throw new Error('비밀번호 암호화에 실패했습니다.');
    }
}

/**
 * 비밀번호 검증
 */
async function verifyPassword(password, hash) {
    try {
        const isMatch = await bcrypt.compare(password, hash);
        return isMatch;
    } catch (error) {
        throw new Error('비밀번호 검증에 실패했습니다.');
    }
}

/**
 * 인증 미들웨어
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            message: '로그인이 필요합니다.'
        });
    }
    next();
}

/**
 * 관리자 권한 확인 미들웨어
 */
async function requireAdmin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            message: '로그인이 필요합니다.'
        });
    }

    try {
        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [req.session.userId]);

        if (users.length === 0 || users[0].role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '관리자 권한이 필요합니다.'
            });
        }

        next();
    } catch (error) {
        console.error('권한 확인 에러:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
    requireAuth,
    requireAdmin
};
