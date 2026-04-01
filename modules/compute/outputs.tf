output "eks_cluster_name" {
  value = aws_eks_cluster.main.name
}

output "web_node_group_name" {
  value = aws_eks_node_group.web_node_group.node_group_name
}

output "was_node_group_name" {
  value = aws_eks_node_group.was_node_group.node_group_name
}

output "web_node_group_min_count" {
  value = var.web_node_group_min_count
}

output "web_node_group_desired_count" {
  value = var.web_node_group_desired_count
}

output "web_node_group_max_count" {
  value = var.web_node_group_max_count
}

output "was_node_group_min_count" {
  value = var.was_node_group_min_count
}

output "was_node_group_desired_count" {
  value = var.was_node_group_desired_count
}

output "was_node_group_max_count" {
  value = var.was_node_group_max_count
}

output "web_pod_replica_count" {
  value = var.web_pod_replica_count
}

output "was_pod_replica_count" {
  value = var.was_pod_replica_count
}

output "alb_dns_name" {
  value = aws_lb.main_alb.dns_name
}

output "alb_zone_id" {
  value = aws_lb.main_alb.zone_id
}

