require('dotenv').config();
const db = require('../config/database');
const { hashPassword } = require('../utils/auth');

async function migratePasswords() {
    console.log('비밀번호 암호화 마이그레이션 시작...\n');

    try {
        // 모든 사용자 조회
        const [users] = await db.query('SELECT id, username, password FROM users');

        console.log(`총 ${users.length}명의 사용자를 찾았습니다.`);

        for (const user of users) {
            // 비밀번호가 이미 암호화되어 있는지 확인 (bcrypt 해시는 $2b$로 시작)
            if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
                console.log(`✓ ${user.username}: 이미 암호화됨 (건너뜀)`);
                continue;
            }

            // 평문 비밀번호를 해시화
            const hashedPassword = await hashPassword(user.password);

            // 데이터베이스 업데이트
            await db.query(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, user.id]
            );

            console.log(`✓ ${user.username}: 비밀번호 암호화 완료`);
        }

        console.log('\n비밀번호 암호화 마이그레이션이 완료되었습니다!');
    } catch (error) {
        console.error('마이그레이션 에러:', error);
    } finally {
        process.exit(0);
    }
}

// 스크립트 실행
migratePasswords();
