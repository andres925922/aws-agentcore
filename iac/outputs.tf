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

output "env_block" {
  description = "Ready-to-paste block for your .env file"
  value       = <<-EOT

    # Paste this into customer-support-mcp/.env
    AWS_REGION=${var.aws_region}
    DYNAMODB_CUSTOMERS_TABLE=${aws_dynamodb_table.customers.name}
    DYNAMODB_PRODUCTS_TABLE=${aws_dynamodb_table.products.name}
    DYNAMODB_TICKETS_TABLE=${aws_dynamodb_table.tickets.name}
  EOT
}
