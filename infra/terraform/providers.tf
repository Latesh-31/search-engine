provider "aws" {
  region = var.aws_region
  default_tags {
    tags = merge(
      {
        "Project"     = var.project
        "Environment" = var.environment
      },
      var.default_tags,
    )
  }
}

