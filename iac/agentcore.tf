# infra/agentcore.tf
#
# IAM execution role for AgentCore Runtime.
# AgentCore uses this role when running your container — it needs:
#   - ECR pull permissions (to fetch the image)
#   - DynamoDB permissions (reusing the policy from main.tf)
#   - CloudWatch Logs (for observability)

# ─── Trust policy ─────────────────────────────────────────────────────────────
# Who can assume this role — AgentCore Runtime service

data "aws_iam_policy_document" "agentcore_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["bedrock-agentcore.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "agentcore_execution" {
  name               = "${local.prefix}-agentcore-execution-role"
  assume_role_policy = data.aws_iam_policy_document.agentcore_trust.json
  tags               = local.common_tags
}

# ─── ECR pull permissions ──────────────────────────────────────────────────────

resource "aws_iam_role_policy" "ecr_pull" {
  name = "ecr-pull"
  role = aws_iam_role.agentcore_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
        ]
        Resource = aws_ecr_repository.mcp_server.arn
      }
    ]
  })
}

# ─── DynamoDB permissions ─────────────────────────────────────────────────────
# Reuse the policy we already defined in main.tf

resource "aws_iam_role_policy_attachment" "dynamodb" {
  role       = aws_iam_role.agentcore_execution.name
  policy_arn = aws_iam_policy.mcp_server.arn
}

# ─── CloudWatch Logs ──────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "agentcore" {
  name              = "/aws/bedrock-agentcore/${local.prefix}"
  retention_in_days = var.cloudwatch_log_retention_days
}

resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "cloudwatch-logs"
  role = aws_iam_role.agentcore_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = [
          "${aws_cloudwatch_log_group.agentcore.arn}:*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:DescribeLogStreams",
        ]
        Resource = aws_cloudwatch_log_group.agentcore.arn
      }
    ]
  })
}
