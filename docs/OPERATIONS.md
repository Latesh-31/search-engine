# Operations Guide

This guide covers deployment, monitoring, troubleshooting, and maintenance of the Search Platform API in production environments.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Monitoring & Observability](#monitoring--observability)
- [Health Checks](#health-checks)
- [Graceful Shutdown](#graceful-shutdown)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)
- [Security](#security)

## Architecture Overview

The Search Platform API is a production-ready Fastify service that provides:

- **API Layer**: RESTful endpoints for managing users, reviews, activities, and search
- **Data Layer**: PostgreSQL (via Prisma ORM) for relational data
- **Search Layer**: OpenSearch for full-text search and aggregations
- **Indexing Pipeline**: Background workers that sync data from PostgreSQL to OpenSearch
- **Observability**: Structured logging, metrics, and distributed tracing

### Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify 4.x
- **Language**: TypeScript
- **Database**: PostgreSQL 16
- **Search**: OpenSearch 2.x
- **ORM**: Prisma
- **Telemetry**: OpenTelemetry

## Deployment

### Docker Deployment

The service is containerized for consistent deployment across environments.

#### Building the Image

```bash
docker build -t search-platform-api:latest .
```

#### Running the Container

```bash
docker run -d \
  --name search-platform-api \
  -p 3000:3000 \
  -p 9464:9464 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://user:pass@db:5432/dbname \
  -e OPENSEARCH_NODE=https://opensearch:9200 \
  search-platform-api:latest
```

### Kubernetes Deployment

For production Kubernetes deployments, the service should be configured with:

#### Deployment Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: search-platform-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: search-platform-api
  template:
    metadata:
      labels:
        app: search-platform-api
    spec:
      containers:
      - name: api
        image: search-platform-api:latest
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9464
          name: metrics
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: connection-string
        - name: OPENSEARCH_NODE
          value: "https://opensearch.default.svc.cluster.local:9200"
        - name: OTEL_ENABLED
          value: "true"
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          value: "http://otel-collector:4318/v1/traces"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
```

#### Service Configuration

```yaml
apiVersion: v1
kind: Service
metadata:
  name: search-platform-api
spec:
  selector:
    app: search-platform-api
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: metrics
    port: 9464
    targetPort: 9464
  type: ClusterIP
```

#### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: search-platform-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: search-platform-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Configuration

### Environment Variables

All environment variables must be set before starting the application. See [`.env.example`](../.env.example) for a complete list.

#### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Application environment (`development`, `test`, `production`) |
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `3000` | Server port |
| `LOG_LEVEL` | `info` | Logging level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`) |

#### Database Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `POSTGRES_HOST` | No | PostgreSQL host (used for connection pooling) |
| `POSTGRES_PORT` | No | PostgreSQL port |
| `POSTGRES_DB` | No | Database name |
| `POSTGRES_USER` | No | Database user |
| `POSTGRES_PASSWORD` | No | Database password |

#### OpenSearch Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSEARCH_NODE` | `http://opensearch:9200` | OpenSearch node URL |
| `OPENSEARCH_USERNAME` | - | OpenSearch username |
| `OPENSEARCH_PASSWORD` | - | OpenSearch password |
| `OPENSEARCH_USERNAME_FILE` | - | Path to file containing username (Docker secrets) |
| `OPENSEARCH_PASSWORD_FILE` | - | Path to file containing password (Docker secrets) |
| `OPENSEARCH_CA_CERT_PATH` | - | Path to CA certificate for TLS |
| `OPENSEARCH_TLS_REJECT_UNAUTHORIZED` | `true` in production | Enable TLS certificate validation |
| `OPENSEARCH_BOOTSTRAP_ENABLED` | `true` | Auto-create indices and templates on startup |

#### OpenTelemetry Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_ENABLED` | `false` | Enable OpenTelemetry instrumentation |
| `OTEL_SERVICE_NAME` | `search-platform-api` | Service name in traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | - | OTLP collector endpoint for traces |
| `OTEL_EXPORTER_OTLP_HEADERS` | - | JSON object with headers for OTLP exporter |
| `OTEL_METRICS_PORT` | `9464` | Prometheus metrics port |
| `OTEL_METRICS_ENDPOINT` | `/metrics` | Prometheus metrics path |

### Secrets Management

#### Docker Secrets (Swarm/Compose)

```yaml
secrets:
  opensearch_username:
    external: true
  opensearch_password:
    external: true

services:
  api:
    secrets:
      - opensearch_username
      - opensearch_password
    environment:
      OPENSEARCH_USERNAME_FILE: /run/secrets/opensearch_username
      OPENSEARCH_PASSWORD_FILE: /run/secrets/opensearch_password
```

#### Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: opensearch-credentials
type: Opaque
stringData:
  username: admin
  password: changeme

---
# Reference in deployment
env:
- name: OPENSEARCH_USERNAME
  valueFrom:
    secretKeyRef:
      name: opensearch-credentials
      key: username
- name: OPENSEARCH_PASSWORD
  valueFrom:
    secretKeyRef:
      name: opensearch-credentials
      key: password
```

## Monitoring & Observability

The service provides comprehensive observability through structured logging, metrics, and distributed tracing.

### Structured Logging

All logs are emitted in JSON format using Pino (Fastify's logger):

```json
{
  "level": 30,
  "time": 1697654321000,
  "pid": 1,
  "hostname": "api-pod-abc123",
  "req": {
    "id": "req-1",
    "method": "POST",
    "url": "/reviews",
    "hostname": "api.example.com",
    "remoteAddress": "10.0.0.1",
    "userAgent": "curl/7.68.0"
  },
  "res": {
    "statusCode": 201
  },
  "duration": 45.2,
  "msg": "Request completed"
}
```

### Metrics (Prometheus)

When `OTEL_ENABLED=true`, Prometheus metrics are exposed at `http://localhost:9464/metrics`.

#### Key Metrics

- `http.server.requests` - Total HTTP requests by method, route, and status
- `http.server.request.duration` - Request duration histogram
- Custom application metrics via OpenTelemetry SDK

#### Scraping Configuration (Prometheus)

```yaml
scrape_configs:
  - job_name: 'search-platform-api'
    static_configs:
      - targets: ['api:9464']
    scrape_interval: 15s
```

#### ServiceMonitor (Prometheus Operator)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: search-platform-api
spec:
  selector:
    matchLabels:
      app: search-platform-api
  endpoints:
  - port: metrics
    interval: 15s
    path: /metrics
```

### Distributed Tracing

Configure an OTLP collector to receive traces:

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger-collector:4318/v1/traces
```

Traces include:
- HTTP request spans with method, route, status code
- Database queries (via Prisma instrumentation)
- OpenSearch operations
- Custom application spans

### Log Aggregation

#### ELK Stack

Ship logs to Elasticsearch using Filebeat or Fluentd:

```yaml
# Filebeat configuration
filebeat.inputs:
- type: container
  paths:
    - /var/log/containers/search-platform-api-*.log
  json.keys_under_root: true
  json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "search-platform-api-%{+yyyy.MM.dd}"
```

#### Loki

```yaml
# Promtail configuration
scrape_configs:
- job_name: kubernetes-pods
  kubernetes_sd_configs:
  - role: pod
  relabel_configs:
  - source_labels: [__meta_kubernetes_pod_label_app]
    target_label: app
  - source_labels: [__meta_kubernetes_namespace]
    target_label: namespace
```

## Health Checks

The service exposes a comprehensive health endpoint at `GET /health`.

### Health Response Format

```json
{
  "status": "pass",
  "version": "0.1.0",
  "releaseId": "abc123def",
  "serviceId": "search-platform-api",
  "description": "Search Platform API health status",
  "checks": {
    "opensearch": [
      {
        "componentId": "opensearch",
        "componentType": "search",
        "status": "pass",
        "time": "2024-01-15T10:30:00.000Z",
        "observedValue": 12,
        "observedUnit": "ms"
      }
    ],
    "postgres": [
      {
        "componentId": "postgres",
        "componentType": "datastore",
        "status": "pass",
        "time": "2024-01-15T10:30:00.000Z",
        "observedValue": 8,
        "observedUnit": "ms"
      }
    ]
  }
}
```

### Health Statuses

- `pass` - All checks passed
- `warn` - Non-critical issues detected
- `fail` - Critical issues, service degraded
- `skipped` - Check not performed (e.g., in test environment)

### Using Health Checks

#### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
```

#### Load Balancer Health Checks

Configure your load balancer to poll `GET /health` with:
- Interval: 10 seconds
- Timeout: 5 seconds
- Healthy threshold: 2 consecutive successes
- Unhealthy threshold: 3 consecutive failures

## Graceful Shutdown

The service implements graceful shutdown to handle `SIGINT` and `SIGTERM` signals.

### Shutdown Sequence

1. Stop accepting new requests
2. Drain existing requests (wait for completion)
3. Stop background indexing pipeline
4. Close database connections
5. Close OpenSearch client
6. Shutdown telemetry collectors
7. Exit process

### Shutdown Timeout

The Kubernetes `terminationGracePeriodSeconds` should be set to allow sufficient time for shutdown:

```yaml
spec:
  terminationGracePeriodSeconds: 30
```

## Troubleshooting

### Common Issues

#### 1. Service Not Starting

**Symptoms**: Container exits immediately or restarts repeatedly

**Diagnosis**:
```bash
# Check logs
docker logs search-platform-api

# Common errors:
# - Environment validation failed
# - Database connection refused
# - OpenSearch unreachable
```

**Solutions**:
- Verify all required environment variables are set
- Check database and OpenSearch connectivity
- Ensure database migrations have been applied: `npm run prisma:migrate:deploy`

#### 2. Health Check Failures

**Symptoms**: Health endpoint returns `fail` status or 500 error

**Diagnosis**:
```bash
# Check health endpoint
curl http://localhost:3000/health | jq

# Check component-specific issues:
# - opensearch.status: "fail"
# - postgres.status: "fail"
```

**Solutions**:
- **OpenSearch**: Verify `OPENSEARCH_NODE` URL, credentials, and network connectivity
- **PostgreSQL**: Check `DATABASE_URL`, connection pool exhaustion, or database locks
- Review service logs for detailed error messages

#### 3. High Memory Usage

**Symptoms**: Container OOM kills or high memory metrics

**Diagnosis**:
```bash
# Check container stats
docker stats search-platform-api

# Check Node.js heap usage
curl http://localhost:3000/health
```

**Solutions**:
- Increase container memory limits
- Review and optimize database queries
- Check for memory leaks in business logic
- Tune connection pool sizes

#### 4. Slow Request Performance

**Symptoms**: High request latency, timeout errors

**Diagnosis**:
```bash
# Check metrics
curl http://localhost:9464/metrics | grep http_server_request_duration

# Enable debug logging
LOG_LEVEL=debug npm start
```

**Solutions**:
- Add database indexes for frequently queried columns
- Optimize OpenSearch queries and aggregations
- Review slow query logs in PostgreSQL
- Increase worker batch sizes for indexing pipeline

#### 5. OpenSearch Index Bootstrap Fails

**Symptoms**: Service starts but OpenSearch templates not created

**Diagnosis**:
```bash
# Check logs for bootstrap errors
docker logs search-platform-api 2>&1 | grep -i opensearch

# Manually verify templates
curl http://opensearch:9200/_index_template/reviews-template-v1
```

**Solutions**:
- Verify OpenSearch permissions (user must have cluster admin rights)
- Disable automatic bootstrap: `OPENSEARCH_BOOTSTRAP_ENABLED=false`
- Manually run bootstrap script: `npm run opensearch:bootstrap`

#### 6. Telemetry Not Working

**Symptoms**: No metrics or traces appearing in observability backend

**Diagnosis**:
```bash
# Verify OTEL is enabled
echo $OTEL_ENABLED  # should be "true"

# Test metrics endpoint
curl http://localhost:9464/metrics

# Check OTLP endpoint connectivity
curl -v $OTEL_EXPORTER_OTLP_ENDPOINT
```

**Solutions**:
- Ensure `OTEL_ENABLED=true`
- Verify OTLP collector endpoint is reachable
- Check OTLP headers authentication
- Review telemetry logs for export errors

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
LOG_LEVEL=debug npm start
```

### Accessing Logs

#### Docker
```bash
docker logs -f search-platform-api
```

#### Kubernetes
```bash
kubectl logs -f deployment/search-platform-api
kubectl logs -f deployment/search-platform-api --previous  # Previous container
```

## Maintenance

### Database Migrations

Before deploying a new version, always apply pending migrations:

```bash
# Production deployment
npm run prisma:migrate:deploy

# Development
npm run prisma:migrate:dev
```

### OpenSearch Index Management

#### Reindexing

To reindex all reviews:

```bash
# Stop the indexing pipeline (set replicas to 0 or scale down)
kubectl scale deployment/search-platform-api --replicas=0

# Delete existing index
curl -X DELETE http://opensearch:9200/reviews-v1

# Restart service (bootstrap will recreate index)
kubectl scale deployment/search-platform-api --replicas=3

# The indexing pipeline will automatically sync data from PostgreSQL
```

#### Index Aliases

Manage aliases for zero-downtime reindexing:

```bash
# Create new index version
curl -X PUT http://opensearch:9200/reviews-v2

# Reindex from old to new
curl -X POST http://opensearch:9200/_reindex \
  -H 'Content-Type: application/json' \
  -d '{"source": {"index": "reviews-v1"}, "dest": {"index": "reviews-v2"}}'

# Switch alias
curl -X POST http://opensearch:9200/_aliases \
  -H 'Content-Type: application/json' \
  -d '{
    "actions": [
      {"remove": {"index": "reviews-v1", "alias": "reviews"}},
      {"add": {"index": "reviews-v2", "alias": "reviews"}}
    ]
  }'

# Delete old index
curl -X DELETE http://opensearch:9200/reviews-v1
```

### Backup and Recovery

#### Database Backups

Use `pg_dump` for PostgreSQL backups:

```bash
# Full backup
pg_dump -h postgres -U search_user -d search_service > backup.sql

# Restore
psql -h postgres -U search_user -d search_service < backup.sql
```

#### OpenSearch Snapshots

Configure snapshot repository:

```bash
# Register repository
curl -X PUT "opensearch:9200/_snapshot/backup_repo" \
  -H 'Content-Type: application/json' \
  -d '{"type": "s3", "settings": {"bucket": "my-backups", "region": "us-east-1"}}'

# Create snapshot
curl -X PUT "opensearch:9200/_snapshot/backup_repo/snapshot_1?wait_for_completion=true"

# Restore snapshot
curl -X POST "opensearch:9200/_snapshot/backup_repo/snapshot_1/_restore"
```

### Scaling

#### Vertical Scaling

Increase container resources:

```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "2Gi"
    cpu: "2000m"
```

#### Horizontal Scaling

Increase replica count:

```bash
# Kubernetes
kubectl scale deployment/search-platform-api --replicas=5

# Docker Compose
docker-compose up -d --scale api=5
```

**Note**: The indexing pipeline uses leader election (if configured) or distributed locking to prevent duplicate indexing across replicas.

## Security

### TLS/HTTPS

#### Terminate TLS at Load Balancer

Recommended approach - use AWS ALB, Google Cloud Load Balancer, or Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/ssl/certs/api.crt;
    ssl_certificate_key /etc/ssl/private/api.key;

    location / {
        proxy_pass http://search-platform-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Rate Limiting

Implement rate limiting at the API gateway or load balancer level. For application-level rate limiting, add the `@fastify/rate-limit` plugin.

### Authentication & Authorization

The service currently does not implement authentication. For production:

1. Add JWT verification middleware
2. Use API keys or OAuth 2.0
3. Implement role-based access control (RBAC)

### Network Policies (Kubernetes)

Restrict traffic to the API:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: search-platform-api-policy
spec:
  podSelector:
    matchLabels:
      app: search-platform-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: opensearch
    ports:
    - protocol: TCP
      port: 9200
```

### Secrets Rotation

Regularly rotate credentials:

1. **Database passwords**: Update in secrets store, restart pods
2. **OpenSearch credentials**: Update in secrets, rolling restart
3. **API keys**: Implement key versioning and rotation strategy

---

For additional support, refer to the [main README](../README.md) or file an issue in the repository.
