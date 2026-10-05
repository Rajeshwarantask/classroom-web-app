# Project Context: Northstar Classroom Operations

## 1. Project identity

**Project name:** Northstar Classroom Operations

**What it does:** Northstar is a campus room-operations web application. Authenticated users can browse rooms, reserve a room for a time window, view their reservations, cancel reservations, check in with a confirmation code, inspect a timetable-style activity view, and see reservation-based utilization signals.

**Primary problem:** Campus users need one place to discover available spaces, make a reservation, and communicate room occupancy without relying on disconnected timetables or manual coordination.

**Target users:** Authenticated campus users such as faculty, staff, or students. The current frontend presents a general campus-operations experience rather than separate role-specific experiences.

**Core workflows:**
1. Sign in or create an account with Supabase email/password authentication.
2. Load rooms and bookings from Supabase.
3. Find a room and open the reservation modal.
4. Submit a room, purpose, date, start time, and end time.
5. Reject invalid time windows and locally detected overlaps.
6. Insert the booking with the authenticated user's id and a generated confirmation code.
7. View, cancel, or check in to a reservation.
8. Review timetable and analytics views derived from the loaded room/booking data.

**Current production/deployment status:** The repository contains Vercel configuration and a frontend build configuration. A production deployment has been attempted historically, but this document does not independently verify a currently live deployment URL. Production deployment should therefore be treated as **not verified here** unless a current deployment check is run.

## 2. Feature inventory

### Authentication

**Purpose:** Gate campus operations data behind an authenticated Supabase session.

**User workflow:** A visitor sees the Northstar sign-in screen, enters email/password, and signs in. A new user can switch to account creation; Supabase sends an email confirmation link when confirmation is required.

**Frontend:** `frontend/src/App.js` renders `AuthScreen`, holds the auth form state, and calls the Supabase browser client. `frontend/src/hooks/useAuth.js` owns session loading and auth-state subscription. `frontend/src/lib/supabase.js` creates the browser client from generated environment values.

**Backend/database:** Supabase Auth manages users and sessions. The `bookings.user_id` column references `auth.users(id)`.

**Important details:** The signup redirect uses `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` when available and falls back to the current origin plus `/auth/callback`. The current visible frontend does not show an explicit callback route implementation in the inspected React source; callback behavior must be verified against the deployed build and Supabase configuration.

**Error handling:** Sign-in errors containing `Invalid` are presented as `Invalid email or password.` Other errors are surfaced directly. Signup success is displayed as an inbox-confirmation message.

### Room directory

**Purpose:** Let users understand the spaces available on campus.

**User workflow:** The sidebar opens `Find a room`. The page displays room cards with room code, name, building, floor, capacity, and equipment, and provides a reserve action.

**Data:** Rooms are selected from Supabase `rooms` with fields `id`, `code`, `name`, `building`, `floor`, `capacity`, and `equipment`. A built-in `demoRooms` array is the initial fallback state if the database has not loaded rows.

**Important details:** The current room filters are visual controls only: `All spaces`, `Available now`, and `Capacity` do not currently change the displayed dataset. Room availability is not recalculated per reservation window in the room cards.

### Room reservation

**Purpose:** Turn room discovery into an actionable reservation workflow.

**User workflow:** A user clicks `Reserve a room` or a room card action, fills in the room, title, purpose, date, start time, and end time, then submits `Confirm reservation`.

**Frontend implementation:** `BookingModal` owns form state. `createBooking` converts the selected date/time into JavaScript `Date` values, validates that the end is after the start, checks currently loaded bookings for an overlap, generates a `CLS-XXXXXX` confirmation code, and inserts the booking through Supabase.

**Overlap logic:** A collision is detected when the same room has a non-cancelled booking where `existing.starts_at < requestedEnd` and `existing.ends_at > requestedStart`. This correctly catches partial overlaps and containment overlaps while allowing back-to-back reservations whose endpoints touch.

**Database:** `public.bookings` stores room, owner, title, purpose, start/end timestamps, status, confirmation code, check-in timestamp, and creation timestamp. A partial index covers active room-window lookups. The database schema also has `ends_at > starts_at` and a unique confirmation-code constraint.

