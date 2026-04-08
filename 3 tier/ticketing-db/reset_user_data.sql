-- 사용자 개입 데이터 리셋(테스트 데이터 제거)
-- 목적: 예매/결제/좌석점유 등 유저가 만들었던 데이터 전부 삭제
-- 주의: 운영 데이터가 있다면 실행하면 안 됩니다.

USE ticketing_test;

SET FOREIGN_KEY_CHECKS = 0;

-- 유저가 생성/변경하는 트랜잭션성 데이터 전부 제거
TRUNCATE TABLE inquiry_answers;
TRUNCATE TABLE inquiries;
TRUNCATE TABLE reviews;
TRUNCATE TABLE admin_login_logs;
TRUNCATE TABLE admin_action_logs;
TRUNCATE TABLE booking_seats;
TRUNCATE TABLE payment;
TRUNCATE TABLE booking;
TRUNCATE TABLE concert_payment;
TRUNCATE TABLE concert_booking_seats;
TRUNCATE TABLE concert_booking;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- 스케줄 잔여/상태 리셋
UPDATE schedules
SET total_count = 30,
    remain_count = 30,
    status = 'OPEN',
    updated_at = NOW();

-- 콘서트 테이블이 없으면 위 TRUNCATE concert_* 를 제거하세요.
-- 잔여석 리셋: UPDATE concert_shows SET remain_count = total_count, status = 'OPEN';

