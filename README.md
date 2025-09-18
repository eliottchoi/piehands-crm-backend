# Piehands CRM - Backend API

A powerful communication engine backend built with NestJS, PostgreSQL, and SendGrid integration.

## 🚀 Core Mission

This backend serves three key objectives:

1. **Mission-Critical Reliability**: Send 10,000+ cold emails successfully without failure
2. **Effortless Automation**: Automate welcome emails and event-driven campaigns  
3. **Intelligent Personalization**: Use LLM to personalize messages dynamically

## 🛠️ Technology Stack

- **Framework**: NestJS (Node.js/TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Email Service**: SendGrid
- **Authentication**: Firebase (future)
- **API Documentation**: Built-in NestJS/Swagger support

## 📋 Current Features

### ✅ Phase 1: Manual Sending & Basic Analytics
- **Users Management**: Bulk user import via CSV/JSONL
- **Templates Management**: Email template CRUD with LiquidJS
- **Campaigns Management**: Manual campaign creation and sending
- **Events API**: User event tracking and analytics
- **SendGrid Integration**: Email sending with webhook support
- **Analytics**: Basic email metrics and user activity tracking

### 🔄 Phase 2: First Automation (In Progress)
- **Events Pipeline**: Async event processing
- **Canvas v1**: Basic workflow with triggers and actions

### 🎯 Phase 3: Intelligent Workflows (Planned)
- **Canvas v2**: Advanced flow control with conditions
- **User Segmentation**: Dynamic user grouping
- **LLM Integration**: AI-powered message personalization

## 🚦 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- SendGrid API Key

### Installation
```bash
npm install
```

### Database Setup
```bash
# Generate Prisma client
npm run install:prisma-manual

# Run migrations (if any)
npx prisma migrate dev

# Seed workspace data
npm run seed:workspace
```

### Environment Setup
Create `.env` file:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/piehands_crm"
SENDGRID_API_KEY="your_sendgrid_api_key"
SENDGRID_FROM_EMAIL="your_verified_sender@domain.com"
```

### Running the Application
```bash
# Development
npm run dev

# Production build
npm run build
npm run start:prod
```

## 📚 API Documentation

### Core Endpoints

#### Users API
- `GET /users` - List users with pagination
- `POST /users` - Create/upsert single user
- `POST /users/bulk` - Bulk import users from CSV
- `GET /users/:id` - Get user details with event history
- `PATCH /users/:id` - Update user properties

#### Events API
- `POST /events/track` - Track user events
- Response: `202 Accepted` (async processing)

#### Templates API  
- `GET /templates` - List email templates
- `POST /templates` - Create new template
- `GET /templates/:id` - Get template details
- `PATCH /templates/:id` - Update template
- `DELETE /templates/:id` - Delete template

#### Campaigns API
- `GET /campaigns` - List campaigns
- `POST /campaigns` - Create campaign
- `GET /campaigns/:id` - Get campaign details
- `PATCH /campaigns/:id` - Update campaign
- `POST /campaigns/send` - Send manual campaign

#### Analytics API
- `GET /analytics/email-overview` - Email activity dashboard
- `GET /analytics/campaigns/:id` - Campaign analytics
- `GET /analytics/users/:id/email-history` - User email history

### Sample Requests

#### Track User Event
```bash
curl -X POST "http://localhost:3000/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "ws_piehands",
    "event": {
      "userId": "user_001",
      "name": "Product Viewed",
      "timestamp": "2025-09-18T11:00:00Z",
      "properties": {
        "product_id": "prod-chocolate",
        "product_name": "다크 초콜릿",
        "price": 15000,
        "category": "dessert"
      }
    }
  }'
```

#### Send Campaign
```bash
curl -X POST "http://localhost:3000/campaigns/send?workspaceId=ws_piehands" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "tmpl_welcome",
    "targetGroup": "ALL_USERS"
  }'
```

## 🗄️ Database Schema

### Key Tables
- **workspaces**: Multi-tenant workspace management
- **users**: End-user profiles with JSON properties
- **events**: User activity tracking
- **templates**: Email template storage
- **campaigns**: Campaign metadata
- **email_logs**: Email sending history

### Data Models
- PostgreSQL for structured data (users, campaigns, logs)
- JSON fields for flexible properties
- UUID primary keys for security
- Timestamps for audit trails

## 🔧 Development Guidelines

### Code Standards
- **No `any` types**: All variables must be explicitly typed
- **Linter-first**: Fix all ESLint errors before commits
- **Validation**: Use DTOs with class-validator for all endpoints
- **Error Handling**: Proper HTTP status codes and error messages

### Testing Strategy
- Unit tests for services and utilities
- Integration tests for database operations  
- E2E tests for complete API workflows
- Test data management with Prisma

## 📈 Monitoring & Observability

- Health check endpoint: `GET /health`
- Structured logging with request tracing
- Error tracking and monitoring
- Performance metrics collection

## 🚀 Deployment

The backend is designed for containerized deployment:

```dockerfile
# Multi-stage build with Node.js
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

## 🤝 Contributing

1. Follow the established patterns in existing modules
2. Add proper validation and error handling
3. Include tests for new features
4. Update API documentation
5. Maintain TypeScript strict mode compliance

---

**Built with ❤️ for mission-critical email communication**