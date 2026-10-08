# Karnataka Startup Fund Portal

A React frontend backed by a PostgreSQL API for startup registration, login, and fund transaction tracking.

## Setup

1. Create the database: `createdb ksfp_portal`
2. Apply the schema: `psql -d ksfp_portal -f database/schema.sql`
3. Copy `.env.example` to `.env` and set `DATABASE_URL`.
4. Install dependencies: `npm install`
5. Start the API: `npm run server`
6. Start the frontend: `npm run dev`

The project is separated into `frontend`, `backend`, `database`, and `shared` directories.

## Database rules

- User emails and CINs are unique.
- Emails, phone numbers, names, and CINs are required and validated.
- Passwords require at least 8 characters, one uppercase letter, and one special character.
- Transactions have a valid date, supported type, description, and positive amount.
- Transactions reference their user with a foreign key and cascade when the user is deleted.

## Security

Passwords use scrypt with a unique random salt. The application stores only hashed credentials in PostgreSQL and keeps the active session in browser session storage.
