variable "project_name" { type = string }
variable "eks_cluster_name" { type = string }
variable "eks_cluster_version" { type = string }

variable "web_node_group_name" { type = string }
variable "web_node_group_instance_type" { type = string }
variable "web_node_group_min_count" { type = number }
variable "web_node_group_desired_count" { type = number }
variable "web_node_group_max_count" { type = number }

variable "was_node_group_name" { type = string }
variable "was_node_group_instance_type" { type = string }
variable "was_node_group_min_count" { type = number }
variable "was_node_group_desired_count" { type = number }
variable "was_node_group_max_count" { type = number }

variable "key_name" { type = string }

variable "web_pod_replica_count" { type = number }
variable "was_pod_replica_count" { type = number }
variable "web_container_image" { type = string }
variable "was_container_image" { type = string }

variable "web_public_subnet_ids" { type = list(string) }
variable "was_private_subnet_ids" { type = list(string) }
variable "eks_subnet_ids" { type = list(string) }
variable "cluster_security_group_id" { type = string }
variable "alb_security_group_id" { type = string }

variable "web_node_group_sg_id" {
  description = "Security group ID for web node group"
  type        = string
}

variable "was_node_group_sg_id" {
  description = "Security group ID for was node group"
  type        = string
}