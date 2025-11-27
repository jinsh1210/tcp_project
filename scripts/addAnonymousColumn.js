require('dotenv').config();
const db = require('../config/database');

async function addAnonymousColumn() {
    console.log('익명 기능 컬럼 추가 마이그레이션 시작...\n');

    try {
        // community_posts 테이블에 is_anonymous 컬럼 추가
        const [postColumns] = await db.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'community_posts'
            AND COLUMN_NAME = 'is_anonymous'
        `, [process.env.DB_NAME || 'auction_db']);

        if (postColumns.length === 0) {
            await db.query(`
                ALTER TABLE community_posts
                ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE
                AFTER user_id
            `);
            console.log('✓ community_posts 테이블에 is_anonymous 컬럼 추가됨');
        } else {
            console.log('✓ community_posts.is_anonymous 컬럼이 이미 존재함');
        }

        // community_comments 테이블에 is_anonymous 컬럼 추가
        const [commentColumns] = await db.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'community_comments'
            AND COLUMN_NAME = 'is_anonymous'
        `, [process.env.DB_NAME || 'auction_db']);

        if (commentColumns.length === 0) {
            await db.query(`
                ALTER TABLE community_comments
                ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE
                AFTER user_id
            `);
            console.log('✓ community_comments 테이블에 is_anonymous 컬럼 추가됨');
        } else {
            console.log('✓ community_comments.is_anonymous 컬럼이 이미 존재함');
        }

        console.log('\n마이그레이션이 완료되었습니다!');
    } catch (error) {
        console.error('마이그레이션 에러:', error);
    } finally {
        process.exit(0);
    }
}

// 스크립트 실행
addAnonymousColumn();
