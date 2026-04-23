# infra/memory.tf
#
# DynamoDB table for cross-instance session memory.
# One row per user, keyed by userId (corporate ID or email).
# TTL attribute: DynamoDB automatically deletes rows after `ttl` (Unix epoch).

resource "aws_dynamodb_table" "memory" {
  name                        = "${local.prefix}-memory"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "userId"
  deletion_protection_enabled = var.enable_deletion_protection

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

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  tags = local.common_tags
}

