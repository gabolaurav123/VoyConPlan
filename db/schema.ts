import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    plan: text('plan').notNull().default('Free'),
    role: text('role').notNull().default('user'),
    suspended: integer('suspended').notNull().default(0),
    profile: text('profile').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_users_email').on(t.email)],
);
export const trips = sqliteTable(
  'trips',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    data: text('data').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_trips_owner').on(t.ownerId)],
);
export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    preferences: text('preferences').notNull().default('{}'),
  },
  (t) => [
    index('idx_members_trip').on(t.tripId),
    index('idx_members_user').on(t.userId),
  ],
);
export const links = sqliteTable('share_links', {
  id: text('id').primaryKey(),
  tripId: text('trip_id')
    .notNull()
    .references(() => trips.id, { onDelete: 'cascade' }),
  hash: text('hash').notNull().unique(),
  kind: text('kind').notNull(),
  expiresAt: text('expires_at').notNull(),
  revoked: integer('revoked').notNull().default(0),
  claimedBy: text('claimed_by'),
  createdAt: text('created_at').notNull(),
});
export const destinations = sqliteTable('destinations', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  hidden: integer('hidden').notNull().default(0),
});
export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  price: integer('price').notNull(),
  tripLimit: integer('trip_limit').notNull(),
  collaborators: integer('collaborators').notNull(),
  features: text('features').notNull(),
});
export const usage = sqliteTable('usage', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  used: integer('used').notNull().default(0),
});
export const favorites = sqliteTable('favorites', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  destinationId: text('destination_id').notNull(),
});
export const content = sqliteTable('content', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const records = sqliteTable(
  'records',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    ownerId: text('owner_id'),
    data: text('data').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_records_kind').on(t.kind),
    index('idx_records_owner').on(t.ownerId),
  ],
);
export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    sessionId: text('session_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_events_date').on(t.createdAt)],
);
export const audit = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  createdAt: text('created_at').notNull(),
});
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
export const rateLimits = sqliteTable('rate_limits', {
  id: text('id').primaryKey(),
  count: integer('count').notNull(),
  expires: integer('expires').notNull(),
});
