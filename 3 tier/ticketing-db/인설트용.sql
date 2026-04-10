ALTER TABLE movies
ADD COLUMN hide CHAR(1) NOT NULL DEFAULT 'N' COMMENT '숨김여부(Y/N)' AFTER status;

UPDATE movies
SET hide = 'N'
WHERE movie_id BETWEEN 1 AND 5;

ALTER TABLE movies
ADD COLUMN synopsis_line TEXT NULL AFTER synopsis;

INSERT INTO movies VALUES
(1, '왕과 사는 남자', '드라마', '장항준', 117, '/images/posters/king.jpg', '/images/posters/main_king.jpg', 'https://www.youtube.com/watch?v=9sxEZuJskvM', 3218700, '2026-03-28', '1457년 청령포, 역사가 지우려 했던 이야기', '“나는 이제 어디로 갑니까…”\n\n계유정난이 조선을 뒤흔들고\n어린 왕 이홍위는 왕위에서 쫓겨나 유배길에 오른다.\n\n“무슨 수를 쓰더라도 그 대감을 우리 광천골로 오게 해야지”\n\n한편, 강원도 영월 산골 마을 광천골의 촌장 엄흥도는\n먹고 살기 힘든 마을 사람들을 위해 청령포를 유배지로 만들기 위해 노력한다.\n그러나 촌장이 부푼 꿈으로 맞이한 이는 왕위에서 쫓겨난 이홍위였다.\n유배지를 지키는 보수주인으로서 그의 모든 일상을 감시해야만 하는 촌장은\n삶의 의지를 잃어버린 이홍위가 점점 신경 쓰이는데…\n\n1457년 청령포, 역사가 지우려 했던 이야기\n<왕과 사는 남자>', 'ACTIVE', 'N', '2026-04-03 21:01:25', '2026-04-04 16:51:31'),
(2, '프로젝트 헤일메리', 'SF', '필로드', 156, '/images/posters/hail.jpg', '/images/posters/main_hail.jpg', 'https://www.youtube.com/watch?v=GC2SR2MGdck', 1543200, '2026-03-15', '죽어가는 태양, 종말 위기에 놓인 지구', '죽어가는 태양, 종말 위기에 놓인 지구\n인류의 운명을 건 단 하나의 미션\n그의 마지막 임무가 시작된다!\n\n눈을 떠보니 아득한 우주의 한가운데에서 깨어난 중학교 과학교사 ‘그레이스’는\n희미한 기억 속에서 자신이 죽어가는 태양으로부터 지구와 인류를 살릴 마지막 희망으로\n이곳에 왔다는 사실을 알게 된다.\n\n잃어버린 기억으로 인해 모든 것이 혼란스러운 상황에서\n‘그레이스’는 우연히 우주 한복판에서 같은 목적으로 온 뜻밖의 존재 ‘로키’를 만나게 되고\n‘그레이스’와 ‘로키’는 각 두 행성의 운명을 건 마지막 미션을 수행하러 떠나게 되는데…', 'ACTIVE', 'N', '2026-04-03 21:01:25', '2026-04-04 16:50:55'),
(3, '호퍼스', '애니메이션', '다니엘 총', 104, '/images/posters/ho.jpg', '/images/posters/main_ho.jpg', 'https://www.youtube.com/watch?v=qNIYD3yzG-U', 2875400, '2026-02-20', '디즈니·픽사의 가장 사랑스러운 애니멀 어드벤처가 온다!', '비버 모드 ON!\n좋아, 자연스러웠어!\n\n동물과 자연을 사랑하는 소녀 ''메이블''은\n할머니와의 소중한 추억이 깃든 연못이 사라질 위기에 놓이자,\n이를 지키기 위한 방법을 찾기 위해 고군분투한다.\n \n어느 날, 사람의 의식을 동물 로봇으로 옮기는\n혁신적인 ''호핑'' 기술을 우연히 체험하게 된 ''메이블''!\n로봇 비버로 호핑한 그녀는 동물 세계에 잠입하게 된다.\n \n그 곳에서 열정적인 포유류의 왕 ''조지''를 비롯해\n다양한 개성을 지닌 동물들과 친구가 된 ''메이블''은\n연못을 지킬 수 있는 방법을 떠올리게 되고\n모두가 깜짝 놀랄 기상천외한 작전을 펼치게 되는데…\n \n2026년 3월, <아바타>만큼 흥미롭고 <주토피아> 뺨치게 귀여운\n디즈니·픽사의 가장 사랑스러운 애니멀 어드벤처가 온다!', 'ACTIVE', 'N', '2026-04-03 21:01:25', '2026-04-04 16:50:23'),
(4, '위 리브 인 타임', '멜로/로맨스', '존 크로울리', 108, '/images/posters/we.jpg', '/images/posters/main_we.jpg', 'https://www.youtube.com/watch?v=qqlfn-T-OFA', 980300, '2026-04-08', '우리의 사랑은 함께한 시간에 영원히 남는다.', '본인의 레스토랑 오픈을 준비하며\n\n새로운 도약을 꿈꾸는 셰프 ‘알무트’.\n\n\n\n최근 이혼을 하면서\n\n삶의 한 챕터를 끝낸 ‘토비아스’.\n\n\n\n예기치 못한 만남을 계기로\n\n두 사람은 서로의 삶을 변화시키는\n\n잊지 못할 10년을 보낸다.\n\n\n\n우리의 사랑은 함께한 시간에 영원히 남는다.', 'ACTIVE', 'N', '2026-04-03 21:01:25', '2026-04-05 19:54:08'),
(5, '쉘터', '액션', '릭 로먼 워', 107, '/images/posters/shelter.jpg', '/images/posters/dummy.jpg', 'https://www.youtube.com/watch?v=7Q9P8jyKczU', 0, '2026-04-15', '등대에 홀로 숨어살던 한 남자.', '등대에 홀로 숨어살던 한 남자.\n\n그 앞에 홀로 나타난 한 소녀.\n\n이제 소녀를 지키기 위해,\n그 남자의 숨겨왔던 액션 본능이 깨어난다!', 'ACTIVE', 'N', '2026-04-03 21:01:25', '2026-04-05 19:47:17'),
(6, '네가 마지막으로 남긴 노래', '멜로/로맨스', '미키 타카히로', 117, '/images/posters/last_song.jpg', '/images/posters/dummy.jpg', 'https://www.youtube.com/watch?v=IKjpAIHqBPI', 42251, '2026-04-01', '시를 쓰는 소년과 노래로 세상을 그리는 소녀가 음악으로 이어지는 청춘 로맨스', '“나에게 가사를 써줄래?”\n\n유난히 눈에 띄지 않는 소년 ‘하루토’와\n유난히 빛나는 소녀 ‘아야네’.\n\n글을 읽고 쓰는 데 어려움이 있는 소녀를 대신해 소년은 시를 쓰고,\n그 시는 노래가 되어 소녀의 목소리로 세상에 울려 퍼진다.\n\n둘만의 비밀, 오직 둘만의 언어.\n\n말보다 음악이 먼저 닿은 순간,\n설렘으로 시작되는 가장 찬란한 청춘 로맨스!', 'ACTIVE', 'N', '2026-04-05 16:19:21', '2026-04-05 20:08:52'),
(7, '살목지', '공포', '이상민', 95, '/images/posters/salmokji.jpg', '/images/posters/dummy.jpg', 'https://www.youtube.com/watch?v=jL2kpyq_ODk', 19156, '2026-04-08', '기이한 소문이 끊이지 않는 저수지에서 촬영팀이 정체불명의 존재와 마주하게 되는 공포 영화', '기이한 소문이 끊이지 않는 저수지 살목지의 로드뷰 화면에\n촬영한 적 없는 정체불명의 형체가 포착된다.\n오늘 안에 반드시 재촬영을 끝내야 하는 상황 속에\n살목지로 향한 PD ‘수인’(김혜윤)과 촬영팀.\n\n촬영이 시작되자 행방이 묘연했던 선배 ‘교식’(김준한)이 등장하고,\n설명되지 않는 일들이 연달아 벌어지며 촬영팀은 점점 아비규환에 빠진다.\n\n휘몰아치는 공포 속 ‘기태’(이종원)는 ‘수인’을 향해 내달리지만\n빠져나오려 할수록 이들은 점점 더 깊은 곳으로 끌려 들어가게 되는데…\n\n거긴, 절대 살아서는 못 나와', 'ACTIVE', 'N', '2026-04-05 16:19:21', '2026-04-05 20:08:52'),
(8, '엔하이픈 - 이머전 인 시네마', '공연실황', '미상', 53, '/images/posters/enhypen_immersion.jpg', '/images/posters/dummy.jpg', 'https://www.youtube.com/watch?v=tb6xlBgBpug', 0, '2026-04-08', '엔하이픈의 몰입형 공연을 극장에서 만나는 스페셜 시네마', 'ENHYPEN과 함께하는 몰입의 세계가 더욱 강렬해진다!\n\n‘ENHYPEN VR CONCERT : IMMERSION’이 SCREENX와 4DX로 돌아왔다.\n\nSCREENX의 확장된 화면과 4DX의 생생한 효과를 통해, 눈앞 0cm에서 펼쳐지는 ENHYPEN의 무대를 극장에서 그대로 체험한다. 변화하는 공간 연출과 압도적인 퍼포먼스가 관객을 몰입의 세계로 이끈다.\n\n‘Bite Me’, ‘XO(Only If You Say Yes)’, 팬송 ‘Highway 1009’까지.\n오직 ENGENE를 위한 특별한 순간을 더 큰 스케일과 생동감으로 만난다.\n\n‘ENHYPEN : IMMERSION IN CINEMAS’\n지금, 또 하나의 몰입이 시작된다.', 'ACTIVE', 'N', '2026-04-05 16:21:38', '2026-04-05 20:08:52'),
(9, '올란도', '드라마', '샐리 포터', 94, '/images/posters/orlando.jpg', '/images/posters/dummy.jpg', 'https://www.youtube.com/watch?v=D3seA01zVhQ', 0, '2026-04-08', '400년의 시간을 지나며 자신의 정체성을 찾아가는 올란도의 여정을 그린 영화', '16세기 영국, 엘리자베스 1세의 총애를 받던\n눈부신 미모의 귀공자 올란도(틸다 스윈튼)는\n영원히 시들지 말라는 명을 받는다\n\n사랑, 정치, 전쟁, 또다시 사랑...\n400년의 시간을 관통해\n남자도, 여자도 아닌 완전한 인간이 된 올란도는\n마침내 자신의 이야기를 쓰기 시작한다\n\n같은 사람이야, 변한 건 없어', 'ACTIVE', 'N', '2026-04-05 16:23:56', '2026-04-05 20:08:52'),
(10, '내 이름은', '드라마', '정지영', 112, '/images/posters/my_name.jpg', '/images/posters/dummy.jpg', 'https://www.youtube.com/watch?v=P4Wv-zm-AJ0', 2057, '2026-04-15', '잃어버린 기억과 이름을 찾아가는 여정을 통해 제주 4·3의 상처를 그린 드라마', '“지독하게 아픈 봄이었수다, 우리 어멍의 1949년은”\n가슴에 묻은 78년의 약속, 이제야 부릅니다\n가장 아픈 비밀에서 가장 찬란한 진실이 된 ‘내 이름은’\n\n1998년의 봄, 촌스러운 이름 ‘영옥’이 인생 최대의 콤플렉스인 18세 소년. 어쩌다 서울에서 전학 온 경태의 눈에 들어 난생처음 반장 완장을 차지만, 결국 꼭두각시로 전락해 교실 안의 폭력을 무기력하게 방관하고 만다. 한편, 손자뻘인 아들 영옥을 홀로 억척스레 키워낸 어머니 정순에게도 지독하게 아팠던 1949년의 봄이 다시 찾아온다. 서울에서 새로 온 의사의 도움을 받아 까맣게 지워져 있던 어린 시절의 파편들을 하나둘 맞추기 시작하는 정순. 분홍색 선글라스를 끼고 하얀 차에 올라 제주의 곳곳을 누빌수록, 반세기 넘게 가슴 깊이 묻어두었던 그날의 슬픈 약속이 수면 위로 떠오르기 시작한다. 부끄러워 버리고 싶었던 소년의 이름과 온몸을 바쳐 지켜내야만 했던 어머니의 1949년. 기억조차 버거웠던 제주의 아픈 비밀이 78년의 시린 시간을 건너, 마침내 두 사람의 삶을 관통하는 가장 찬란한 진실이 되어 피어난다.', 'ACTIVE', 'N', '2026-04-05 16:25:55', '2026-04-05 20:08:52');



