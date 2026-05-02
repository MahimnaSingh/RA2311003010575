
Three types of notifications: Placements, Events, Results. Students need to see them when logged in, mark them read, and get new ones in real time without refreshing.

Here's the API I'd build for this:

**Get all notifications**
```
GET /api/notifications
Authorization: Bearer <token>
```
Query params: `?type=Placement&isRead=false&page=1&limit=20`

Response:
```json
{
  "notifications": [
    {
      "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
      "type": "Placement",
      "message": "Google hiring drive on campus",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:30Z"
    }
  ],
  "total": 120,
  "page": 1,
  "limit": 20
}
```

**Get a single notification**
```
GET /api/notifications/:id
Authorization: Bearer <token>
```
Returns the notification object or `404` with `{ "error": "notification not found" }` if it doesn't exist.

**Create a notification (admin only)**
```
POST /api/notifications
Authorization: Bearer <token>
Content-Type: application/json
```
```json
{
  "studentIds": [1042, 1043, 1044],
  "type": "Placement",
  "message": "Amazon hiring drive on 5th May"
}
```
Response `201`:
```json
{ "success": true, "notificationsCreated": 3 }
```

**Mark one as read**
```
PATCH /api/notifications/:id/read
Authorization: Bearer <token>
```
Response: `{ "success": true }`

**Mark all as read**
```
PATCH /api/notifications/read-all
Authorization: Bearer <token>
```
Response: `{ "success": true, "updated": 45 }`

**Delete a notification**
```
DELETE /api/notifications/:id
Authorization: Bearer <token>
```
Response: `{ "success": true }`

---

**Real-time notifications**

I'd use Server-Sent Events (SSE) over WebSockets here. Notifications only flow one way — server to client — so WebSockets are overkill. SSE is simpler, works over plain HTTP, and reconnects automatically if the connection drops.

```
GET /api/notifications/stream
Authorization: Bearer <token>
Accept: text/event-stream
```

The server keeps the connection open and pushes events as they come in:
```
data: {"id":"abc123","type":"Placement","message":"Google hiring","createdAt":"2026-05-02T10:00:00Z"}
```

When the backend creates a new notification for a student, it pushes it down their open SSE connection immediately.

---

## Stage 2

I'd go with PostgreSQL. The data is clearly relational — students have notifications, notifications have types and read states. We need filtering, sorting, bulk inserts, and strong consistency. PostgreSQL handles all of this well and the ENUM type maps perfectly to our notification categories.

**Schema:**

```sql
CREATE TYPE notification_type AS ENUM ('Placement', 'Result', 'Event');

CREATE TABLE students (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  message           TEXT NOT NULL,
  is_read           BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_student_unread
  ON notifications (student_id, is_read, created_at DESC);

CREATE INDEX idx_notifications_type_created
  ON notifications (notification_type, created_at DESC);
```

**Queries for the Stage 1 APIs:**

Fetch all (with filters + pagination):
```sql
SELECT id, notification_type, message, is_read, created_at
FROM notifications
WHERE student_id = $1
  AND ($2::notification_type IS NULL OR notification_type = $2)
  AND ($3::boolean IS NULL OR is_read = $3)
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;
```

Fetch single:
```sql
SELECT id, notification_type, message, is_read, created_at
FROM notifications
WHERE id = $1 AND student_id = $2;
```

Bulk create:
```sql
INSERT INTO notifications (student_id, notification_type, message)
SELECT unnest($1::int[]), $2::notification_type, $3
RETURNING id;
```

Mark one read:
```sql
UPDATE notifications SET is_read = true
WHERE id = $1 AND student_id = $2;
```

Mark all read:
```sql
UPDATE notifications SET is_read = true
WHERE student_id = $1 AND is_read = false;
```

Delete:
```sql
DELETE FROM notifications WHERE id = $1 AND student_id = $2;
```

**As data grows** the main issues will be query slowdowns and table bloat. The composite index on `(student_id, is_read, created_at DESC)` handles the most common read pattern. For old data, I'd archive notifications older than 6 months to a separate table or partition the table by `created_at` month so the active partition stays small. For bulk inserts (notifying 50k students), use multi-row inserts or `COPY` instead of looping.

---

## Stage 3

The query:
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

