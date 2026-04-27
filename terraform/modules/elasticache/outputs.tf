output "redis_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}
# AWS 명명과 동일(호환용 별칭). 앱에서는 ELASTICACHE_PRIMARY_ENDPOINT 로 주입 권장.
output "elasticache_primary_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "primary_availability_zone" {
  # 단일 노드(num_cache_clusters=1) 기준: primary cache cluster AZ
  value = data.aws_elasticache_cluster.redis_primary.availability_zone
}

output "redis_port" {
  value = aws_elasticache_replication_group.redis.port
}
