# Overview

Van Gogh Fidelidad is a customer loyalty management system built as a full-stack web application. The application allows businesses to manage member registrations, track loyalty points, and view analytics dashboards. It features a React frontend with a modern UI built using shadcn/ui components and Tailwind CSS, with Firebase as the backend database for storing member data.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing with pages for dashboard, members list, and member registration
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system including color variables and theming support
- **Form Handling**: React Hook Form with Zod schema validation for type-safe form management

## Backend Architecture
- **Server**: Express.js with TypeScript running on Node.js
- **Database Integration**: Prepared for PostgreSQL with Drizzle ORM (configuration present but currently using Firebase)
- **Development Setup**: Hot reload support with Vite middleware integration
- **API Structure**: RESTful API design with /api prefix for all endpoints

## Data Storage
- **Primary Database**: Firebase Firestore for member data storage
- **Schema Design**: Centralized schema definitions in shared directory using Zod for validation
- **Member Model**: Includes id, nombre, apellido, email, puntos, and fechaRegistro fields
- **Data Operations**: CRUD operations for member management with points tracking capabilities

## Component Architecture
- **Layout**: Fixed sidebar navigation with responsive design
- **Modular Components**: Reusable UI components for member tables, stats cards, and modals
- **Form Components**: Dedicated modals for adding members and editing points
- **State Management**: Custom hooks for member operations and statistics

## Development Workflow
- **Build Process**: Vite for frontend bundling, esbuild for server compilation
- **Database Migrations**: Drizzle kit configured for schema management
- **Environment**: Development and production configurations with Replit integration

The architecture emphasizes type safety throughout the stack with shared TypeScript interfaces, form validation with Zod schemas, and comprehensive error handling. The modular component structure allows for easy maintenance and feature expansion while maintaining a consistent user experience.

# External Dependencies

## Database Services
- **Firebase**: Primary database using Firestore for member data storage with real-time capabilities
- **Neon Database**: PostgreSQL database service configured for potential migration (currently unused)

## UI and Styling
- **Radix UI**: Comprehensive set of unstyled, accessible UI primitives for complex components
- **Tailwind CSS**: Utility-first CSS framework for styling with custom design system
- **Lucide React**: Icon library providing consistent iconography throughout the application

## Development Tools
- **Vite**: Frontend build tool and development server with hot reload capabilities
- **Replit Integration**: Development environment plugins for enhanced debugging and cartography

## Form and Validation
- **React Hook Form**: Form state management and validation library
- **Zod**: TypeScript-first schema declaration and validation library

## State Management
- **TanStack React Query**: Server state management, caching, and synchronization

## Utilities
- **date-fns**: Date manipulation and formatting library
- **nanoid**: Unique ID generation for various application needs
- **class-variance-authority**: Utility for creating variant-based component APIs