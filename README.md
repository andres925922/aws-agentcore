# AWS AgentCore MCP Server

TypeScript MCP server for customer support workflows with pluggable persistence:

- DB backends: sqlite or dynamodb
- Memory backends: ram, sqlite, or dynamodb
- Runtime target: Bedrock AgentCore

## Project structure

```text
iac/                 # Terraform infrastructure (DynamoDB, IAM, ECR, logs)
agentcore/           # Bedrock AgentCore runtime config templates
src/                 # MCP server source code
```

## Prerequisites

Install these dependencies before running anything:

1. Node.js 20+
2. npm 10+
3. Docker
4. AWS CLI v2
5. Terraform >= 1.6

Quick checks:

```bash
node -v
npm -v
docker --version
aws --version
terraform -version
```

## Local app setup

```bash
npm install
npm run build
```

Run locally with sqlite:

```bash
cp .env.example .env
npm run seedSqlite
npm run dev
```

Server endpoint:

```text
http://0.0.0.0:8000/mcp
```

## AWS CLI profile setup

Create a named profile (recommended):

```bash
aws configure --profile aws-agent-core
```

Set default profile for your terminal session:

```bash
export AWS_PROFILE=aws-agent-core
```

Optional explicit region:

```bash
export AWS_REGION=eu-west-2
```

Verify credentials and account:

```bash
aws sts get-caller-identity
```

## Terraform infrastructure

All infrastructure is in [iac/main.tf](iac/main.tf), [iac/memory.tf](iac/memory.tf), [iac/ecr.tf](iac/ecr.tf), and [iac/agentcore.tf](iac/agentcore.tf).

### What gets created

1. DynamoDB tables: customers, products, tickets, memory
2. IAM policy with least-privilege DynamoDB actions for this MCP
3. ECR repository for the runtime image
4. AgentCore execution role
5. CloudWatch log group with retention policy

### Recommended tfvars file

Create [iac/terraform.tfvars](iac/terraform.tfvars):

```hcl
aws_region                    = "eu-west-2"
project_name                  = "customer-support-mcp"
environment                   = "dev"
enable_point_in_time_recovery = true
enable_deletion_protection    = false
cloudwatch_log_retention_days = 30
```

### Install and apply infra

```bash
cd iac
terraform init
terraform fmt
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```

### Export outputs to app env

After apply:

```bash
terraform output -raw env_block
```

Copy that output into your [.env](.env) file.

### Seed DynamoDB data

With infra already applied and .env configured:

```bash
npm run seedDynamo
```

### Destroy infra

Normal destroy:

```bash
cd iac
terraform destroy
```

If deletion protection was enabled for DynamoDB, set it to false in tfvars first and apply:

```bash
cd iac
terraform apply -var="enable_deletion_protection=false"
terraform destroy
```

## Bedrock AgentCore config folder

The folder [agentcore/README.md](agentcore/README.md) contains templates and instructions to configure runtime deployment inputs.

Files:

1. [agentcore/.env.agentcore.example](agentcore/.env.agentcore.example)
2. [agentcore/runtime-config.example.json](agentcore/runtime-config.example.json)
3. [agentcore/README.md](agentcore/README.md)

## Useful npm scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run seedSqlite
npm run seedDynamo
```

## Invoke models with context (/chat)

This project now exposes a Bedrock chat orchestration endpoint:

```text
POST /chat
```

The endpoint:

1. Loads per-user memory context automatically.
2. Sends that context to your selected Bedrock model.
3. Lets the model call business tools (customer profile, warranty, ticket creation, memory tools).
4. Returns the final assistant reply.

Required environment variables:

```bash
AWS_REGION=eu-west-2
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

Optional:

```bash
BEDROCK_SYSTEM_PROMPT="You are a helpful customer support assistant"
```

Example request:

```bash
curl -X POST http://localhost:8000/chat \
	-H "Content-Type: application/json" \
	-d '{
		"userId": "andres",
		"message": "Revisa la garantia del producto p0000000-0000-0000-0000-000000000001 y si esta vencida abre un ticket",
		"rememberResponse": true
	}'
```

Example response shape:

```json
{
	"modelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
	"reply": "...",
	"stopReason": "end_turn",
	"toolCalls": [
		{
			"name": "check_warranty_status",
			"input": {
				"productId": "..."
			}
		}
	]
}
```

## Build the image
```bash
docker build -f src/Dockerfile -t customer-service-mcp .
```

## Push the image to ECR
```bash
aws sts get-caller-identity

aws ecr get-login-password --region eu-west-2 --profile default | docker login --username AWS --password-stdin <account_id>.dkr.ecr.eu-west-2.amazonaws.com
docker tag customer-service-mcp:latest <account_id>.dkr.ecr.eu-west-2.amazonaws.com/customer-service-mcp:latest
docker push <account_id>.dkr.ecr.eu-west-2.amazonaws.com/customer-service-mcp:latest
```	
