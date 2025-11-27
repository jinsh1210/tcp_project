const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAdmin } = require('../utils/auth');
const asyncHandler = require('../utils/asyncHandler');

// 대시보드 통계
router.get('/stats', requireAdmin, asyncHandler(async (req, res) => {
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
}));

// 모든 사용자 조회
router.get('/users', requireAdmin, asyncHandler(async (req, res) => {
    const [users] = await db.query(`
        SELECT id, username, email, balance, role, created_at
        FROM users
        ORDER BY created_at DESC
    `);

    res.json({ success: true, users });
}));

// 모든 상품 조회 (관리자용)
router.get('/items', requireAdmin, asyncHandler(async (req, res) => {
    const [items] = await db.query(`
        SELECT i.*, u.username as seller_name
        FROM items i
        JOIN users u ON i.seller_id = u.id
        ORDER BY i.created_at DESC
    `);

    res.json({ success: true, items });
}));

// 상품 삭제 (관리자 권한)
router.delete('/items/:id', requireAdmin, asyncHandler(async (req, res) => {
    await db.query('DELETE FROM items WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '상품이 삭제되었습니다.' });
}));

// 사용자 역할 변경
router.put('/users/:id/role', requireAdmin, asyncHandler(async (req, res) => {
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ success: false, message: '잘못된 역할입니다.' });
    }

    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ success: true, message: '역할이 변경되었습니다.' });
}));

// 사용자 잔액 변경
router.put('/users/:id/balance', requireAdmin, asyncHandler(async (req, res) => {
    const { balance } = req.body;

    // 잔액 유효성 검사
    if (typeof balance !== 'number' || balance < 0) {
        return res.status(400).json({ success: false, message: '유효하지 않은 잔액입니다.' });
    }

    await db.query('UPDATE users SET balance = ? WHERE id = ?', [balance, req.params.id]);
    res.json({ success: true, message: '잔액이 변경되었습니다.' });
}));

// 사용자 삭제
router.delete('/users/:id', requireAdmin, asyncHandler(async (req, res) => {
    // 자기 자신은 삭제할 수 없음
    if (parseInt(req.params.id) === req.session.userId) {
        return res.status(400).json({ success: false, message: '자기 자신은 삭제할 수 없습니다.' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '사용자가 삭제되었습니다.' });
}));

module.exports = router;
