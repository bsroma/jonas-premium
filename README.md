# JONAS PREMIUM — Executive Transportation Platform

JONAS PREMIUM is a web-based executive transportation booking platform built to manage customer requests, reservations, pricing configuration, and administrative operations.

The project combines a public-facing website with a private administration panel, using Supabase for authentication, database management, and access control.

## 🚀 Project Overview

The application consists of two main components:

- **Public Website:** Customer-facing interface for requesting transportation services.
- **Admin Dashboard:** Private management interface for authorized administrators.

## ✨ Key Features

### Public Website
- Transportation booking request form.
- Customer service requests.
- WhatsApp communication with pre-filled messages.
- Responsive web interface.

### Administration Dashboard
- Secure administrator authentication.
- Reservation and request management.
- Booking status updates.
- Fixed-route pricing management.
- Additional service fees management.
- Manual quotation creation and management.
- Quotation history and status tracking.
- Prepared WhatsApp and email communications.

### Database & Security
- Supabase integration.
- PostgreSQL database.
- Row Level Security (RLS).
- Role-based administrative access using an `admin_users` table.
- Separation between public functionality and administrative operations.

## 🛠️ Technologies Used

- HTML5
- CSS3
- JavaScript
- Supabase
- PostgreSQL
- GitHub Pages

## 🏗️ Architecture

The application uses a static frontend hosted on GitHub Pages, with Supabase providing backend services.

The public website and administration dashboard are maintained as separate interfaces within the same project.

## 🔐 Security Considerations

- Administrative access requires authentication and authorization.
- Database permissions are enforced through Supabase RLS policies.
- Public browser configuration uses only the Supabase publishable/anonymous key.
- Service role keys and secret credentials must never be exposed in frontend code.

## ⚠️ Current Development Status

The pricing engine is currently disabled.

Although administrators can configure fixed routes, prices, and additional fees, these settings are not yet connected to automatic public fare calculations.

The platform currently supports manual quotations.

WhatsApp and email messages are prepared for administrator review. Messages are not sent automatically.

Additional work is planned for:
- Automated pricing integration.
- Route and distance calculations.
- Spam protection.
- Legal and privacy documentation.
- Full end-to-end testing.

## 📦 Deployment

The public website is deployed through GitHub Pages, while Supabase provides authentication and database services.

## 🎯 Project Goals

JONAS PREMIUM was developed to provide a practical digital solution for executive transportation businesses, combining customer booking requests with administrative management tools.

This project demonstrates practical experience building web applications, integrating backend services, managing database permissions, and developing business-oriented software.
