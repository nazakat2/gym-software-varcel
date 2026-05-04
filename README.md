# Core X — Gym Management Platform

A full-stack gym management platform consisting of two products:

1. **Core X Admin Panel** — Web-based management dashboard for gym owners/staff
2. **Gym Member App** — React Native mobile app for gym members

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
  - [Admin Panel](#admin-panel-features)
  - [Member Mobile App](#member-mobile-app-features)
  - [REST API](#rest-api)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [API Reference](#api-reference)

---

## Overview

**Core X** is a complete gym management solution. The admin panel gives gym owners full control over members, billing, inventory, staff, and analytics. The member mobile app lets gym members track their fitness, book classes, view workout plans, and manage their membership — all from their phone.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend (Admin) | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Frontend (Mobile) | React Native, Expo, TypeScript |
| Backend API | Node.js, Express, TypeScript |
| Database | PostgreSQL (via Drizzle ORM) |
| Auth (Admin) | JWT, bcrypt |
| Auth (Mobile) | JWT, OTP (email-based) |
| PDF Generation | jsPDF, jspdf-autotable |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
/
├── artifacts/
│   ├── gym-admin/          # React/Vite Admin Panel
│   ├── gym-member-app/     # Expo React Native Mobile App
│   └── api-server/         # Express REST API
├── lib/
│   ├── db/                 # Drizzle ORM schema & database client
│   ├── api-spec/           # OpenAPI spec (auto-generated)
│   ├── api-client-react/   # React Query hooks (auto-generated)
│   └── api-zod/            # Zod validation schemas (auto-generated)
└── pnpm-workspace.yaml
```

---

## Features

### Admin Panel Features

#### Dashboard
- Live KPI cards: total members, active members, today's attendance, monthly revenue, unpaid dues, expiring soon
- Revenue trend chart (6 months)
- Quick-access links to all sections

#### Member Management
- Full member list with search, filter by status/plan
- **Add New Member** — 5-section registration form:
  - Personal info with photo upload
  - Contact & emergency contact
  - Membership plan & trainer assignment
  - Health/medical conditions (12 conditions checklist)
  - Fitness notes
- **Member Profile** — 7-tab detail view:
  - **Profile** — edit all personal info
  - **Health** — medical conditions, fitness goals, editable
  - **Membership** — renew, freeze/unfreeze, full history log
  - **Measurements** — add chest/waist/arms/hips, BMI calculation with color coding
  - **Attendance** — per-member visit log
  - **Invoices** — invoice list with mark-as-paid action
  - **Notes** — admin/trainer notes

#### Billing
- Create invoices linked to members
- Mark invoices as paid (cash/card/online)
- View all invoices with filters
- Unpaid dues tracking

#### POS & Sales
- Point-of-sale interface for product/supplement sales
- Cart management, member lookup
- Sales history with PDF receipts
- Revenue tracking

#### Inventory
- Product/supplement stock management
- Low stock alerts
- Category management

#### Attendance
- Manual check-in/check-out
- Daily attendance log
- Attendance stats (today's count, peak hours)

#### Employees
- Staff profiles with roles and salary
- Employee list management

#### Accounts
- Income and expense vouchers
- Account balance tracking

#### Reports (Monthly-wise PDF Downloads)
- **Month selector** — pick any past month, all data filters accordingly
- **Overview PDF** — KPI summary + weekly financial breakdown + attendance for selected month
- **Members PDF** — full members list + separate page for members who joined that month
- **Revenue PDF** — weekly breakdown + all invoices filtered to the selected month
- **Attendance PDF** — daily attendance chart for the selected month
- **Expiring Members PDF** — members whose plan expires in the selected month

#### Notifications
- Broadcast announcements to members
- Notification history

#### Mobile Content Management
- Manage content shown in the member app:
  - Workout plans (exercises, sets, reps, difficulty)
  - Diet/nutrition plans (meals, calories, macros)
  - Announcements and banners

#### Business Settings
- Gym name, address, phone, email, website
- Currency and timezone settings
- Logo management

#### Admin Users
- Create/manage admin accounts
- Role-based access (super-admin, admin, trainer)

---

### Member Mobile App Features

#### Authentication
- Register with email + OTP verification
- Login with JWT session
- Forgot password via OTP reset

#### Home & Dashboard
- Welcome screen with membership status
- Quick stats (days left, next class)
- Latest announcements

#### Membership
- View active plan details
- Membership expiry date
- Plan history

#### Workout Plans
- Browse assigned workout plans
- Exercise details with sets, reps, instructions
- Filter by difficulty and muscle group

#### Diet Plans
- View assigned nutrition plans
- Daily meal breakdown
- Calorie and macro tracking

#### Class Booking
- Browse available classes
- Book/cancel classes
- Upcoming bookings view

#### Progress Tracking
- Log body measurements over time
- View progress charts (weight, BMI, body fat)
- Measurement history

#### Profile
- Edit personal info
- Change password
- Notification preferences

---

### REST API

Base URL: `/api`

#### Auth (Admin)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/auth/login` | Admin login |
| POST | `/api/admin/auth/register` | Register admin |
| POST | `/api/admin/auth/send-otp` | Send OTP |
| POST | `/api/admin/auth/verify-otp` | Verify OTP |

#### Auth (Member)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Member register |
| POST | `/api/auth/login` | Member login |
| POST | `/api/auth/send-otp` | Send OTP |
| POST | `/api/auth/verify-otp` | Verify OTP |
| POST | `/api/auth/reset-password` | Reset password |

#### Members
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/members` | List all members |
| POST | `/api/members` | Create member |
| GET | `/api/members/:id` | Get member profile |
| PUT | `/api/members/:id` | Update member |
| DELETE | `/api/members/:id` | Delete member |
| GET/PUT | `/api/members/:id/health` | Health info |
| GET/POST/DELETE | `/api/members/:id/notes` | Admin notes |
| GET | `/api/members/:id/membership-history` | Plan history |
| POST | `/api/members/:id/freeze` | Freeze membership |
| POST | `/api/members/:id/unfreeze` | Unfreeze membership |
| GET | `/api/members/:id/attendance` | Member attendance |
| GET | `/api/members/:id/invoices` | Member invoices |
| GET/POST | `/api/members/:id/measurements` | Body measurements |
| DELETE | `/api/members/:id/measurements/:mid` | Delete measurement |

#### Billing
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/billing` | List invoices |
| POST | `/api/billing` | Create invoice |
| POST | `/api/billing/:id/pay` | Mark as paid |

#### Attendance
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/attendance` | List all attendance |
| POST | `/api/attendance/checkin` | Check in |
| POST | `/api/attendance/checkout` | Check out |
| GET | `/api/attendance/today-stats` | Today's stats |

#### Sales / POS
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sales` | List sales |
| POST | `/api/sales` | Create sale |
| GET | `/api/pos/products` | POS product list |
| GET | `/api/pos/members` | Member search for POS |

#### Inventory
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List products |
| POST | `/api/products` | Add product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

#### Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reports/financial?month=YYYY-MM` | Financial report |
| GET | `/api/reports/attendance?month=YYYY-MM` | Attendance report |
| GET | `/api/reports/members` | Member statistics |

#### Other
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/stats` | Dashboard KPIs |
| GET | `/api/dashboard/revenue-chart` | 6-month revenue |
| GET/POST | `/api/employees` | Employee management |
| GET/POST | `/api/accounts` | Accounts/vouchers |
| GET/POST | `/api/notifications` | Notifications |
| GET/PUT | `/api/business` | Business settings |
| GET/POST | `/api/app-content/workout-plans` | Workout plans |
| GET/POST | `/api/app-content/diet-plans` | Diet plans |
| GET/POST | `/api/app-content/announcements` | Announcements |

---

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL database

### Installation

```bash
# Clone the repository
git clone https://github.com/nazakat2/Gym-Goer.git
cd Gym-Goer

# Install all dependencies
pnpm install
```

### Running the Apps

```bash
# Start the API server
pnpm --filter @workspace/api-server run dev

# Start the Admin Panel
pnpm --filter @workspace/gym-admin run dev

# Start the Mobile App
pnpm --filter @workspace/gym-member-app run dev
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | JWT signing secret |
| `EMAIL_PASS` | SMTP password for OTP emails |
| `PORT` | Server port (auto-assigned per service) |

---

## Database

The database schema uses **Drizzle ORM**. Tables include:

| Table | Description |
|---|---|
| `members` | Gym member profiles |
| `member_health` | Health conditions per member |
| `member_notes` | Admin/trainer notes per member |
| `membership_history` | Plan change history |
| `invoices` | Billing invoices |
| `attendance` | Check-in/check-out log |
| `measurements` | Body measurement records |
| `employees` | Staff profiles |
| `products` | Inventory items |
| `sales` | POS transactions |
| `vouchers` | Income/expense vouchers |
| `notifications` | Announcements |
| `workout_plans` | Mobile app workout content |
| `diet_plans` | Mobile app nutrition content |
| `business_settings` | Gym configuration |
| `admin_users` | Admin accounts |
| `users` | Member app accounts |
| `otps` | OTP verification codes |

To push schema changes to the database:

```bash
pnpm --filter @workspace/db run db:push
```

---

## License

Private — All rights reserved © Core X Gym
