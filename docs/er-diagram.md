# 📊 Evently Backend - Complete Entity Relationship Diagram

## 🗃️ Core Database Schema

```
                              ┌─────────────────────────────┐
                              │           USERS              │
                              │─────────────────────────────│
                              │  id (UUID) PK             │
                              │  email UNIQUE NOT NULL    │
                              │  name VARCHAR(255)        │
                              │  password_hash VARCHAR    │
                              │ role ENUM(user,admin)    │
                              │  is_active BOOLEAN        │
                              │ version INTEGER          │
                              │ created_at TIMESTAMP     │
                              │ updated_at TIMESTAMP     │
                              └─────────┬───────────────────┘
                                        │ 1:N
                         ┌──────────────┼──────────────┐
                         │              │              │
                         ▼              ▼              ▼
           ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
           │      BOOKINGS       │ │      WAITLISTS      │ │   NOTIFICATIONS     │
           │─────────────────────│ │─────────────────────│ │─────────────────────│
           │  id (UUID) PK     │ │  id (UUID) PK     │ │  id (UUID) PK     │
           │  user_id FK       │ │  user_id FK       │ │  user_id FK       │
           │  event_id FK      │ │  event_id FK      │ │  event_id FK      │
           │  quantity INT     │ │  position INT     │ │  type ENUM        │
           │  total_amount     │ │  priority_score   │ │  message TEXT     │
           │  status ENUM      │ │  joined_at        │ │  channels JSON    │
           │  booking_ref     │ │  expires_at       │ │  status ENUM      │
           │  version INT      │ │  status ENUM      │ │  sent_at          │
           │  created_at       │ │  notify_prefs     │ │  delivered_at     │
           │  updated_at       │ │  created_at       │ │  read BOOLEAN     │
           └─────────┬───────────┘ │  updated_at       │ └─────────────────────┘
                     │ N:1         └─────────┬───────────┘
                     │                       │ N:1
                     │                       │
                     └───────────────────────┼────────────────────────┐
                                             │                        │
                                             ▼                        ▼
                  ┌─────────────────────────────────────────────────────────────────┐
                  │                         EVENTS                                  │
                  │─────────────────────────────────────────────────────────────────│
                  │  id (UUID) PK                                                 │
                  │  name VARCHAR(255) NOT NULL                                   │
                  │  description TEXT                                             │
                  │  venue VARCHAR(255) NOT NULL                                  │
                  │  event_date TIMESTAMP NOT NULL                               │
                  │  total_capacity INTEGER > 0                                  │
                  │  available_seats INTEGER >= 0                                │
                  │  base_price DECIMAL(10,2) >= 0                               │
                  │  current_price DECIMAL(10,2) >= 0                            │
                  │  status ENUM(active,cancelled,completed)                      │
                  │  version INTEGER (optimistic locking)                        │
                  │  created_by FK → users(id)                                   │
                  │  created_at TIMESTAMP                                         │
                  │  updated_at TIMESTAMP                                         │
                  │                                                                 │
                  │  CONSTRAINT: available_seats <= total_capacity                │
                  └─────────────┬───────────────┬───────────────┬───────────────────┘
                                │ 1:N           │ 1:N           │ 1:N
                                ▼               ▼               ▼
                  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
                  │PRICING_HISTORY  │ │EVENT_ANALYTICS  │ │ BOOKING_ATTEMPTS    │
                  │─────────────────│ │─────────────────│ │─────────────────────│
                  │ id (UUID) PK  │ │ id (UUID) PK  │ │ id (UUID) PK      │
                  │ event_id FK   │ │ event_id FK   │ │ event_id FK       │
                  │ old_price     │ │ metric_type   │ │ user_id FK        │
                  │ new_price     │ │ metric_value  │ │ quantity INT      │
                  │ reason        │ │ recorded_at   │ │ result ENUM       │
                  │ applied_by    │ │ is_realtime   │ │ failure_reason    │
                  │ applied_at    │ └─────────────────┘ │ attempted_at      │
                  └─────────────────┘                     │ ip_address        │
                                                          │ user_agent        │
                                                          └─────────────────────┘

                           ┌─────────────────────────────────┐
                           │      WAITLIST_PROMOTIONS        │
                           │─────────────────────────────────│
                           │  id (UUID) PK                 │
                           │  waitlist_id FK               │
                           │  event_id FK                  │
                           │  user_id FK                   │
                           │  promoted_at TIMESTAMP        │
                           │  expires_at TIMESTAMP         │
                           │  window_minutes INTEGER       │
                           │  status ENUM(pending,used,exp)│
                           │  booking_id FK (nullable)     │
                           │  promotion_reason             │
                           │  created_at TIMESTAMP         │
                           └─────────────────────────────────┘

                           ┌─────────────────────────────────┐
                           │         EMAIL_TEMPLATES         │
                           │─────────────────────────────────│
                           │  id (UUID) PK                 │
                           │  template_type ENUM           │
                           │  │ (welcome, booking_confirm,  │
                           │  │  cancellation, waitlist_    │
                           │  │  join, waitlist_promotion,  │
                           │  │  notification)              │
                           │  subject_template TEXT        │
                           │  html_template TEXT           │
                           │  text_template TEXT           │
                           │  variables JSON               │
                           │  │ {userName, eventName,       │
                           │  │  eventDate, venue, etc.}    │
                           │  is_active BOOLEAN            │
                           │  version INTEGER              │
                           │  created_at TIMESTAMP         │
                           │  updated_at TIMESTAMP         │
                           └─────────────────────────────────┘

                           ┌─────────────────────────────────┐
                           │        EMAIL_DELIVERY_LOG       │
                           │─────────────────────────────────│
                           │  id (UUID) PK                 │
                           │  recipient_email VARCHAR       │
                           │  template_type ENUM           │
                           │  provider ENUM(sendgrid,smtp) │
                           │  status ENUM(sent,failed,     │
                           │         pending,bounced)      │
                           │  send_attempts INTEGER        │
                           │  last_attempt_at TIMESTAMP    │
                           │  delivered_at TIMESTAMP       │
                           │  error_message TEXT           │
                           │  metadata JSON                │
                           │  │ {messageId, reference,      │
                           │  │  eventId, userId}           │
                           │  created_at TIMESTAMP         │
                           └─────────────────────────────────┘
```

