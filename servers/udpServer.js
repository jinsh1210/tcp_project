const dgram = require('dgram');
const db = require('../config/database');

class UDPServer {
    constructor(port) {
        this.port = port;
        this.server = dgram.createSocket('udp4');
        this.clients = new Set();
        this.broadcastInterval = null;
    }

    start() {
        this.server.on('error', (err) => {
            console.error('UDP 서버 에러:', err);
            this.server.close();
        });

        this.server.on('message', (msg, rinfo) => {
            const message = msg.toString().trim();
            console.log(`UDP 수신 [${rinfo.address}:${rinfo.port}]: ${message}`);

            try {
                const request = JSON.parse(message);

                if (request.action === 'subscribe') {
                    // 클라이언트 등록
                    const clientKey = `${rinfo.address}:${rinfo.port}`;
                    this.clients.add(clientKey);
                    console.log(`UDP 클라이언트 등록: ${clientKey}`);

                    // 즉시 현재 경매 상태 전송
                    this.sendAuctionStatus(rinfo.address, rinfo.port);
                } else if (request.action === 'unsubscribe') {
                    const clientKey = `${rinfo.address}:${rinfo.port}`;
                    this.clients.delete(clientKey);
                    console.log(`UDP 클라이언트 해제: ${clientKey}`);
                }
            } catch (error) {
                console.error('UDP 메시지 처리 에러:', error);
            }
        });

        this.server.on('listening', () => {
            const address = this.server.address();
            console.log(`UDP 서버가 포트 ${address.port}에서 실행 중입니다.`);
        });

        this.server.bind(this.port);

        // 주기적으로 경매 상태 브로드캐스트 (5초마다)
        this.startBroadcast();
    }

    async sendAuctionStatus(address, port) {
        try {
            const [items] = await db.query(`
                SELECT
                    i.id,
                    i.title,
                    i.current_price,
                    i.end_time,
                    u.username as seller_name,
                    (SELECT COUNT(*) FROM bids WHERE item_id = i.id) as bid_count
                FROM items i
                JOIN users u ON i.seller_id = u.id
                WHERE i.status = 'active'
                ORDER BY i.end_time ASC
            `);

            const data = {
                type: 'auction_status',
                timestamp: new Date().toISOString(),
                items: items.map(item => ({
                    id: item.id,
                    title: item.title,
                    currentPrice: item.current_price,
                    endTime: item.end_time,
                    sellerName: item.seller_name,
                    bidCount: item.bid_count
                }))
            };

            const message = Buffer.from(JSON.stringify(data));
            this.server.send(message, port, address, (err) => {
                if (err) {
                    console.error(`UDP 전송 실패 [${address}:${port}]:`, err);
                }
            });
        } catch (error) {
            console.error('경매 상태 조회 에러:', error);
        }
    }

    startBroadcast() {
        // 5초마다 모든 클라이언트에게 경매 상태 브로드캐스트
        this.broadcastInterval = setInterval(async () => {
            if (this.clients.size === 0) return;

            try {
                const [items] = await db.query(`
                    SELECT
                        i.id,
                        i.title,
                        i.current_price,
                        i.end_time,
                        u.username as seller_name,
                        (SELECT COUNT(*) FROM bids WHERE item_id = i.id) as bid_count
                    FROM items i
                    JOIN users u ON i.seller_id = u.id
                    WHERE i.status = 'active'
                    ORDER BY i.end_time ASC
                `);

                const data = {
                    type: 'auction_status',
                    timestamp: new Date().toISOString(),
                    items: items.map(item => ({
                        id: item.id,
                        title: item.title,
                        currentPrice: item.current_price,
                        endTime: item.end_time,
                        sellerName: item.seller_name,
                        bidCount: item.bid_count
                    }))
                };

                const message = Buffer.from(JSON.stringify(data));

                this.clients.forEach((clientKey) => {
                    const [address, port] = clientKey.split(':');
                    this.server.send(message, parseInt(port), address, (err) => {
                        if (err) {
                            console.error(`UDP 브로드캐스트 실패 [${clientKey}]:`, err);
                        }
                    });
                });
            } catch (error) {
                console.error('브로드캐스트 에러:', error);
            }
        }, 5000);
    }

    stop() {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
        }
        this.server.close();
    }
}

module.exports = UDPServer;
