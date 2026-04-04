output "eks_cluster_name" {
  value = module.compute.eks_cluster_name
}

output "web_node_group_name" {
  value = module.compute.web_node_group_name
}

output "was_node_group_name" {
  value = module.compute.was_node_group_name
}

output "primary_db_endpoint" {
  value = module.database.primary_db_endpoint
}

output "replica_db_endpoint" {
  value = module.database.replica_db_endpoint
}

output "cloudfront_domain_name" {
  value = module.cloudfront.cloudfront_domain_name
}

output "route53_record_fqdn" {
  value = module.cloudfront.route53_record_fqdn
}