**Concurrency caveat:** The frontend performs an optimistic/local overlap check, and a unique-key collision is handled as a user-facing conflict. The inspected schema does not include a PostgreSQL exclusion constraint or an RPC/transaction that atomically locks a room time range. Therefore true concurrent overlap prevention is not fully verified by the current implementation.

**Edge cases:** End-before-start is rejected. A locally detected overlapping booking is rejected. A database unique violation (`23505`) is translated to a conflict message. Other insert failures receive a generic reservation error. Empty title and purpose are prevented by required form controls, but server-side length validation is not present in the inspected frontend flow.

### Booking management

**Purpose:** Give users a reservation log and cancellation control.

**User workflow:** `My bookings` renders all loaded bookings. Confirmed bookings expose `Cancel`; cancelled bookings remain visible with a cancelled status.

**Implementation:** Cancellation updates `status` to `cancelled` and scopes the update to both the booking id and the current session user id. Local state is updated after success.

**Authorization:** Supabase RLS contains an owner-only update policy using `auth.uid() = user_id`. The frontend also supplies the user id filter.

**Edge cases:** Failed cancellation shows a toast. There is no explicit cancellation time, reason, or server-side policy preventing cancellation of past bookings in the inspected code.

### Confirmation-code check-in

**Purpose:** Mark a reservation as active occupancy at the room.

**User workflow:** The Overview page has a `Quick check-in` field. The user enters a confirmation code; the app finds a matching confirmed booking, updates it to `checked_in`, stores `checked_in_at`, and shows a confirmation toast.

**Implementation:** Codes are compared case-insensitively against the loaded booking list. The update targets the booking id and changes status and check-in time.

**Important limitations:** The current frontend does not scope the check-in update by user id, does not verify that the request is within the booking window, and does not require a QR scan despite the product direction mentioning QR check-in. The implemented feature is confirmation-code check-in, not QR check-in.

### Overview

**Purpose:** Provide a compact operational landing page.

**UI:** It includes a hero card, quick check-in card, room cards, today-at-a-glance schedule rows, and a link-like action to view rooms.

**Data:** Today’s reservations are derived by comparing each booking’s start date with the browser’s current date. Active bookings exclude cancelled records.

### Timetable

**Purpose:** Provide a visual weekly planning view.

**UI:** The page renders a Monday–Friday grid with fixed display times (`09:00`, `10:30`, `12:00`, `14:00`, `15:30`) and shows occupied/free cells.

**Important implementation detail:** The inspected React component uses `(row + col) % 4 === 0` to create occupied cells and selects room codes from the loaded room list. It does not map actual `timetable_entries` or booking timestamps into the grid. The explanatory copy says conflicts are prevented by overlapping windows, but the visible timetable itself is a deterministic visual representation rather than a database-backed schedule.

### Analytics

**Purpose:** Provide lightweight reservation activity signals.

**UI:** It displays total reservations, most requested room, available-space count, and horizontal bars by room.

**Implementation:** Counts are computed in the browser from loaded non-cancelled bookings. The most-requested room is selected by count. Bar width is `Math.min(100, count * 18 + 8)`.

**Limitations:** These are user-visible activity counts, not a time-normalized utilization heatmap. There is no Chart.js usage in the inspected final `App.js`; the dependency exists in the frontend manifest but is not demonstrated as used by this UI.

### Legacy classroom availability API

The Express backend also exposes older MongoDB-backed classroom operations. These are separate from the current Supabase-backed Northstar frontend and are not called by the inspected `App.js`.

Capabilities include room availability by day/period, staff availability, faculty listing, projector-room availability, lab listing, lab availability, dashboard statistics, and timetable mutation. These routes should be treated as backend/legacy capabilities unless a frontend caller is confirmed.

## 3. End-to-end user flows

### Sign-in

1. Browser loads the React app.
2. `useAuth` asks Supabase for the current session and subscribes to auth changes.
3. While loading, `LoadingScreen` renders.
4. Without a session, `AuthScreen` renders.
5. Submit calls `supabase.auth.signInWithPassword({ email, password })`.
6. Supabase returns a session or an error.
7. On success, the auth state subscription updates the app and the main shell renders.
8. On failure, a generic invalid-credentials message is shown for invalid errors.

