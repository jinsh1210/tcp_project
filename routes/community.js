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

        // 익명 처리
        const processedPosts = posts.map(post => ({
            ...post,
            username: post.is_anonymous ? '익명' : post.username
        }));

        res.json({ success: true, posts: processedPosts });
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

        // 익명 처리
        const post = {
            ...posts[0],
            username: posts[0].is_anonymous ? '익명' : posts[0].username
        };

        const processedComments = comments.map(comment => ({
            ...comment,
            username: comment.is_anonymous ? '익명' : comment.username
        }));

        res.json({ success: true, post, comments: processedComments });
    } catch (error) {
        console.error('게시글 상세 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 게시글 작성
router.post('/posts', async (req, res) => {
    try {
        const { userId, title, content, isAnonymous } = req.body;

        if (!userId || !title || !content) {
            return res.status(400).json({ success: false, message: '필수 항목을 입력해주세요.' });
        }

        const [result] = await db.query(
            'INSERT INTO community_posts (user_id, title, content, is_anonymous) VALUES (?, ?, ?, ?)',
            [userId, title, content, isAnonymous || false]
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
        const { postId, userId, content, isAnonymous } = req.body;

        if (!postId || !userId || !content) {
            return res.status(400).json({ success: false, message: '필수 항목을 입력해주세요.' });
        }

        const [result] = await db.query(
            'INSERT INTO community_comments (post_id, user_id, content, is_anonymous) VALUES (?, ?, ?, ?)',
            [postId, userId, content, isAnonymous || false]
        );

        res.json({ success: true, message: '댓글이 작성되었습니다.', commentId: result.insertId });
    } catch (error) {
        console.error('댓글 작성 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 게시글 삭제
router.delete('/posts/:id', async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.body.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }

        // 게시글 작성자 확인
        const [posts] = await db.query('SELECT user_id FROM community_posts WHERE id = ?', [postId]);

        if (posts.length === 0) {
            return res.status(404).json({ success: false, message: '게시글을 찾을 수 없습니다.' });
        }

        if (posts[0].user_id !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: '본인이 작성한 게시글만 삭제할 수 있습니다.' });
        }

        // 게시글 삭제 (CASCADE로 댓글도 자동 삭제됨)
        await db.query('DELETE FROM community_posts WHERE id = ?', [postId]);

        res.json({ success: true, message: '게시글이 삭제되었습니다.' });
    } catch (error) {
        console.error('게시글 삭제 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 댓글 삭제
router.delete('/comments/:id', async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.body.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }

        // 댓글 작성자 확인
        const [comments] = await db.query('SELECT user_id FROM community_comments WHERE id = ?', [commentId]);

        if (comments.length === 0) {
            return res.status(404).json({ success: false, message: '댓글을 찾을 수 없습니다.' });
        }

        if (comments[0].user_id !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: '본인이 작성한 댓글만 삭제할 수 있습니다.' });
        }

        // 댓글 삭제
        await db.query('DELETE FROM community_comments WHERE id = ?', [commentId]);

        res.json({ success: true, message: '댓글이 삭제되었습니다.' });
    } catch (error) {
        console.error('댓글 삭제 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
