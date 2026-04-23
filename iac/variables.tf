# infra/variables.tf

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "eu-west-2"
}

variable "project_name" {
  description = "Used as a prefix for all resource names"
  type        = string
  default     = "customer-support-mcp"
}

variable "environment" {
  description = "Deployment environment (dev / staging / prod)"
  type        = string
  default     = "dev"
}

variable "enable_point_in_time_recovery" {
  description = "Enable DynamoDB point-in-time recovery"
  type        = bool
  default     = true
}

variable "enable_deletion_protection" {
  description = "Enable DynamoDB deletion protection"
  type        = bool
  default     = false
}

variable "cloudwatch_log_retention_days" {
  description = "Retention period (days) for AgentCore CloudWatch logs"
  type        = number
  default     = 30
}
