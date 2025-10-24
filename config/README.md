# Environment Configuration

This directory contains environment-aware configuration artifacts that complement the runtime `.env` files and Kubernetes overlays.

## Overview

Each environment (staging, production) uses a dedicated configuration bundle:

- **`.env.<environment>.example`** — canonical list of environment variables that should be supplied via AWS Secrets Manager or GitHub Actions environment secrets.
- **`deploy/kubernetes/overlays/<environment>`** — Kubernetes overlays that set environment-specific values (log levels, replica counts, ingress hosts) and wire up ExternalSecret resources to pull secrets from AWS Secrets Manager.

The application itself still relies on environment variables, but the files in this folder serve as a human-readable manifest describing the required settings per environment. Platform teams should keep these files in sync with the secrets stored in AWS Secrets Manager and the GitHub Actions environment configuration.

## Adding a New Environment

1. Duplicate `.env.<environment>.example` with the required values.
2. Create a matching Kubernetes overlay under `deploy/kubernetes/overlays/<environment>`.
3. Provision infrastructure with `terraform apply -var environment=<environment>`.
4. Configure GitHub Actions environment secrets (`AWS_OIDC_ROLE_ARN`, `STAGING_EKS_CLUSTER_NAME`, etc.) for the new environment.
