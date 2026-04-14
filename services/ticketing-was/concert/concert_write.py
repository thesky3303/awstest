"""
콘서트 예매 쓰기 — SQS FIFO 통합 버전.
원본: _ShowLockPool(threading.Lock) → SQS FIFO MessageGroupId=show_id.
      유저별 그룹(show_id-user_id)으로 분리해 동일 회차라도 타 유저 대량 적체에 GUI 예매가 묻히지 않게 함(DB는 FOR UPDATE 로 좌석 정합성 유지).
"""
import json
import uuid
import secrets
import string
import pymysql
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from config import BOOKING_QUEUE_COUNTER_TTL_SEC, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER
from sqs_client import get_booking_status_dict, send_booking_message
from concert.sale_state import get_sale_state, is_open, set_sale_state
from concert.seat_hold import adjust_remain, try_hold_seats
from cache.redis_client import redis_client
from waiting_room import (
    enter as wr_enter,
    metrics as wr_metrics,
    observe as wr_observe,
    reset as wr_reset,
    set_control_full as wr_set_control_full,
    status as wr_status,
    verify_permit as wr_verify_permit,
)

router = APIRouter()

# NOTE: Local synchronous fallback removed (EKS-only).

def _reset_concert_redis_seat_state(*, show_id: int) -> dict:
    """
    데모/테스트용: 해당 show_id의 '좌석 상태' Redis 키를 **write-api가 실제로 사용하는 Redis(DB=cache)** 기준으로 리셋.
    - confirmed/hold/hold_rev/pending/show snapshot/seat hold keys 정리
    - holdmeta는 booking_ref 기준 키라 show_id별 패턴이 없어, value(JSON)에서 show_id를 확인해 선택적으로 삭제한다.
    """
    sid = int(show_id or 0)
    if sid <= 0:
        return {"ok": False, "code": "BAD_SHOW_ID"}

    keys_fixed = [
        f"concert:confirmed:{sid}:v1",
        f"concert:hold:{sid}:v1",
        f"concert:show:{sid}:hold_rev:v1",
        f"concert:show:{sid}:pending:v1",
        f"concert:show:{sid}:read:v2",
    ]
    deleted_fixed = 0
    try:
        deleted_fixed = int(redis_client.delete(*keys_fixed) or 0)
    except Exception:
        deleted_fixed = 0

    # seat hold keys는 개수가 많을 수 있어 scan_iter로 정리
    deleted_seat_keys = 0
    try:
        batch: list[str] = []
        pat = f"concert:seat:{sid}:*:hold:v1"
        for k in redis_client.scan_iter(match=pat, count=1000):
            batch.append(str(k))
            if len(batch) >= 1000:
                deleted_seat_keys += int(redis_client.delete(*batch) or 0)
                batch = []
        if batch:
            deleted_seat_keys += int(redis_client.delete(*batch) or 0)
    except Exception:
        deleted_seat_keys = 0

    # holdmeta는 show_id별 패턴이 없어 value를 보고 골라서 삭제(데모 전용)
    deleted_holdmeta = 0
    scanned_holdmeta = 0
    try:
        batch2: list[str] = []
        for k in redis_client.scan_iter(match="concert:holdmeta:*:v1", count=1000):
            kk = str(k)
            scanned_holdmeta += 1
            try:
                raw = redis_client.get(kk)
                meta = json.loads(raw) if raw else None
                if isinstance(meta, dict) and int(meta.get("show_id") or 0) == sid:
                    batch2.append(kk)
            except Exception:
                # 파싱 실패 등은 스킵
                continue
            if len(batch2) >= 500:
                deleted_holdmeta += int(redis_client.delete(*batch2) or 0)
                batch2 = []
        if batch2:
            deleted_holdmeta += int(redis_client.delete(*batch2) or 0)
    except Exception:
        deleted_holdmeta = 0

    return {
        "ok": True,
        "show_id": sid,
        "deleted_fixed": int(deleted_fixed),
        "deleted_seat_keys": int(deleted_seat_keys),
        "deleted_holdmeta": int(deleted_holdmeta),
        "scanned_holdmeta": int(scanned_holdmeta),
    }

def _pending_key(show_id: int) -> str:
    return f"concert:show:{int(show_id)}:pending:v1"


def _pending_incr(show_id: int, delta: int) -> None:
    d = int(delta or 0)
    if d == 0:
        return
    try:
        k = _pending_key(int(show_id))
        v = int(redis_client.incrby(k, d) or 0)
        # 카운터 누적 방지: 오픈/런 단위로 자연 만료
        try:
            ttl = int(BOOKING_QUEUE_COUNTER_TTL_SEC)
            if ttl > 0:
                redis_client.expire(k, ttl)
        except Exception:
            pass
        # 음수로 내려가는 비정상 케이스 방지
        if v < 0:
            redis_client.set(k, "0")
    except Exception:
        return


def _to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_seat_key(value: str):
    text = str(value or "").strip()
    parts = text.split("-")
    if len(parts) != 2:
        return None
    row = _to_int(parts[0])
    col = _to_int(parts[1])
    if row <= 0 or col <= 0:
        return None
    return row, col