### Sign-up

1. User switches the auth mode to account creation.
2. Submit calls `supabase.auth.signUp` with email/password and an email redirect URL.
3. Supabase handles account creation and confirmation email delivery.
4. The UI tells the user to check their inbox on success.

### Initial data load

1. A session becomes available.
2. The app runs two Supabase queries in parallel with `Promise.all`.
3. It selects room metadata from `rooms` ordered by room code.
4. It selects booking fields from `bookings` ordered by start time.
5. Loaded rows replace initial room/booking state.
6. Errors from the initial load are not explicitly surfaced in the current `loadData` function.

### Reservation

1. User opens the modal.
2. The modal selects the clicked room or defaults to the first room.
3. User submits required form fields.
4. `createBooking` parses the local date/time.
5. It rejects an invalid interval.
6. It checks active in-memory bookings for overlap.
7. It inserts a confirmed booking through Supabase with the current user id.
8. RLS checks the user-owned insert policy.
9. The returned row is appended and sorted by start time.
10. The modal closes, a confirmation toast appears, and the app navigates to My bookings.

### Cancellation

1. User clicks Cancel on a confirmed booking.
2. Supabase updates the booking to `cancelled`, filtered by id and current user id.
3. RLS validates ownership.
4. Local state updates the matching booking.
5. A toast confirms cancellation.

### Check-in

1. User enters the confirmation code.
2. The browser searches loaded confirmed bookings case-insensitively.
3. If no match exists, it shows an error toast.
4. If a match exists, Supabase updates status to `checked_in` and sets `checked_in_at`.
5. The local row is updated and a success toast is displayed.

### Sign-out

The profile button calls the `signOut` function exposed by `useAuth`. Supabase clears the session, the auth subscription updates state, and the app returns to the auth screen.

## 4. Frontend routes and pages

The current frontend is a single-page React application without React Router. Navigation is controlled by the `page` state in `App`.

| View | Access | Main functionality |
|---|---|---|
| Auth screen | Public | Sign in and sign up |
| Overview | Authenticated | Room highlights, today’s schedule, check-in |
| Find a room | Authenticated | Room directory and reserve actions |
| My bookings | Authenticated | Reservation log and cancellation |
| Timetable | Authenticated | Weekly visual timetable |
| Analytics | Authenticated | Reservation counts and room activity bars |

The app does not currently expose URL-addressable routes for these views. Direct URL routing, 404 handling, and route-level code splitting are not implemented in the inspected source.

## 5. Backend API endpoints

The Express server mounts legacy Mongo routes at `/api`, dashboard routes at `/api`, and timetable routes at `/api/timetable`.

### `GET /health`
- Authentication: none.
- Purpose: Returns `{ status: "ok", service: "classroom-api" }`.
- Database: none.

### Classroom routes in `backend/routes/classrooms.js`

- `GET /api/check-availability?room=<room>&day=<day>&period=<period>`: Validates required query fields, verifies the room against `ClassroomList`, scans Mongo classroom schedules, reports free/occupied status, and may return faculty, subject, year, section, and a randomly selected alternative room.
- `GET /api/check-staff?faculty=<id>&day=<day>&period=<period>`: Scans schedules for faculty occupancy and returns current room details plus the next free period.
- `GET /api/faculty-list`: Aggregates distinct faculty ids and names.
- `GET /api/projector?day=<day>&period=<period>`: Finds free allocated rooms that are present in the projector collection.
- `GET /api/lab-list`: Aggregates room values containing `lab` across weekday schedules.
- `GET /api/check-lab-availability?room=<room>&day=<day>&period=<period>`: Checks lab occupancy and returns availability/details.

The file continues with additional legacy availability endpoints; the exact complete endpoint inventory should be regenerated from the final file if these routes are extended.

### Dashboard route in `backend/routes/dashboard.js`

- `GET /api/dashboard-stats?day=<optional>&period=<optional>`: Reads allocated rooms, projector rooms, and classroom schedules; determines the requested period automatically from the current time unless a period is supplied; returns current free/occupied counts, resource totals, free projector rooms, and weekday bar-chart aggregates.