The logic is fine but with 5 million rows and no index, Postgres does a full sequential scan — reads every single row, filters, then sorts. That's expensive. `SELECT *` also pulls columns you probably don't need.

The fix is a composite index:
```sql
CREATE INDEX idx_notifications_student_unread
ON notifications (student_id, is_read, created_at DESC);
```

With this, Postgres goes directly to the matching rows in order. No scan, no sort. Goes from O(n) to roughly O(log n + k) where k is the number of unread notifications for that student.

And replace `SELECT *`:
```sql
SELECT id, notification_type, message, created_at
FROM notifications
WHERE student_id = 1042 AND is_read = false
ORDER BY created_at DESC;
```

**On indexing every column** — bad idea. Every index you add slows down every INSERT, UPDATE, and DELETE because Postgres has to update each one. Storage goes up too. And the query planner can actually get confused with too many indexes and pick the wrong one. Only index columns you actually filter or sort on.

**Students who got a Placement in the last 7 days:**
```sql
SELECT DISTINCT student_id
FROM notifications
WHERE notification_type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

The DB getting hit on every page load for every student is going to fall over at scale. A few things I'd do:

**Redis cache** — this is the main fix. Cache each student's notifications under a key like `notifications:student:{id}`. On page load, check Redis first. Only go to the DB on a cache miss. When a new notification is saved for a student, invalidate their cache key. The trade-off is that notifications might be a second or two stale in edge cases, and you now have Redis to keep alive.

**Pagination** — never fetch all notifications at once. Already built into Stage 1 with `page` and `limit`. Fetching 20 rows is dramatically cheaper than 500. Clients just need to handle pagination, which is standard.

**Read replicas** — route all GET queries to a read replica, keep the primary for writes only. Scales read throughput horizontally. Downside is slight replication lag — a notification just written might not appear immediately on the replica.

**ETags** — return an ETag with each response. If the client sends `If-None-Match` and nothing changed, respond with `304 Not Modified` and no body. Saves bandwidth and server processing for students whose notifications haven't changed. Only useful if clients implement it properly.

---

## Stage 5

The current implementation:
```
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)
        save_to_db(student_id, message)
        push_to_app(student_id, message)
```

The problems are pretty obvious once 200 emails fail. The loop stops completely — no retry, no fallback. The remaining 49,800 students get nothing. It's also fully synchronous so it blocks for however long 50,000 email API calls take. And there's no way to see what succeeded and what didn't.

**Should DB save and email happen together?** No. Saving to DB should happen first, unconditionally. Email delivery depends on a third-party API that can fail, timeout, or rate-limit. If they're coupled and email fails, the notification never gets saved and students have no record of it. Decouple them.

**Redesigned approach:**

```
function notify_all(student_ids: array, message: string):
    // save everything to DB first, in bulk
    bulk_insert_notifications(student_ids, message)

    // queue one delivery job per student
    for student_id in student_ids:
        queue.push({ student_id, message, attempts: 0 })


// worker — run multiple instances of this
function worker():
    while true:
        job = queue.pop()
        try:
            send_email(job.student_id, job.message)
            push_to_app(job.student_id, job.message)
        catch error:
            if job.attempts < MAX_RETRIES:
                job.attempts += 1
                queue.push_with_delay(job, delay = 2 ^ job.attempts seconds)
            else:
                dead_letter_queue.push(job)
                log_failure(job.student_id, error)
```

DB write always happens. Delivery is async and retried on failure with exponential backoff. After MAX_RETRIES the job goes to a dead letter queue for manual review. Multiple workers process jobs in parallel so 50,000 emails go out in seconds not minutes.

---

## Stage 6

Each notification gets a priority score based on type and recency.

Weights: Placement = 3, Result = 2, Event = 1

For recency I normalize timestamps within the fetched set — the newest notification gets 1.0, the oldest gets 0.0, everything else falls in between proportionally.

Priority = weight + recency score. So a very recent Placement scores close to 4.0, an old Event scores close to 1.0. Sort descending, take top 10.

For keeping the top 10 updated as new notifications come in — use a min-heap capped at size 10. When a new notification arrives, score it. If the heap isn't full yet, push it in. If it is full, compare against the minimum score in the heap. If the new score is higher, pop the minimum and push the new one in. Otherwise ignore it. This is O(log 10) per new notification which is effectively constant time regardless of how many total notifications there are.
