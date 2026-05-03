# DropBroker — System Architecture

A property listing platform for owners and tenants, built with enterprise-grade AWS architecture.

---

## Table of Contents
1. [High Level Architecture](#high-level-architecture)
2. [Backend](#backend)
3. [Frontend](#frontend)
4. [State Management](#state-management)
5. [Middleware](#middleware)
6. [Database Schema](#database-schema)
7. [Auth Flow](#auth-flow)
8. [Deployment](#deployment)

---

## High Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                    │
│                                                     │
│   S3 + CloudFront                                   │
│   ┌──────────┐ ┌───────────┐ ┌──────────────────┐  │
│   │ Shell App│ │ Tenant App│ │   Owner App      │  │
│   │ (routing)│ │ (browse,  │ │ (post property,  │  │
│   │          │ │ wishlist, │ │  dashboard)      │  │
│   │          │ │ visits)   │ │                  │  │
│   └──────────┘ └───────────┘ └──────────────────┘  │
│                ┌───────────┐                        │
│                │ Admin App │                        │
│                │ (approve, │                        │
│                │  manage)  │                        │
│                └───────────┘                        │
└─────────────────────────────────────────────────────┘
                        │
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────┐
│                   API GATEWAY                        │
│   Single URL — Cognito JWT Authorizer                │
│  /auth/*   /properties/*   /visits/*   /wishlists/* │
│  /admin/*                                           │
└─────────────────────────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
┌─────────────────────────────────────────────────────┐
│                  LAMBDA SERVICES                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Auth    │  │ Property │  │     Visit        │  │
│  │ Service  │  │ Service  │  │    Service       │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│  ┌──────────┐  ┌──────────┐                        │
│  │ Wishlist │  │  Admin   │                        │
│  │ Service  │  │ Service  │                        │
│  └──────────┘  └──────────┘                        │
└─────────────────────────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
┌─────────────────────────────────────────────────────┐
│                   DATA LAYER                         │
│   RDS PostgreSQL          S3 (images bucket)        │
│   (all services           (property photos)         │
│    share one DB)                                    │
└─────────────────────────────────────────────────────┘
│              SUPPORTING SERVICES                     │
│   Cognito (Auth)    CloudWatch (Logs & Alerts)      │
│   GitHub Actions (CI/CD)                            │
└─────────────────────────────────────────────────────┘
```

---

## Backend

### Tech Stack
| Tool | Purpose |
|---|---|
| Node.js 18 | Lambda runtime |
| Serverless Framework v3 | Deploy Lambda + API Gateway |
| AWS Lambda | Serverless compute |
| AWS API Gateway (HTTP API) | Single entry point for all services |
| AWS Cognito | Authentication — passwords, tokens, sessions |
| AWS RDS PostgreSQL | Relational database |
| AWS S3 | Property image storage |

### Services

#### Auth Service
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| /auth/register | POST | None | Create user in Cognito + RDS |
| /auth/login | POST | None | Returns accessToken, idToken, refreshToken |
| /auth/verify | POST | None | Confirm email with 6-digit code |
| /auth/resend-code | POST | None | Resend verification code |

#### Property Service
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| /properties | POST | JWT (owner) | Create property listing |
| /properties | GET | None | Browse + filter properties |
| /properties/:id | GET | None | Single property detail |
| /properties/:id/images | POST | JWT (owner) | Upload image via S3 presigned URL |

#### Wishlist Service
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| /wishlists | POST | JWT (tenant) | Save property to wishlist |
| /wishlists | GET | JWT (tenant) | Get my wishlist |
| /wishlists/:propertyId | DELETE | JWT (tenant) | Remove from wishlist |

#### Visit Service
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| /visits | POST | JWT (tenant) | Request a property visit |
| /visits | GET | JWT | Tenant sees own visits, owner sees incoming |
| /visits/:id | PATCH | JWT (owner) | Approve or reject visit |

#### Admin Service
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| /admin/properties | GET | JWT (admin) | List pending/approved/rejected properties |
| /admin/properties/:id | PATCH | JWT (admin) | Approve or reject listing |
| /admin/users | GET | JWT (admin) | List all users |
| /admin/users/:id | PATCH | JWT (admin) | Activate or deactivate user |

### API Gateway
- Single shared HTTP API
- Base URL: `https://sh4jxvfw36.execute-api.ap-southeast-2.amazonaws.com`
- Cognito JWT Authorizer on all protected routes
- CORS enabled

### Folder Structure
```
backend/
└── services/
    ├── api-gateway/
    │   ├── serverless.yml
    │   ├── package.json
    │   └── src/healthCheck.js
    ├── auth-service/
    │   ├── serverless.yml
    │   ├── package.json
    │   └── src/ register.js, login.js, verify.js, resendCode.js, db.js
    ├── property-service/
    │   ├── serverless.yml
    │   ├── package.json
    │   └── src/ createProperty.js, listProperties.js, getProperty.js, uploadImage.js, auth.js, db.js
    ├── wishlist-service/
    │   ├── serverless.yml
    │   ├── package.json
    │   └── src/ addWishlist.js, getWishlist.js, removeWishlist.js, auth.js, db.js
    ├── visit-service/
    │   ├── serverless.yml
    │   ├── package.json
    │   └── src/ requestVisit.js, getVisits.js, updateVisit.js, auth.js, db.js
    └── admin-service/
        ├── serverless.yml
        ├── package.json
        └── src/ listPendingProperties.js, updatePropertyStatus.js, listUsers.js, updateUser.js, auth.js, db.js
```

---

## Frontend

### Tech Stack
| Tool | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool |
| @originjs/vite-plugin-federation | Module Federation — runtime remote loading |
| React Router v6 | Routing |
| Zustand | Auth state (shared from shell to remotes) |
| React Query | Server state / API data fetching |
| Axios | HTTP client with interceptors |

### App Roles
| App | Role | Route Prefix |
|---|---|---|
| Shell | HOST — loads all remotes, handles auth | / |
| Tenant App | REMOTE | /browse, /property/:id, /wishlist, /visits |
| Owner App | REMOTE | /owner/dashboard, /owner/post, /owner/listings |
| Admin App | REMOTE | /admin/dashboard, /admin/listings, /admin/users |

### Module Federation
```
shell         → HOST    (consumes TenantApp, OwnerApp, AdminApp)
tenant-app    → REMOTE  (exposes ./TenantApp)
owner-app     → REMOTE  (exposes ./OwnerApp)
admin-app     → REMOTE  (exposes ./AdminApp)
```

Zustand store is defined in shell and exposed via Module Federation so all remotes share the same auth state instance.

### Shell App Structure
```
shell/src/
├── store/
│   └── authStore.js        ← Zustand (token, user, role, login, logout)
├── components/
│   ├── Navbar.jsx           ← role-aware navigation
│   ├── ProtectedRoute.jsx   ← redirect to /login if no token
│   └── RoleRoute.jsx        ← redirect if wrong role
├── pages/
│   ├── Login.jsx
│   ├── Register.jsx
│   └── Verify.jsx
├── remotes/
│   ├── TenantApp.jsx        ← lazy loads remote
│   ├── OwnerApp.jsx
│   └── AdminApp.jsx
└── App.jsx                  ← routing + role-based redirects
```

### Tenant App Structure
```
tenant-app/src/
├── pages/
│   ├── Browse.jsx           ← property grid + filters
│   ├── PropertyDetail.jsx   ← single property + book visit
│   ├── Wishlist.jsx
│   └── MyVisits.jsx
├── components/
│   ├── PropertyCard.jsx
│   ├── FilterBar.jsx        ← city, price, type, furnished
│   └── VisitModal.jsx       ← date/time picker
└── TenantApp.jsx            ← exposed entry point
```

### Owner App Structure
```
owner-app/src/
├── pages/
│   ├── Dashboard.jsx        ← listing stats
│   ├── PostProperty.jsx     ← create listing + image upload
│   └── MyListings.jsx       ← manage own properties
├── components/
│   ├── PropertyForm.jsx
│   └── ImageUploader.jsx    ← S3 presigned URL upload
└── OwnerApp.jsx
```

### Admin App Structure
```
admin-app/src/
├── pages/
│   ├── Dashboard.jsx        ← pending counts overview
│   ├── Listings.jsx         ← approve/reject properties
│   └── Users.jsx            ← activate/deactivate users
├── components/
│   ├── PropertyReviewCard.jsx
│   └── UserTable.jsx
└── AdminApp.jsx
```

---

## State Management

| State | Solution | Why |
|---|---|---|
| Auth (token, user, role) | Zustand in shell | Shared across all remotes, accessible outside React (Axios interceptor) |
| API data (properties, visits) | React Query | Caching, loading states, refetching |
| Local UI (forms, filters) | useState | No need to share |

---

## Middleware

### Axios Interceptors (in each app's api/axios.js)
```
Request  → auto-attach Authorization: Bearer <token> from Zustand
Response → 401 detected → logout() + redirect to /login
```

### Route Guards (in shell)
```
ProtectedRoute → no token → redirect to /login
RoleRoute      → wrong role → redirect to /unauthorized
```

---

## Database Schema

```sql
users          → id, email, full_name, phone, role, is_active
properties     → id, owner_id, title, city, locality, price, type, furnished, status
property_images → id, property_id, s3_url, is_primary
wishlists      → id, tenant_id, property_id
visits         → id, tenant_id, property_id, owner_id, requested_date, status
messages       → id, sender_id, receiver_id, property_id, content
```

---

## Auth Flow

```
1. Register  → Cognito creates user → RDS saves profile
2. Verify    → Cognito confirms email with 6-digit code
3. Login     → Cognito returns accessToken (JWT, 1hr expiry)
4. API Call  → Axios sends Bearer token → API Gateway verifies with Cognito
5. Expired   → 401 → Axios interceptor → logout → redirect to login
6. Refresh   → use refreshToken to get new accessToken (to be implemented)
```

---

## Deployment

### Backend
Each service deployed independently via `serverless deploy`

### Frontend
| App | S3 Bucket | CloudFront |
|---|---|---|
| Shell | shell.dropbroker.com.s3 | proplist.com |
| Tenant App | tenant.dropbroker.com.s3 | tenant.proplist.com |
| Owner App | owner.dropbroker.com.s3 | owner.proplist.com |
| Admin App | admin.dropbroker.com.s3 | admin.proplist.com |

### CI/CD (GitHub Actions)
- Push to `main` on backend repo → deploy changed service to Lambda
- Push to `main` on frontend repo → build + deploy to S3 + invalidate CloudFront cache

---

## Phases

| Phase | Status |
|---|---|
| RDS + Cognito setup | ✅ Done |
| Auth Service | ✅ Done |
| Property Service | ✅ Done |
| Wishlist Service | ✅ Done |
| Visit Service | ✅ Done |
| Admin Service | ✅ Done |
| API Gateway (unified) | ✅ Done |
| Micro-frontends Setup | ⏳ Next |
| Tenant App | ⏳ |
| Owner App | ⏳ |
| Admin App | ⏳ |
| CI/CD GitHub Actions | ⏳ |
| CloudWatch Monitoring | ⏳ |
