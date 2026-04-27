output "writer_endpoint" {
  value     = aws_db_instance.writer.address
  sensitive = true
}

output "writer_availability_zone" {
  value     = aws_db_instance.writer.availability_zone
  sensitive = false
}

output "reader_endpoint" {
  value     = null
  sensitive = true
}
output "db_port" {
  value = aws_db_instance.writer.port
}
