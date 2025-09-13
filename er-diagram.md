# 📊 Evently Backend - Entity Relationship Diagram

                         ┌─────────────────┐
                         │      USERS      │
                         │─────────────────│
                         │ id (UUID) PK    │
                         │ email           │
                         │ name            │
                         │ password_hash   │
                         │ role            │
                         │ is_active       │
                         │ version         │
                         │ created_at      │
                         │ updated_at      │
                         └─────────┬───────┘
                                   │ 1
                                   │
                                   │ N
                  ┌────────────────┼────────────────┐
                  │                │                │
                  ▼ N              ▼ N              ▼ N
         ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
         │    BOOKINGS     │ │    WAITLISTS    │ │WAITLIST_PROMOTIONS│
         │─────────────────│ │─────────────────│ │─────────────────│
         │ id (UUID) PK    │ │ id (UUID) PK    │ │ id (UUID) PK    │
         │ user_id FK      │ │ user_id FK      │ │ waitlist_id FK  │
         │ event_id FK     │ │ event_id FK     │ │ event_id FK     │
         │ quantity        │ │ position        │ │ user_id FK      │
         │ total_amount    │ │ priority_score  │ │ promoted_at     │
         │ status          │ │ joined_at       │ │ expires_at      │
         │ booking_ref     │ │ expires_at      │ │ window_minutes  │
         │ version         │ │ status          │ │ status          │
         │ created_at      │ │ notification_   │ │ booking_id FK   │
         │ updated_at      │ │   preferences   │ │ created_at      │
         └─────────┬───────┘ │ created_at      │ └─────────────────┘
                   │         │ updated_at      │
                   │         └─────────┬───────┘
                   │ N                 │ N
                   │                   │
                   │ 1                 │ 1
                   ▼                   ▼
         ┌──────────────────────────────────────┐
         │               EVENTS                 │
         │──────────────────────────────────────│
         │ id (UUID) PK                         │
         │ name                                 │
         │ description                          │
         │ venue                                │
         │ event_date                           │
         │ total_capacity                       │
         │ available_seats                      │
         │ price                                │
         │ status                               │
         │ version (optimistic locking)         │
         │ created_by FK → users(id)            │
         │ created_at                           │
         │ updated_at                           │
         └─────────────────┬────────────────────┘
                           │ 1
                           │
                           │ N
                           ▼
                 ┌─────────────────┐
                 │PRICING_HISTORY  │
                 │─────────────────│
                 │ id (UUID) PK    │
                 │ event_id FK     │
                 │ old_price       │
                 │ new_price       │
                 │ change_reason   │
                 │ applied_by      │
                 │ applied_at      │
                 └─────────────────┘

# 🔗 Relationship Details:

Primary Relationships:
- Users (1) ↔ (N) Bookings: One user can have many bookings
- Users (1) ↔ (N) Waitlists: One user can be on waitlists for multiple events  
- Events (1) ↔ (N) Bookings: One event can have many bookings
- Events (1) ↔ (N) Waitlists: One event can have many waitlist entries
- Events (1) ↔ (N) Pricing History: Track all price changes per event

Advanced Relationships:
- Waitlists (1) ↔ (1) Waitlist Promotions: When promoted, create promotion record
- Waitlist Promotions (N) ↔ (1) Bookings: Link successful promotions to bookings

Key Constraints:
- Unique Constraint: (user_id, event_id) in waitlists - one waitlist entry per user per event
- Check Constraint: available_seats <= total_capacity in events
- Foreign Key Cascade: Maintain referential integrity across all relationships

# Indexes for Performance:
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_event_id ON bookings(event_id);
CREATE INDEX idx_events_date_status ON events(event_date, status);
CREATE INDEX idx_waitlists_event_position ON waitlists(event_id, position);
CREATE INDEX idx_waitlists_user_priority ON waitlists(user_id, priority_score);

# 🗃️ Sharding Strategy:
Shard 1: Events with organizer_id hash % 4 = 0
Shard 2: Events with organizer_id hash % 4 = 1  
Shard 3: Events with organizer_id hash % 4 = 2
Shard 4: Events with organizer_id hash % 4 = 3

Cross-shard queries handled by aggregation service