### Timetable routes in `backend/routes/timetable.js`

- `GET /api/timetable?year=<year>&section=<section>`: Returns a Mongo classroom schedule.
- `PUT /api/timetable/update`: Updates a period object for a matching year/section/day/period.
- `DELETE /api/timetable/delete`: Replaces a period with a default free entry.
- `POST /api/timetable/add`: Adds a period if that period does not already exist.

The inspected timetable routes validate entity existence and period existence, but do not implement the Supabase timetable clash-detection model described in the earlier schema proposal.

## 6. Architecture

### Current production-oriented frontend path

The visible Northstar UI is a React 19 Create React App application. It uses the Supabase browser SDK directly for authentication and data access. There is no current frontend call to the Express API in the inspected `App.js`.

### Legacy backend path

The repository also contains a Node.js/Express server backed by Mongoose/MongoDB. It exposes legacy classroom schedule APIs and can serve the frontend build in production when `NODE_ENV=production`.

### Text architecture diagram

```text
Authenticated user
      |
      v
React/Create React App frontend
      |
      +--> Supabase browser client --> Supabase Auth
      |                              Supabase Postgres tables
      |
      +--> Local React state for room, booking, page, and toast state

Separate legacy path:
HTTP client
      |
      v
Express server
      |
      +--> /api classroom/dashboard/timetable routes
      |
      +--> Mongoose models
      |
      v
MongoDB
```

### State management

State is managed with React `useState` and `useEffect`. There is no Redux, Zustand, React Query, SWR, or context-based domain store in the inspected implementation. Auth state is encapsulated by `useAuth`; page, rooms, bookings, modal, form, and toast state are held in `App` or feature components.

### Validation and error handling

Validation is a mixture of native HTML constraints, frontend checks, Supabase/RLS constraints, Mongo route checks, and error-to-toast translation. There is no shared TypeScript schema validation layer; the inspected application is JavaScript.

## 7. Folder structure

Important current structure:

```text
/
├── package.json
├── vercel.json
├── PROJECT_CONTEXT.md
├── scripts/
│   └── generate-frontend-env.js
├── frontend/
│   ├── package.json
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json
│   │   └── static assets
│   ├── scripts/
│   │   └── generate-frontend-env.js
│   └── src/
│       ├── App.js
│       ├── App.css
│       ├── index.css
│       ├── index.js
│       ├── config/env.js
│       ├── lib/supabase.js
│       ├── hooks/useAuth.js
│       ├── services/campusService.js
│       └── components/ui/AppStates.js
└── backend/
    ├── package.json
    ├── server.js
    ├── vercel.json
    ├── routes/
    │   ├── classrooms.js
    │   ├── dashboard.js
    │   └── timetable.js
    └── models/
        ├── Classroom.js
        ├── ClassroomList.js
        └── Projector.js
```

The frontend has begun a modular structure with config, hooks, services, lib, and UI state components, but the majority of the current UI and feature composition remains in `src/App.js`. A full `features/`, `pages/`, `types/`, and `assets/` architecture is not present in the inspected final tree.

## 8. Technology stack

### Frontend

- React 19: component rendering and local state.
- Create React App / `react-scripts` 5: development server and production bundle.
- `@supabase/supabase-js`: browser auth and Postgres Data API access.
- Plain CSS in `App.css` and `index.css`: application styling and responsive layout.
- `web-vitals`: included in dependencies; meaningful use is not verified from the inspected files.
- Axios, Chart.js, and `react-chartjs-2`: present in the manifest, but meaningful use is not verified in the inspected final `App.js`.

### Backend

- Node.js: server runtime.
- Express: HTTP server and route composition.
- Mongoose: MongoDB models and queries.
- `cors`: cross-origin request handling.
- `dotenv`: environment loading.

### Database and services

- Supabase Auth and Supabase Postgres: used directly by the current Northstar frontend.
- MongoDB: used by the legacy Express classroom API when `MONGO_URI` is configured.

### Deployment

- Vercel: root `vercel.json` defines build/install/output behavior and static-asset rewrites/headers.
- CRA build output: `frontend/build`.

