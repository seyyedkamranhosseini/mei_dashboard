CREATE TABLE `approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formType` enum('daily','concrete') NOT NULL,
	`formId` int NOT NULL,
	`adminId` int NOT NULL,
	`decision` enum('approved','rejected') NOT NULL,
	`comments` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `concrete_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,

	-- Project Information
	`permitNo` varchar(100) NOT NULL,
	`fileNo` varchar(100),
	`meiProjectNoName` varchar(255) NOT NULL,
	`contractor` varchar(255) NOT NULL,
	`subContractor` varchar(255),
	`buildingNo` varchar(100),
	`floorDeck` varchar(100),
	`other` varchar(100),
	`specificLocation` text,

	-- Placement Type (boolean flags)
	`footing` boolean NOT NULL DEFAULT false,
	`postTension` boolean NOT NULL DEFAULT false,
	`masonryWall` boolean NOT NULL DEFAULT false,
	`columns` boolean NOT NULL DEFAULT false,
	`walls` boolean NOT NULL DEFAULT false,
	`masonryColumns` boolean NOT NULL DEFAULT false,
	`slabOnGrade` boolean NOT NULL DEFAULT false,
	`beams` boolean NOT NULL DEFAULT false,
	`masonryPrisms` boolean NOT NULL DEFAULT false,

	-- Sample Information
	`supplier` varchar(255),
	`material` varchar(255),
	`sampledBy` varchar(255),
	`ticketNo` varchar(100),
	`dateSampled` datetime,
	`time` varchar(10),
	`loadNo` varchar(100),
	`dateReceived` datetime,
	`setNo` varchar(100),
	`truckNo` varchar(100),
	`weather` varchar(100),
	`mixDesignNo` varchar(100),
	`cementFactorSkCy` decimal(10,3),
	`maxSizeAggIn` decimal(10,3),
	`admixture` varchar(255),
	`specifiedStrengthPsi` int,

	-- Specified vs Measured
	`slumpInSpecified` decimal(6,2),
	`slumpInMeasured` decimal(6,2),
	`mixTempFSpecified` decimal(6,2),
	`mixTempFMeasured` decimal(6,2),
	`airTempFSpecified` decimal(6,2),
	`airTempFMeasured` decimal(6,2),
	`airContentSpecified` decimal(6,2),
	`airContentMeasured` decimal(6,2),

	-- Specimen Data (7 specimens stored as JSON rows)
	`specimens` json NOT NULL,

	-- Comments & Status
	`comments` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `concrete_tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_field_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,

	-- Job Information
	`jobNo` varchar(100) NOT NULL,
	`permitNo` varchar(100) NOT NULL,
	`irNo` varchar(100),
	`projectName` varchar(255) NOT NULL,
	`client` varchar(255) NOT NULL,
	`location` text NOT NULL,
	`contractor` varchar(255) NOT NULL,
	`reviewedBy` varchar(255),

	-- Date, Time & Weather
	`date` timestamp NOT NULL,
	`weather` varchar(100),

	-- Inspection Types
	`inspectionTypes` json NOT NULL,

	-- Conformance
	`workConformance` enum('met','not_met') NOT NULL,
	`workRequirements` enum('met','not_met') NOT NULL DEFAULT 'met',
	`materialSampling` enum('performed','not_performed') NOT NULL,

	-- Notes
	`notes` text,

	-- Status & Timestamps
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_field_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);
