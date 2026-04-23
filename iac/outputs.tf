# infra/outputs.tf
#
# After `terraform apply`, copy these values into your .env file.

output "customers_table_name" {
  description = "DynamoDB table name for customers"
  value       = aws_dynamodb_table.customers.name
}

output "products_table_name" {
  description = "DynamoDB table name for products"
  value       = aws_dynamodb_table.products.name
}

output "tickets_table_name" {
  description = "DynamoDB table name for tickets"
  value       = aws_dynamodb_table.tickets.name
}

output "mcp_server_policy_arn" {
  description = "ARN of the IAM policy — attach this to your IAM user or Phase 4 execution role"
  value       = aws_iam_policy.mcp_server.arn
}

output "memory_table_name" {
  description = "DynamoDB table name for session memory"
  value       = aws_dynamodb_table.memory.name
}

output "env_block" {
  description = "Ready-to-paste block for your .env file"
  value       = <<-EOT

    # Paste this into customer-support-mcp/.env
    AWS_REGION=${var.aws_region}
    DB_BACKEND=dynamo
    MEMORY_BACKEND=dynamo
    DYNAMODB_CUSTOMERS_TABLE=${aws_dynamodb_table.customers.name}
    DYNAMODB_PRODUCTS_TABLE=${aws_dynamodb_table.products.name}
    DYNAMODB_TICKETS_TABLE=${aws_dynamodb_table.tickets.name}
    DYNAMODB_MEMORY_TABLE=${aws_dynamodb_table.memory.name}
  EOT
}


output "agentcore_execution_role_arn" {
  description = "Paste this into the deploy script as EXECUTION_ROLE_ARN"
  value       = aws_iam_role.agentcore_execution.arn
}

output "agentcore_log_group_name" {
  description = "CloudWatch Logs group for AgentCore runtime"
  value       = aws_cloudwatch_log_group.agentcore.name
}

output "ecr_repository_url" {
  description = "ECR URL — use this in the deploy script"
  value       = aws_ecr_repository.mcp_server.repository_url
}

output "ecr_registry" {
  description = "Registry hostname for docker login"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}
