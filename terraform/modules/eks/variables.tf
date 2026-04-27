variable "env" { type = string }
variable "aws_region" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }

# VPC Custom Networking 용. 파드 ENI 를 이 서브넷(secondary CIDR)에서 할당하도록
# ENIConfig(AZ별 1개) 를 생성한다. subnet_ids(노드 subnet)과 별개로 관리된다.
variable "pod_subnet_ids" {
  type        = list(string)
  description = "Pod 전용 서브넷 목록. pod_subnet_azs 와 인덱스 쌍으로 매칭된다."
}

variable "pod_subnet_azs" {
  type        = list(string)
  description = "pod_subnet_ids 각각의 AZ 풀네임(예: ap-northeast-2a). ENIConfig 의 metadata.name 에 그대로 들어가며, 노드의 topology.kubernetes.io/zone 라벨과 매칭된다."
}

variable "cluster_name" {
  type        = string
  description = "EKS cluster resource name"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID for destroy-time cleanup of LB/ENI/EIP"
}

variable "sqs_queue_arns" {
  type        = list(string)
  description = "SQS queue ARNs for IRSA"
  default     = []
}

variable "assets_bucket_arn" {
  type        = string
  description = "S3 assets bucket ARN — db-backup CronJob 가 mysqldump 결과를 backups/ prefix 에 PutObject 한다."
  default     = ""
}

# count 가 다른 리소스 attribute(unknown at plan)에 걸리면 "Invalid count argument" 에러.
# destroy/refresh 에서도 안전하도록 plan-time known bool 로 분리.
variable "enable_db_backup_to_assets" {
  type        = bool
  default     = false
  description = "db-backup IRSA policy 생성 여부. assets_bucket_arn 이 plan 시점 unknown 이 될 수 있어 count 는 이 bool 로 분기."
}

variable "app_node_instance_types" {
  type        = list(string)
  description = "워커 노드 인스턴스 타입(평시 1대·max 확장 시 수평 증설)."
}

variable "app_node_desired_size" {
  type        = number
  description = "평시 desired 노드 수."
}

variable "app_node_min_size" {
  type        = number
  description = "최소 노드(비용 바닥)."
}

variable "app_node_max_size" {
  type        = number
  description = "피크 시 상한. Cluster Autoscaler + HPA(read-api 등)와 함께 쓸 것."
}

# Burst 전용 노드그룹(티켓팅 이벤트 전용). subnet_ids 는 AZ 를 통제하기 위해 보통 1개 AZ subnet 만 넣는다.
variable "burst_primary_subnet_ids" {
  type        = list(string)
  description = "Burst primary managed node group subnets (typically 1 AZ)."
}

variable "burst_secondary_subnet_ids" {
  type        = list(string)
  description = "Burst secondary managed node group subnets (typically 1 AZ)."
}

variable "burst_primary_desired_size" {
  type        = number
  description = "Burst primary node group desired size (평시 0 권장)."
}

variable "burst_primary_min_size" {
  type        = number
  description = "Burst primary node group min size."
}

variable "burst_primary_max_size" {
  type        = number
  description = "Burst primary node group max size (ASG 상한)."
}

variable "burst_secondary_desired_size" {
  type        = number
  description = "Burst secondary node group desired size (평시 0 권장)."
}

variable "burst_secondary_min_size" {
  type        = number
  description = "Burst secondary node group min size."
}

variable "burst_secondary_max_size" {
  type        = number
  description = "Burst secondary node group max size (ASG 상한)."
}
