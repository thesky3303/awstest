module "network" {
  source = "./modules/network"

  project_name                      = local.network.project_name
  public_vpc_cidr                   = local.network.public_vpc_cidr
  private_vpc_cidr                  = local.network.private_vpc_cidr
  public_vpc_web_pub_rt_sn1_cidr    = local.network.public_vpc_web_pub_rt_sn1_cidr
  public_vpc_web_pub_rt_sn2_cidr    = local.network.public_vpc_web_pub_rt_sn2_cidr
  public_vpc_was_pri_rt_sn1_cidr    = local.network.public_vpc_was_pri_rt_sn1_cidr
  public_vpc_was_pri_rt_sn2_cidr    = local.network.public_vpc_was_pri_rt_sn2_cidr
  private_vpc_db_pri_rt_sn1_cidr    = local.network.private_vpc_db_pri_rt_sn1_cidr
  private_vpc_db_pri_rt_sn2_cidr    = local.network.private_vpc_db_pri_rt_sn2_cidr
  az_1                              = local.network.az_1
  az_2                              = local.network.az_2
  admin_cidr                        = local.network.admin_cidr
  route53_zone_name                 = local.network.route53_zone_name
}

module "compute" {
  source = "./modules/compute"

  public_vpc_id = local.compute.public_vpc_id

  project_name                 = local.network.project_name
  eks_cluster_name             = local.compute.eks_cluster_name
  eks_cluster_version          = local.compute.eks_cluster_version

  web_node_group_name          = local.compute.web_node_group_name
  web_node_group_instance_type = local.compute.web_node_group_instance_type
  web_node_group_min_count     = local.compute.web_node_group_min_count
  web_node_group_desired_count = local.compute.web_node_group_desired_count
  web_node_group_max_count     = local.compute.web_node_group_max_count
  web_node_group_sg_id        = module.network.web_node_group_sg_id

  was_node_group_name          = local.compute.was_node_group_name
  was_node_group_instance_type = local.compute.was_node_group_instance_type
  was_node_group_min_count     = local.compute.was_node_group_min_count
  was_node_group_desired_count = local.compute.was_node_group_desired_count
  was_node_group_max_count     = local.compute.was_node_group_max_count
  was_node_group_sg_id        = module.network.was_node_group_sg_id

  key_name                     = local.compute.key_name

  web_pod_replica_count        = local.compute.web_pod_replica_count
  was_pod_replica_count        = local.compute.was_pod_replica_count
  web_container_image          = local.compute.web_container_image
  was_container_image          = local.compute.was_container_image

  web_public_subnet_ids        = module.network.web_public_subnet_ids
  was_private_subnet_ids       = module.network.was_private_subnet_ids
  eks_subnet_ids               = module.network.eks_subnet_ids
  cluster_security_group_id    = module.network.cluster_security_group_id
  alb_security_group_id        = module.network.alb_security_group_id
}

module "database" {
  source = "./modules/database"

  project_name           = local.network.project_name
  db_subnet_ids          = module.network.db_subnet_ids
  db_primary_sg_id       = module.network.db_primary_sg_id
  db_replica_sg_id       = module.network.db_replica_sg_id
  db_name                = local.database.db_name
  db_username            = local.database.db_username
  db_password            = local.database.db_password
  db_engine              = local.database.db_engine
  db_engine_version      = local.database.db_engine_version
  db_instance_class      = local.database.db_instance_class
  allocated_storage      = local.database.allocated_storage
}

module "cloudfront" {
  source = "./modules/cloudfront"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  enabled            = local.cloudfront.enabled
  domain_name        = local.cloudfront.domain_name
  hosted_zone_id     = module.network.route53_zone_id
  hosted_zone_name   = local.cloudfront.hosted_zone_name
  origin_domain_name = module.compute.alb_dns_name
  project_name       = local.network.project_name
}

# 추후 storage 모듈 추가 시 여기서 module 호출
# db 백업용 s3 버킷은 현재 비활성

# 추후 redis 모듈 추가 시 여기서 module 호출
#
# redis 추가 시 수정할 파일
# - main.tf
# - modules/network/main.tf
# - modules/network/variables.tf
# - modules/network/outputs.tf
# - modules/compute/main.tf
# - modules/compute/variables.tf
# - modules/compute/outputs.tf
# - modules/redis/main.tf
# - modules/redis/variables.tf
# - modules/redis/outputs.tf
#
# 추후 반영 내용
# - web -> redis read endpoint 연결
# - was -> redis read endpoint 연결
# - was -> redis write endpoint 연결
# - redis security group 추가
# - redis subnet / output 추가

# 추후 monitoring 모듈 추가 시 여기서 module 호출
# 프로메테우스 사용 시 메트릭 보존을 위해 EBS 연결 고려
# 로그 저장용 S3와 메트릭 저장용 EBS는 역할이 다름

# 추후 cicd 모듈 추가 시 여기서 module 호출
# 추후 ebs 모듈 추가 시 여기서 module 호출
