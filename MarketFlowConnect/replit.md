# Fortune First - Insurance & Wealth Management Platform

## Overview

Fortune First is a comprehensive lead generation and marketing platform designed for an insurance and wealth management business. The application focuses on capturing leads through multiple channels including interactive quizzes, dedicated landing pages for different services (insurance, retirement planning, and recruiting), and newsletter subscriptions. The platform uses a modern React frontend with a Node.js/Express backend and is designed to integrate with marketing tools like ActiveCampaign for lead nurturing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Routing**: Wouter for client-side routing (lightweight React router)
- **State Management**: TanStack React Query for server state management
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints for lead capture and newsletter management
- **Validation**: Zod schemas for runtime type validation
- **Storage**: In-memory storage implementation with interface for easy database integration
- **Development**: Hot reload with Vite middleware integration

### Data Storage Solutions
- **Current**: In-memory storage using Map data structures for development
- **Configured**: Drizzle ORM with PostgreSQL support (via Neon Database)
- **Schema**: Structured lead and newsletter subscriber tables with JSON fields for flexible data

### Authentication and Authorization
- **Current**: No authentication system implemented
- **Session Management**: Basic Express session handling configured

### File Upload and Asset Management
- **Cloud Storage**: Google Cloud Storage integration configured
- **Static Assets**: Vite handles static asset optimization and serving

## External Dependencies

### Database and ORM
- **Drizzle ORM**: Modern TypeScript ORM with PostgreSQL dialect
- **Neon Database**: Serverless PostgreSQL database provider
- **Connection**: Environment-based database URL configuration

### UI and Design System
- **Radix UI**: Comprehensive set of accessible, unstyled UI primitives
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **Lucide React**: Modern icon library
- **Fonts**: Google Fonts integration (Inter, DM Sans, Fira Code, Geist Mono)

### Development and Build Tools
- **Vite**: Fast build tool and development server
- **TypeScript**: Static type checking and modern JavaScript features
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Autoprefixer

### Cloud Services
- **Google Cloud Storage**: File storage and static asset management
- **Environment Variables**: Configured for database and cloud service credentials

### Marketing and Analytics
- **Planned Integrations**: ActiveCampaign for email marketing automation
- **Lead Tracking**: UTM parameter support and source attribution
- **Form Analytics**: Lead capture form performance tracking

### Replit-Specific Features
- **Development Plugins**: Cartographer and dev banner for Replit environment
- **Error Handling**: Runtime error overlay for development debugging