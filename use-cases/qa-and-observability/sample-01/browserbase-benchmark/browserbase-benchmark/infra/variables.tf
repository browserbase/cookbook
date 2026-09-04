variable "region" {
  description = "AWS region — match your Render deployment region"
  type        = string
  default     = "us-west-2"
}

variable "instance_type" {
  description = "EC2 instance type — t3.large (2 vCPU / 8 GB) required to run Chromium in production"
  type        = string
  default     = "t3.large"
}
