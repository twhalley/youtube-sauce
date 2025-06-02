# IAM User for ECR push access
resource "aws_iam_user" "ecr_push_user" {
  name = "youtube-sauce-ecr-push"
  path = "/service/"

  tags = {
    Name = "youtube-sauce-ecr-push"
  }
}

# IAM Policy for ECR push access
resource "aws_iam_policy" "ecr_push_policy" {
  name        = "youtube-sauce-ecr-push-policy"
  description = "Policy to allow pushing to YouTube Sauce ECR repository"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetRepositoryPolicy",
          "ecr:DescribeRepositories",
          "ecr:ListImages",
          "ecr:DescribeImages",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = [
          aws_ecr_repository.youtube_sauce.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach policy to user
resource "aws_iam_user_policy_attachment" "ecr_push_policy_attachment" {
  user       = aws_iam_user.ecr_push_user.name
  policy_arn = aws_iam_policy.ecr_push_policy.arn
}

# Create access key for the user
resource "aws_iam_access_key" "ecr_push_key" {
  user = aws_iam_user.ecr_push_user.name
}

# Output the access key details (sensitive)
output "ecr_push_access_key_id" {
  description = "Access key ID for ECR push user"
  value       = aws_iam_access_key.ecr_push_key.id
}

output "ecr_push_secret_access_key" {
  description = "Secret access key for ECR push user"
  value       = aws_iam_access_key.ecr_push_key.secret
  sensitive   = true
} 