INSERT INTO movies VALUES
(11, '더미데이터1', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터1', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(12, '더미데이터2', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터2', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(13, '더미데이터3', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터3', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(14, '더미데이터4', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터4', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(15, '더미데이터5', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터5', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(16, '더미데이터6', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터6', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(17, '더미데이터7', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터7', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(18, '더미데이터8', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터8', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(19, '더미데이터9', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터9', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(20, '더미데이터10', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터10', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(21, '더미데이터11', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터11', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(22, '더미데이터12', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터12', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(23, '더미데이터13', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터13', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(24, '더미데이터14', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터14', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(25, '더미데이터15', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터15', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(26, '더미데이터16', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터16', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(27, '더미데이터17', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터17', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(28, '더미데이터18', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터18', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(29, '더미데이터19', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터19', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(30, '더미데이터20', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터20', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(31, '더미데이터21', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터21', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(32, '더미데이터22', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터22', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(33, '더미데이터23', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터23', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(34, '더미데이터24', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터24', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(35, '더미데이터25', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터25', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(36, '더미데이터26', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터26', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(37, '더미데이터27', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터27', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(38, '더미데이터28', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터28', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(39, '더미데이터29', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터29', NULL, 'INACTIVE', 'Y', NOW(), NOW()),
(40, '더미데이터30', '더미', '더미', 0, '/images/posters/dummy.jpg', '/images/posters/dummy.jpg', NULL, 0, '2026-04-05', '더미데이터30', NULL, 'INACTIVE', 'Y', NOW(), NOW());



INSERT INTO theaters (theater_id, address, created_at, updated_at) VALUES
(1, '서울', NOW(), NOW()),
(2, '경기', NOW(), NOW()),
(3, '인천', NOW(), NOW()),
(4, '대전', NOW(), NOW()),
(5, '부산', NOW(), NOW());

INSERT INTO halls (theater_id, hall_name, total_seats, created_at, updated_at) VALUES
(1, 'A', 30, NOW(), NOW()),
(1, 'B', 30, NOW(), NOW()),
(2, 'A', 30, NOW(), NOW()),
(2, 'B', 30, NOW(), NOW()),
(3, 'A', 30, NOW(), NOW()),
(3, 'B', 30, NOW(), NOW()),
(4, 'A', 30, NOW(), NOW()),
(4, 'B', 30, NOW(), NOW()),
(5, 'A', 30, NOW(), NOW()),
(5, 'B', 30, NOW(), NOW());

INSERT INTO hall_seats (hall_id, seat_row_no, seat_col_no, status, created_at) VALUES
(1, 1, 1, 'ACTIVE', NOW()),
(1, 1, 2, 'ACTIVE', NOW()),
(1, 1, 3, 'ACTIVE', NOW()),
(1, 1, 4, 'ACTIVE', NOW()),
(1, 1, 5, 'ACTIVE', NOW());

-- =====================================================================
-- [좌석 보강] hall_seats 가 일부만 들어가 있으면 예매(write)에서 seat_id 매핑이 실패(HTTP 400)합니다.
-- 모든 상영관에 대해 기본 3x10(=30) 좌석을 INSERT IGNORE 로 채웁니다.
-- (이미 존재하는 좌석은 uq_hall_seats_position(hall_id,row,col) 제약으로 무시됨)
-- 참고: DB의 seat_row_no는 숫자(1,2,3...)이며 UI에서 1=A열, 2=B열, 3=C열로 표시합니다.
-- =====================================================================
WITH RECURSIVE r AS (
  SELECT 1 AS n
  UNION ALL SELECT n + 1 FROM r WHERE n < 3
),
c AS (
  SELECT 1 AS n
  UNION ALL SELECT n + 1 FROM c WHERE n < 10
)
INSERT IGNORE INTO hall_seats (hall_id, seat_row_no, seat_col_no, status, created_at)
SELECT
  h.hall_id,
  r.n AS seat_row_no,
  c.n AS seat_col_no,
  'ACTIVE' AS status,
  NOW() AS created_at
FROM halls h
CROSS JOIN r
CROSS JOIN c;


INSERT INTO schedules (
    movie_id,
    hall_id,
    show_date,
    total_count,
    remain_count,
    status,
    created_by_admin_id,
    updated_by_admin_id,
    created_at,
    updated_at
) VALUES
(1, 1, '2026-04-08 09:00:00', 30, 30, 'OPEN', NULL, NULL, NOW(), NOW()),
(2, 2, '2026-04-08 14:00:00', 30, 30, 'OPEN', NULL, NULL, NOW(), NOW()),
(3, 3, '2026-04-08 19:00:00', 30, 30, 'OPEN', NULL, NULL, NOW(), NOW()),
(4, 4, '2026-04-09 09:00:00', 30, 30, 'OPEN', NULL, NULL, NOW(), NOW()),
(5, 5, '2026-04-09 14:00:00', 30, 30, 'OPEN', NULL, NULL, NOW(), NOW());



INSERT IGNORE INTO hall_seats (seat_id, hall_id, seat_row_no, seat_col_no, status, created_at) VALUES
(7, 1, 1, 7, 'ACTIVE', NOW()),
(10, 1, 1, 10, 'ACTIVE', NOW()),
(20, 1, 2, 10, 'ACTIVE', NOW());

INSERT INTO booking (user_id, req_count, book_status, created_at, schedule_id) VALUES
(1, 5, 'PAID', NOW(), 1);

SET @booking_id = LAST_INSERT_ID();

INSERT INTO booking_seats (booking_id, schedule_id, seat_id, created_at) VALUES
(@booking_id, 1, 1, NOW()),
(@booking_id, 1, 5, NOW()),
(@booking_id, 1, 7, NOW()),
(@booking_id, 1, 10, NOW()),
(@booking_id, 1, 20, NOW());


UPDATE booking
SET booking_code = 'B20260406-0001'
WHERE booking_id = 1;

INSERT IGNORE INTO hall_seats (seat_id, hall_id, seat_row_no, seat_col_no, status, created_at) VALUES
(7, 1, 1, 7, 'ACTIVE', NOW()),
(10, 1, 1, 10, 'ACTIVE', NOW()),
(20, 1, 2, 10, 'ACTIVE', NOW());


INSERT INTO booking_seats (booking_id, schedule_id, seat_id, created_at) VALUES
(1, 1, 1, NOW()),
(1, 1, 2, NOW()),
(1, 1, 3, NOW()),
(1, 1, 4, NOW()),
(1, 1, 5, NOW());


------------------------------------------------------------

-- =====================================================================
-- [예매 UI] 극장 5개가 화면에 안 나올 때 보강용 (기존 DB에 이미 넣은 경우)
--
-- 증상: DB theaters 에는 5행인데 예매 화면 극장 목록이 3개(서울·경기·인천)만 나옴.
-- 원인(과거): halls 가 theater 1~3 만 있거나, Redis 에 옛날 bootstrap JSON 이 남아 있음.
-- 조치:
--   1) 아래 INSERT IGNORE 실행 (극장 4·5 상영관 없으면 추가)
--   2) ticketing-was Read API 재시작
--   3) Redis: 관리자 "캐시 재빌드" 또는 theaters bootstrap 키 무효화
--      (코드상 키: theaters:booking:bootstrap:v4)
-- =====================================================================

INSERT IGNORE INTO halls (theater_id, hall_name, total_seats, created_at, updated_at) VALUES
(4, 'A', 30, NOW(), NOW()),
(4, 'B', 30, NOW(), NOW()),
(5, 'A', 30, NOW(), NOW()),
(5, 'B', 30, NOW(), NOW());

-- (선택) 대전·부산 극장에도 상영을 붙이려면 halls 의 hall_id 를 확인한 뒤 schedules 에 행 추가


------------------------------------------------------------

-- 이 밑으로 작성

-- =====================================================================
-- 2) [나중에 새 환경에 넣을 최종본] 최종(H) 스케줄 생성 (INSERT만, 중복 방지)
--
-- 전제
--  - movies(1~10 ACTIVE+hide='N') / theaters / halls 데이터는 이미 들어가 있음
--  - 더미(movie_id>=11)는 이미 비노출 상태라는 전제(또는 movie_id 1~10만 대상)
-- =====================================================================

SET @seoul_theater_id := 1;
SET @schedule_start_date := '2026-04-07';
SET @schedule_end_date := '2026-05-30';
SET @turnover_minutes := 3;

SET @seoul_hall_a_id := (
  SELECT hall_id
  FROM halls
  WHERE theater_id = @seoul_theater_id AND hall_name = 'A'
  ORDER BY hall_id ASC
  LIMIT 1
);

INSERT INTO schedules (
  movie_id,
  hall_id,
  show_date,
  total_count,
  remain_count,
  status,
  created_by_admin_id,
  updated_by_admin_id,
  created_at,
  updated_at
)
WITH RECURSIVE dates AS (
  SELECT DATE(@schedule_start_date) AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dates WHERE d < DATE(@schedule_end_date)
),
other_movies AS (
  SELECT
    movie_id,
    runtime_minutes,
    ROW_NUMBER() OVER (ORDER BY movie_id ASC) AS rn
  FROM movies
  WHERE movie_id BETWEEN 2 AND 10
    AND UPPER(COALESCE(status, '')) = 'ACTIVE'
    AND UPPER(COALESCE(hide, 'N')) = 'N'
    AND COALESCE(runtime_minutes, 0) > 0
),
other_movie_count AS (
  SELECT COUNT(*) AS cnt FROM other_movies
),
fixed_king AS (
  SELECT 1 AS movie_id, TIMESTAMP(d.d, '09:00:00') AS start_at FROM dates d
  UNION ALL SELECT 1, TIMESTAMP(d.d, '14:00:00') FROM dates d
  UNION ALL SELECT 1, TIMESTAMP(d.d, '20:00:00') FROM dates d
  UNION ALL SELECT 1, TIMESTAMP(d.d, '23:00:00') FROM dates d
),
fixed_bounds AS (
  SELECT d.d AS day, TIMESTAMP(d.d, '00:57:00') AS seg_start, TIMESTAMP(d.d, '09:00:00') AS seg_end, 0 AS seg_idx FROM dates d
  UNION ALL SELECT d.d, TIMESTAMP(d.d, '10:57:00'), TIMESTAMP(d.d, '14:00:00'), 1 FROM dates d
  UNION ALL SELECT d.d, TIMESTAMP(d.d, '15:57:00'), TIMESTAMP(d.d, '20:00:00'), 2 FROM dates d
  UNION ALL SELECT d.d, TIMESTAMP(d.d, '21:57:00'), TIMESTAMP(d.d, '23:00:00'), 3 FROM dates d
),
pack AS (
  SELECT
    fb.day,
    fb.seg_idx,
    0 AS step,
    fb.seg_start AS start_at,
    fb.seg_end AS seg_end,
    (MOD(CRC32(CONCAT(DATE_FORMAT(fb.day, '%Y-%m-%d'), '-', fb.seg_idx, '-', 0)), omc.cnt) + 1) AS pick_rn
  FROM fixed_bounds fb
  JOIN other_movie_count omc ON omc.cnt > 0

  UNION ALL
  SELECT
    p.day,
    p.seg_idx,
    p.step + 1,
    DATE_ADD(p.start_at, INTERVAL (om.runtime_minutes + @turnover_minutes) MINUTE) AS start_at,
    p.seg_end,
    (MOD(CRC32(CONCAT(DATE_FORMAT(p.day, '%Y-%m-%d'), '-', p.seg_idx, '-', (p.step + 1))), omc.cnt) + 1) AS pick_rn
  FROM pack p
  JOIN other_movie_count omc ON omc.cnt > 0
  JOIN other_movies om ON om.rn = p.pick_rn
  WHERE DATE_ADD(p.start_at, INTERVAL (om.runtime_minutes + @turnover_minutes) MINUTE) <= p.seg_end
),
packed_shows AS (
  SELECT
    om.movie_id,
    @seoul_hall_a_id AS hall_id,
    p.start_at AS show_date
  FROM pack p
  JOIN other_movies om ON om.rn = p.pick_rn
),
wanted AS (
  SELECT fk.movie_id, @seoul_hall_a_id AS hall_id, fk.start_at AS show_date
  FROM fixed_king fk
  UNION ALL
  SELECT movie_id, hall_id, show_date
  FROM packed_shows
)
SELECT
  w.movie_id,
  w.hall_id,
  w.show_date,
  COALESCE(h.total_seats, 30) AS total_count,
  COALESCE(h.total_seats, 30) AS remain_count,
  'OPEN' AS status,
  NULL AS created_by_admin_id,
  NULL AS updated_by_admin_id,
  NOW() AS created_at,
  NOW() AS updated_at
FROM wanted w
JOIN halls h ON h.hall_id = w.hall_id
WHERE NOT EXISTS (
  SELECT 1
  FROM schedules s
  WHERE s.movie_id = w.movie_id
    AND s.hall_id = w.hall_id
    AND s.show_date = w.show_date
)
ORDER BY w.show_date ASC, w.movie_id ASC;








USE ticketing_test;

-- 1) A/B/C 체크 제약이 있으면 먼저 제거(이름은 환경마다 다를 수 있음)
-- 캡쳐에 나온게 chk_hall_seats_row_no 라면:
ALTER TABLE hall_seats DROP CHECK chk_hall_seats_row_no;

-- 2) 데이터 값을 숫자로 변환 (CASE WHEN ... THEN ...)
UPDATE hall_seats
SET seat_row_no = CASE UPPER(TRIM(CAST(seat_row_no AS CHAR)))
  WHEN 'A' THEN 1
  WHEN 'B' THEN 2
  WHEN 'C' THEN 3
  ELSE CAST(seat_row_no AS UNSIGNED)
END;

-- 3) 컬럼 타입을 INT로 변경
ALTER TABLE hall_seats
  MODIFY seat_row_no INT NOT NULL;

-- 4) 숫자 row 체크 제약 다시 추가
ALTER TABLE hall_seats
  ADD CONSTRAINT chk_hall_seats_row_no CHECK (seat_row_no > 0);