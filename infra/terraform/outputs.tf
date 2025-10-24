output "vpc_id" {
  description = "Identifier of the provisioned VPC."
  value       = module.vpc.vpc_id
}

output "public_subnets" {
  description = "IDs of public subnets."
  value       = module.vpc.public_subnets
}

output "private_subnets" {
  description = "IDs of private subnets."
  value       = module.vpc.private_subnets
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster."
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "Endpoint for the EKS control plane."
  value       = module.eks.cluster_endpoint
}

output "eks_oidc_provider_arn" {
  description = "ARN of the cluster's OIDC provider for IRSA."
  value       = module.eks.oidc_provider_arn
}

output "rds_endpoint" {
  description = "PostgreSQL endpoint hostname."
  value       = module.postgres.db_instance_address
}

output "opensearch_endpoint" {
  description = "OpenSearch domain HTTPS endpoint."
  value       = aws_opensearch_domain.this.endpoint
}

output "database_secret_arn" {
  description = "ARN of the Secrets Manager secret storing PostgreSQL credentials."
  value       = aws_secretsmanager_secret.database.arn
}

output "opensearch_secret_arn" {
  description = "ARN of the Secrets Manager secret storing OpenSearch credentials."
  value       = aws_secretsmanager_secret.opensearch.arn
}

output "deploy_role_arn" {
  description = "ARN of the IAM role assumed by the CI/CD pipeline."
  value       = aws_iam_role.deploy.arn
}

output "api_service_account_role_arn" {
  description = "IAM role associated with the Kubernetes service account for the API."
  value       = aws_iam_role.api_service_account.arn
}

output "ecr_repository_url" {
  description = "URL of the ECR repository hosting API images."
  value       = aws_ecr_repository.api.repository_url
}
