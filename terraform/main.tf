terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.2.0"
}

provider "aws" {
  region = var.aws_region
}

# VPC for RDS
resource "aws_vpc" "rds_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "youtube-sauce-rds-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "rds_igw" {
  vpc_id = aws_vpc.rds_vpc.id

  tags = {
    Name = "youtube-sauce-rds-igw"
  }
}

# Public Subnet 1
resource "aws_subnet" "public_1" {
  vpc_id            = aws_vpc.rds_vpc.id
  cidr_block        = var.public_subnet_1_cidr
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "youtube-sauce-public-1"
  }
}

# Public Subnet 2
resource "aws_subnet" "public_2" {
  vpc_id            = aws_vpc.rds_vpc.id
  cidr_block        = var.public_subnet_2_cidr
  availability_zone = "${var.aws_region}b"

  tags = {
    Name = "youtube-sauce-public-2"
  }
}

# Route Table for Public Subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.rds_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.rds_igw.id
  }

  tags = {
    Name = "youtube-sauce-public-rt"
  }
}

# Route Table Association for Public Subnet 1
resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

# Route Table Association for Public Subnet 2
resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

# Security Group for RDS
resource "aws_security_group" "rds_sg" {
  name        = "youtube-sauce-rds-sg"
  description = "Security group for RDS instance"
  vpc_id      = aws_vpc.rds_vpc.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "youtube-sauce-rds-sg"
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "rds_subnet_group" {
  name        = "youtube-sauce-subnet-group"
  description = "RDS subnet group for YouTube Sauce"
  subnet_ids  = [aws_subnet.public_1.id, aws_subnet.public_2.id]

  tags = {
    Name = "youtube-sauce-db-subnet-group"
  }
}

# RDS Instance
resource "aws_db_instance" "youtube_sauce_db" {
  identifier           = "youtube-sauce-db"
  engine              = "postgres"
  engine_version      = "15.13"
  instance_class      = var.db_instance_class
  allocated_storage   = var.db_allocated_storage
  storage_type        = "gp3"
  
  db_name             = "youtubesauce"
  username            = "youtubesauce"
  password            = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]

  multi_az               = false
  publicly_accessible    = false
  skip_final_snapshot    = true

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  auto_minor_version_upgrade = true
  
  performance_insights_enabled = true
  performance_insights_retention_period = 7

  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring_role.arn

  tags = {
    Name = "youtube-sauce-db"
  }
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring_role" {
  name = "youtube-sauce-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring_policy" {
  role       = aws_iam_role.rds_monitoring_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
} 