output "primary_db_endpoint" {
  value = aws_db_instance.primary.endpoint
}

output "replica_db_endpoint" {
  value = aws_db_instance.replica.endpoint
}
