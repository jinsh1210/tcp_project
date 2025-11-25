const net = require('net');
const db = require('../config/database');

class TCPServer {
    constructor(port) {
        this.port = port;
        this.server = null;
        this.clients = new Map();
    }

    async handleBid(data) {
        try {
            const { itemId, userId, bidAmount } = JSON.parse(data);

            // 현재 상품 정보 조회
            const [items] = await db.query(
                'SELECT * FROM items WHERE id = ? AND status = "active"',
                [itemId]
            );

            if (items.length === 0) {
                return { success: false, message: '경매가 종료되었거나 존재하지 않는 상품입니다.' };
            }

            const item = items[0];

            // 입찰가 검증
            if (bidAmount <= item.current_price) {
                return { success: false, message: '현재가보다 높은 금액을 입찰해야 합니다.' };
            }

            // 사용자 잔액 확인
            const [users] = await db.query('SELECT balance FROM users WHERE id = ?', [userId]);
            if (users.length === 0 || users[0].balance < bidAmount) {
                return { success: false, message: '잔액이 부족합니다.' };
            }

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

            return {
                success: true,
                message: '입찰에 성공했습니다.',
                data: {
                    itemId,
                    newPrice: bidAmount,
                    userId
                }
            };
        } catch (error) {
            console.error('입찰 처리 에러:', error);
            return { success: false, message: '입찰 처리 중 오류가 발생했습니다.' };
        }
    }

    start() {
        this.server = net.createServer((socket) => {
            const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
            console.log(`TCP 클라이언트 연결: ${clientId}`);

            this.clients.set(clientId, socket);

            socket.on('data', async (data) => {
                const message = data.toString().trim();
                console.log(`TCP 수신 [${clientId}]: ${message}`);

                try {
                    const request = JSON.parse(message);

                    if (request.action === 'bid') {
                        const result = await this.handleBid(message);
                        socket.write(JSON.stringify(result) + '\n');
                    } else {
                        socket.write(JSON.stringify({
                            success: false,
                            message: '알 수 없는 요청입니다.'
                        }) + '\n');
                    }
                } catch (error) {
                    console.error('메시지 처리 에러:', error);
                    socket.write(JSON.stringify({
                        success: false,
                        message: '잘못된 요청 형식입니다.'
                    }) + '\n');
                }
            });

            socket.on('end', () => {
                console.log(`TCP 클라이언트 연결 종료: ${clientId}`);
                this.clients.delete(clientId);
            });

            socket.on('error', (error) => {
                console.error(`TCP 소켓 에러 [${clientId}]:`, error);
                this.clients.delete(clientId);
            });
        });

        this.server.listen(this.port, () => {
            console.log(`TCP 서버가 포트 ${this.port}에서 실행 중입니다.`);
        });
    }

    broadcast(message) {
        const data = JSON.stringify(message) + '\n';
        this.clients.forEach((socket, clientId) => {
            try {
                socket.write(data);
            } catch (error) {
                console.error(`브로드캐스트 실패 [${clientId}]:`, error);
            }
        });
    }
}

module.exports = TCPServer;
