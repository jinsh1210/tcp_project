const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Socket.IO 인스턴스 저장
let io = null;

// Socket.IO 설정 함수
function setSocketIO(socketIO) {
    io = socketIO;
    console.log('✓ Socket.IO가 API 라우터에 연결되었습니다.');
}

router.setSocketIO = setSocketIO;

// 모든 경매 상품 조회
router.get('/items', async (req, res) => {
    try {
        const [items] = await db.query(`
            SELECT
                i.*,
                u.username as seller_name,
                (SELECT COUNT(*) FROM bids WHERE item_id = i.id) as bid_count,
                (SELECT MAX(bid_amount) FROM bids WHERE item_id = i.id) as highest_bid
            FROM items i
            JOIN users u ON i.seller_id = u.id
            WHERE i.status = 'active'
            ORDER BY i.end_time ASC
        `);
        res.json({ success: true, items });
    } catch (error) {
        console.error('상품 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 특정 상품 상세 조회
router.get('/items/:id', async (req, res) => {
    try {
        const [items] = await db.query(`
            SELECT
                i.*,
                u.username as seller_name,
                u.email as seller_email
            FROM items i
            JOIN users u ON i.seller_id = u.id
            WHERE i.id = ?
        `, [req.params.id]);

        if (items.length === 0) {
            return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });
        }

        const [bids] = await db.query(`
            SELECT b.*, u.username
            FROM bids b
            JOIN users u ON b.user_id = u.id
            WHERE b.item_id = ?
            ORDER BY b.bid_amount DESC
            LIMIT 10
        `, [req.params.id]);

        res.json({
            success: true,
            item: items[0],
            recentBids: bids
        });
    } catch (error) {
        console.error('상품 상세 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 새 상품 등록
router.post('/items', async (req, res) => {
    try {
        const { sellerId, title, description, startingPrice, buyNowPrice, endTime } = req.body;

        if (!sellerId || !title || !startingPrice || !endTime) {
            return res.status(400).json({ success: false, message: '필수 항목을 입력해주세요.' });
        }

        // 즉시 구매가가 시작가보다 낮으면 에러
        if (buyNowPrice && parseFloat(buyNowPrice) <= parseFloat(startingPrice)) {
            return res.status(400).json({ success: false, message: '즉시 구매가는 시작가보다 높아야 합니다.' });
        }

        const [result] = await db.query(`
            INSERT INTO items (seller_id, title, description, starting_price, current_price, buy_now_price, end_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [sellerId, title, description, startingPrice, startingPrice, buyNowPrice || null, endTime]);

        res.json({
            success: true,
            message: '상품이 등록되었습니다.',
            itemId: result.insertId
        });
    } catch (error) {
        console.error('상품 등록 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 입찰하기 (HTTP API)
router.post('/bids', async (req, res) => {
    try {
        const { itemId, userId, bidAmount } = req.body;

        if (!itemId || !userId || !bidAmount) {
            return res.status(400).json({ success: false, message: '필수 항목을 입력해주세요.' });
        }

        // 현재 상품 정보 조회
        const [items] = await db.query(
            'SELECT * FROM items WHERE id = ? AND status = "active"',
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).json({ success: false, message: '경매가 종료되었거나 존재하지 않는 상품입니다.' });
        }

        const item = items[0];

        if (parseFloat(bidAmount) <= parseFloat(item.current_price)) {
            return res.status(400).json({ success: false, message: '현재가보다 높은 금액을 입찰해야 합니다.' });
        }

        // 즉시 구매가가 있는 경우, 입찰가가 즉시 구매가 이상이면 에러
        if (item.buy_now_price && parseFloat(bidAmount) >= parseFloat(item.buy_now_price)) {
            return res.status(400).json({
                success: false,
                message: `입찰가는 즉시 구매가(${item.buy_now_price.toLocaleString()}원)보다 낮아야 합니다. 즉시 구매가로 구매하려면 '즉시 구매' 버튼을 이용해주세요.`
            });
        }

        // 사용자 잔액 확인
        const [users] = await db.query('SELECT balance FROM users WHERE id = ?', [userId]);
        if (users.length === 0 || parseFloat(users[0].balance) < parseFloat(bidAmount)) {
            return res.status(400).json({ success: false, message: '잔액이 부족합니다.' });
        }

        // 일반 입찰 처리
        // 입찰 기록
        await db.query(
            'INSERT INTO bids (item_id, user_id, bid_amount) VALUES (?, ?, ?)',
            [itemId, userId, bidAmount]
        );

        // 상품 현재가 업데이트
        await db.query(
            'UPDATE items SET current_price = ? WHERE id = ?',
            [bidAmount, itemId]
        );

        // 사용자 이름 조회
        const [bidUser] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
        const username = bidUser[0].username;

        // WebSocket으로 모든 클라이언트에게 실시간 알림
        if (io) {
            io.emit('new_bid', {
                itemId,
                itemTitle: item.title,
                newPrice: bidAmount,
                bidderName: username,
                bidCount: await getBidCount(itemId)
            });
        }

        res.json({
            success: true,
            message: '입찰에 성공했습니다.',
            data: { itemId, newPrice: bidAmount, userId }
        });
    } catch (error) {
        console.error('입찰 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 사용자 정보 조회
router.get('/users/:id', async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, email, balance, created_at FROM users WHERE id = ?',
            [req.params.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }

        res.json({ success: true, user: users[0] });
    } catch (error) {
        console.error('사용자 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 사용자의 입찰 내역 조회
router.get('/users/:id/bids', async (req, res) => {
    try {
        const [bids] = await db.query(`
            SELECT b.*, i.title, i.current_price, i.status
            FROM bids b
            JOIN items i ON b.item_id = i.id
            WHERE b.user_id = ?
            ORDER BY b.bid_time DESC
        `, [req.params.id]);

        res.json({ success: true, bids });
    } catch (error) {
        console.error('입찰 내역 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 즉시 구매
router.post('/buy-now', async (req, res) => {
    try {
        const { itemId, userId } = req.body;

        if (!itemId || !userId) {
            return res.status(400).json({ success: false, message: '필수 항목을 입력해주세요.' });
        }

        // 상품 정보 조회
        const [items] = await db.query(
            'SELECT * FROM items WHERE id = ? AND status = "active"',
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).json({ success: false, message: '경매가 종료되었거나 존재하지 않는 상품입니다.' });
        }

        const item = items[0];

        // 즉시 구매가가 설정되어 있는지 확인
        if (!item.buy_now_price) {
            return res.status(400).json({ success: false, message: '이 상품은 즉시 구매가 설정되지 않았습니다.' });
        }

        // 자기 자신의 상품은 구매 불가
        if (item.seller_id === parseInt(userId)) {
            return res.status(400).json({ success: false, message: '본인의 상품은 구매할 수 없습니다.' });
        }

        // 사용자 잔액 확인
        const [users] = await db.query('SELECT balance FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        }

        const buyerBalance = parseFloat(users[0].balance);
        if (buyerBalance < parseFloat(item.buy_now_price)) {
            return res.status(400).json({
                success: false,
                message: '잔액이 부족합니다.',
                required: item.buy_now_price,
                current: buyerBalance
            });
        }

        // 트랜잭션 시작
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 구매자 잔액 차감
            await connection.query(
                'UPDATE users SET balance = balance - ? WHERE id = ?',
                [item.buy_now_price, userId]
            );

            // 판매자 잔액 증가
            await connection.query(
                'UPDATE users SET balance = balance + ? WHERE id = ?',
                [item.buy_now_price, item.seller_id]
            );

            // 상품 상태를 sold로 변경
            await connection.query(
                'UPDATE items SET status = "sold", current_price = ? WHERE id = ?',
                [item.buy_now_price, itemId]
            );

            // 거래 기록 생성
            await connection.query(
                'INSERT INTO transactions (item_id, buyer_id, seller_id, final_price, status) VALUES (?, ?, ?, ?, "completed")',
                [itemId, userId, item.seller_id, item.buy_now_price]
            );

            await connection.commit();
            connection.release();

            // WebSocket으로 즉시 구매 알림
            if (io) {
                const [buyerInfo] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
                io.emit('item_sold', {
                    itemId,
                    itemTitle: item.title,
                    price: item.buy_now_price,
                    buyerName: buyerInfo[0].username,
                    type: 'buy_now'
                });
            }

            res.json({
                success: true,
                message: '즉시 구매가 완료되었습니다!',
                data: {
                    itemId,
                    price: item.buy_now_price,
                    remainingBalance: buyerBalance - item.buy_now_price
                }
            });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('즉시 구매 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 상품 삭제 (본인 물품만)
router.delete('/items/:id', async (req, res) => {
    try {
        const itemId = req.params.id;
        const userId = req.body.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }

        // 상품 조회
        const [items] = await db.query('SELECT seller_id FROM items WHERE id = ?', [itemId]);

        if (items.length === 0) {
            return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다.' });
        }

        // 본인 물품인지 확인
        if (items[0].seller_id !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: '본인이 등록한 상품만 삭제할 수 있습니다.' });
        }

        // 입찰이 있는지 확인
        const [bids] = await db.query('SELECT COUNT(*) as count FROM bids WHERE item_id = ?', [itemId]);

        if (bids[0].count > 0) {
            return res.status(400).json({ success: false, message: '입찰이 있는 상품은 삭제할 수 없습니다.' });
        }

        // 상품 삭제
        await db.query('DELETE FROM items WHERE id = ?', [itemId]);

        res.json({ success: true, message: '상품이 삭제되었습니다.' });
    } catch (error) {
        console.error('상품 삭제 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 종료된 경매 처리 함수
async function processExpiredAuctions() {
    try {
        // 종료 시간이 지났지만 아직 active 상태인 경매 찾기
        const [expiredItems] = await db.query(`
            SELECT * FROM items
            WHERE status = 'active' AND end_time <= NOW()
        `);

        for (const item of expiredItems) {
            // 최고 입찰 찾기
            const [highestBid] = await db.query(`
                SELECT * FROM bids
                WHERE item_id = ?
                ORDER BY bid_amount DESC
                LIMIT 1
            `, [item.id]);

            const connection = await db.getConnection();
            await connection.beginTransaction();

            try {
                if (highestBid.length > 0) {
                    // 입찰이 있는 경우 - 최고 입찰자에게 판매
                    const bid = highestBid[0];

                    // 구매자 잔액 확인
                    const [buyer] = await connection.query(
                        'SELECT balance FROM users WHERE id = ?',
                        [bid.user_id]
                    );

                    if (buyer.length > 0 && parseFloat(buyer[0].balance) >= parseFloat(bid.bid_amount)) {
                        // 구매자 잔액 차감
                        await connection.query(
                            'UPDATE users SET balance = balance - ? WHERE id = ?',
                            [bid.bid_amount, bid.user_id]
                        );

                        // 판매자 잔액 증가
                        await connection.query(
                            'UPDATE users SET balance = balance + ? WHERE id = ?',
                            [bid.bid_amount, item.seller_id]
                        );

                        // 상품 상태를 sold로 변경
                        await connection.query(
                            'UPDATE items SET status = "sold" WHERE id = ?',
                            [item.id]
                        );

                        // 거래 기록 생성
                        await connection.query(
                            'INSERT INTO transactions (item_id, buyer_id, seller_id, final_price, status) VALUES (?, ?, ?, ?, "completed")',
                            [item.id, bid.user_id, item.seller_id, bid.bid_amount]
                        );

                        console.log(`경매 종료: 상품 ID ${item.id}, 낙찰가 ${bid.bid_amount}원`);

                        // WebSocket으로 경매 종료 알림
                        if (io) {
                            const [winnerInfo] = await connection.query('SELECT username FROM users WHERE id = ?', [bid.user_id]);
                            io.emit('auction_ended', {
                                itemId: item.id,
                                itemTitle: item.title,
                                finalPrice: bid.bid_amount,
                                winnerName: winnerInfo[0].username,
                                status: 'sold'
                            });
                        }
                    } else {
                        // 잔액 부족 - 경매 만료 처리
                        await connection.query(
                            'UPDATE items SET status = "expired" WHERE id = ?',
                            [item.id]
                        );
                        console.log(`경매 만료: 상품 ID ${item.id} (구매자 잔액 부족)`);

                        // WebSocket으로 경매 만료 알림
                        if (io) {
                            io.emit('auction_ended', {
                                itemId: item.id,
                                itemTitle: item.title,
                                status: 'expired',
                                reason: 'insufficient_balance'
                            });
                        }
                    }
                } else {
                    // 입찰이 없는 경우 - 만료 처리
                    await connection.query(
                        'UPDATE items SET status = "expired" WHERE id = ?',
                        [item.id]
                    );
                    console.log(`경매 만료: 상품 ID ${item.id} (입찰 없음)`);

                    // WebSocket으로 경매 만료 알림
                    if (io) {
                        io.emit('auction_ended', {
                            itemId: item.id,
                            itemTitle: item.title,
                            status: 'expired',
                            reason: 'no_bids'
                        });
                    }
                }

                await connection.commit();
            } catch (error) {
                await connection.rollback();
                console.error(`경매 처리 에러 (상품 ID: ${item.id}):`, error);
            } finally {
                connection.release();
            }
        }
    } catch (error) {
        console.error('종료된 경매 처리 에러:', error);
    }
}

// 입찰 횟수 조회 헬퍼 함수
async function getBidCount(itemId) {
    const [result] = await db.query('SELECT COUNT(*) as count FROM bids WHERE item_id = ?', [itemId]);
    return result[0].count;
}

// 경매 처리 함수를 외부에서 호출할 수 있도록 export
router.processExpiredAuctions = processExpiredAuctions;

module.exports = router;
