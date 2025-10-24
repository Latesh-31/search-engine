data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  az_count = 3
  azs = slice(data.aws_availability_zones.available.names, 0, local.az_count)
  public_subnets = length(var.public_subnet_cidrs) > 0 ? var.public_subnet_cidrs : [for i in range(local.az_count) : cidrsubnet(var.vpc_cidr, 4, i)]
  private_subnets = length(var.private_subnet_cidrs) > 0 ? var.private_subnet_cidrs : [for i in range(local.az_count) : cidrsubnet(var.vpc_cidr, 4, i + local.az_count)]
  name_prefix = "${var.project}-${var.environment}"
  kubernetes_namespace = "search-platform-${var.environment}"
  tags = merge({
    "Project"     = var.project
    "Environment" = var.environment
    "Terraform"   = "true"
  }, var.default_tags)
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.5"

  name = "${local.name_prefix}-vpc"
  cidr = var.vpc_cidr

  azs             = local.azs
  private_subnets = local.private_subnets
  public_subnets  = local.public_subnets

  enable_nat_gateway = true
  single_nat_gateway = true
  one_nat_gateway_per_az = false

  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_suffix  = "public"
  private_subnet_suffix = "private"

  create_flow_log_cloudwatch_iam_role = true
  flow_log_destination_type           = "cloud-watch-logs"
  flow_log_max_aggregation_interval   = 60

  tags = local.tags
}

resource "aws_kms_key" "rds" {
  description             = "KMS key for ${local.name_prefix} PostgreSQL"
  deletion_window_in_days = 10
  enable_key_rotation     = true
  tags                    = local.tags
}

resource "aws_kms_key" "opensearch" {
  description             = "KMS key for ${local.name_prefix} OpenSearch"
  deletion_window_in_days = 10
  enable_key_rotation     = true
  tags                    = local.tags
}

