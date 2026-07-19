import { pgTable, text, integer, timestamp, boolean, jsonb, index, uniqueIndex, serial } from 'drizzle-orm/pg-core';

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

export type Program = typeof programs.$inferSelect;
export type NewProgram = typeof programs.$inferInsert;
export type Scope = typeof scopes.$inferSelect;
export type NewScope = typeof scopes.$inferInsert;
export type ProgramSnapshot = typeof programSnapshots.$inferSelect;
export type NewProgramSnapshot = typeof programSnapshots.$inferInsert;
