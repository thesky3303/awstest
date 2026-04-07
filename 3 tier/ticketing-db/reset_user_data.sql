-- 사용자 개입 데이터 리셋(테스트 데이터 제거)
-- 목적: 예매/결제/좌석점유 등 유저가 만들었던 데이터 전부 삭제
-- 주의: 운영 데이터가 있다면 실행하면 안 됩니다.

USE ticketing_test;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE booking_seats;
TRUNCATE TABLE payment;
TRUNCATE TABLE booking;
SET FOREIGN_KEY_CHECKS = 1;

-- 스케줄 잔여/상태 리셋
UPDATE schedules
SET total_count = 30,
    remain_count = 30,
    status = 'OPEN',
    updated_at = NOW();

