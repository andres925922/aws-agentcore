# infra/main.tf
#
# Phase 2 infrastructure for the customer-support MCP server.
# Creates three DynamoDB tables and an IAM policy your local credentials
# (or future Lambda/ECS role) will use to access them.
#
# Deploy:
#   cd infra
#   terraform init
#   terraform plan
#   terraform apply

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ─── Local helpers ────────────────────────────────────────────────────────────

locals {
  prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ─── DynamoDB: customers ──────────────────────────────────────────────────────
#
# Primary key : id (UUID)
# GSI         : email-index — lets us do getCustomerByEmail efficiently
#               without a full table scan

resource "aws_dynamodb_table" "customers" {
  name         = "${local.prefix}-customers"
  billing_mode = "PAY_PER_REQUEST" # no capacity planning needed for dev/phase2
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  # email GSI — mirrors getCustomerByEmail() in the DB client
  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL" # return full item, not just keys
  }

  tags = local.common_tags
}

# ─── DynamoDB: products ───────────────────────────────────────────────────────
#
# Primary key : id (UUID)
# GSI         : customerId-index — lets us fetch all products for a customer

resource "aws_dynamodb_table" "products" {
  name         = "${local.prefix}-products"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "customerId"
    type = "S"
  }

  global_secondary_index {
    name            = "customerId-index"
    hash_key        = "customerId"
    projection_type = "ALL"
  }

  tags = local.common_tags
}

# ─── DynamoDB: tickets ────────────────────────────────────────────────────────
#
# Primary key : id (UUID)
# GSI         : customerId-index — fetch all tickets for a customer

resource "aws_dynamodb_table" "tickets" {
  name         = "${local.prefix}-tickets"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "customerId"
    type = "S"
  }

  global_secondary_index {
    name            = "customerId-index"
    hash_key        = "customerId"
    projection_type = "ALL"
  }

  tags = local.common_tags
}

# ─── IAM policy ───────────────────────────────────────────────────────────────
#
# Least-privilege: only the operations our three tools actually need.
# Attach this to your local IAM user, or to the ECS/Lambda role in Phase 4.

resource "aws_iam_policy" "mcp_server" {
  name        = "${local.prefix}-mcp-server-policy"
  description = "Minimum DynamoDB permissions for the customer-support MCP server"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "TableAccess"
        Effect = "Allow"
        Action = [
          # Reads
          "dynamodb:GetItem",
          "dynamodb:Query",
          # Writes (create_support_ticket tool)
          "dynamodb:PutItem",
        ]
        Resource = [
          aws_dynamodb_table.customers.arn,
          aws_dynamodb_table.products.arn,
          aws_dynamodb_table.tickets.arn,
          # GSI ARNs follow the pattern table_arn/index/index_name
          "${aws_dynamodb_table.customers.arn}/index/*",
          "${aws_dynamodb_table.products.arn}/index/*",
          "${aws_dynamodb_table.tickets.arn}/index/*",
        ]
      }
    ]
  })

  tags = local.common_tags
}
