-- Initial schema: hub types, tiers, parts, sensors, configs, sessions, personas
CREATE TABLE IF NOT EXISTS `hub_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`badge` text NOT NULL,
	`badge_class` text NOT NULL,
	`description` text NOT NULL,
	`specs` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `hub_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`hub_type_id` text NOT NULL,
	`name` text NOT NULL,
	`badge` text NOT NULL,
	`badge_class` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`specs` text NOT NULL,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`)
);

CREATE TABLE IF NOT EXISTS `hub_tier_parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hub_tier_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`hub_tier_id`) REFERENCES `hub_tiers`(`id`)
);

CREATE TABLE IF NOT EXISTS `sensor_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`hub_type_id` text NOT NULL,
	`name` text NOT NULL,
	`badge` text NOT NULL,
	`badge_class` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`battery` text NOT NULL,
	`comm_range` text NOT NULL,
	`accent_color` text NOT NULL,
	`specs` text NOT NULL,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`)
);

CREATE TABLE IF NOT EXISTS `sensor_tier_parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sensor_tier_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`sensor_tier_id`) REFERENCES `sensor_tiers`(`id`)
);

CREATE TABLE IF NOT EXISTS `saved_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`hub_type_id` text NOT NULL,
	`hub_tier_id` text,
	`sensor_tier_id` text NOT NULL,
	`qty` integer DEFAULT 4 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`),
	FOREIGN KEY (`hub_tier_id`) REFERENCES `hub_tiers`(`id`),
	FOREIGN KEY (`sensor_tier_id`) REFERENCES `sensor_tiers`(`id`)
);

CREATE TABLE IF NOT EXISTS `bom_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`part_name` text NOT NULL,
	`supplier` text NOT NULL,
	`url` text NOT NULL,
	`price` text,
	`rating` integer,
	`confidence` text NOT NULL,
	`fetched_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `bom_selections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`build_key` text NOT NULL,
	`part_name` text NOT NULL,
	`selected_url` text NOT NULL,
	`selected_supplier` text,
	`selection_source` text NOT NULL,
	`filter_mode` text NOT NULL,
	`updated_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `build_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hub_type_id` text,
	`hub_tier_id` text,
	`sensor_tier_id` text,
	`qty` integer,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`),
	FOREIGN KEY (`hub_tier_id`) REFERENCES `hub_tiers`(`id`),
	FOREIGN KEY (`sensor_tier_id`) REFERENCES `sensor_tiers`(`id`)
);

CREATE TABLE IF NOT EXISTS `chat_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`recommendation_made` integer DEFAULT 0 NOT NULL,
	`recommendation_applied` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `custom_builds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`hub_type_id` text NOT NULL,
	`sensor_qty` integer DEFAULT 4 NOT NULL,
	`total_price` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`)
);

CREATE TABLE IF NOT EXISTS `custom_build_parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`custom_build_id` integer NOT NULL,
	`part_type` text NOT NULL,
	`part_name` text NOT NULL,
	`part_description` text NOT NULL,
	`price` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`custom_build_id`) REFERENCES `custom_builds`(`id`)
);

CREATE TABLE IF NOT EXISTS `personas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tagline` text NOT NULL,
	`description` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `persona_factors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` text NOT NULL,
	`factor` text NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`importance` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`)
);

CREATE TABLE IF NOT EXISTS `persona_bundles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` text NOT NULL,
	`label` text NOT NULL,
	`hub_type_id` text NOT NULL,
	`hub_tier_id` text,
	`sensor_tier_id` text NOT NULL,
	`qty` integer NOT NULL,
	`reasoning` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`),
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`),
	FOREIGN KEY (`hub_tier_id`) REFERENCES `hub_tiers`(`id`),
	FOREIGN KEY (`sensor_tier_id`) REFERENCES `sensor_tiers`(`id`)
);

CREATE TABLE IF NOT EXISTS `preselections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hub_type_id` text NOT NULL,
	`hub_tier_id` text,
	`sensor_tier_id` text NOT NULL,
	`source` text NOT NULL,
	`converted_to_save` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`),
	FOREIGN KEY (`hub_tier_id`) REFERENCES `hub_tiers`(`id`),
	FOREIGN KEY (`sensor_tier_id`) REFERENCES `sensor_tiers`(`id`)
);
