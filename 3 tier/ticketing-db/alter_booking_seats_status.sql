-- booking_seats 테이블에 조건부 유니크 인덱스 추가
-- 목적: 환불 시 DELETE 대신 UPDATE로 이력 보존하면서, ACTIVE 좌석만 유니크 충돌 발생
-- MySQL에서 partial unique index가 없으므로 Generated Column + NULL 유니크 특성 활용

USE ticketing_test;

-- 1) status 컬럼 추가 (이미 있으면 무시)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ticketing_test'
    AND TABLE_NAME = 'booking_seats'
    AND COLUMN_NAME = 'status'
);
SET @sql1 = IF(@col_exists = 0,
  "ALTER TABLE booking_seats ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'",
  "SELECT 'status column already exists'"
);
PREPARE stmt FROM @sql1;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) 기존 유니크 제약 제거 (있으면 제거)
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'ticketing_test'
    AND TABLE_NAME = 'booking_seats'
    AND INDEX_NAME = 'uq_booking_seats_schedule_seat'
);
SET @sql2 = IF(@idx_exists > 0,
  "ALTER TABLE booking_seats DROP INDEX uq_booking_seats_schedule_seat",
  "SELECT 'old unique index already dropped'"
);
PREPARE stmt FROM @sql2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Generated Column + 새 유니크 제약
--    ACTIVE면 (schedule_id, seat_id) 값, 아니면 NULL
--    MySQL에서 NULL은 UNIQUE 제약에 걸리지 않음

-- 3-0) 이전 버전(문자열 CONCAT) 컬럼/인덱스가 있으면 제거
SET @old_col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ticketing_test'
    AND TABLE_NAME = 'booking_seats'
    AND COLUMN_NAME = 'active_schedule_seat'
);
SET @old_idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'ticketing_test'
    AND TABLE_NAME = 'booking_seats'
    AND INDEX_NAME = 'uq_booking_seats_active_seat'
);
SET @sql3_0 = IF(@old_idx_exists > 0,
  "ALTER TABLE booking_seats DROP INDEX uq_booking_seats_active_seat",
  "SELECT 'old active unique index already dropped'"
);
PREPARE stmt FROM @sql3_0;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @sql3_0b = IF(@old_col_exists > 0,
  "ALTER TABLE booking_seats DROP COLUMN active_schedule_seat",
  "SELECT 'old active_schedule_seat column already dropped'"
);
PREPARE stmt FROM @sql3_0b;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3-1) 새 Generated Columns + 복합 UNIQUE 인덱스 (리빌드 최소화를 위해 VIRTUAL 사용)
SET @active_schedule_id_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ticketing_test'
    AND TABLE_NAME = 'booking_seats'
    AND COLUMN_NAME = 'active_schedule_id'
);
SET @active_seat_id_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ticketing_test'
    AND TABLE_NAME = 'booking_seats'
    AND COLUMN_NAME = 'active_seat_id'
);
SET @new_uq_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'ticketing_test'
    AND TABLE_NAME = 'booking_seats'
    AND INDEX_NAME = 'uq_booking_seats_active_seat'
);

-- 컬럼/인덱스를 한 번에 추가할 수 있을 때만 단일 ALTER 실행
SET @sql3_1 = IF(@active_schedule_id_exists = 0 AND @active_seat_id_exists = 0 AND @new_uq_exists = 0,
  "ALTER TABLE booking_seats \
     ADD COLUMN active_schedule_id BIGINT GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN schedule_id ELSE NULL END) VIRTUAL, \
     ADD COLUMN active_seat_id BIGINT GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN seat_id ELSE NULL END) VIRTUAL, \
     ADD UNIQUE INDEX uq_booking_seats_active_seat (active_schedule_id, active_seat_id)",
  "SELECT 'active generated columns / unique index already exist (or partially exist)'"
);
PREPARE stmt FROM @sql3_1;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 부분 적용 상태(컬럼만 있고 인덱스가 없거나, 1개만 있는 경우)는 수동 정리가 필요함
-- (자동으로 여러 분기 ALTER를 더 수행하면 현재 환경에서 FK 1215 재현 가능성이 커서 여기서 멈춤)

-- 4) status 인덱스 추가
CREATE INDEX idx_booking_seats_status ON booking_seats(status);
