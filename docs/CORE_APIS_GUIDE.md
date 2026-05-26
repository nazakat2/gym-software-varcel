# 💼 Core APIs - Complete Implementation Guide

## 🎉 What's Been Built

Complete business logic APIs for gym management:
- ✅ **Invoices API** (6 endpoints + stats)
- ✅ **Attendance API** (7 endpoints + reports)
- ✅ **Employees API** (7 endpoints + earnings)

---

## 💰 Invoices API

### **Endpoints**

#### 1. **Create Invoice**
```http
POST /api/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "memberId": 123,
  "amount": "3000",
  "plan": "monthly",
  "dueDate": "2024-06-01",
  "paymentMethod": "cash",
  "trainerId": 5,
  "notes": "Regular monthly fee"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "invoiceNumber": "INV-2024-001",
    "memberId": 123,
    "amount": "3000",
    "plan": "monthly",
    "status": "unpaid",
    "trainerCommission": "300",
    "gymRevenue": "2700"
  },
  "message": "Invoice created successfully"
}
```

**Features:**
- ✅ Auto-generates invoice number (INV-2024-001)
- ✅ Calculates trainer commission automatically
- ✅ Verifies member exists
- ✅ Audit logging

---

#### 2. **List Invoices**
```http
GET /api/invoices?page=1&limit=20&status=unpaid&memberId=123
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `status` - Filter by status (unpaid, paid, overdue, cancelled)
- `memberId` - Filter by member
- `startDate` - Filter by date range (YYYY-MM-DD)
- `endDate` - Filter by date range (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "invoice": { /* invoice details */ },
        "member": {
          "id": 123,
          "name": "Ahmed Ali",
          "memberCode": "MEM-001",
          "phone": "03001234567"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

#### 3. **Get Invoice Details**
```http
GET /api/invoices/1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": { /* full invoice details */ },
    "member": { /* member details */ },
    "trainer": { /* trainer details if assigned */ }
  }
}
```

---

#### 4. **Update Invoice**
```http
PATCH /api/invoices/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": "3500",
  "notes": "Updated amount"
}
```

**Note:** Cannot update paid invoices

---

#### 5. **Mark Invoice as Paid**
```http
POST /api/invoices/1/pay
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentMethod": "cash",
  "paidDate": "2024-05-18",
  "notes": "Paid in full"
}
```

**Features:**
- ✅ Marks invoice as paid
- ✅ Records trainer commission in earnings table
- ✅ Sends audit log
- ✅ Cannot pay already paid invoices

---

#### 6. **Delete Invoice**
```http
DELETE /api/invoices/1
Authorization: Bearer <token>
```

**Note:** Cannot delete paid invoices

---

#### 7. **Invoice Statistics**
```http
GET /api/invoices/stats/overview
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 150000,
    "monthlyRevenue": 45000,
    "unpaidCount": 12,
    "overdueCount": 3
  }
}
```

---

## 📋 Attendance API

### **Endpoints**

#### 1. **Check In Member**
```http
POST /api/attendance/checkin
Authorization: Bearer <token>
Content-Type: application/json

{
  "memberId": 123,
  "checkInMethod": "barcode",
  "notes": "Regular check-in"
}
```

**Check-in Methods:**
- `manual` - Manual entry
- `barcode` - Barcode scan
- `qr` - QR code scan
- `biometric` - Fingerprint/face recognition

**Validations:**
- ✅ Member must exist and be active
- ✅ Membership must not be expired
- ✅ Membership must not be frozen
- ✅ Member must not be blacklisted
- ✅ Cannot check in twice on same day

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "memberId": 123,
    "date": "2024-05-18",
    "checkInTime": "10:30:00",
    "checkInMethod": "barcode",
    "member": {
      "id": 123,
      "name": "Ahmed Ali",
      "memberCode": "MEM-001"
    }
  },
  "message": "Member checked in successfully"
}
```

---

