locals {
  network = {
    project_name = "complete-module"

    public_vpc_cidr                = "10.0.0.0/16"
    private_vpc_cidr               = "10.1.0.0/16"

    public_vpc_web_pub_rt_sn1_cidr = "10.0.1.0/24"
    public_vpc_web_pub_rt_sn2_cidr = "10.0.2.0/24"

    public_vpc_was_pri_rt_sn1_cidr = "10.0.11.0/24"
    public_vpc_was_pri_rt_sn2_cidr = "10.0.12.0/24"

    private_vpc_db_pri_rt_sn1_cidr = "10.1.1.0/24"
    private_vpc_db_pri_rt_sn2_cidr = "10.1.2.0/24"

    az_1       = "ap-northeast-2a"
    az_2       = "ap-northeast-2c"
    admin_cidr = "0.0.0.0/0"

    route53_zone_name = "aws-thesky3303.store"
  }

  compute = {
    eks_cluster_name    = "main-eks-cluster"
    eks_cluster_version = "1.31"

    web_node_group_name          = "web-node-group"
    web_node_group_instance_type = "t3.micro"
    web_node_group_min_count     = 1
    web_node_group_desired_count = 2
    web_node_group_max_count     = 4

    was_node_group_name          = "was-node-group"
    was_node_group_instance_type = "t3.micro"
    was_node_group_min_count     = 1
    was_node_group_desired_count = 2
    was_node_group_max_count     = 4

    key_name = "Mykey"

    web_pod_replica_count = 2
    was_pod_replica_count = 2

    web_container_image = ""
    was_container_image = ""
    # 비공개 이미지 사용 시 인증 설정 추가 가능
    # 메트릭으로 파드 관리를 위해 추후 추가할 곳
  }

  database = {
    db_name           = "appdb"
    db_username       = "admin"
    db_password       = "soldesk1."
    db_engine         = "mysql"
    db_engine_version = "8.0.45"
    db_instance_class = "db.t3.micro"
    allocated_storage = 20
  }

  cloudfront = {
    enabled          = true
    domain_name      = "aws-thesky3303.store"
    hosted_zone_name = "aws-thesky3303.store"
    # ACM 인증서는 us-east-1 에서 조회
  }

  storage = {
    # 추후 db 백업용 s3 버킷 값 추가
  }

  redis = {
    # 추후 redis 값 추가
    # read redis / write redis 역할 분리 가능
    # web은 read redis 우선 조회
    # was는 read redis / write redis 모두 사용 가능
  }

  monitoring = {
    # 추후 monitoring 값 추가
    # 프로메테우스 메트릭 보존을 위해 EBS(PV) 연결 예정
    # 로그는 S3에 저장하더라도 프로메테우스 메트릭 저장소는 별도 필요
  }

  cicd = {
    # 추후 cicd 값 추가
  }

  ebs = {
    # 추후 ebs 값 추가
    # monitoring, ec2 등의 저장소로 사용할 수 있음
  }
}