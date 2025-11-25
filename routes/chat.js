const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 채팅방 생성 또는 조회
router.post('/rooms', async (req, res) => {
    try {
        const { itemId, buyerId, sellerId } = req.body;

        if (!itemId || !buyerId || !sellerId) {
            return res.status(400).json({ success: false, message: '필수 항목이 누락되었습니다.' });
        }

        // 기존 채팅방 확인
        const [existing] = await db.query(
            'SELECT * FROM chat_rooms WHERE item_id = ? AND buyer_id = ? AND seller_id = ?',
            [itemId, buyerId, sellerId]
        );

        if (existing.length > 0) {
            return res.json({ success: true, roomId: existing[0].id });
        }

        // 새 채팅방 생성
        const [result] = await db.query(
            'INSERT INTO chat_rooms (item_id, buyer_id, seller_id) VALUES (?, ?, ?)',
            [itemId, buyerId, sellerId]
        );

        res.json({ success: true, roomId: result.insertId });
    } catch (error) {
        console.error('채팅방 생성 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 사용자의 채팅방 목록 조회
router.get('/rooms/user/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        const [rooms] = await db.query(`
            SELECT
                r.*,
                i.title as item_title,
                buyer.username as buyer_name,
                seller.username as seller_name,
                (SELECT message FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_message_time
            FROM chat_rooms r
            JOIN items i ON r.item_id = i.id
            JOIN users buyer ON r.buyer_id = buyer.id
            JOIN users seller ON r.seller_id = seller.id
            WHERE r.buyer_id = ? OR r.seller_id = ?
            ORDER BY last_message_time DESC
        `, [userId, userId]);

        res.json({ success: true, rooms });
    } catch (error) {
        console.error('채팅방 목록 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 채팅방 메시지 조회
router.get('/rooms/:roomId/messages', async (req, res) => {
    try {
        const [messages] = await db.query(`
            SELECT m.*, u.username
            FROM chat_messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.room_id = ?
            ORDER BY m.created_at ASC
        `, [req.params.roomId]);

        res.json({ success: true, messages });
    } catch (error) {
        console.error('메시지 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 메시지 전송
router.post('/messages', async (req, res) => {
    try {
        const { roomId, senderId, message } = req.body;

        if (!roomId || !senderId || !message) {
            return res.status(400).json({ success: false, message: '필수 항목이 누락되었습니다.' });
        }

        const [result] = await db.query(
            'INSERT INTO chat_messages (room_id, sender_id, message) VALUES (?, ?, ?)',
            [roomId, senderId, message]
        );

        res.json({ success: true, messageId: result.insertId });
    } catch (error) {
        console.error('메시지 전송 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