## 🔗 Advanced Relationship Matrix

| Entity | Relationship | Cardinality | Constraints | Business Rule |
|--------|--------------|-------------|-------------|---------------|
| **Users** ↔ **Bookings** | One-to-Many | 1:N | CASCADE DELETE | User can have multiple bookings |
| **Users** ↔ **Waitlists** | One-to-Many | 1:N | CASCADE DELETE | User can join multiple waitlists |
| **Users** ↔ **Notifications** | One-to-Many | 1:N | CASCADE DELETE | User receives multiple notifications |
| **Events** ↔ **Bookings** | One-to-Many | 1:N | RESTRICT DELETE | Event with bookings cannot be deleted |
| **Events** ↔ **Waitlists** | One-to-Many | 1:N | CASCADE DELETE | Event deletion removes waitlists |
| **Events** ↔ **Pricing History** | One-to-Many | 1:N | CASCADE DELETE | Track all price changes |
| **Waitlists** ↔ **Promotions** | One-to-One | 1:1 | CASCADE DELETE | Promotion created when user promoted |
| **Bookings** ↔ **Attempts** | One-to-Many | 1:N | CASCADE DELETE | Track all booking attempts |

## 🎯 Business Logic Constraints

### 🔒 Database Constraints
```sql
-- Users table constraints
ALTER TABLE users ADD CONSTRAINT chk_email_format 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Events table constraints  
ALTER TABLE events ADD CONSTRAINT chk_event_capacity 
  CHECK (available_seats <= total_capacity AND available_seats >= 0);
  
ALTER TABLE events ADD CONSTRAINT chk_event_date 
  CHECK (event_date > created_at);
  
ALTER TABLE events ADD CONSTRAINT chk_pricing 
  CHECK (current_price >= 0 AND base_price >= 0);

-- Bookings table constraints
ALTER TABLE bookings ADD CONSTRAINT chk_booking_quantity 
  CHECK (quantity > 0 AND quantity <= 10);
  
ALTER TABLE bookings ADD CONSTRAINT chk_booking_amount 
  CHECK (total_amount > 0);

-- Waitlist constraints
ALTER TABLE waitlists ADD CONSTRAINT unq_user_event_waitlist 
  UNIQUE (user_id, event_id);
  
ALTER TABLE waitlists ADD CONSTRAINT chk_waitlist_position 
  CHECK (position > 0);
```

