terraform {
  backend "s3" {
    bucket         = "youtube-sauce-terraform-state"
    key            = "terraform.tfstate"
    region         = "eu-north-1"
    encrypt        = true
    dynamodb_table = "youtube-sauce-terraform-lock"
  }
} 