resource "aws_kms_key" "secrets" {
  description             = "KMS key for ${local.name_prefix} Secrets Manager"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  tags                    = local.tags
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.8"

  cluster_name    = "${local.name_prefix}-eks"
  cluster_version = var.eks_cluster_version
  cluster_enabled_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  enable_irsa = true

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnets
  control_plane_subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  kms_key_arn = aws_kms_key.secrets.arn

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
      resolve_conflicts = "OVERWRITE"
    }
  }

  eks_managed_node_groups = {
    default = {
      ami_type       = "AL2_x86_64"
      capacity_type  = "ON_DEMAND"
      desired_size   = var.eks_node_desired_capacity
      max_size       = var.eks_node_max_size
      min_size       = var.eks_node_min_size
      instance_types = var.eks_node_instance_types
      subnet_ids     = module.vpc.private_subnets
      labels = {
        "environment" = var.environment
        "workload"     = "api"
      }
      tags = local.tags
    }
    spot = {
      ami_type       = "AL2_x86_64"
      capacity_type  = "SPOT"
      desired_size   = 1
      max_size       = 3
      min_size       = 0
      instance_types = ["m6i.large", "m6i.xlarge", "m5.large"]
      subnet_ids     = module.vpc.private_subnets
      taints = [
        {
          key    = "workload"
          value  = "batch"
          effect = "NO_SCHEDULE"
        }
      ]
      labels = {
        "environment" = var.environment
        "workload"     = "batch"
      }
      tags = local.tags
    }
  }

  node_security_group_tags = {
    "kubernetes.io/cluster/${local.name_prefix}-eks" = null
    "Name"                                        = "${local.name_prefix}-eks-nodes"
  }

  tags = local.tags
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds"
  description = "Allow Postgres access from EKS nodes"
  vpc_id      = module.vpc.vpc_id

  ingress {
    protocol        = "tcp"
    from_port       = 5432
    to_port         = 5432
    security_groups = [module.eks.node_security_group_id]
    description     = "EKS node group access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_security_group" "opensearch" {
  name        = "${local.name_prefix}-opensearch"
  description = "Allow OpenSearch HTTPS traffic from EKS nodes"
  vpc_id      = module.vpc.vpc_id

  ingress {
    protocol        = "tcp"
    from_port       = 443
    to_port         = 443
    security_groups = [module.eks.node_security_group_id]
    description     = "EKS worker nodes"
  }

  ingress {
    protocol  = "tcp"
    from_port = 9200
    to_port   = 9200
    security_groups = [module.eks.node_security_group_id]
    description = "EKS worker nodes"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "random_password" "db_master" {
  length  = 30
  special = true
}

module "postgres" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.4"

  identifier = "${local.name_prefix}-postgres"

  engine            = "postgres"
  engine_version    = "16.3"
  family            = "postgres16"
  instance_class    = var.rds_instance_class
  allocated_storage = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage
  storage_type      = "gp3"
  iops              = 3000

  db_name  = replace("${var.project}_${var.environment}", "-", "_")
  username = "search_platform"
  password = random_password.db_master.result

  multi_az                        = true
  publicly_accessible             = false
  deletion_protection             = true
  copy_tags_to_snapshot           = true
  skip_final_snapshot             = false
  backup_retention_period         = var.rds_backup_retention_days
  backup_window                   = "03:00-04:00"
  maintenance_window              = "Sun:04:00-Sun:05:00"
  apply_immediately               = false
  performance_insights_enabled         = true
  performance_insights_retention_period = 7
  monitoring_interval                  = 60
  create_monitoring_role               = true
  monitoring_role_name                 = "${local.name_prefix}-rds-monitor"

  create_db_subnet_group = true
  subnet_ids             = module.vpc.private_subnets

  vpc_security_group_ids = [aws_security_group.rds.id]

  storage_encrypted               = true
  kms_key_id                      = aws_kms_key.rds.arn
  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = local.tags
}

resource "aws_cloudwatch_log_group" "postgres" {
  name              = "/aws/rds/instance/${module.postgres.db_instance_identifier}/postgresql"
  retention_in_days = 30
  tags              = local.tags
}

resource "random_password" "opensearch_master" {
  length  = 32
  special = true
}

resource "aws_cloudwatch_log_group" "opensearch_application" {
  name              = "/aws/opensearch/${local.name_prefix}/application"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "opensearch_index_slow" {
  name              = "/aws/opensearch/${local.name_prefix}/index-slow"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "opensearch_search_slow" {
  name              = "/aws/opensearch/${local.name_prefix}/search-slow"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_opensearch_domain" "this" {
  domain_name    = substr(replace(local.name_prefix, "-", ""), 0, 24)
  engine_version = "OpenSearch_2.13"

  cluster_config {
    instance_type  = var.opensearch_instance_type
    instance_count = var.opensearch_instance_count
    zone_awareness_enabled = true
    zone_awareness_config {
      availability_zone_count = length(local.azs) >= 2 ? 2 : 1
    }
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = var.opensearch_volume_size
    throughput  = 125
  }

  encrypt_at_rest {
    enabled    = true
    kms_key_id = aws_kms_key.opensearch.arn
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  vpc_options {
    subnet_ids         = slice(module.vpc.private_subnets, 0, min(length(module.vpc.private_subnets), 3))
    security_group_ids = [aws_security_group.opensearch.id]
  }

  advanced_security_options {
    enabled                        = true
    internal_user_database_enabled = true
    master_user_options {
      master_user_name     = "search_admin"
      master_user_password = random_password.opensearch_master.result
    }
  }

  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.opensearch_application.arn
    log_type                 = "ES_APPLICATION_LOGS"
  }

  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.opensearch_index_slow.arn
    log_type                 = "INDEX_SLOW_LOGS"
  }

  log_publishing_options {
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.opensearch_search_slow.arn
    log_type                 = "SEARCH_SLOW_LOGS"
  }

  auto_tune_options {
    desired_state = "ENABLED"
    rollback_on_disable = "DEFAULT"
  }

  tags = local.tags
}

resource "aws_secretsmanager_secret" "database" {
  name        = "/${var.project}/${var.environment}/database"
  description = "PostgreSQL credentials for ${local.name_prefix}"
  kms_key_id  = aws_kms_key.secrets.arn
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username = module.postgres.db_instance_username
    password = random_password.db_master.result
    host     = module.postgres.db_instance_address
    port     = 5432
    database = module.postgres.db_instance_name
    url      = "postgresql://${module.postgres.db_instance_username}:${random_password.db_master.result}@${module.postgres.db_instance_address}:5432/${module.postgres.db_instance_name}"
  })
}

resource "aws_secretsmanager_secret" "opensearch" {
  name        = "/${var.project}/${var.environment}/opensearch"
  description = "OpenSearch connection details for ${local.name_prefix}"
  kms_key_id  = aws_kms_key.secrets.arn
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "opensearch" {
  secret_id = aws_secretsmanager_secret.opensearch.id
  secret_string = jsonencode({
    username = "search_admin"
    password = random_password.opensearch_master.result
    endpoint = aws_opensearch_domain.this.endpoint
  })
}

resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/eks/${module.eks.cluster_name}/search-platform-api"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_iam_role" "deploy" {
  name = "${local.name_prefix}-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:*"
          }
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_policy" "deploy" {
  name        = "${local.name_prefix}-deploy"
  description = "Permissions for GitHub Actions deploy role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "eks:DescribeCluster",
          "eks:ListClusters"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:InitiateLayerUpload",
          "ecr:BatchGetImage",
          "ecr:PutImage"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = [
          "eks:UpdateClusterConfig",
          "eks:UpdateClusterVersion",
          "eks:DescribeNodegroup",
          "eks:DescribeUpdate"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParameterHistory",
          "secretsmanager:GetSecretValue"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "deploy" {
  role       = aws_iam_role.deploy.name
  policy_arn = aws_iam_policy.deploy.arn
}

resource "aws_iam_role" "api_service_account" {
  name = "${local.name_prefix}-api-sa"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = module.eks.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(module.eks.cluster_oidc_issuer_url, "https://", "")}:sub" = "system:serviceaccount:${local.kubernetes_namespace}:search-platform-api"
            "${replace(module.eks.cluster_oidc_issuer_url, "https://", "")}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_policy" "api_service_account" {
  name        = "${local.name_prefix}-api-sa"
  description = "Permissions for the search platform API Kubernetes service account"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.database.arn,
          aws_secretsmanager_secret.opensearch.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.application.arn}:*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "es:ESHttpGet",
          "es:ESHttpHead",
          "es:ESHttpPost",
          "es:ESHttpPut"
        ]
        Resource = "${aws_opensearch_domain.this.arn}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api_service_account" {
  role       = aws_iam_role.api_service_account.name
  policy_arn = aws_iam_policy.api_service_account.arn
}

resource "aws_ecr_repository" "api" {
  name                 = "${var.project}-api"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.secrets.arn
  }
  tags = local.tags
}

resource "aws_cloudwatch_log_group" "alb" {
  name              = "/aws/elasticloadbalancing/${local.name_prefix}"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"
  tags = local.tags
}

resource "aws_sns_topic_subscription" "alerts_email" {
  for_each = toset(var.alert_emails)

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_metric_alarm" "eks_cpu" {
  alarm_name          = "${local.name_prefix}-eks-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "node_cpu_utilization"
  namespace           = "AWS/EKS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "EKS node CPU utilization is above 80%"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = module.eks.cluster_name
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${local.name_prefix}-rds-free-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 5
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 21474836480
  alarm_description   = "RDS free storage below 20 GB"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = module.postgres.db_instance_identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "opensearch_cluster_status" {
  alarm_name          = "${local.name_prefix}-opensearch-cluster-status"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ClusterStatus.red"
  namespace           = "AWS/ES"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  alarm_description   = "OpenSearch cluster status red"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DomainName = aws_opensearch_domain.this.domain_name
    ClientId   = data.aws_caller_identity.current.account_id
  }
}