### Testing

- React Testing Library and Jest-related packages are present in the frontend manifest. No test files or passing test run were verified in this inspection.

### TypeScript

The requested project direction mentioned TypeScript, but the inspected final implementation is JavaScript (`.js`) rather than TypeScript (`.ts`/`.tsx`). TypeScript is **not verified as implemented**.

## 9. Database design

### Supabase Postgres tables

The approved schema creates:

#### `public.rooms`
- `id uuid primary key default gen_random_uuid()`
- `code text not null unique`
- `name text not null`
- `building text not null`
- `floor integer not null default 1`
- `capacity integer not null check (capacity > 0)`
- `equipment text[] not null default '{}'`
- `created_at timestamptz not null default now()`

#### `public.bookings`
- `id uuid primary key`
- `room_id uuid not null` referencing `rooms`
- `user_id uuid not null` referencing `auth.users`
- `title`, `purpose`
- `starts_at`, `ends_at`
- `status` with `confirmed`, `cancelled`, `checked_in`, or `completed`
- unique `confirmation_code`
- optional `checked_in_at`
- `created_at`
- check constraint requiring `ends_at > starts_at`

Indexes include an active room-window partial index on `(room_id, starts_at, ends_at)` for confirmed/checked-in bookings.

#### `public.timetable_entries`
- `room_id` referencing rooms
- `faculty_id` referencing auth users
- subject, weekday, period, start/end time, created timestamp
- checks for weekday 1–7, period 1–12, and valid time window
- room-slot and faculty-slot indexes

This table exists in the approved schema but is not queried by the inspected current React timetable view.

### Supabase RLS

- `rooms`: authenticated users can select rows.
- `bookings`: authenticated users can select rows; authenticated users can insert rows only when `auth.uid() = user_id`; owners can update their rows.
- `timetable_entries`: authenticated users can select rows.

The booking select policy is broad for authenticated users (`using (true)`), so the current schema allows authenticated users to read all bookings. This is an important authorization characteristic, not an assumption of private per-user visibility.

### MongoDB models

The legacy backend uses Mongoose models for `Classroom`, `ClassroomList`, and `Projector`. Exact schema fields visible in route usage include classroom `year`, `section`, `faculty`, and a day-keyed `schedule` containing period, room, occupied, facultyId, subject, and projector-related fields. The complete model definitions should be treated as authoritative if this legacy API is retained.

## 10. Authentication and authorization

- Provider: Supabase Auth.
- Methods: email/password sign-in and signup.
- Session state: loaded/subscribed through `supabase.auth.getSession()` and `onAuthStateChange` in `useAuth`.
- Frontend protection: the main application shell is not rendered until a session exists.
- Data authorization: Supabase RLS policies protect booking inserts and owner updates.
- Sign-out: delegated to Supabase through `useAuth`.
- Legacy Express routes: no Supabase JWT verification middleware was found in the inspected `server.js`; their authentication/authorization behavior is therefore not verified and should not be described as protected.
- Roles: no admin/faculty/student role authorization was verified in the current frontend.

## 11. Important technical implementations

### Overlap detection

The booking workflow uses the standard half-open interval overlap test. It catches bookings that start inside the requested interval, end inside it, or contain it. It also allows adjacent reservations. This is the strongest non-trivial business rule in the current frontend.

### Parallel initial data loading

Rooms and bookings are requested concurrently with `Promise.all`, reducing sequential request latency for the authenticated landing experience.

### Optimistic local UI synchronization

After successful insert, cancel, or check-in operations, the app updates React state immediately from the returned/known values rather than requiring a full page reload.

### Supabase/Postgres relational integrity

Foreign keys, status checks, timestamp checks, unique confirmation codes, and indexes encode important invariants in the database instead of relying exclusively on UI logic.

### Legacy period analytics

The Express dashboard route computes current-period occupancy, resource classifications, and weekday free-room aggregates by scanning Mongo schedules. It also supports automatic current-period detection from local server time or a manually selected period.

### Production static serving configuration

The root Vercel config builds the frontend, publishes `frontend/build`, excludes common static assets from SPA fallback rewrites, and sets a manifest content type plus long-lived caching for `/static/*` assets.