#### 2. **Check Out Member**
```http
POST /api/attendance/checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "attendanceId": 1,
  "notes": "Regular checkout"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "checkInTime": "10:30:00",
    "checkOutTime": "12:00:00"
  },
  "message": "Member checked out successfully"
}
```

---

#### 3. **List Attendance**
```http
GET /api/attendance?page=1&limit=20&date=2024-05-18&memberId=123
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page
- `memberId` - Filter by member
- `date` - Filter by specific date (YYYY-MM-DD)
- `startDate` - Date range start
- `endDate` - Date range end

---

#### 4. **Today's Attendance**
```http
GET /api/attendance/today
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2024-05-18",
    "count": 15,
    "members": [
      {
        "attendance": { /* attendance record */ },
        "member": { /* member details */ }
      }
    ]
  }
}
```

**Shows:** Currently checked-in members (not checked out yet)

---

#### 5. **Attendance Report**
```http
GET /api/attendance/report?startDate=2024-05-01&endDate=2024-05-31&memberId=123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2024-05-01",
      "endDate": "2024-05-31",
      "totalDays": 31
    },
    "summary": {
      "totalCheckIns": 450,
      "uniqueMembers": 85,
      "averagePerDay": "14.5"
    },
    "byDate": {
      "2024-05-01": 12,
      "2024-05-02": 15,
      // ...
    },
    "memberStats": {
      "totalCheckIns": 20,
      "dates": ["2024-05-01", "2024-05-03", ...],
      "averagePerWeek": "4.5"
    }
  }
}
```

---

#### 6. **Attendance Statistics**
```http
GET /api/attendance/stats/overview
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "today": 15,
    "thisMonth": 450,
    "currentlyCheckedIn": 8
  }
}
```

---

#### 7. **Delete Attendance Record**
```http
DELETE /api/attendance/1
Authorization: Bearer <token>
```

---

## 👥 Employees API

### **Endpoints**

#### 1. **Create Employee**
```http
POST /api/employees
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Hassan Trainer",
  "role": "trainer",
  "phone": "03001234567",
  "cnic": "42101-1234567-1",
  "email": "hassan@gym.com",
  "address": "123 Street, Karachi",
  "joinDate": "2024-01-01",
  "salary": "50000",
  "commissionPercentage": "10"
}
```

**Roles:**
- `trainer` - Gym trainer
- `receptionist` - Front desk
- `cleaner` - Cleaning staff
- `maintenance` - Maintenance staff
- `staff` - General staff

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Hassan Trainer",
    "role": "trainer",
    "phone": "03001234567",
    "salary": "50000",
    "commissionPercentage": "10",
    "status": "active"
  },
  "message": "Employee created successfully"
}
```

---

#### 2. **List Employees**
```http
GET /api/employees?page=1&limit=20&role=trainer&status=active
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page
- `query` - Search by name
- `role` - Filter by role
- `status` - Filter by status (active, on_leave, terminated)

---

#### 3. **Get Employee Details**
```http
GET /api/employees/1
Authorization: Bearer <token>
```

**Response (for trainers):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Hassan Trainer",
    "role": "trainer",
    "stats": {
      "assignedMembers": 15,
      "monthlyEarnings": 15000
    }
  }
}
```

---

#### 4. **Update Employee**
```http
PATCH /api/employees/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "salary": "55000",
  "commissionPercentage": "12"
}
```

---

#### 5. **Delete Employee**
```http
DELETE /api/employees/1
Authorization: Bearer <token>
```

**Note:** Cannot delete trainers with assigned members

---

#### 6. **Get Trainers List**
```http
GET /api/employees/trainers/list
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Hassan Trainer",
      "phone": "03001234567",
      "assignedMembers": 15,
      "commissionPercentage": "10"
    }
  ]
}
```

**Use Case:** For dropdowns when assigning trainers to members

---

