# ECR Repository
resource "aws_ecr_repository" "youtube_sauce" {
  name                 = "youtube-sauce"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "youtube-sauce"
  }
}

# ECR Lifecycle Policy
resource "aws_ecr_lifecycle_policy" "youtube_sauce" {
  repository = aws_ecr_repository.youtube_sauce.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 30 images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Output the repository URL
output "ecr_repository_url" {
  description = "The URL of the ECR repository"
  value       = aws_ecr_repository.youtube_sauce.repository_url
} 