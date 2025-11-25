const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Admin 권한 확인 미들웨어
const requireAdmin = async (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }

    try {
        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [req.session.userId]);

        if (users.length === 0 || users[0].role !== 'admin') {
            return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
        }

        next();
    } catch (error) {
        console.error('권한 확인 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 대시보드 통계
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const [userCount] = await db.query('SELECT COUNT(*) as count FROM users');
        const [itemCount] = await db.query('SELECT COUNT(*) as count FROM items');
        const [activeItemCount] = await db.query('SELECT COUNT(*) as count FROM items WHERE status = "active"');
        const [bidCount] = await db.query('SELECT COUNT(*) as count FROM bids');
        const [totalSales] = await db.query('SELECT SUM(final_price) as total FROM transactions WHERE status = "completed"');

        res.json({
            success: true,
            stats: {
                totalUsers: userCount[0].count,
                totalItems: itemCount[0].count,
                activeItems: activeItemCount[0].count,
                totalBids: bidCount[0].count,
                totalSales: totalSales[0].total || 0
            }
        });
    } catch (error) {
        console.error('통계 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 모든 사용자 조회
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT id, username, email, balance, role, created_at
            FROM users
            ORDER BY created_at DESC
        `);

        res.json({ success: true, users });
    } catch (error) {
        console.error('사용자 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 모든 상품 조회 (관리자용)
router.get('/items', requireAdmin, async (req, res) => {
    try {
        const [items] = await db.query(`
            SELECT i.*, u.username as seller_name
            FROM items i
            JOIN users u ON i.seller_id = u.id
            ORDER BY i.created_at DESC
        `);

        res.json({ success: true, items });
    } catch (error) {
        console.error('상품 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 상품 삭제 (관리자 권한)
router.delete('/items/:id', requireAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM items WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: '상품이 삭제되었습니다.' });
    } catch (error) {
        console.error('상품 삭제 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 사용자 역할 변경
router.put('/users/:id/role', requireAdmin, async (req, res) => {
    try {
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ success: false, message: '잘못된 역할입니다.' });
        }

        await db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
        res.json({ success: true, message: '역할이 변경되었습니다.' });
    } catch (error) {
        console.error('역할 변경 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 사용자 잔액 변경
router.put('/users/:id/balance', requireAdmin, async (req, res) => {
    try {
        const { balance } = req.body;

        // 잔액 유효성 검사
        if (typeof balance !== 'number' || balance < 0) {
            return res.status(400).json({ success: false, message: '유효하지 않은 잔액입니다.' });
        }

        await db.query('UPDATE users SET balance = ? WHERE id = ?', [balance, req.params.id]);
        res.json({ success: true, message: '잔액이 변경되었습니다.' });
    } catch (error) {
        console.error('잔액 변경 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 사용자 삭제
router.delete('/users/:id', requireAdmin, async (req, res) => {
    try {
        // 자기 자신은 삭제할 수 없음
        if (parseInt(req.params.id) === req.session.userId) {
            return res.status(400).json({ success: false, message: '자기 자신은 삭제할 수 없습니다.' });
        }

        await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: '사용자가 삭제되었습니다.' });
    } catch (error) {
        console.error('사용자 삭제 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
