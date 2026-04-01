CREATE TABLE `hub_tier_parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hub_tier_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`hub_tier_id`) REFERENCES `hub_tiers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hub_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`hub_type_id` text NOT NULL,
	`name` text NOT NULL,
	`badge` text NOT NULL,
	`badge_class` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`specs` text NOT NULL,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hub_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`badge` text NOT NULL,
	`badge_class` text NOT NULL,
	`description` text NOT NULL,
	`specs` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`hub_type_id` text NOT NULL,
	`hub_tier_id` text,
	`sensor_tier_id` text NOT NULL,
	`qty` integer DEFAULT 4 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hub_tier_id`) REFERENCES `hub_tiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sensor_tier_id`) REFERENCES `sensor_tiers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sensor_tier_parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sensor_tier_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`sensor_tier_id`) REFERENCES `sensor_tiers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sensor_tiers` (
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
	FOREIGN KEY (`hub_type_id`) REFERENCES `hub_types`(`id`) ON UPDATE no action ON DELETE no action
);
