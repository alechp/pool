import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const hubTypes = sqliteTable('hub_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  badge: text('badge').notNull(),
  badgeClass: text('badge_class').notNull(),
  description: text('description').notNull(),
  specs: text('specs').notNull(),
});

export const hubTiers = sqliteTable('hub_tiers', {
  id: text('id').primaryKey(),
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  name: text('name').notNull(),
  badge: text('badge').notNull(),
  badgeClass: text('badge_class').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  specs: text('specs').notNull(),
});

export const hubTierParts = sqliteTable('hub_tier_parts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hubTierId: text('hub_tier_id').notNull().references(() => hubTiers.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const sensorTiers = sqliteTable('sensor_tiers', {
  id: text('id').primaryKey(),
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  name: text('name').notNull(),
  badge: text('badge').notNull(),
  badgeClass: text('badge_class').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  battery: text('battery').notNull(),
  commRange: text('comm_range').notNull(),
  accentColor: text('accent_color').notNull(),
  specs: text('specs').notNull(),
});

export const sensorTierParts = sqliteTable('sensor_tier_parts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sensorTierId: text('sensor_tier_id').notNull().references(() => sensorTiers.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const savedConfigs = sqliteTable('saved_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  hubTierId: text('hub_tier_id').references(() => hubTiers.id),
  sensorTierId: text('sensor_tier_id').notNull().references(() => sensorTiers.id),
  qty: integer('qty').notNull().default(4),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Custom builds (granular part selection)
export const customBuilds = sqliteTable('custom_builds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  sensorQty: integer('sensor_qty').notNull().default(4),
  totalPrice: integer('total_price').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const customBuildParts = sqliteTable('custom_build_parts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customBuildId: integer('custom_build_id').notNull().references(() => customBuilds.id),
  partType: text('part_type').notNull(),
  partName: text('part_name').notNull(),
  partDescription: text('part_description').notNull(),
  price: integer('price').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

// BOM purchase links (AI-generated, cached)
export const bomLinks = sqliteTable('bom_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  partName: text('part_name').notNull(),
  supplier: text('supplier').notNull(),
  url: text('url').notNull(),
  price: text('price'),
  confidence: text('confidence').notNull(),
  fetchedAt: text('fetched_at').notNull(),
});

export const bomSelections = sqliteTable('bom_selections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  buildKey: text('build_key').notNull(),
  partName: text('part_name').notNull(),
  selectedUrl: text('selected_url').notNull(),
  selectedSupplier: text('selected_supplier'),
  selectionSource: text('selection_source').notNull(),
  filterMode: text('filter_mode').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Build session tracking
export const buildSessions = sqliteTable('build_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hubTypeId: text('hub_type_id').references(() => hubTypes.id),
  hubTierId: text('hub_tier_id').references(() => hubTiers.id),
  sensorTierId: text('sensor_tier_id').references(() => sensorTiers.id),
  qty: integer('qty'),
  status: text('status').notNull(),
  source: text('source').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Preselection tracking (pricing table → build clicks)
export const preselections = sqliteTable('preselections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  hubTierId: text('hub_tier_id').references(() => hubTiers.id),
  sensorTierId: text('sensor_tier_id').notNull().references(() => sensorTiers.id),
  source: text('source').notNull(),
  convertedToSave: integer('converted_to_save').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

// AI chat session tracking
export const chatSessions = sqliteTable('chat_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageCount: integer('message_count').notNull().default(0),
  recommendationMade: integer('recommendation_made').notNull().default(0),
  recommendationApplied: integer('recommendation_applied').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Personas
export const personas = sqliteTable('personas', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const personaFactors = sqliteTable('persona_factors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  personaId: text('persona_id').notNull().references(() => personas.id),
  factor: text('factor').notNull(),
  label: text('label').notNull(),
  value: text('value').notNull(),
  importance: text('importance').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const personaBundles = sqliteTable('persona_bundles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  personaId: text('persona_id').notNull().references(() => personas.id),
  label: text('label').notNull(),
  hubTypeId: text('hub_type_id').notNull().references(() => hubTypes.id),
  hubTierId: text('hub_tier_id').references(() => hubTiers.id),
  sensorTierId: text('sensor_tier_id').notNull().references(() => sensorTiers.id),
  qty: integer('qty').notNull(),
  reasoning: text('reasoning').notNull(),
  sortOrder: integer('sort_order').notNull(),
});
