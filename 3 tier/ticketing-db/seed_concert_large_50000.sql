USE ticketing_test;

-- 5만석(200 x 250) 예시 콘서트/회차 데이터
-- 좌석 전체 테이블 없이 concert_booking_seats(예약된 좌석만) 쌓는 구조를 그대로 사용합니다.

INSERT INTO concerts
  (title, category, genre, venue_summary, poster_url, runtime_minutes, synopsis, synopsis_line, status, hide)
VALUES
  ('2026 봄 페스티벌 LIVE', 'CONCERT', '페스티벌', '올림픽공원 체조경기장 · 스탠딩 A', 'concert1.jpg', 140,
   '봄 페스티벌 라이브 공연입니다.', '봄 페스티벌 라이브 공연입니다.', 'ACTIVE', 'N');

SET @new_concert_id := LAST_INSERT_ID();

INSERT INTO concert_shows
  (concert_id, show_date, venue_name, venue_address, hall_name, seat_rows, seat_cols, total_count, remain_count, price, status)
VALUES
  (@new_concert_id, '2026-05-10 18:00:00', '올림픽공원 체조경기장', '서울 송파구 올림픽로 424', '스탠딩 A',
   200, 250, 50000, 50000, 120000, 'OPEN');