## 12. Error handling and edge cases

Implemented:
- Auth loading state via `LoadingScreen`.
- Required email/password, title, purpose, date, and time controls.
- End time must be after start time.
- Client-side booking overlap detection.
- Database unique-key conflict translated to a booking conflict message.
- Generic booking, cancellation, and check-in failure toasts.
- Unknown check-in code produces an error toast.
- Empty booking state is rendered.
- Cancelled bookings remain visible with a distinct state.
- Backend query validation returns HTTP 400 for missing parameters.
- Backend not-found cases return 404 for missing classroom/period/data.
- Backend unexpected failures return HTTP 500 with generic error payloads.

Not verified or incomplete:
- Initial Supabase load errors are not surfaced to the user.
- There is no explicit error boundary in the inspected `App.js`.
- Network retry/backoff is not implemented.
- Expired-session recovery beyond Supabase auth-state behavior is not explicitly handled.
- Server-side input validation for Supabase booking title/purpose/date is not present in the frontend code.
- Timezone policy is not explicit; browser-local date/time is converted to an ISO timestamp.
- QR validation and booking-window check-in rules are not implemented.
- Legacy routes accept many values without schema validation beyond required fields and parsing.

## 13. Security

Verified mechanisms:
- Supabase handles password authentication and session management.
- Supabase public configuration is loaded through environment-backed frontend config; no secret should be placed in the browser bundle.
- Booking insert RLS requires the authenticated user id to equal `user_id`.
- Booking owner update RLS requires ownership for updates.
- Foreign keys and database check constraints protect relational/data invariants.
- Express uses CORS with `CLIENT_ORIGIN` when configured, otherwise allows the default permissive behavior from `origin: true`.
- Express JSON payload size is limited to 1 MB.

Not verified:
- Express JWT authentication.
- Rate limiting.
- CSRF protection.
- Content Security Policy.
- Structured request validation library.
- Role-based authorization.
- A fully private booking read policy.

## 14. Performance

Verified:
- Rooms and bookings load in parallel.
- Supabase queries select explicit columns instead of `select('*')` in the inspected app query.
- Room and booking ordering occurs in the database query.
- Supabase has an active booking room-window index.
- Vercel config applies immutable long-lived caching to `/static/*`.

Not verified:
- Pagination for rooms/bookings.
- Client cache library.
- Memoization or virtualization.
- Code splitting.
- Image/font optimization.
- Measured Core Web Vitals or bundle-size improvements.

## 15. Deployment

### Frontend deployment configuration

Root `vercel.json` specifies:
- `buildCommand`: `npm run build`
- `installCommand`: `npm install`
- `outputDirectory`: `frontend/build`
- `framework`: `create-react-app`
- SPA fallback rewrites that avoid common static asset paths.
- Manifest content type header.
- Immutable cache headers for `/static/*`.

The root build script runs the frontend environment generator, installs frontend dependencies, then runs the CRA build.

### Environment configuration

The project contains environment examples and a generator script. The frontend reads Supabase URL, publishable/anon key, and optional redirect URL from build-time environment variables. The backend reads `MONGO_URI`, `CLIENT_ORIGIN`, `NODE_ENV`, and `PORT` through dotenv/process environment.

Secrets are not included in this document.

### Production considerations

The project has two data paths: Supabase for the current Northstar frontend and MongoDB for the legacy Express API. A production deployment must ensure the chosen data path has the required variables and that the Vercel project root/build settings match the repository layout. The currently inspected root configuration is intended to deploy the CRA frontend as a static build; backend deployment is separate unless the server is hosted through its own Vercel configuration.

## 16. Development and build process

From the repository root:

```bash
npm install
npm run start
```

The root start script starts the CRA frontend with `HOST=0.0.0.0` and development WebSocket settings. The frontend package supports:

```bash
cd frontend
npm install
npm start
npm run build
npm test
```

The root production build command is:

```bash
npm run build
```

It generates frontend environment configuration, installs frontend dependencies, and builds the CRA output into `frontend/build`.

