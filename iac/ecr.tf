# infra/ecr.tf
#
# ECR repository where we push the Docker image before deploying to AgentCore.
# AgentCore Runtime pulls from here.

resource "aws_ecr_repository" "mcp_server" {
  name                 = "${local.prefix}-mcp-server"
  image_tag_mutability = "MUTABLE" # allows overwriting :latest tag

  image_scanning_configuration {
    scan_on_push = true # free basic scanning, catches known CVEs
  }

  tags = local.common_tags
}

# Lifecycle policy — keep only the last 10 images to control storage costs
resource "aws_ecr_lifecycle_policy" "mcp_server" {
  repository = aws_ecr_repository.mcp_server.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

output "ecr_repository_url" {
  description = "ECR URL — use this in the deploy script"
  value       = aws_ecr_repository.mcp_server.repository_url
}

output "ecr_registry" {
  description = "Registry hostname for docker login"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

data "aws_caller_identity" "current" {}
