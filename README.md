# DropBroker

A property listing platform for owners and tenants.
Built with enterprise-grade architecture on AWS.

## Architecture
- Frontend: React (Micro-frontends) → S3 + CloudFront
- Backend: Node.js (Microservices) → AWS Lambda
- Database: PostgreSQL → AWS RDS
- Auth: AWS Cognito
- API: AWS API Gateway
- Monitoring: AWS CloudWatch
- CI/CD: GitHub Actions

## Services
- auth-service
- property-service
- visit-service
- wishlist-service
- admin-service
