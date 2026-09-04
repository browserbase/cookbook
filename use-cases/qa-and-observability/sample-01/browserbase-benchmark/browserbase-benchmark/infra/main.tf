terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# ---------------------------------------------------------------------------
# Latest Amazon Linux 2023 AMI
# ---------------------------------------------------------------------------
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ---------------------------------------------------------------------------
# IAM — EC2 role with SSM access (no inbound ports needed)
# ---------------------------------------------------------------------------
resource "aws_iam_role" "sandbox" {
  name_prefix = "bb-benchmark-role-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.sandbox.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "sandbox" {
  name_prefix = "bb-benchmark-profile-"
  role = aws_iam_role.sandbox.name
}

# ---------------------------------------------------------------------------
# Security group — egress only (SSM connects out; no inbound ports)
# ---------------------------------------------------------------------------
resource "aws_security_group" "sandbox" {
  name_prefix = "bb-benchmark-sg-"
  description = "Egress-only security group for BB benchmark EC2"

  egress {
    description = "HTTPS to internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "HTTP (playwright deps)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "bb-sandbox-benchmark-sg" }
}

# ---------------------------------------------------------------------------
# EC2 instance
# ---------------------------------------------------------------------------
resource "aws_instance" "sandbox" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.instance_type
  iam_instance_profile        = aws_iam_instance_profile.sandbox.name
  vpc_security_group_ids      = [aws_security_group.sandbox.id]
  associate_public_ip_address = true

  user_data = file("${path.module}/user_data.sh")

  root_block_device {
    volume_size = 20   # GB — Chromium + deps need ~4 GB
    volume_type = "gp3"
  }

  tags = { Name = "bb-sandbox-benchmark" }
}
