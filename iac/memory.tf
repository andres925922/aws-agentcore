# infra/memory.tf
#
# DynamoDB table for cross-instance session memory.
# One row per user, keyed by userId (corporate ID or email).
# TTL attribute: DynamoDB automatically deletes rows after `ttl` (Unix epoch).

resource "aws_dynamodb_table" "memory" {
  name         = "${local.prefix}-memory"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  # Enable DynamoDB TTL — the application sets the `ttl` attribute (seconds)
  # DynamoDB deletes the row automatically once that time passes.
  # Deletion is eventually consistent (can take up to 48h after expiry).
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = local.common_tags
}

# Add memory table permissions to the existing MCP server IAM policy
# We create a separate inline policy to keep main.tf clean.
resource "aws_iam_policy" "memory_access" {
  name        = "${local.prefix}-memory-policy"
  description = "DynamoDB permissions for the memory store"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "MemoryTableAccess"
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
      ]
      Resource = [aws_dynamodb_table.memory.arn]
    }]
  })

  tags = local.common_tags
}

# Attach memory policy to the AgentCore execution role
resource "aws_iam_role_policy_attachment" "memory" {
  role       = aws_iam_role.agentcore_execution.name
  policy_arn = aws_iam_policy.memory_access.arn
}

output "memory_table_name" {
  description = "DynamoDB memory table name — add to .env as DYNAMODB_MEMORY_TABLE"
  value       = aws_dynamodb_table.memory.name
}
