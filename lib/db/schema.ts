import { pgTable, text, integer, timestamp, boolean, jsonb, index, uniqueIndex, serial, primaryKey } from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from 'next-auth/adapters';

export const programs = pgTable(
  'programs',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    platform: text('platform').notNull(), // hackerone | bugcrowd | intigriti | yeswehack | federacy | hackenproof | selfhosted
    name: text('name').notNull(),
    handle: text('handle'), // platform-specific handle, e.g. h1 "shopify"
    url: text('url').notNull(),
    programType: text('program_type').notNull().default('bounty'), // bounty | vdp | private
    offersBounty: boolean('offers_bounty').notNull().default(false),
    offersSwag: boolean('offers_swag').notNull().default(false),
    managed: boolean('managed').notNull().default(false),
    minBounty: integer('min_bounty'),
    maxBounty: integer('max_bounty'),
    currency: text('currency').default('USD'),
    submissionState: text('submission_state'), // open | paused | closed
    safeHarbor: text('safe_harbor'), // full | partial | none | null (unknown). Populated where source exposes it (Bugcrowd today).
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    raw: jsonb('raw'), // original record from source for debugging
    searchText: text('search_text'), // denormalized text for FTS; tsvector generated via SQL
  },
  (t) => ({
    slugPlatformUq: uniqueIndex('programs_slug_platform_uq').on(t.platform, t.slug),
    platformIdx: index('programs_platform_idx').on(t.platform),
    firstSeenIdx: index('programs_first_seen_idx').on(t.firstSeenAt),
  }),
);

export const scopes = pgTable(
  'scopes',
  {
    id: serial('id').primaryKey(),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    identifier: text('identifier').notNull(), // e.g. *.shopify.com, com.shopify.app, github.com/org/repo
    assetType: text('asset_type').notNull(), // url | wildcard | android | ios | api | source_code | hardware | smart_contract | other
    inScope: boolean('in_scope').notNull().default(true),
    eligibleForBounty: boolean('eligible_for_bounty').notNull().default(true),
    severity: text('severity'), // critical | high | medium | low | none
    instruction: text('instruction'),
  },
  (t) => ({
    programIdx: index('scopes_program_idx').on(t.programId),
    identifierIdx: index('scopes_identifier_idx').on(t.identifier),
    assetTypeIdx: index('scopes_asset_type_idx').on(t.assetType),
  }),
);

export const sources = pgTable('sources', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(), // 'bounty-targets-data', 'hackerone-api', etc.
  url: text('url').notNull(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  lastStatus: text('last_status'), // ok | error
  lastError: text('last_error'),
});

export const ingestRuns = pgTable('ingest_runs', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull().default('running'), // running | ok | error
  programsUpserted: integer('programs_upserted').default(0),
  scopesUpserted: integer('scopes_upserted').default(0),
  error: text('error'),
});

export const programSnapshots = pgTable(
  'program_snapshots',
  {
    id: serial('id').primaryKey(),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    ingestRunId: integer('ingest_run_id').references(() => ingestRuns.id, { onDelete: 'set null' }),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    contentHash: text('content_hash').notNull(),
    payload: jsonb('payload').notNull(),
  },
  (t) => ({
    programCapturedIdx: index('program_snapshots_program_captured_idx').on(t.programId, t.capturedAt),
    programHashIdx: index('program_snapshots_program_hash_idx').on(t.programId, t.contentHash),
  }),
);

// --- Auth.js v5 tables (Drizzle adapter shape) ---
// User rows are created on first OAuth sign-in via @auth/drizzle-adapter.
// See https://authjs.dev/getting-started/adapters/drizzle for the required shape.

export const users = pgTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date', withTimezone: true }),
  image: text('image'),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

// --- Per-user state (cross-device sync for watchlist + compare) ---

export const userWatchlist = pgTable(
  'user_watchlist',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.programId] }),
    userIdx: index('user_watchlist_user_idx').on(t.userId),
  }),
);

export const userCompare = pgTable(
  'user_compare',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    programId: integer('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.programId] }),
    userIdx: index('user_compare_user_idx').on(t.userId),
  }),
);

export type Program = typeof programs.$inferSelect;
export type NewProgram = typeof programs.$inferInsert;
export type Scope = typeof scopes.$inferSelect;
export type NewScope = typeof scopes.$inferInsert;
export type ProgramSnapshot = typeof programSnapshots.$inferSelect;
export type NewProgramSnapshot = typeof programSnapshots.$inferInsert;
export type User = typeof users.$inferSelect;