def _get_tx_connection():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def _is_duplicate_key_error(exc: Exception) -> bool:
    if not isinstance(exc, pymysql.err.IntegrityError):
        return False
    try:
        return int(exc.args[0]) == 1062
    except Exception:
        return False


def _generate_booking_code() -> str:
    letters = "".join(secrets.choice(string.ascii_uppercase) for _ in range(2))
    digits = "".join(secrets.choice(string.digits) for _ in range(6))
    return f"C{letters}{digits}"


def _seat_shard_id(row: int, col: int) -> int:
    """
    한 회차 내부 샤딩(병렬 처리 데모/운영용).
    - FIFO MessageGroupId를 show_id 단일이 아니라 show_id+shard로 쪼개면
      같은 회차라도 서로 다른 shard는 병렬 처리 가능(파드 확장 효과가 큼).
    - 샤드 수는 환경변수로 조절(기본 64).
    """
    try:
        n = int((__import__("os").getenv("CONCERT_FIFO_SHARDS", "64") or "64").strip())
    except Exception:
        n = 64
    n = max(1, min(1024, n))
    # 좌석 좌표 기반의 간단한 해시(빠르고 분산 충분)
    return ((int(row) * 1000003) ^ int(col)) % n


@router.post("/api/write/concerts/booking/commit")
def commit_concert_booking(payload: dict):
    data = payload if isinstance(payload, dict) else {}
    user_id = _to_int(data.get("user_id"))
    show_id = _to_int(data.get("show_id"))
    seats = data.get("seats") or []
    skip_hold = bool(data.get("skip_hold") is True)
    permit_token = str(data.get("permit_token") or "").strip()

    if user_id <= 0 or show_id <= 0:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "code": "BAD_REQUEST", "message": "요청값이 올바르지 않습니다."},
        )

    if not isinstance(seats, list) or not seats:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "code": "NO_SEATS", "message": "좌석을 선택해주세요."},
        )

    parsed_seats = []
    seat_set = set()
    for item in seats:
        parsed = _parse_seat_key(item)
        if not parsed:
            return JSONResponse(
                status_code=400,
                content={"ok": False, "code": "BAD_SEAT_KEY", "message": "좌석 형식이 올바르지 않습니다."},
            )
        if parsed in seat_set:
            continue
        seat_set.add(parsed)
        parsed_seats.append(parsed)

    req_count = len(parsed_seats)
    if req_count <= 0:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "code": "NO_SEATS", "message": "좌석을 선택해주세요."},
        )

    # Waiting Room(입장 대기열): permit 없이는 커밋을 받지 않는다(새치기 방지).
    if not wr_verify_permit(permit_token=permit_token, kind="concert", entity_id=show_id, user_id=user_id):
        return JSONResponse(
            status_code=429,
            content={
                "ok": False,
                "code": "WAITING_ROOM_REQUIRED",
                "message": "대기열 처리 중입니다. 잠시 후 다시 시도해주세요.",
            },
        )

    # 실서비스 UX: 마감 상태면 즉시 컷(백그라운드 처리량/큐 적체와 무관하게 화면은 '땡'에 끊긴다)
    if not is_open(show_id):
        st = get_sale_state(show_id)
        return JSONResponse(
            status_code=409,
            content={
                "ok": False,
                "code": "SALES_CLOSED",
                "message": "모든 투표가 마감되었습니다.",
                "sale": st,
            },
        )

    # booking_ref를 write-api에서 먼저 발급해 Redis 홀드 ↔ SQS 메시지 ↔ 폴링 키를 하나로 묶는다.
    booking_ref = str(uuid.uuid4())

    hold_applied = False
    pending_count = 0
    if skip_hold:
        # 2) "바로 큐로" 경로: 좌석 홀드를 걸지 않고, enqueue 시점에 pending 카운터로 remain을 선차감한다.
        # - 성공 시 pending은 worker에서 내려가고(중복 차감 방지), confirmed/DB가 remain 감소를 유지한다.
        # - 실패/중복좌석 등은 worker에서 pending을 내려 remain이 복구된다.
        pending_count = int(req_count)
        _pending_incr(show_id, pending_count)
        # remain 단일 카운터 차감(hold 없이도 선차감)
        adjust_remain(show_id=show_id, delta=-pending_count, ttl_sec=BOOKING_QUEUE_COUNTER_TTL_SEC)
    else:
        # 1) 홀드(주황) 경로: 좌석 단위 선점으로 remain이 즉시 줄어들게 한다.
        hold = try_hold_seats(show_id=show_id, seats=parsed_seats, booking_ref=booking_ref)
        if not hold.get("ok"):
            code = hold.get("code") or "DUPLICATE_SEAT"
            # confirmed 좌석은 hold로 덮을 수 없음(회색->주황 금지)
            if str(code) == "CONFIRMED_SEAT":
                return JSONResponse(status_code=409, content={"ok": False, "code": "DUPLICATE_SEAT"})
            return JSONResponse(status_code=409, content={"ok": False, "code": code})
        hold_applied = True

    # Read API는 show 스냅샷 캐시(concert:show:{id}:read:v2)를 그대로 재사용한다.
    # 큐 적체가 길어도 "접수(홀드)" 좌석이 즉시 UI에 점유로 보이려면,
    # 홀드 성공 시점에 스냅샷을 무효화해 다음 조회에서 reserved_seats_snapshot 기반으로 재계산되게 해야 한다.
    try:
        redis_client.delete(f"concert:show:{int(show_id)}:read:v2")
    except Exception:
        pass

    booking_ref = send_booking_message(
        booking_type="concert",
        group_id=f"{show_id}-sh{_seat_shard_id(parsed_seats[0][0], parsed_seats[0][1])}",
        booking_ref=booking_ref,
        payload={
            "user_id": user_id,
            "show_id": show_id,
            "seats": [f"{r}-{c}" for r, c in parsed_seats],
            # pending_count는 "홀드 없이 큐로만 선차감"하는 경로에서 사용.
            "pending_count": int(pending_count),
            "hold_applied": bool(hold_applied),
        },
    )
    return {
        "ok": True,
        "code": "QUEUED",
        "booking_ref": booking_ref,
        "message": "예매 요청이 접수되었습니다.",
    }


