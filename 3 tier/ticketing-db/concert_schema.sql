-- 콘서트/뮤지컬 도메인 (영화 예매 테이블과 분리). 최초 1회 실행.
USE ticketing_test;

CREATE TABLE IF NOT EXISTS concerts (
    concert_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(30) NULL COMMENT 'CONCERT, MUSICAL',
    genre VARCHAR(50) NULL,
    venue_summary VARCHAR(255) NULL,
    poster_url VARCHAR(255) NULL,
    runtime_minutes INT NOT NULL DEFAULT 120,
    synopsis TEXT NULL,
    synopsis_line VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    hide CHAR(1) NOT NULL DEFAULT 'N',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS concert_shows (
    show_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concert_id BIGINT NOT NULL,
    show_date DATETIME NOT NULL,
    venue_name VARCHAR(200) NOT NULL,
    venue_address VARCHAR(255) NOT NULL,
    hall_name VARCHAR(80) NOT NULL DEFAULT '홀',
    seat_rows INT NOT NULL,
    seat_cols INT NOT NULL,
    total_count INT NOT NULL,
    remain_count INT NOT NULL,
    price INT NOT NULL DEFAULT 120000,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_concert_shows_concert
        FOREIGN KEY (concert_id) REFERENCES concerts(concert_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_concert_shows_counts
        CHECK (remain_count >= 0 AND total_count >= 0 AND remain_count <= total_count),
    CONSTRAINT chk_concert_shows_seat_dim
        CHECK (seat_rows > 0 AND seat_cols > 0 AND total_count = seat_rows * seat_cols)
);

CREATE TABLE IF NOT EXISTS concert_booking (
    booking_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(50) NULL,
    user_id BIGINT NOT NULL,
    show_id BIGINT NOT NULL,
    reg_count INT NOT NULL,
    book_status VARCHAR(20) NOT NULL DEFAULT 'PAID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_concert_booking_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_concert_booking_show
        FOREIGN KEY (show_id) REFERENCES concert_shows(show_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_concert_booking_reg CHECK (reg_count > 0),
    UNIQUE INDEX uq_concert_booking_code (booking_code)
);

CREATE TABLE IF NOT EXISTS concert_booking_seats (
    booking_seat_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    show_id BIGINT NOT NULL,
    seat_row_no INT NOT NULL,
    seat_col_no INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active_show_id BIGINT
        GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN show_id ELSE NULL END) VIRTUAL,
    active_row_no INT
        GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN seat_row_no ELSE NULL END) VIRTUAL,
    active_col_no INT
        GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN seat_col_no ELSE NULL END) VIRTUAL,
    CONSTRAINT fk_cbs_booking
        FOREIGN KEY (booking_id) REFERENCES concert_booking(booking_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_cbs_show
        FOREIGN KEY (show_id) REFERENCES concert_shows(show_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_cbs_row CHECK (seat_row_no > 0),
    CONSTRAINT chk_cbs_col CHECK (seat_col_no > 0),
    UNIQUE INDEX uq_concert_booking_seats_active_seat (active_show_id, active_row_no, active_col_no)
);

CREATE TABLE IF NOT EXISTS concert_payment (
    payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    pay_yn CHAR(1) NOT NULL DEFAULT 'Y',
    paid_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_concert_payment_booking
        FOREIGN KEY (booking_id) REFERENCES concert_booking(booking_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_concert_payment_booking UNIQUE (booking_id),
    CONSTRAINT chk_concert_pay_yn CHECK (pay_yn IN ('Y', 'N'))
);
