output "rds_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.youtube_sauce_db.endpoint
}

output "rds_port" {
  description = "The port the RDS instance is listening on"
  value       = aws_db_instance.youtube_sauce_db.port
}

output "rds_db_name" {
  description = "The name of the database"
  value       = aws_db_instance.youtube_sauce_db.db_name
}

output "rds_username" {
  description = "The master username for the database"
  value       = aws_db_instance.youtube_sauce_db.username
  sensitive   = true
}

output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.rds_vpc.id
}

output "security_group_id" {
  description = "The ID of the security group"
  value       = aws_security_group.rds_sg.id
} 