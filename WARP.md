# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Multi-WA-Mate (WAPANELS) is a WhatsApp multi-device management platform built with React, TypeScript, Vite, and Supabase. The application provides features for managing multiple WhatsApp devices, broadcast messaging, chatbot automation, CRM chat, and more.

## Common Development Commands

### Installation & Setup
```bash
# Install dependencies
npm install

# Start development server on port 8080
npm run dev

# Build for production
npm run build

# Build for development (includes source maps)
npm run build:dev

# Preview production build
npm run preview

# Run ESLint
npm run lint
```

### Environment Configuration
The project uses Vite environment variables. Create a `.env` file based on the following structure:
```
VITE_SUPABASE_PROJECT_ID="ierdfxgeectqoekugyvb"
VITE_SUPABASE_PUBLISHABLE_KEY="your_supabase_anon_key"
VITE_SUPABASE_URL="https://ierdfxgeectqoekugyvb.supabase.co"
```

## Architecture Overview

### Tech Stack
- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite with SWC
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime subscriptions
- **PWA**: Vite PWA plugin with service workers
- **WhatsApp Integration**: Baileys library (deployed separately on Railway)

### Project Structure

```
/src
├── /components       # Reusable UI components
│   ├── /ui          # shadcn/ui base components
│   └── ...          # Feature-specific components
├── /pages           # Route components
│   └── /admin       # Admin-specific pages
├── /hooks           # Custom React hooks
├── /lib             # Utility functions
└── /integrations    # External service integrations
    └── /supabase    # Supabase client and types

/supabase
└── /migrations      # Database migration files

/railway-service     # WhatsApp Baileys service (deployed separately)
```

### Database Architecture

The application uses Supabase with the following main tables:
- **profiles**: User profile information
- **devices**: WhatsApp device sessions with QR codes and connection status
- **contacts**: Contact management with group support
- **message_templates**: Reusable message templates
- **broadcasts**: Broadcast campaign management
- **chatbot_rules**: Automated response rules
- **message_history**: Message logging
- **webhooks**: Webhook configuration for events
- **api_keys**: API key management
- **subscription_plans**: Subscription tiers
- **user_subscriptions**: User subscription status
- **payments**: Payment records

All tables implement Row Level Security (RLS) policies for data isolation between users.

### Authentication & Authorization

The app has two user roles:
- **user**: Regular users with access to WhatsApp management features
- **admin**: Admin users with access to admin dashboard and user management

Protected routes are wrapped with the `ProtectedRoute` component which checks authentication and role requirements.

### WhatsApp Integration

WhatsApp connectivity is handled through a separate Node.js service using the Baileys library. This service:
1. Runs on Railway as a separate deployment
2. Listens to the Supabase `devices` table for status changes
3. Generates QR codes for device connection
4. Maintains WhatsApp sessions
5. Updates connection status in real-time

The frontend communicates with WhatsApp through Supabase database updates rather than direct API calls to the Baileys service.

### Payment Integration

The app integrates with Pakasir payment gateway:
- **Slug**: berbagiakun
- **API Key**: Stored in user rules
- Payment flow uses redirect URLs with order tracking

### Key Features

1. **Multi-Device Management**: Connect and manage multiple WhatsApp accounts
2. **Broadcast Messaging**: Send bulk messages with scheduling
3. **Contact Management**: Import/export contacts, tagging, grouping
4. **Chatbot Automation**: Rule-based auto-responses
5. **Template Management**: Save and reuse message templates
6. **CRM Chat**: Customer relationship management interface
7. **Auto-Post**: Scheduled content posting
8. **API Access**: RESTful API with key authentication
9. **Webhooks**: Event-based integrations
10. **PWA Support**: Installable progressive web app

### State Management Patterns

- **Authentication State**: Managed through `useAuth` hook using Supabase Auth
- **Subscription State**: Managed through `useSubscription` hook
- **Server State**: React Query for data fetching and caching
- **UI State**: Local component state and React hooks

### Routing Structure

Routes are organized by user role:
- `/` - Public landing page
- `/auth` - Authentication page
- `/dashboard`, `/devices`, etc. - User routes (protected)
- `/admin/*` - Admin routes (protected, admin role required)

### Development Considerations

1. **Real-time Updates**: Uses Supabase real-time subscriptions for live data updates
2. **PWA Configuration**: Service worker configuration in `vite.config.ts`
3. **Type Safety**: TypeScript with generated Supabase types
4. **Component Library**: Uses shadcn/ui components with Radix UI primitives
5. **Dark Mode**: Theme switching with next-themes
6. **Mobile Responsive**: Mobile-first design with responsive layouts
7. **Error Handling**: Toast notifications for user feedback
8. **Form Validation**: react-hook-form with Zod schemas

### Deployment

The frontend is deployed through Lovable.dev, while the WhatsApp Baileys service requires separate deployment on Railway with the following environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### API Integration

The application provides RESTful APIs for external integrations:
- API key management in `/api-keys`
- Documentation in `/api-docs`
- Webhook configuration in `/webhooks`

### Testing

Currently, no test files are configured in the project. Consider adding:
- Unit tests with Vitest
- Component testing with React Testing Library
- E2E tests with Playwright