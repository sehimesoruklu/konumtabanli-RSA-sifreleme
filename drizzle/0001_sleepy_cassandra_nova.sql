CREATE TABLE `location_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`label` varchar(255),
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`nModulusSummary` text,
	`publicExponent` varchar(32) DEFAULT '65537',
	`bitLength` int DEFAULT 2048,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `location_history_id` PRIMARY KEY(`id`)
);
