-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS auction_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auction_db;

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 상품 테이블
CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seller_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    starting_price DECIMAL(10, 2) NOT NULL,
    current_price DECIMAL(10, 2) NOT NULL,
    buy_now_price DECIMAL(10, 2) DEFAULT NULL,
    image_url VARCHAR(500),
    status ENUM('active', 'sold', 'expired') DEFAULT 'active',
    end_time DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 입찰 테이블
CREATE TABLE IF NOT EXISTS bids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    bid_amount DECIMAL(10, 2) NOT NULL,
    bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 거래 테이블
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    final_price DECIMAL(10, 2) NOT NULL,
    transaction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 커뮤니티 게시판 테이블
CREATE TABLE IF NOT EXISTS community_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 커뮤니티 댓글 테이블
CREATE TABLE IF NOT EXISTS community_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 샘플 데이터 삽입
INSERT INTO users (username, email, password, balance, role) VALUES
('buyer1', 'buyer1@example.com', 'password123', 10000.00, 'user'),
('seller1', 'seller1@example.com', 'password123', 5000.00, 'user'),
('buyer2', 'buyer2@example.com', 'password123', 15000.00, 'user'),
('admin', 'admin@auction.com', 'admin123', 0, 'admin')
ON DUPLICATE KEY UPDATE role = VALUES(role);

INSERT INTO items (seller_id, title, description, starting_price, current_price, buy_now_price, end_time) VALUES
(2, '아이폰 14 Pro', '거의 새것 같은 아이폰 14 Pro 256GB', 800000, 800000, 1000000, DATE_ADD(NOW(), INTERVAL 2 DAY)),
(2, '맥북 프로 2021', 'M1 Pro 칩, 16GB RAM, 512GB SSD', 1500000, 1500000, 1800000, DATE_ADD(NOW(), INTERVAL 3 DAY)),
(2, '에어팟 프로 2세대', '미개봉 새상품', 200000, 200000, NULL, DATE_ADD(NOW(), INTERVAL 1 DAY)),
(2, '아이패드 에어', '64GB, 스페이스 그레이', 500000, 500000, 600000, DATE_ADD(NOW(), INTERVAL 2 DAY));
