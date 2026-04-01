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
