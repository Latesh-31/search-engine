# Troubleshooting Guide

Quick reference for diagnosing and resolving common issues with the Search Platform API.

## Table of Contents

- [General Diagnostics](#general-diagnostics)
- [Startup Issues](#startup-issues)
- [Runtime Errors](#runtime-errors)
- [Performance Issues](#performance-issues)
- [Data Issues](#data-issues)
- [External Service Issues](#external-service-issues)
- [Getting Help](#getting-help)

## General Diagnostics

### Checking Service Health

```bash
# Basic health check
curl http://localhost:3000/health | jq

# Expected response
{
  "status": "pass",
  "checks": {
    "opensearch": [{"status": "pass", ...}],
    "postgres": [{"status": "pass", ...}]
  }
}
```

### Viewing Logs

```bash
# Docker
docker logs search-platform-api
docker logs -f search-platform-api  # Follow mode

# Kubernetes
kubectl logs deployment/search-platform-api
kubectl logs -f deployment/search-platform-api
kubectl logs deployment/search-platform-api --previous  # Previous crash

# Filter for errors
kubectl logs deployment/search-platform-api | grep -i error
```

### Enable Debug Logging

```bash
# Set environment variable
export LOG_LEVEL=debug

# Or in .env file
LOG_LEVEL=debug

# Restart service
npm run dev
```

## Startup Issues

### Issue: Environment Validation Failed

**Symptom**: Service exits immediately with validation errors

```
❌ Invalid environment configuration: {
  DATABASE_URL: [ 'Required' ],
  OPENSEARCH_NODE: [ 'Invalid url' ]
}
```

**Solution**:
1. Check `.env` file exists: `ls -la .env`
2. Verify required variables are set: `cat .env | grep DATABASE_URL`
3. Copy from example: `cp .env.example .env`
4. Fill in all required values

### Issue: Database Connection Failed

**Symptom**: Errors mentioning `ECONNREFUSED`, `connect ETIMEDOUT`, or Prisma connection errors

```
Failed to start server
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Diagnosis**:
```bash
# Check database is running
docker ps | grep postgres
kubectl get pods | grep postgres

# Test connection manually
psql postgresql://user:pass@host:5432/dbname

# Check network connectivity
telnet postgres-host 5432
nc -zv postgres-host 5432
```

**Solution**:
1. Verify database is running and accessible
2. Check `DATABASE_URL` format: `postgresql://user:pass@host:5432/dbname`
3. Verify firewall rules allow traffic on port 5432
4. Check credentials are correct
5. Ensure database exists: `CREATE DATABASE search_service;`

### Issue: Database Migrations Not Applied

**Symptom**: Prisma errors about missing tables or columns

```
Invalid `prisma.user.findMany()` invocation:
The table `public.User` does not exist in the current database.
```

**Solution**:
```bash
# Apply migrations
npm run prisma:migrate:deploy

# If in development, can reset database
npm run prisma:migrate:dev

# Verify migrations
npx prisma migrate status
```

### Issue: OpenSearch Connection Failed

**Symptom**: Health check shows OpenSearch as `fail`, or bootstrap errors

```
OpenSearch infrastructure bootstrap failed
Error: connect ECONNREFUSED 127.0.0.1:9200
```

**Diagnosis**:
```bash
# Check OpenSearch is running
docker ps | grep opensearch
kubectl get pods | grep opensearch

# Test connection
curl http://opensearch:9200

# Check cluster health
curl http://opensearch:9200/_cluster/health
```

**Solution**:
1. Verify `OPENSEARCH_NODE` URL is correct
2. Check OpenSearch is running and healthy
3. Verify credentials if security is enabled
4. For TLS: ensure `OPENSEARCH_CA_CERT_PATH` points to valid cert
5. Temporarily disable bootstrap: `OPENSEARCH_BOOTSTRAP_ENABLED=false`

### Issue: OpenTelemetry Initialization Failed

**Symptom**: Errors mentioning OTLP exporter or metrics

```
Error: OTEL_EXPORTER_OTLP_HEADERS must be a valid JSON object string
```

**Solution**:
1. If not using telemetry: `OTEL_ENABLED=false`
2. Check JSON format: `OTEL_EXPORTER_OTLP_HEADERS='{"key":"value"}'`
3. Verify OTLP endpoint is reachable
4. Test without auth headers first

## Runtime Errors

### Issue: 404 Not Found

**Symptom**: All requests return 404

```json
{
  "statusCode": 404,
  "error": "NotFoundError",
  "message": "Route GET /users not found"
}
```

**Diagnosis**:
- Check route registration in `src/app.ts`
- Verify route prefix is correct
- Check request URL matches exactly (trailing slashes matter)

**Solution**:
- Use exact endpoint paths from documentation
- Example: `GET /users` not `GET /users/`

### Issue: 400 Validation Error

**Symptom**: Request rejected with validation details

```json
{
  "statusCode": 400,
  "error": "ValidationError",
  "message": "Request validation failed",
  "details": {
    "email": {
      "_errors": ["Invalid email"]
    }
  }
}
```

**Solution**:
- Review validation details in response
- Check request body matches schema requirements
- Ensure correct Content-Type header: `application/json`
- Validate JSON syntax: `echo '{}' | jq`

### Issue: 500 Internal Server Error

**Symptom**: Generic 500 error with no details

```json
{
  "statusCode": 500,
  "error": "InternalServerError",
  "message": "Internal server error."
}
```

**Diagnosis**:
1. Check server logs for full error details
2. Error details are hidden in production for security
3. In development, full stack traces are visible

**Common Causes**:
- Database query errors
- OpenSearch query syntax errors
- Unhandled exceptions in business logic
- Resource exhaustion (memory, connections)

**Solution**:
- Review logs for specific error messages
- Check database and OpenSearch are accessible
- Verify data integrity (foreign key constraints)
- Check for connection pool exhaustion

### Issue: Request Timeout

**Symptom**: Requests hang and eventually timeout

**Diagnosis**:
```bash
# Check request duration metrics
curl http://localhost:9464/metrics | grep http_server_request_duration

# Check slow queries in logs
LOG_LEVEL=debug npm start
```

**Common Causes**:
- Slow database queries (missing indexes)
- Large OpenSearch aggregations
- Deadlocks or long transactions
- External service delays

**Solution**:
- Add database indexes: `CREATE INDEX idx_name ON table(column);`
- Optimize OpenSearch queries (reduce aggregation size)
- Implement request timeouts
- Add query monitoring and slow query logging

## Performance Issues

### Issue: High Memory Usage

**Symptom**: Container OOM killed or high memory metrics

**Diagnosis**:
```bash
# Check container memory
docker stats search-platform-api

# Check Node.js heap
node --inspect src/index.js
# Open Chrome DevTools and take heap snapshot

# Check for memory leaks
npm install -g clinic
clinic doctor -- node dist/index.js
```

**Common Causes**:
- Large result sets loaded into memory
- Connection pool leaks
- Event listener leaks
- Inefficient data structures

**Solution**:
1. Implement pagination on all list endpoints
2. Use streaming for large responses
3. Review connection pool configurations
4. Limit query result sizes
5. Increase container memory limits

### Issue: High CPU Usage

**Symptom**: CPU at 100%, slow response times

**Diagnosis**:
```bash
# Check CPU usage
docker stats search-platform-api

# Profile application
npm install -g clinic
clinic flame -- node dist/index.js
```

**Common Causes**:
- Heavy serialization/deserialization
- Inefficient algorithms (O(n²) loops)
- Regex catastrophic backtracking
- Synchronous crypto operations

**Solution**:
1. Use async operations for I/O
2. Implement caching for expensive operations
3. Optimize hot code paths
4. Consider worker threads for CPU-intensive tasks

### Issue: Database Connection Pool Exhausted

**Symptom**: Errors about no available connections

```
Error: Timed out fetching a new connection from the connection pool
```

**Diagnosis**:
```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'search_service';

# Check pool configuration
grep connection_limit .env
```

**Solution**:
1. Increase pool size in `DATABASE_URL`: `?connection_limit=20`
2. Check for connection leaks (missing `.finally()`)
3. Reduce query duration
4. Implement connection pooling proxy (PgBouncer)

### Issue: Slow Search Queries

**Symptom**: `/search/reviews` endpoint is slow

**Diagnosis**:
```bash
# Check query performance
curl -X POST http://localhost:3000/search/reviews \
  -H 'Content-Type: application/json' \
  -d '{"query":"test"}' \
  -w '\nTime: %{time_total}s\n'

# Check OpenSearch slow logs
curl http://opensearch:9200/_nodes/stats/indices/search
```

**Solution**:
1. Reduce page size: `"pageSize": 10` instead of 100
2. Limit aggregations
3. Add index refresh intervals
4. Use OpenSearch query profiling
5. Consider adding shard replicas

## Data Issues

### Issue: Missing or Stale Search Results

**Symptom**: Data in PostgreSQL but not in OpenSearch

**Diagnosis**:
```bash
# Check if indexing pipeline is running
# Look for logs: "Review indexing pipeline started"

# Check PostgreSQL for pending changes
SELECT * FROM "Review" WHERE id = 'some-id';

# Check OpenSearch for document
curl http://opensearch:9200/reviews/_doc/some-id
```

**Solution**:
1. Verify indexing pipeline is running (check logs)
2. Check for pipeline errors in logs
3. Manually reindex if needed:
   ```bash
   # Delete and recreate index (this restarts pipeline)
   curl -X DELETE http://opensearch:9200/reviews-v1
   # Restart service to bootstrap and re-sync
   ```

### Issue: Data Inconsistency Between Stores

**Symptom**: Different data in PostgreSQL vs OpenSearch

**Solution**:
1. PostgreSQL is source of truth
2. OpenSearch is eventually consistent
3. Force re-sync by deleting OpenSearch index
4. Check indexing pipeline logs for errors

### Issue: Foreign Key Constraint Violations

**Symptom**: Cannot create/delete records due to relationships

```
Foreign key constraint failed on the field: `userId`
```

**Solution**:
1. Create referenced records first (e.g., create user before review)
2. Delete child records before parent (e.g., delete reviews before user)
3. Check cascade delete rules in Prisma schema

## External Service Issues

### Issue: OpenSearch Cluster Red

**Symptom**: Health check returns cluster status red

**Diagnosis**:
```bash
curl http://opensearch:9200/_cluster/health

# Check shard allocation
curl http://opensearch:9200/_cat/shards?v
```

**Solution**:
1. Check disk space: OpenSearch refuses writes at 90% disk
2. Restart unhealthy nodes
3. Manually allocate shards if needed
4. Review OpenSearch logs for specific errors

### Issue: PostgreSQL Locks

**Symptom**: Queries hanging, timeouts

**Diagnosis**:
```sql
-- Check locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Check blocking queries
SELECT pid, query, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE wait_event IS NOT NULL;
```

**Solution**:
```sql
-- Kill blocking query (use carefully)
SELECT pg_terminate_backend(pid);
```

### Issue: Telemetry Collector Unreachable

**Symptom**: Traces not appearing, OTLP errors in logs

```
Failed to export traces to http://otel-collector:4318/v1/traces
```

**Solution**:
1. Verify OTLP collector is running: `kubectl get pods -l app=otel-collector`
2. Check network connectivity: `curl http://otel-collector:4318/v1/traces`
3. Verify authentication headers are correct
4. Temporarily disable: `OTEL_ENABLED=false`

## Getting Help

### Collecting Debug Information

When reporting issues, provide:

```bash
# Service version
npm run --silent version

# Environment
NODE_ENV=...
LOG_LEVEL=...

# Health check output
curl http://localhost:3000/health | jq

# Recent logs (last 100 lines)
docker logs --tail 100 search-platform-api 2>&1

# System information
docker stats --no-stream search-platform-api
# OR
kubectl top pod search-platform-api
```

### Useful Commands

```bash
# Check service is listening
lsof -i :3000
netstat -an | grep 3000

# Test database connection
psql "$DATABASE_URL" -c "SELECT version();"

# Test OpenSearch connection
curl -u user:pass http://opensearch:9200/_cluster/health

# Validate environment configuration
npm run typecheck

# Run tests
npm test

# Check for common issues
npm run lint
```

### Support Resources

- **Documentation**: [README.md](../README.md), [OPERATIONS.md](./OPERATIONS.md)
- **Logs**: Always check application logs first
- **Health Endpoint**: `GET /health` for service status
- **Metrics**: `GET :9464/metrics` for performance data (if OTEL enabled)

### Debug Checklist

Before asking for help, verify:

- [ ] All environment variables are set correctly
- [ ] Database migrations have been applied
- [ ] PostgreSQL is running and accessible
- [ ] OpenSearch is running and accessible
- [ ] Health endpoint returns `pass` status
- [ ] Logs contain detailed error messages
- [ ] Service can handle simple requests (e.g., `GET /`)
- [ ] Network connectivity between services
- [ ] Firewall rules allow required ports
- [ ] Disk space is available
- [ ] Memory limits are sufficient

---

If issues persist after following this guide, open an issue with:
- Full error messages from logs
- Health check output
- Environment configuration (redact secrets)
- Steps to reproduce
