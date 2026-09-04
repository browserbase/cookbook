output "instance_id" {
  description = "EC2 instance ID of the sandbox benchmark host"
  value       = aws_instance.sandbox.id
}

output "region" {
  description = "AWS region the instance was launched in"
  value       = var.region
}

output "ami_id" {
  description = "Amazon Linux 2023 AMI used"
  value       = data.aws_ami.al2023.id
}
