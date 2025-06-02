# Random password generation
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# AWS Secrets Manager secret for database
resource "aws_secretsmanager_secret" "db_secret" {
  name        = "youtube-sauce/db-credentials"
  description = "Database credentials for YouTube Sauce application"

  tags = {
    Name = "youtube-sauce-db-credentials"
  }
}

# Store database credentials
resource "aws_secretsmanager_secret_version" "db_secret_version" {
  secret_id = aws_secretsmanager_secret.db_secret.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    engine   = "postgres"
    host     = aws_db_instance.youtube_sauce_db.endpoint
    port     = aws_db_instance.youtube_sauce_db.port
    dbname   = aws_db_instance.youtube_sauce_db.db_name
  })
}

# AWS Secrets Manager secret for ECR push credentials
resource "aws_secretsmanager_secret" "ecr_push_secret" {
  name        = "youtube-sauce/ecr-push-credentials"
  description = "ECR push credentials for YouTube Sauce application"

  tags = {
    Name = "youtube-sauce-ecr-push-credentials"
  }
}

# Store ECR push credentials
resource "aws_secretsmanager_secret_version" "ecr_push_secret_version" {
  secret_id = aws_secretsmanager_secret.ecr_push_secret.id
  secret_string = jsonencode({
    access_key_id     = aws_iam_access_key.ecr_push_key.id
    secret_access_key = aws_iam_access_key.ecr_push_key.secret
  })
} 