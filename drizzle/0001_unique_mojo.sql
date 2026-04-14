CREATE TABLE `bom_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`part_name` text NOT NULL,
	`supplier` text NOT NULL,
	`url` text NOT NULL,
	`price` text,
	`confidence` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `build_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hub_type_id` text,
	`hub_tier_id` text,
	`sensor_tier_id` text,
	`qty` integer,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hub_tier_id`) REFERENCES `hub_tiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sensor_tier_id`) REFERENCES `sensor_tiers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`recommendation_made` integer DEFAULT 0 NOT NULL,
	`recommendation_applied` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `custom_build_parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`custom_build_id` integer NOT NULL,
	`part_type` text NOT NULL,
	`part_name` text NOT NULL,
	`part_description` text NOT NULL,
	`price` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`custom_build_id`) REFERENCES `custom_builds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `custom_builds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`hub_type_id` text NOT NULL,
	`sensor_qty` integer DEFAULT 4 NOT NULL,
	`total_price` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `persona_bundles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` text NOT NULL,
	`label` text NOT NULL,
	`hub_type_id` text NOT NULL,
	`hub_tier_id` text,
	`sensor_tier_id` text NOT NULL,
	`qty` integer NOT NULL,
	`reasoning` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hub_tier_id`) REFERENCES `hub_tiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sensor_tier_id`) REFERENCES `sensor_tiers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `persona_factors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`persona_id` text NOT NULL,
	`factor` text NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`importance` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `personas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tagline` text NOT NULL,
	`description` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `preselections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hub_type_id` text NOT NULL,
	`hub_tier_id` text,
	`sensor_tier_id` text NOT NULL,
	`source` text NOT NULL,
	`converted_to_save` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hub_tier_id`) REFERENCES `hub_tiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sensor_tier_id`) REFERENCES `sensor_tiers`(`id`) ON UPDATE no action ON DELETE no action
);
