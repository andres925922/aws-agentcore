# Bedrock AgentCore runtime configuration

This folder centralizes runtime deployment inputs for Bedrock AgentCore.

## Files

1. .env.agentcore.example: key/value template for account-specific values.
2. runtime-config.example.json: complete runtime configuration template.

## Suggested workflow

1. Copy .env.agentcore.example to .env.agentcore and fill real values.
2. Build and push the MCP Docker image to ECR.
3. Generate runtime config from your real values.
4. Create or update the runtime in Bedrock AgentCore using your deployment method.

## Build and push image

```bash
AWS_PROFILE=aws-agent-core AWS_REGION=eu-west-2 aws ecr get-login-password \
  | docker login --username AWS --password-stdin 123456789012.dkr.ecr.eu-west-2.amazonaws.com

docker build -f src/Dockerfile -t customer-support-mcp:latest .
docker tag customer-support-mcp:latest 123456789012.dkr.ecr.eu-west-2.amazonaws.com/customer-support-mcp-dev-mcp-server:latest
docker push 123456789012.dkr.ecr.eu-west-2.amazonaws.com/customer-support-mcp-dev-mcp-server:latest
```

## Notes

- Keep runtime path as /mcp to match the server endpoint.
- Keep port as 8000 unless you update the app and Docker config.
- Store sensitive values outside git, for example in AWS Secrets Manager or your CI secrets.
