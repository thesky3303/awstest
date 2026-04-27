# Ticketing Burst Lane 비교도 (As-Is vs To-Be)

이 문서는 `teamproject` 코드( Terraform + Kubernetes manifests )를 기준으로,
**“현재 구조(As-Is)”**와 **“버스트 전용 레인(To-Be)”**을 비교 정리합니다.

## 결론(핵심 한 줄)

**max는 유지하되, max가 “어디에 뜨는지(AZ/노드풀/파드 배치)”를 통제한다.**

## 전제(가장 현실적인 분포)

최선의 분포는 “한 AZ 몰빵(100:0)”도 “전체 AZ 균등(예: 50:50, 33:33:33)”도 아닙니다.

- **Primary AZ 집중 + Secondary AZ 예비 + (각 AZ 내부) 노드 균등 분산**
- 추천 비율
  - **성능 우선**: Primary 80% / Secondary 20%
  - **안정성 우선**: Primary 70% / Secondary 30%
  - Other AZ: 0%

## 근거(로그에서 관찰된 패턴)

`diag/ticketing_diag_20260424_203727.txt`(당시 단일 `write-api-burst` 구조)에는 burst 쪽 health probe가 반복 실패한 흔적이 있습니다.

- `context deadline exceeded (Client.Timeout exceeded while awaiting headers)`
- `connect: connection refused`
- `read: connection reset by peer`

이는 “단순 OOMKilled”이라기보다, **부하 구간에서 네트워크/큐/스케줄/CPU 경합이 합쳐져 health/accept 경로까지 지연·불안정**해지는 흐름과 맞습니다.

## 현재 구조(Repo 상태) — “버스트 전용 레인 + 80:20 분포”가 반영됨

이 문서의 As/To 비교는 “과거 단일 burst 배포” 대비를 기준으로 두되, **현재 `teamproject` 트리는 To-Be 쪽이 구현된 상태**입니다.

- **EKS 노드그룹**
  - `aws_eks_node_group.app` + `aws_eks_node_group.burst_primary` + `aws_eks_node_group.burst_secondary` (`terraform/modules/eks/main.tf`)
  - burst 노드그룹은 **RDS writer AZ를 Primary로 두고**, public subnet AZ 집합에서 **단일 subnet/AZ**로 고정
- **버스트 워크로드(분리 배포)**
  - write: `k8s/write-api/deployment-burst-primary.yaml`, `k8s/write-api/deployment-burst-secondary.yaml`
  - worker: `k8s/worker-svc/deployment-burst-primary.yaml`, `k8s/worker-svc/deployment-burst-secondary.yaml`
- **오토스케일 객체도 분리**
  - write HPA: `k8s/write-api/hpa-primary.yaml`, `k8s/write-api/hpa-secondary.yaml`
  - worker KEDA: `k8s/keda/scaledobject-worker-svc-sqs-primary.yaml`, `k8s/keda/scaledobject-worker-svc-sqs-secondary.yaml`

## 설계 요약(왜 이렇게 쪼개나)

핵심은 3단입니다.

1) **노드그룹을 분리**: `app` + `burst-primary` + `burst-secondary`  
2) **파드를 레인에 고정**: taint/toleration + nodeSelector로 burst 파드는 burst 노드에만  
3) **비율을 replicas로 강제**: Deployment를 primary/secondary로 쪼개서 80:20을 “정확히” 맞춤

---

## 비교표(한눈에)

> 보기 팁: VSCode/Cursor에서 **Markdown Preview**로 열면 표가 “진짜 표”로 렌더링됩니다. (`Ctrl+Shift+V`)

