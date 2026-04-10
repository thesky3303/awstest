-- 샘플 콘서트/공연 회차 (concert_schema.sql 실행 후)
USE ticketing_test;

INSERT INTO concerts (title, category, genre, venue_summary, poster_url, runtime_minutes, synopsis, synopsis_line, status, hide)
VALUES
(
    '2026 봄 페스티벌 LIVE',
    'CONCERT',
    '페스티벌',
    '올림픽공원 체조경기장',
    '/images/no-image.png',
    150,
    '국내 인기 아티스트가 한자리에 모이는 야외 페스티벌입니다.',
    '야외 페스티벌, 단 하루.',
    'ACTIVE',
    'N'
),
(
    '뮤지컬 <별이 빛나는 밤>',
    'MUSICAL',
    '뮤지컬',
    '샤롯데씨어터',
    '/images/no-image.png',
    140,
    '감동적인 스토리와 라이브 밴드가 어우러진 창작 뮤지컬.',
    '당신의 밤을 비추는 이야기.',
    'ACTIVE',
    'N'
);

SET @cid1 = (SELECT concert_id FROM concerts WHERE title = '2026 봄 페스티벌 LIVE' LIMIT 1);
SET @cid2 = (SELECT concert_id FROM concerts WHERE title = '뮤지컬 <별이 빛나는 밤>' LIMIT 1);

INSERT INTO concert_shows (
    concert_id, show_date, venue_name, venue_address, hall_name,
    seat_rows, seat_cols, total_count, remain_count, price, status
)
VALUES
(@cid1, '2026-05-10 18:00:00', '올림픽공원 체조경기장', '서울 송파구 올림픽로 424', '스탠딩 A', 5, 10, 50, 50, 150000, 'OPEN'),
(@cid1, '2026-05-11 15:00:00', '올림픽공원 체조경기장', '서울 송파구 올림픽로 424', '스탠딩 B', 5, 10, 50, 50, 150000, 'OPEN'),
(@cid2, '2026-06-01 19:30:00', '샤롯데씨어터', '서울 송파구 올림픽로 240', '1층', 5, 10, 50, 50, 99000, 'OPEN'),
(@cid2, '2026-06-02 14:00:00', '샤롯데씨어터', '서울 송파구 올림픽로 240', '1층', 5, 10, 50, 50, 99000, 'OPEN');
