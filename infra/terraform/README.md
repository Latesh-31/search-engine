# Infrastructure as Code

This Terraform configuration provisions the core AWS infrastructure required to operate the Search Platform API in production. The stack includes networking, container orchestration, managed data stores, security controls, and observability plumbing.

## Features

- Opinionated **multi-AZ VPC** with public and private subnets, NAT gateway, and VPC flow logs
- **Amazon EKS** cluster (with managed node groups and IRSA) ready for the Kubernetes manifests in `deploy/kubernetes`
- **Amazon RDS for PostgreSQL** with encryption, automated backups, enhanced monitoring, and Secrets Manager credentials
- **Amazon OpenSearch Service** domain secured inside the VPC with fine-grained access control and CloudWatch logging
- AWS Secrets Manager secrets for database and OpenSearch connection details consumed by the application
- Hardened security groups restricting data store access to EKS worker nodes only
- **Amazon ECR** repository for container images
- **IAM roles and policies** for GitHub Actions (CI/CD) and for the Kubernetes service account that runs the API pods
- **CloudWatch log groups & alarms** plus optional SNS email notifications for proactive alerting

## Prerequisites

- Terraform **1.5+**
- AWS account with sufficient permissions to create the listed resources
- Configured AWS credentials (environment variables, SSO, or shared credentials file)
- Remote state backend (S3 + DynamoDB is recommended) — configure via `terraform init -backend-config=...`

## Directory Layout

```
infra/
└── terraform/
    ├── main.tf              # Primary infrastructure definition
    ├── variables.tf         # Input variables with defaults and documentation
    ├── outputs.tf           # Useful values exported after apply
    ├── providers.tf         # AWS provider configuration and tagging
    ├── versions.tf          # Terraform + provider version constraints
    └── README.md            # This guide
```

## Getting Started

Create a dedicated workspace per environment (staging, production) to keep state isolated:

```bash
cd infra/terraform
terraform init -backend-config=envs/staging.backend.hcl
terraform workspace new staging || terraform workspace select staging
```

Populate the required variables. You can use a `*.tfvars` file (one per environment) or pass values on the CLI. A minimal `staging.tfvars` might look like:

```hcl
environment        = "staging"
github_repository  = "your-org/search-platform"
alert_emails       = ["alerts@your-org.com"]
```

For production you can override capacity parameters, subnet CIDRs, or instance classes as needed.

Plan and apply:

```bash
terraform plan -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
```

> **Tip:** Enable remote state locking (S3 backend with DynamoDB) before applying to production.

## Post-Apply Checklist

1. **Exported outputs** include:
   - `eks_cluster_name` and `eks_cluster_endpoint` for configuring `kubectl`
   - `deploy_role_arn` for the GitHub Actions OIDC trust relationship (see `.github/workflows/deploy.yml`)
   - `api_service_account_role_arn` referenced by the Kubernetes `ServiceAccount` manifest
   - Secrets Manager ARNs consumed by the ExternalSecret resources in `deploy/kubernetes`
2. **Install cluster add-ons**:
   - [AWS Load Balancer Controller](https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html)
   - [Metrics Server](https://docs.aws.amazon.com/eks/latest/userguide/metrics-server.html)
   - [External Secrets Operator](https://external-secrets.io/)
3. **Configure Route 53** records to point your domain (e.g., `api.example.com`) at the provisioned Application Load Balancer once the Kubernetes ingress is created.

## Secrets & Environment Separation

- Secrets are stored in AWS Secrets Manager under `/search-platform/<environment>/*`.
- The Kubernetes overlays reference these secrets via `ExternalSecret` objects so that credentials are materialised inside the cluster automatically.
- The Terraform variable `environment` drives naming, tagging, and network isolation, ensuring staging and production stacks stay separated.

## Disaster Recovery

The following safeguards are included by default:

- Multi-AZ RDS deployment with automated backups (14-day retention) and storage autoscaling
- OpenSearch with zone awareness, hourly automated snapshots, and encryption
- Encrypted ECR, Secrets Manager, and logs using customer-managed KMS keys
- SNS-powered CloudWatch alarms for critical metrics (CPU, storage, cluster health)

## Next Steps

- Review and tailor instance sizes, scaling boundaries, and retention periods to match forecasted load
- Integrate additional observability tooling (e.g., Amazon Managed Prometheus/Grafana) if desired
- Extend Terraform with modules for supporting services (Redis, S3 buckets, Lambda triggers, etc.) as the platform evolves

Refer to [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) for the full deployment runbook and operational procedures.