@router.post("/api/write/concerts/{show_id}/waiting-room/enter")
def enter_waiting_room(show_id: int, payload: dict):
    data = payload if isinstance(payload, dict) else {}
    user_id = _to_int(data.get("user_id"))
    if user_id <= 0 or int(show_id) <= 0:
        return JSONResponse(status_code=400, content={"ok": False, "code": "BAD_REQUEST"})
    return wr_enter(kind="concert", entity_id=int(show_id), user_id=user_id)


@router.post("/api/write/concerts/{show_id}/waiting-room/reset")
def reset_waiting_room(show_id: int):
    # 테스트/데모용: 서버가 실제로 사용하는 Redis 기준으로 WR 카운터 리셋
    return wr_reset(kind="concert", entity_id=int(show_id))

@router.post("/api/write/concerts/{show_id}/redis/reset")
def reset_concert_redis(show_id: int):
    # 테스트/데모용: 서버가 실제로 쓰는 Redis(cache 논리 DB) 기준으로 콘서트 좌석 상태 키 리셋
    return _reset_concert_redis_seat_state(show_id=int(show_id))


@router.get("/api/write/concerts/waiting-room/status/{queue_ref}")
def waiting_room_status(queue_ref: str):
    return wr_status(queue_ref=queue_ref)


@router.get("/api/write/concerts/{show_id}/waiting-room/metrics")
def waiting_room_metrics(show_id: int):
    return wr_metrics(kind="concert", entity_id=int(show_id))


@router.post("/api/write/concerts/{show_id}/waiting-room/control")
def waiting_room_control(show_id: int, payload: dict):
    data = payload if isinstance(payload, dict) else {}
    mode = data.get("mode", None)
    if mode is not None:
        mode = str(mode).strip().upper()
        if mode not in ("AUTO", "MANUAL"):
            return JSONResponse(status_code=400, content={"ok": False, "code": "BAD_MODE"})
    enabled = data.get("enabled", None)
    if enabled is not None:
        enabled = bool(enabled)
    rate = data.get("admit_rate_per_sec", None)
    if rate is not None:
        try:
            rate = int(rate)
        except Exception:
            return JSONResponse(status_code=400, content={"ok": False, "code": "BAD_RATE"})
    message = data.get("message", None)
    return wr_set_control_full(
        kind="concert",
        entity_id=int(show_id),
        mode=mode,
        enabled=enabled,
        admit_rate_per_sec=rate,
        message=message,
    )


@router.post("/api/write/concerts/{show_id}/waiting-room/observe")
def waiting_room_observe(show_id: int, payload: dict):
    data = payload if isinstance(payload, dict) else {}
    return wr_observe(kind="concert", entity_id=int(show_id), data=data)


@router.get("/api/write/concerts/booking/status/{booking_ref}")
def check_concert_booking_status(booking_ref: str):
    return get_booking_status_dict(booking_ref)


# --- 판매 상태 제어(운영/데모용) ---
@router.get("/api/write/concerts/{show_id}/sale")
def get_concert_sale(show_id: int):
    return {"ok": True, "show_id": int(show_id), "sale": get_sale_state(int(show_id))}


@router.post("/api/write/concerts/{show_id}/sale/open")
def open_concert_sale(show_id: int):
    set_sale_state(int(show_id), "OPEN")
    return {"ok": True, "show_id": int(show_id), "sale": get_sale_state(int(show_id))}


@router.post("/api/write/concerts/{show_id}/sale/close")
def close_concert_sale(show_id: int):
    set_sale_state(int(show_id), "CLOSED")
    return {"ok": True, "show_id": int(show_id), "sale": get_sale_state(int(show_id))}
