import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  ownerUserId: integer('owner_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  legalName: text('legal_name').default('').notNull(),
  tradeName: text('trade_name').default('').notNull(),
  cnpj: text('cnpj').default('').notNull(),
  cnae: text('cnae').default('').notNull(),
  segment: text('segment').default('').notNull(),
  companySize: text('company_size').default('').notNull(),
  registrationStatus: text('registration_status').default('').notNull(),
  description: text('description').default('').notNull(),
  operationType: text('operation_type').default('both').notNull(), // physical | ecommerce | both
  address: text('address').default('').notNull(),
  city: text('city').default('').notNull(),
  state: text('state').default('').notNull(),
  latitude: text('latitude').default('').notNull(),
  longitude: text('longitude').default('').notNull(),
  placeId: text('place_id').default('').notNull(),
  phone: text('phone').default('').notNull(),
  commercialEmail: text('commercial_email').default('').notNull(),
  website: text('website').default('').notNull(),
  logoUrl: text('logo_url').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const companyUnits = pgTable('company_units', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  city: text('city').default('').notNull(),
  state: text('state').default('').notNull(),
  latitude: text('latitude').default('').notNull(),
  longitude: text('longitude').default('').notNull(),
  placeId: text('place_id').default('').notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companyMembers = pgTable('company_members', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').default('viewer').notNull(), // owner | admin | editor | viewer
  status: text('status').default('active').notNull(), // active | invited
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  planCode: text('plan_code').default('profissional').notNull(),
  billingCycle: text('billing_cycle').default('monthly').notNull(),
  status: text('status').default('trialing').notNull(),
  trialEndsAt: timestamp('trial_ends_at').notNull(),
  extraCompetitors: integer('extra_competitors').default(0).notNull(),
  extraUnits: integer('extra_units').default(0).notNull(),
  extraWhatsappPacks: integer('extra_whatsapp_packs').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const companyAssets = pgTable('company_assets', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  uploadedByUserId: integer('uploaded_by_user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  dataBase64: text('data_base64').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  categoryId: integer('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  description: text('description').default('').notNull(),
  sku: text('sku').default('').notNull(),
  priceCents: integer('price_cents').default(0).notNull(),
  acquisitionCostCents: integer('acquisition_cost_cents').default(0).notNull(),
  stockQty: integer('stock_qty').default(0).notNull(),
  soldUnits: integer('sold_units').default(0).notNull(),
  status: text('status').default('active').notNull(), // active | draft | archived
  imageUrl: text('image_url').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const integrations = pgTable('integrations', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  provider: text('provider').notNull(), // ifood | mercadolivre | olx | shopee | amazon | shopify | own_site | whatsapp_business
  connectionStatus: text('connection_status').default('disconnected').notNull(),
  accountLabel: text('account_label').default('').notNull(),
  storeUrl: text('store_url').default('').notNull(),
  lastSyncAt: timestamp('last_sync_at'),
  lastError: text('last_error').default('').notNull(),
  configJson: jsonb('config_json').default({}).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const dataImports = pgTable('data_imports', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  uploadedByUserId: integer('uploaded_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(), // csv | xlsx | pdf | image | manual
  sourceOrigin: text('source_origin').notNull(),
  reliabilityLevel: text('reliability_level').default('media').notNull(), // alta | media | baixa
  extractedRowsJson: jsonb('extracted_rows_json').default([]).notNull(),
  rowCount: integer('row_count').default(0).notNull(),
  summaryText: text('summary_text').default('').notNull(),
  insightsJson: jsonb('insights_json').default([]).notNull(),
  status: text('status').default('confirmed').notNull(), // preview | confirmed | discarded
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const internalMetrics = pgTable('internal_metrics', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  unitId: integer('unit_id').references(() => companyUnits.id, {
    onDelete: 'set null',
  }),
  periodDate: text('period_date').notNull(),
  revenueCents: integer('revenue_cents').default(0).notNull(),
  ordersCount: integer('orders_count').default(0).notNull(),
  avgTicketCents: integer('avg_ticket_cents').default(0).notNull(),
  grossMarginPct: text('gross_margin_pct').default('').notNull(),
  lossesCents: integer('losses_cents').default(0).notNull(),
  sourceOrigin: text('source_origin').default('manual').notNull(),
  reliabilityLevel: text('reliability_level').default('media').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const competitors = pgTable('competitors', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  segment: text('segment').default('').notNull(),
  positioning: text('positioning').default('').notNull(),
  announcedPriceRange: text('announced_price_range').default('').notNull(),
  shippingInfo: text('shipping_info').default('').notNull(),
  deliveryDays: text('delivery_days').default('').notNull(),
  publicRating: text('public_rating').default('').notNull(),
  complaintsNote: text('complaints_note').default('').notNull(),
  lastChangeNote: text('last_change_note').default('').notNull(),
  sourceUrl: text('source_url').default('').notNull(),
  channels: text('channels').default('').notNull(),
  priceComparison: text('price_comparison').default('').notNull(),
  threatLevel: text('threat_level').default('Impacto médio').notNull(),
  reviewSnippetsJson: jsonb('review_snippets_json').default([]).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const customerReviews = pgTable('customer_reviews', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  source: text('source').default('manual').notNull(), // google | reclame_aqui | marketplace | whatsapp_business | manual
  rating: integer('rating').default(5).notNull(),
  sentiment: text('sentiment').default('positivo').notNull(), // positivo | neutro | negativo
  commentText: text('comment_text').notNull(),
  authorLabel: text('author_label').default('Cliente').notNull(),
  hasLgpdConsent: boolean('has_lgpd_consent').default(true).notNull(),
  reviewedAt: text('reviewed_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const evidenceCards = pgTable('evidence_cards', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  moduleKey: text('module_key').notNull(),
  title: text('title').notNull(),
  externalFinding: text('external_finding').notNull(),
  internalDataUsed: text('internal_data_used').notNull(),
  source: text('source').notNull(),
  referenceDate: text('reference_date').notNull(),
  method: text('method').notNull(),
  scope: text('scope').notNull(),
  reliability: text('reliability').notNull(),
  limitations: text('limitations').notNull(),
  verificationNeeded: text('verification_needed').notNull(),
  crossQualityScore: integer('cross_quality_score').default(0).notNull(),
  hasSufficientEvidence: boolean('has_sufficient_evidence').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const strategicItems = pgTable('strategic_items', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  kind: text('kind').notNull(), // pestel | porter | swot | tows | decision | action_plan | opportunity
  category: text('category').default('').notNull(),
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  priority: text('priority').default('media').notNull(), // alta | media | baixa
  status: text('status').default('aberto').notNull(), // aberto | em_andamento | concluido
  impactNote: text('impact_note').default('').notNull(),
  dueDate: text('due_date').default('').notNull(),
  metadataJson: jsonb('metadata_json').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const simulations = pgTable('simulations', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  scenarioType: text('scenario_type').default('realista').notNull(), // pessimista | realista | otimista
  horizonDays: integer('horizon_days').default(90).notNull(), // 30 | 90 | 180
  assumptionsJson: jsonb('assumptions_json').default({}).notNull(),
  projectionsJson: jsonb('projections_json').default({}).notNull(),
  uncertaintyNote: text('uncertainty_note').default('').notNull(),
  hasSufficientData: boolean('has_sufficient_data').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  userEmail: text('user_email').default('').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').default('').notNull(),
  detailsJson: jsonb('details_json').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const lgpdRecords = pgTable('lgpd_records', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  recordType: text('record_type').notNull(), // consent | export_request | deletion_request
  status: text('status').default('active').notNull(),
  scope: text('scope').default('').notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const geoSavedEntities = pgTable('geo_saved_entities', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  entityKind: text('entity_kind').default('competitor').notNull(), // competitor | supplier | partner | client | expansion_target
  classification: text('classification').default('direct').notNull(), // direct | indirect | potential | strategic
  placeId: text('place_id').default('').notNull(),
  name: text('name').notNull(),
  address: text('address').default('').notNull(),
  city: text('city').default('').notNull(),
  state: text('state').default('').notNull(),
  latitude: text('latitude').default('').notNull(),
  longitude: text('longitude').default('').notNull(),
  distanceKm: text('distance_km').default('').notNull(),
  travelTimeText: text('travel_time_text').default('').notNull(),
  category: text('category').default('').notNull(),
  website: text('website').default('').notNull(),
  phone: text('phone').default('').notNull(),
  publicRating: text('public_rating').default('').notNull(),
  userRatingsTotal: integer('user_ratings_total').default(0).notNull(),
  priceLevel: text('price_level').default('').notNull(),
  openingHoursJson: jsonb('opening_hours_json').default([]).notNull(),
  sourceName: text('source_name').default('Google Places API (New)').notNull(),
  googleMapsUri: text('google_maps_uri').default('').notNull(),
  notes: text('notes').default('').notNull(),
  metadataJson: jsonb('metadata_json').default({}).notNull(),
  lastUpdatedAt: timestamp('last_updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const geoSearchLogs = pgTable('geo_search_logs', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  searchType: text('search_type').default('competitors').notNull(), // competitors | suppliers | expansion | territorial | monitor_refresh
  query: text('query').default('').notNull(),
  centerAddress: text('center_address').default('').notNull(),
  centerLat: text('center_lat').default('').notNull(),
  centerLng: text('center_lng').default('').notNull(),
  radiusKm: integer('radius_km').default(5).notNull(),
  resultsCount: integer('results_count').default(0).notNull(),
  filtersJson: jsonb('filters_json').default({}).notNull(),
  snapshotJson: jsonb('snapshot_json').default([]).notNull(),
  alertsSummary: text('alerts_summary').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const geoApiUsageLogs = pgTable('geo_api_usage_logs', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  provider: text('provider').notNull(), // google_places | google_geocoding | google_routes | osm_overpass | ibge | open_meteo | inmet | brasilapi
  endpoint: text('endpoint').default('').notNull(),
  cacheHit: boolean('cache_hit').default(false).notNull(),
  statusCode: integer('status_code').default(200).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companyReputationProfiles = pgTable('company_reputation_profiles', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  googlePlaceId: text('google_place_id').default('').notNull(),
  googlePlaceName: text('google_place_name').default('').notNull(),
  googleMapsUri: text('google_maps_uri').default('').notNull(),
  googleRating: text('google_rating').default('').notNull(),
  googleRatingsTotal: integer('google_ratings_total').default(0).notNull(),
  googleSyncStatus: text('google_sync_status').default('pending').notNull(), // pending | synced | not_found | unavailable
  googleSyncNote: text('google_sync_note').default('').notNull(),
  googleLastSyncedAt: timestamp('google_last_synced_at'),
  reclameAquiUrl: text('reclame_aqui_url').default('').notNull(),
  reclameAquiScore: text('reclame_aqui_score').default('').notNull(),
  reclameAquiStatusLabel: text('reclame_aqui_status_label').default('').notNull(),
  reclameAquiResponseRatePct: text('reclame_aqui_response_rate_pct').default('').notNull(),
  reclameAquiSolvedRatePct: text('reclame_aqui_solved_rate_pct').default('').notNull(),
  reclameAquiBackToBuyPct: text('reclame_aqui_back_to_buy_pct').default('').notNull(),
  reclameAquiComplaintsTotal: integer('reclame_aqui_complaints_total').default(0).notNull(),
  reclameAquiAnsweredTotal: integer('reclame_aqui_answered_total').default(0).notNull(),
  reclameAquiCaptureStatus: text('reclame_aqui_capture_status').default('idle').notNull(), // idle | captured | partial | unavailable
  reclameAquiCaptureNote: text('reclame_aqui_capture_note').default('').notNull(),
  reclameAquiLastSyncedAt: timestamp('reclame_aqui_last_synced_at'),
  aiDiagnosisJson: jsonb('ai_diagnosis_json').default({}).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const financialSalesRecords = pgTable('financial_sales_records', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  periodMonth: text('period_month').notNull(), // YYYY-MM
  categoryName: text('category_name').notNull(),
  productName: text('product_name').default('').notNull(),
  unitsSold: integer('units_sold').default(0).notNull(),
  unitPriceCents: integer('unit_price_cents').default(0).notNull(),
  unitCostCents: integer('unit_cost_cents').default(0).notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const financialCostRecords = pgTable('financial_cost_records', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  periodMonth: text('period_month').notNull(), // YYYY-MM
  categoryName: text('category_name').default('Geral').notNull(),
  cmvSourceMode: text('cmv_source_mode').default('auto_vendas').notNull(), // auto_vendas | manual
  cmvCents: integer('cmv_cents').default(0).notNull(),
  freightCents: integer('freight_cents').default(0).notNull(),
  packagingCents: integer('packaging_cents').default(0).notNull(),
  cardFeesCents: integer('card_fees_cents').default(0).notNull(),
  marketplaceFeesCents: integer('marketplace_fees_cents').default(0).notNull(),
  lossesDamagesCents: integer('losses_damages_cents').default(0).notNull(),
  otherVariableCostsCents: integer('other_variable_costs_cents').default(0).notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const financialExpenseRecords = pgTable('financial_expense_records', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  periodMonth: text('period_month').notNull(), // YYYY-MM
  costCenter: text('cost_center').default('Operação').notNull(),
  rentCents: integer('rent_cents').default(0).notNull(),
  payrollCents: integer('payroll_cents').default(0).notNull(),
  waterCents: integer('water_cents').default(0).notNull(),
  energyCents: integer('energy_cents').default(0).notNull(),
  internetCents: integer('internet_cents').default(0).notNull(),
  marketingCents: integer('marketing_cents').default(0).notNull(),
  accountingCents: integer('accounting_cents').default(0).notNull(),
  systemsCents: integer('systems_cents').default(0).notNull(),
  otherExpensesCents: integer('other_expenses_cents').default(0).notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const inventoryControlItems = pgTable('inventory_control_items', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  periodMonth: text('period_month').notNull(), // YYYY-MM
  categoryName: text('category_name').notNull(),
  sku: text('sku').default('').notNull(),
  itemName: text('item_name').notNull(),
  initialStock: integer('initial_stock').default(0).notNull(),
  purchasesQty: integer('purchases_qty').default(0).notNull(),
  salesQty: integer('sales_qty').default(0).notNull(),
  lossesQty: integer('losses_qty').default(0).notNull(),
  unitCostCents: integer('unit_cost_cents').default(0).notNull(),
  reorderPoint: integer('reorder_point').default(10).notNull(),
  periodDays: integer('period_days').default(30).notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const securityEvents = pgTable('security_events', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(), // WAF_BLOCK | SQLI_PROBE | XSS_PROBE | SSRF_ATTEMPT | PATH_TRAVERSAL | RATE_LIMIT | BOT_BLOCKED | AUTH_INVALID | TENANT_FORBIDDEN | UPLOAD_REJECTED | CSRF_MISMATCH | SCANNER_PROBE
  severity: text('severity').default('medium').notNull(), // low | medium | high | critical
  ipHash: text('ip_hash').default('').notNull(),
  method: text('method').default('').notNull(),
  path: text('path').default('').notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'set null' }),
  cfRay: text('cf_ray').default('').notNull(),
  cfCountry: text('cf_country').default('').notNull(),
  userAgent: text('user_agent').default('').notNull(),
  blocked: boolean('blocked').default(true).notNull(),
  detailsJson: jsonb('details_json').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const backupSnapshots = pgTable('backup_snapshots', {
  id: serial('id').primaryKey(),
  fileName: text('file_name').notNull(),
  triggerType: text('trigger_type').default('scheduled').notNull(), // scheduled | manual | company_export
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'set null' }),
  integritySha256: text('integrity_sha256').notNull(),
  sizeBytes: integer('size_bytes').default(0).notNull(),
  recordCountsJson: jsonb('record_counts_json').default({}).notNull(),
  status: text('status').default('verified').notNull(), // verified | failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const aiUsageLogs = pgTable('ai_usage_logs', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  module: text('module').default('gemeo_ai_chat').notNull(),
  model: text('model').default('gemini-4-hydrogen').notNull(),
  toolUsed: text('tool_used').default('general').notNull(),
  status: text('status').default('success').notNull(), // success | degraded | quota_exceeded | error
  latencyMs: integer('latency_ms').default(0).notNull(),
  inputChars: integer('input_chars').default(0).notNull(),
  outputChars: integer('output_chars').default(0).notNull(),
  errorCode: text('error_code').default('').notNull(),
  errorMessage: text('error_message').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const aiActionProposals = pgTable('ai_action_proposals', {
  id: serial('id').primaryKey(),
  proposalToken: text('proposal_token').notNull().unique(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  functionName: text('function_name').notNull(),
  title: text('title').notNull(),
  summary: text('summary').default('').notNull(),
  argsJson: jsonb('args_json').default({}).notNull(),
  status: text('status').default('pending').notNull(), // pending | executed | rejected | expired
  resultJson: jsonb('result_json').default({}).notNull(),
  approvedByUserId: integer('approved_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  expiresAt: timestamp('expires_at').notNull(),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  ownedCompanies: many(companies),
  memberships: many(companyMembers),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  owner: one(users, {
    fields: [companies.ownerUserId],
    references: [users.id],
  }),
  units: many(companyUnits),
  members: many(companyMembers),
  subscription: one(subscriptions),
  reputationProfile: one(companyReputationProfiles),
  categories: many(categories),
  products: many(products),
  integrations: many(integrations),
  competitors: many(competitors),
  customerReviews: many(customerReviews),
  evidenceCards: many(evidenceCards),
  strategicItems: many(strategicItems),
  simulations: many(simulations),
  auditLogs: many(auditLogs),
  lgpdRecords: many(lgpdRecords),
  geoSavedEntities: many(geoSavedEntities),
  geoSearchLogs: many(geoSearchLogs),
  geoApiUsageLogs: many(geoApiUsageLogs),
  financialSalesRecords: many(financialSalesRecords),
  financialCostRecords: many(financialCostRecords),
  financialExpenseRecords: many(financialExpenseRecords),
  inventoryControlItems: many(inventoryControlItems),
  aiUsageLogs: many(aiUsageLogs),
  aiActionProposals: many(aiActionProposals),
}));
