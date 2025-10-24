variable "project" {
  description = "Name of the project used for tagging and naming resources."
  type        = string
  default     = "search-platform"
}

variable "environment" {
  description = "Deployment environment (e.g. staging, production)."
  type        = string
}

variable "aws_region" {
  description = "AWS region to deploy resources into."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.42.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "List of public subnet CIDR blocks. Leave empty to auto-generate."
  type        = list(string)
  default     = []
}

variable "private_subnet_cidrs" {
  description = "List of private subnet CIDR blocks. Leave empty to auto-generate."
  type        = list(string)
  default     = []
}

variable "eks_cluster_version" {
  description = "EKS control plane version."
  type        = string
  default     = "1.30"
}

variable "eks_node_instance_types" {
  description = "Instance types for the managed node group."
  type        = list(string)
  default     = ["m6i.large"]
}

variable "eks_node_min_size" {
  description = "Minimum number of nodes in the EKS managed node group."
  type        = number
  default     = 2
}

variable "eks_node_desired_capacity" {
  description = "Desired number of nodes in the EKS managed node group."
  type        = number
  default     = 3
}

variable "eks_node_max_size" {
  description = "Maximum number of nodes in the EKS managed node group."
  type        = number
  default     = 6
}

variable "rds_instance_class" {
  description = "Instance class for the PostgreSQL database."
  type        = string
  default     = "db.m6g.large"
}

variable "rds_allocated_storage" {
  description = "Allocated storage (in GB) for the PostgreSQL instance."
  type        = number
  default     = 200
}

variable "rds_max_allocated_storage" {
  description = "Maximum autoscaling storage (in GB) for PostgreSQL."
  type        = number
  default     = 1000
}

variable "rds_backup_retention_days" {
  description = "Number of days to retain automated backups for PostgreSQL."
  type        = number
  default     = 14
}

variable "opensearch_instance_type" {
  description = "Instance type for the OpenSearch data nodes."
  type        = string
  default     = "m6g.large.search"
}

variable "opensearch_instance_count" {
  description = "Number of OpenSearch data nodes."
  type        = number
  default     = 3
}

variable "opensearch_volume_size" {
  description = "EBS volume size (in GB) for OpenSearch data nodes."
  type        = number
  default     = 200
}

variable "default_tags" {
  description = "Additional resource tags to apply."
  type        = map(string)
  default     = {}
}

variable "github_repository" {
  description = "GitHub repository in the format owner/name used for OIDC trust with GitHub Actions."
  type        = string
  default     = "YOUR_ORG/search-platform"
}

variable "alert_emails" {
  description = "List of email addresses to subscribe to CloudWatch alarms."
  type        = list(string)
  default     = []
}