The legacy backend package can be run using its package scripts when its dependencies and MongoDB environment are configured. Exact backend scripts should be checked in the final `backend/package.json`; a production backend deployment is not established by the frontend Vercel config alone.

## 17. Modernization and restructuring evidence

Verified changes represented in the current tree include:
- Added a root-level build/deployment orchestration path for the nested frontend.
- Added environment generation for frontend builds.
- Added a dedicated Supabase client module.
- Added `useAuth` for reusable session handling.
- Added a campus service module and UI app-state component location.
- Added a production-oriented Northstar UI with room discovery, reservations, bookings, check-in, timetable, and analytics views.
- Added Supabase schema for rooms, bookings, and timetable entries with RLS, constraints, indexes, and seed rooms.
- Added Vercel routing and asset headers to avoid treating static files as SPA routes.
- Added responsive styling in the frontend CSS.

Claims not verified from the inspected final implementation:
- TypeScript migration.
- Complete feature-folder/page-folder decomposition.
- Complete backend/frontend unification.
- Fully production-hardened authorization.
- Automated end-to-end test coverage.

## 18. Technical complexity ranking

### High

- Reservation interval conflict logic: requires correct overlap semantics and handling of adjacent windows.
- Authenticated data mutations with Supabase RLS: user identity must flow from session to row ownership.
- Dual data architecture: current Supabase operations coexist with a legacy Mongo/Express API, creating deployment and source-of-truth complexity.
- Legacy dashboard aggregation: multiple Mongo collections and period/day schedule scans produce categorized occupancy metrics.

### Medium

- Modular auth hook and Supabase client setup.
- Parallel initial data loading and local state reconciliation after mutations.
- Responsive, multi-view application shell built without a router.
- Database constraints/indexes for reservation data.

### Low

- Room-card display.
- Simple count-based analytics.
- Static timetable visualization in the current frontend.
- Standard Vercel CRA build configuration.

## 19. Resume-Relevant Technical Evidence

### Verified implementation

- Built a React-based campus room operations interface with authenticated room discovery, reservations, cancellations, confirmation-code check-in, timetable, and utilization views (`frontend/src/App.js`).
- Integrated Supabase email/password authentication and session-aware rendering (`frontend/src/hooks/useAuth.js`, `frontend/src/lib/supabase.js`, `App.js`).
- Implemented browser-side interval overlap detection for room reservations using start/end timestamp comparisons (`App.js:createBooking`).
- Added PostgreSQL booking constraints, foreign keys, status validation, unique confirmation codes, and active room-window indexing in the approved Supabase schema.
- Added Supabase RLS policies for authenticated room/timetable reads and owner-scoped booking creation/update.
- Loaded room and booking data concurrently with `Promise.all`.
- Added Express/Mongoose APIs for legacy classroom, staff, projector, lab, dashboard, and timetable operations.
- Added Vercel CRA build configuration with static-asset-aware SPA rewrites and manifest/cache headers (`vercel.json`).
- Added environment generation scripts for nested frontend deployment builds.

### Measured result

No performance, adoption, latency, test-coverage, or deployment-success metric was verified from the inspected codebase. Do not claim percentage improvements or production uptime.

### Qualitative improvement

- The project moved beyond a read-only classroom lookup concept by adding a reservation and check-in workflow.
- The frontend separates authentication, environment configuration, Supabase client access, service location, hooks, and UI state components, although most application composition remains in `App.js`.
- The UI provides loading, empty, success, and failure feedback for several user actions.

### Do not claim / insufficient evidence

- Do not claim QR-code check-in; the implemented flow uses manually entered confirmation codes.
- Do not claim atomic database-level overlap prevention; the inspected schema has an index but no exclusion constraint or transactional reservation RPC.
- Do not claim real-time occupancy; the UI updates after a user check-in but no Supabase Realtime subscription was verified.
- Do not claim a database-backed timetable UI; the current frontend timetable uses deterministic placeholder occupancy logic.
- Do not claim TypeScript; the inspected application uses JavaScript.
- Do not claim complete role-based admin authorization.
- Do not claim Chart.js dashboards unless actual usage is verified beyond the dependency manifest.
- Do not claim automated test coverage without test files/results.
- Do not claim a currently verified production deployment without running a live deployment/browser/asset check.