### 🚨 Triggers & Business Rules
```sql
-- Auto-generate booking reference
CREATE OR REPLACE FUNCTION generate_booking_reference() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.booking_reference := 'EVT' || TO_CHAR(NOW(), 'YYYYMMDD') || 
                          LPAD(EXTRACT(EPOCH FROM NOW())::TEXT, 10, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update waitlist positions when someone leaves
CREATE OR REPLACE FUNCTION reorder_waitlist_positions() 
RETURNS TRIGGER AS $$
BEGIN
  UPDATE waitlists 
  SET position = position - 1 
  WHERE event_id = OLD.event_id AND position > OLD.position;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Prevent overbooking
CREATE OR REPLACE FUNCTION prevent_overbooking() 
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT available_seats FROM events WHERE id = NEW.event_id) < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient seats available';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 📊 Performance Optimization Indexes

### 🚀 Primary Indexes
```sql
-- Core performance indexes
CREATE INDEX CONCURRENTLY idx_events_date_status 
  ON events(event_date, status) WHERE status = 'active';

CREATE INDEX CONCURRENTLY idx_bookings_user_event 
  ON bookings(user_id, event_id) INCLUDE (quantity, total_amount);

CREATE INDEX CONCURRENTLY idx_bookings_status_created 
  ON bookings(status, created_at) WHERE status IN ('confirmed', 'cancelled');

CREATE INDEX CONCURRENTLY idx_waitlists_event_position 
  ON waitlists(event_id, position) WHERE status = 'waiting';

CREATE INDEX CONCURRENTLY idx_waitlists_priority_joined 
  ON waitlists(priority_score DESC, joined_at ASC) WHERE status = 'waiting';

-- Analytics indexes
CREATE INDEX CONCURRENTLY idx_booking_attempts_result_time 
  ON booking_attempts(result, attempted_at) WHERE result = 'failed';

CREATE INDEX CONCURRENTLY idx_pricing_history_event_applied 
  ON pricing_history(event_id, applied_at DESC);

-- Notification system indexes  
CREATE INDEX CONCURRENTLY idx_notifications_user_unread 
  ON notifications(user_id, read) WHERE read = false;

CREATE INDEX CONCURRENTLY idx_notifications_type_sent 
  ON notifications(type, sent_at DESC);
```

### 🔍 Specialized Indexes
```sql
-- Full-text search on events
CREATE INDEX CONCURRENTLY idx_events_search 
  ON events USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || venue));

-- Geospatial index for venue-based searches (future enhancement)
-- CREATE INDEX CONCURRENTLY idx_events_location 
--   ON events USING gist(venue_coordinates);

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY idx_events_upcoming 
  ON events(event_date) WHERE status = 'active' AND event_date > NOW();

CREATE INDEX CONCURRENTLY idx_bookings_recent 
  ON bookings(created_at DESC) WHERE created_at > NOW() - INTERVAL '30 days';
