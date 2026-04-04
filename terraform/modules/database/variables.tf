variable "project_name" { type = string }
variable "db_subnet_ids" { type = list(string) }
variable "db_primary_sg_id" { type = string }
variable "db_replica_sg_id" { type = string }
variable "db_name" { type = string }
variable "db_username" { type = string }
variable "db_password" {
  type      = string
  sensitive = true
}
variable "db_engine" { type = string }
variable "db_engine_version" { type = string }
variable "db_instance_class" { type = string }
variable "allocated_storage" { type = number }