## 20. Interview-relevant technical topics

### Reservation interval semantics
- **Implemented:** Checks whether active bookings overlap a requested room interval.
- **Why needed:** Matching only start times would allow partial or containing overlaps.
- **Question:** How do you define and test interval collisions?
- **Detail:** `existingStart < requestedEnd && existingEnd > requestedStart`; adjacent intervals are allowed.

### Client validation versus database invariants
- **Implemented:** Browser checks end-after-start and local conflicts; Postgres checks timestamp validity and ownership.
- **Why needed:** UX validation is fast, but database constraints are the last line of integrity.
- **Question:** What happens when two users reserve simultaneously?
- **Detail:** The current implementation does not provide a verified atomic range lock/exclusion constraint, so this is a known tradeoff and improvement area.

### Supabase RLS ownership
- **Implemented:** Insert/update policies use `auth.uid()` and booking `user_id`.
- **Why needed:** Browser clients cannot be trusted to enforce ownership alone.
- **Question:** How does a browser mutation remain user-scoped?
- **Detail:** The database policy independently verifies the authenticated identity.

### Auth state lifecycle
- **Implemented:** Initial session load plus auth-state subscription in a reusable hook.
- **Why needed:** Prevents rendering protected operations before the session is known and reacts to sign-in/sign-out.
- **Question:** Why not just read the session once?
- **Detail:** Auth changes can occur after initial load, so subscription state is required.

### Dual persistence architecture
- **Implemented:** Supabase powers the current Northstar UI; Express/Mongoose/MongoDB supports legacy classroom APIs.
- **Why needed:** The repository contains an evolved system with separate current and legacy paths.
- **Question:** Would you keep both in a new production system?
- **Detail:** A consolidation plan would reduce operational ambiguity and make authorization, deployment, and source-of-truth behavior easier to reason about.

### Timezone handling
- **Implemented:** Date and time inputs are combined in the browser and serialized with `toISOString()`.
- **Why needed:** Supabase stores timestamps consistently.
- **Question:** What edge case exists for campuses in multiple time zones or daylight-saving transitions?
- **Detail:** The current implementation does not declare a campus timezone policy; this should be made explicit in a production redesign.

### Static SPA deployment
- **Implemented:** Vercel publishes CRA output and avoids rewriting known static asset paths to `index.html`.
- **Why needed:** Rewriting `/manifest.json` or JavaScript bundles to HTML causes `Unexpected token '<'` and CORS/manifest failures.
- **Question:** How would you diagnose a blank deployment?
- **Detail:** Check build root/output, inspect the deployed HTML and bundle status codes, verify manifest JSON/content type, and ensure fallback rewrites exclude assets.

## 21. Unknown / uncertain areas

- Current production deployment URL and live asset status are not independently verified in this document.
- Complete contents of `Classroom.js`, `ClassroomList.js`, and `Projector.js` were not reproduced here.
- The complete tail of `classrooms.js` was not inspected in this context; its endpoint inventory may be larger than the representative routes listed above.
- Whether the separate backend has a working production deployment is unknown.
- Whether Supabase email confirmation is enabled in the deployed project is unknown.
- Whether the current public deployment has Vercel Deployment Protection enabled is unknown.
- Whether all environment variables are configured in every Vercel environment is unknown.
- Automated test execution and coverage are not verified.
- The exact final CSS responsive breakpoints and accessibility audit results are not documented here.

## 22. Authoritative summary

Northstar Classroom Operations is a JavaScript React campus-room application backed by Supabase Auth/Postgres for its current reservation experience and a separate Express/MongoDB legacy classroom API. Its most defensible technical story is authenticated room booking with interval-overlap validation, relational constraints/RLS, confirmation-code check-in, concurrent initial data loading, and Vercel static deployment configuration. The strongest interview discussion should be honest about the important boundaries: overlap protection is currently partly client-side, check-in is code-based rather than QR-based, the timetable visualization is not fully data-backed, and the repository still contains two backend/data architectures.

This document intentionally distinguishes implemented behavior from intended or previously proposed functionality so it can be used as reliable source material for resumes, portfolio writing, and interviews.