| 구분 | As-Is (과거 단일 burst) | To-Be / Repo(현재) | 달라지는 점(핵심) |
|---|---|---|---|
| 노드그룹 수 | 1개 (`aws_eks_node_group.app`) | `app` + `burst-primary` + `burst-secondary` | “확장될 공간”을 분리해 제어 |
| AZ 제어 | `app`이 멀티 AZ 서브넷을 사용 → 분산이 우연/랜덤 | burst nodegroup는 **특정 AZ subnet만** 사용 | max까지 올려도 “어느 AZ로 커지나”가 고정 |
| 최선의 분포 | 결과적으로 균등/랜덤에 가까울 수 있음 | **Primary 70~80% + Secondary 20~30% + Other 0%** | 성능(거리)과 안정성(예비) 동시 확보 |
| burst 파드 배치 | 스케줄 제약 없음 → 일반 노드에 섞일 수 있음 | burst 노드 taint + burst 파드 toleration/nodeSelector | 버스트 파드가 “버스트 레인에만” 뜸 |
| write↔worker locality | write/worker가 서로 다른 AZ로 퍼질 수 있음 | write/worker 모두 같은 레인(Primary/Secondary)로 묶음 | 내부 통신 경로 단축 |
| DB writer 근접성 | DB writer AZ는 고정인데 파드가 따라가지 못함 | Primary AZ를 DB writer AZ로 선정 | 커밋 경로의 꼬리 지연 개선 기대 |
| 운영(웜업) | reactive(HPA/KEDA/CA) 중심 | scheduled warm-up + HPA/KEDA는 보정 | 이벤트 시작 시점의 스파이크 완화 |

---

## “80:20 분포”를 정확히 만드는 방법 (Deployment 분리)

nodeSelector만으로는 “정확히 80:20” 같은 **비율을 강제**하기 어렵습니다.  
그래서 아래처럼 **Deployment를 primary/secondary로 분리**하고 **replicas로 비율**을 맞추는 방식이 가장 단순·확실합니다.

### 예시(총량 70, 80:20)

- `write-api-burst-primary`: replicas 56 (Primary)
- `write-api-burst-secondary`: replicas 14 (Secondary)

### worker 예시(총량 130, 80:20)

- `worker-svc-burst-primary`: replicas 104 (Primary)
- `worker-svc-burst-secondary`: replicas 26 (Secondary)

서비스(Service)는 두 Deployment가 **같은 selector(공통 라벨)**로 묶이게 하면,
엔드포인트 수 자체가 80:20에 가까워져 분포도 자연스럽게 맞춰집니다.

---

## 스케줄 강제의 최소 구성(개념)

> 아래는 “무엇이 추가되면 구조가 바뀌는지”를 보여주는 최소 예시입니다(문서용).

| 대상 | As-Is | To-Be에 추가되는 것 |
|---|---|---|
| burst 노드그룹 | 없음(노드그룹 1개) | 노드 라벨: `workload=ticketing-burst`, `burst-zone=primary|secondary` + taint: `workload=ticketing-burst:NoSchedule` |
| `write-api-burst-*` | 스케줄 제약 없음 | `nodeSelector: { workload: ticketing-burst, burst-zone: primary|secondary }` + tolerations(taint 허용) |
| `worker-svc-burst-*` | 스케줄 제약 없음 | `write-api-burst-*`와 동일(같은 레인에 고정) |

---

## 흐름 비교(다이어그램)

```mermaid
flowchart LR
  subgraph ASIS[As-Is: max 확장 시]
    A1[노드 1풀(app) 확장] --> A2[HPA/KEDA로 파드 확장]
    A2 --> A3[여러 AZ로 분산(비통제)]
    A3 --> A4[write/worker ↔ DB/Redis 경로 다양화]
    A4 --> A5[지연/리셋/timeout ↑, probe 실패 ↑]
  end

  subgraph TOBE[To-Be: Burst lane 80:20]
    B1[burst-primary/secondary 노드풀 사전 증설] --> B2[버스트 파드 레인 고정]
    B2 --> B3[Primary 70~80% + Secondary 20~30%]
    B3 --> B4[AZ 내부는 hostname 기준 균등 분산]
    B4 --> B5[max 상태 유지 + 성능 손실 최소화]
  end
```

## “먼저 정해야 하는 것” 체크리스트

- **Primary AZ**: RDS Writer AZ (1순위)
- **Secondary AZ**: 예비 AZ(리소스 여유/서브넷 IP 여유/발표 내러티브 고려)
- **성공 기준(측정)**: max까지 올린 상태에서 p95 지연, 5xx, probe 실패율이 유의미하게 증가하지 않는지

