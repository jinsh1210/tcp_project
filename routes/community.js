const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 모든 게시글 조회
router.get('/posts', async (req, res) => {
    try {
        const [posts] = await db.query(`
            SELECT p.*, u.username,
                   (SELECT COUNT(*) FROM community_comments WHERE post_id = p.id) as comment_count
            FROM community_posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        `);
        res.json({ success: true, posts });
    } catch (error) {
        console.error('게시글 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 특정 게시글 조회
router.get('/posts/:id', async (req, res) => {
    try {
        // 조회수 증가
        await db.query('UPDATE community_posts SET views = views + 1 WHERE id = ?', [req.params.id]);

        const [posts] = await db.query(`
            SELECT p.*, u.username
            FROM community_posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
        `, [req.params.id]);

        if (posts.length === 0) {
            return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
        }

        const [comments] = await db.query(`
            SELECT c.*, u.username
            FROM community_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
        `, [req.params.id]);

        res.json({ success: true, post: posts[0], comments });
    } catch (error) {
        console.error('게시글 상세 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 게시글 작성
router.post('/posts', async (req, res) => {
    try {
        const { userId, title, content } = req.body;

        if (!userId || !title || !content) {
            return res.status(400).json({ success: false, message: '필수 항목을 입력해주세요.' });
        }

        const [result] = await db.query(
            'INSERT INTO community_posts (user_id, title, content) VALUES (?, ?, ?)',
            [userId, title, content]
        );

        res.json({ success: true, message: '게시글이 작성되었습니다.', postId: result.insertId });
    } catch (error) {
        console.error('게시글 작성 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 댓글 작성
router.post('/comments', async (req, res) => {
    try {
        const { postId, userId, content } = req.body;

        if (!postId || !userId || !content) {
            return res.status(400).json({ success: false, message: '필수 항목을 입력해주세요.' });
        }

        const [result] = await db.query(
            'INSERT INTO community_comments (post_id, user_id, content) VALUES (?, ?, ?)',
            [postId, userId, content]
        );

        res.json({ success: true, message: '댓글이 작성되었습니다.', commentId: result.insertId });
    } catch (error) {
        console.error('댓글 작성 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
