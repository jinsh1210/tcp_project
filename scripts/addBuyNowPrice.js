require('dotenv').config();
const db = require('../config/database');

async function addBuyNowPriceColumn() {
    console.log('즉시 구매가 컬럼 추가 마이그레이션 시작...\n');

    try {
        // 컬럼이 이미 존재하는지 확인
        const [columns] = await db.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'items'
            AND COLUMN_NAME = 'buy_now_price'
        `, [process.env.DB_NAME || 'auction_db']);

        if (columns.length > 0) {
            console.log('✓ buy_now_price 컬럼이 이미 존재합니다.');
        } else {
            // 컬럼 추가
            await db.query(`
                ALTER TABLE items
                ADD COLUMN buy_now_price DECIMAL(10, 2) DEFAULT NULL
                AFTER current_price
            `);
            console.log('✓ buy_now_price 컬럼이 성공적으로 추가되었습니다.');
        }

        console.log('\n마이그레이션이 완료되었습니다!');
    } catch (error) {
        console.error('마이그레이션 에러:', error);
    } finally {
        process.exit(0);
    }
}

// 스크립트 실행
addBuyNowPriceColumn();
