const bcrypt = require('bcrypt');

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

module.exports = {
    hashPassword,
    verifyPassword,
    requireAuth
};
