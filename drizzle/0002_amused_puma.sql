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
