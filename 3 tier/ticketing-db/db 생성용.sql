ALTER USER 'root'@'localhost' IDENTIFIED BY 'soldesk1';

CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'soldesk1';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;

CREATE DATABASE IF NOT EXISTS ticketing_test
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE ticketing_test;

CREATE TABLE users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_users (
    admin_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_login_id VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    admin_name VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'STAFF',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL
);

CREATE TABLE movies (
    movie_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    genre VARCHAR(50) NULL,
    director VARCHAR(100) NULL,
    runtime_minutes INT NOT NULL DEFAULT 0 COMMENT '상영시간(분)',
    poster_url VARCHAR(255) NULL,
    main_poster_url VARCHAR(255) NULL,
    video_url VARCHAR(255) NULL COMMENT '동영상 URL 주소',
    audience_count BIGINT NOT NULL DEFAULT 0 COMMENT '누적 관객수',
    release_date DATE NULL,
    synopsis TEXT NULL,
    synopsis_line TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    hide CHAR(1) NOT NULL DEFAULT 'N' COMMENT '숨김여부(Y/N)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE theaters (
    theater_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE halls (
    hall_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    theater_id BIGINT NOT NULL,
    hall_name VARCHAR(20) NOT NULL COMMENT 'A관, B관',
    total_seats INT NOT NULL DEFAULT 30,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_halls_theater
        FOREIGN KEY (theater_id) REFERENCES theaters(theater_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_halls_theater_name UNIQUE (theater_id, hall_name),
    CONSTRAINT chk_halls_total_seats CHECK (total_seats > 0)
);

CREATE TABLE hall_seats (
    seat_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    hall_id BIGINT NOT NULL,
    seat_row_no INT NOT NULL COMMENT '1,2,3...',
    seat_col_no INT NOT NULL COMMENT '1~10',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_hall_seats_hall
        FOREIGN KEY (hall_id) REFERENCES halls(hall_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_hall_seats_position UNIQUE (hall_id, seat_row_no, seat_col_no),
    CONSTRAINT chk_hall_seats_row_no CHECK (seat_row_no > 0),
    CONSTRAINT chk_hall_seats_col_no CHECK (seat_col_no > 0)
);

CREATE TABLE schedules (
    schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    movie_id BIGINT NOT NULL,
    hall_id BIGINT NOT NULL,
    show_date DATETIME NOT NULL,
    total_count INT NOT NULL,
    remain_count INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_by_admin_id BIGINT NULL,
    updated_by_admin_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_schedules_movie
        FOREIGN KEY (movie_id) REFERENCES movies(movie_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_schedules_hall
        FOREIGN KEY (hall_id) REFERENCES halls(hall_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_schedules_created_admin
        FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(admin_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_schedules_updated_admin
        FOREIGN KEY (updated_by_admin_id) REFERENCES admin_users(admin_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_schedules_total_count CHECK (total_count >= 0),
    CONSTRAINT chk_schedules_remain_count CHECK (remain_count >= 0),
    CONSTRAINT chk_schedules_valid_count CHECK (remain_count <= total_count)
);

CREATE TABLE booking (
    booking_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    schedule_id BIGINT NOT NULL,
    req_count INT NOT NULL,
    book_status VARCHAR(20) NOT NULL DEFAULT 'HOLD',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_booking_schedule
        FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_booking_req_count CHECK (req_count > 0)
);

CREATE TABLE booking_seats (
    booking_seat_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    schedule_id BIGINT NOT NULL,
    seat_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_seats_booking
        FOREIGN KEY (booking_id) REFERENCES booking(booking_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_booking_seats_schedule
        FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_booking_seats_seat
        FOREIGN KEY (seat_id) REFERENCES hall_seats(seat_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_booking_seats_schedule_seat UNIQUE (schedule_id, seat_id)
);

CREATE TABLE payment (
    payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    pay_yn CHAR(1) NOT NULL DEFAULT 'N',
    paid_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_booking
        FOREIGN KEY (booking_id) REFERENCES booking(booking_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uq_payment_booking UNIQUE (booking_id),
    CONSTRAINT chk_payment_pay_yn CHECK (pay_yn IN ('Y', 'N'))
);

CREATE TABLE inquiries (
    inquiry_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    inquiry_status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_inquiry_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE inquiry_answers (
    answer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    inquiry_id BIGINT NOT NULL,
    admin_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_answer_inquiry
        FOREIGN KEY (inquiry_id) REFERENCES inquiries(inquiry_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_answer_admin
        FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE reviews (
    review_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    movie_id BIGINT NOT NULL,
    rating TINYINT NOT NULL,
    content TEXT NOT NULL,
    review_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_review_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_review_movie
        FOREIGN KEY (movie_id) REFERENCES movies(movie_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE admin_login_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT NOT NULL,
    login_ip VARCHAR(45) NOT NULL,
    login_result VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_login_log_admin
        FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE admin_action_logs (
    action_log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT NOT NULL,
    action_type VARCHAR(20) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL,
    description VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_action_log_admin
        FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_movies_title ON movies(title);
CREATE INDEX idx_movies_status ON movies(status);

CREATE INDEX idx_halls_theater_id ON halls(theater_id);

CREATE INDEX idx_hall_seats_hall_id ON hall_seats(hall_id);
CREATE INDEX idx_hall_seats_status ON hall_seats(status);

CREATE INDEX idx_schedules_movie_id ON schedules(movie_id);
CREATE INDEX idx_schedules_hall_id ON schedules(hall_id);
CREATE INDEX idx_schedules_show_date ON schedules(show_date);
CREATE INDEX idx_schedules_status ON schedules(status);

CREATE INDEX idx_booking_user_id ON booking(user_id);
CREATE INDEX idx_booking_schedule_id ON booking(schedule_id);
CREATE INDEX idx_booking_status ON booking(book_status);

CREATE INDEX idx_booking_seats_booking_id ON booking_seats(booking_id);
CREATE INDEX idx_booking_seats_schedule_id ON booking_seats(schedule_id);
CREATE INDEX idx_booking_seats_seat_id ON booking_seats(seat_id);

CREATE INDEX idx_inquiries_user_id ON inquiries(user_id);
CREATE INDEX idx_inquiries_status ON inquiries(inquiry_status);

CREATE INDEX idx_inquiry_answers_inquiry_id ON inquiry_answers(inquiry_id);
CREATE INDEX idx_inquiry_answers_admin_id ON inquiry_answers(admin_id);

CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_movie_id ON reviews(movie_id);
CREATE INDEX idx_reviews_status ON reviews(review_status);

CREATE INDEX idx_admin_login_logs_admin_id ON admin_login_logs(admin_id);
CREATE INDEX idx_admin_action_logs_admin_id ON admin_action_logs(admin_id);
CREATE INDEX idx_admin_action_logs_target ON admin_action_logs(target_type, target_id);



ALTER TABLE booking
ADD COLUMN booking_code VARCHAR(50) NULL UNIQUE AFTER booking_id;