```

## 🗂️ Database Sharding Strategy

### 📈 Horizontal Partitioning
```
Sharding Key: HASH(event_id) % 4

┌─────────────┬─────────────┬─────────────┬─────────────┐
│   SHARD 0   │   SHARD 1   │   SHARD 2   │   SHARD 3   │
│ Events A-F  │ Events G-M  │ Events N-S  │ Events T-Z  │
│             │             │             │             │
│ • Users     │ • Users     │ • Users     │ • Users     │
│ • Bookings  │ • Bookings  │ • Bookings  │ • Bookings  │
│ • Waitlists │ • Waitlists │ • Waitlists │ • Waitlists │
│ • Analytics │ • Analytics │ • Analytics │ • Analytics │
└─────────────┴─────────────┴─────────────┴─────────────┘

Cross-shard Operations:
• Global user lookups → Distributed query
• System-wide analytics → Map-reduce aggregation
• Cross-event promotions → Coordinated transactions
```

### 🔄 Replication Strategy
```
Master-Replica Configuration per Shard:

SHARD_N_MASTER (Write Operations)
    ↓ Streaming Replication
SHARD_N_REPLICA_1 (Read Operations - Analytics)
    ↓ Cascading Replication  
SHARD_N_REPLICA_2 (Read Operations - Reporting)

Failover Strategy:
1. Health Check Failure Detection (5s timeout)
2. Automatic Replica Promotion (30s SLA)
3. Application Connection Rerouting
4. Master Recovery and Re-synchronization
```

## 📋 Data Lifecycle Management

### 🗄️ Archival Strategy
```sql
-- Archive old bookings (completed events > 1 year)
CREATE TABLE bookings_archive (LIKE bookings INCLUDING ALL);

-- Partition notifications by month
CREATE TABLE notifications_2025_09 PARTITION OF notifications 
FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

-- Soft delete for regulatory compliance
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_users_active ON users(id) WHERE deleted_at IS NULL;
```

### 🧹 Data Retention Policies
| Table | Retention Period | Archive Strategy | Notes |
|-------|-----------------|------------------|--------|
| **bookings** | 7 years | Cold storage after 2 years | Legal compliance |
| **booking_attempts** | 90 days | Hard delete | Security/privacy |
| **notifications** | 1 year | Monthly partitions | Performance |
| **pricing_history** | 5 years | Compressed storage | Business intelligence |
| **waitlist_promotions** | 6 months | Archive after event completion | Analytics |

## 🔐 Security & Compliance

### 🛡️ Data Protection
- **PII Encryption**: Email, name fields encrypted at rest
- **Audit Trail**: All data modifications logged with user context
- **Access Control**: Row-level security based on user roles
- **Data Anonymization**: Automated PII scrubbing for analytics
- **GDPR Compliance**: Right to be forgotten implementation

### 🔍 Query Examples
```sql
-- Get user's complete booking history
SELECT b.*, e.name, e.venue, e.event_date
FROM bookings b 
JOIN events e ON b.event_id = e.id
WHERE b.user_id = $1 
ORDER BY b.created_at DESC;

-- Find events with highest demand
SELECT e.*, 
       COUNT(b.id) as total_bookings,
       AVG(w.position) as avg_waitlist_position,
       (e.total_capacity - e.available_seats) / e.total_capacity::decimal as capacity_utilization
FROM events e
LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
LEFT JOIN waitlists w ON e.id = w.event_id AND w.status = 'waiting'
WHERE e.status = 'active'
GROUP BY e.id
ORDER BY capacity_utilization DESC;

-- Waitlist promotion eligibility
SELECT w.*, u.email, 
       ROW_NUMBER() OVER (PARTITION BY w.event_id ORDER BY w.priority_score DESC, w.joined_at ASC) as promotion_order
FROM waitlists w
JOIN users u ON w.user_id = u.id
WHERE w.event_id = $1 AND w.status = 'waiting'
LIMIT $2;
```