#### 7. **Get Trainer Earnings**
```http
GET /api/employees/1/earnings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trainer": {
      "id": 1,
      "name": "Hassan Trainer",
      "commissionPercentage": "10"
    },
    "totalEarnings": 50000,
    "earnings": [
      {
        "earning": { /* earning record */ },
        "invoice": { /* related invoice */ },
        "member": { /* member who paid */ }
      }
    ]
  }
}
```

---

#### 8. **Employee Statistics**
```http
GET /api/employees/stats/overview
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 25,
    "trainers": 8,
    "active": 23,
    "onLeave": 2
  }
}
```

---

## 🔐 Permissions Required

All endpoints require authentication and specific permissions:

| Endpoint | Permission |
|----------|-----------|
| Invoices | `billing.read`, `billing.create`, `billing.update`, `billing.delete` |
| Attendance | `attendance.read`, `attendance.create`, `attendance.update`, `attendance.delete` |
| Employees | `members.read`, `members.create`, `members.update`, `members.delete` |

---

## 🎯 Business Logic Features

### **Invoices**
- ✅ Auto-generate invoice numbers
- ✅ Calculate trainer commissions automatically
- ✅ Track gym revenue separately
- ✅ Prevent updating/deleting paid invoices
- ✅ Record trainer earnings when paid
- ✅ Revenue statistics

### **Attendance**
- ✅ Validate membership status
- ✅ Check expiry dates
- ✅ Check frozen status
- ✅ Prevent duplicate check-ins
- ✅ Multiple check-in methods
- ✅ Attendance reports
- ✅ Real-time statistics

### **Employees**
- ✅ Role-based employee types
- ✅ Trainer commission tracking
- ✅ Assigned members count
- ✅ Earnings history
- ✅ Prevent deleting trainers with members
- ✅ Phone number uniqueness

---

## 📊 Complete API Summary

### **Total Endpoints: 27**

| API | Endpoints | Status |
|-----|-----------|--------|
| Authentication | 10 | ✅ Complete |
| Members | 8 | ✅ Complete |
| Invoices | 7 | ✅ Complete |
| Attendance | 7 | ✅ Complete |
| Employees | 8 | ✅ Complete |
| **Total** | **40** | **✅ Complete** |

---

## 🚀 Quick Start

### **1. Update Server**
```typescript
// api/index.ts
import invoicesRouter from "./routes/invoices";
import attendanceRouter from "./routes/attendance";
import employeesRouter from "./routes/employees";

app.use("/api/invoices", invoicesRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/employees", employeesRouter);
```

### **2. Test APIs**
```bash
# Create invoice
curl -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": 1,
    "amount": "3000",
    "plan": "monthly",
    "dueDate": "2024-06-01"
  }'

# Check in member
curl -X POST http://localhost:3000/api/attendance/checkin \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": 1,
    "checkInMethod": "manual"
  }'

# Create employee
curl -X POST http://localhost:3000/api/employees \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hassan Trainer",
    "role": "trainer",
    "phone": "03001234567",
    "joinDate": "2024-01-01",
    "salary": "50000"
  }'
```

---

## ✅ Implementation Checklist

### **Phase 1: Database** ✅ Complete
- [x] Multi-tenant schema
- [x] All tables with indexes
- [x] Soft delete support
- [x] Audit trail

### **Phase 2: Authentication** ✅ Complete
- [x] Login/Signup
- [x] Password reset
- [x] Token refresh
- [x] Profile management

### **Phase 3: Core APIs** ✅ Complete
- [x] Members API (8 endpoints)
- [x] Invoices API (7 endpoints)
- [x] Attendance API (7 endpoints)
- [x] Employees API (8 endpoints)

### **Phase 4: Next Steps** ⏳ Pending
- [ ] Integration tests
- [ ] Frontend integration
- [ ] Reports & Analytics
- [ ] File upload
- [ ] Notifications

---

**Status:** ✅ Core APIs Complete  
**Total Time:** ~1 week (as estimated)  
**Next:** Frontend Integration or Reports & Analytics  
**Last Updated:** 2024-05-18
