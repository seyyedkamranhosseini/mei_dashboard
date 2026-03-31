-- Migration: Add new fields to daily_field_reports and rebuild concrete_tests
-- Run this against your database BEFORE deploying the updated schema.ts / routers.ts

-- ─── daily_field_reports: add missing columns ─────────────────────────────────

ALTER TABLE `daily_field_reports`
  ADD COLUMN `irNo`               varchar(100)                                    AFTER `permitNo`,
  ADD COLUMN `reviewedBy`         varchar(255)                                    AFTER `contractor`,
  ADD COLUMN `time`               varchar(10)                                     AFTER `date`;

-- ─── concrete_tests: drop old table and recreate with new schema ──────────────
-- WARNING: This deletes all existing concrete test data.
-- If you have data to preserve, export it first.

DROP TABLE IF EXISTS `concrete_tests`;

CREATE TABLE `concrete_tests` (
  `id`                    int AUTO_INCREMENT NOT NULL,
  `userId`                int NOT NULL,

  -- Project Information
  `permitNo`              varchar(100) NOT NULL,
  `fileNo`                varchar(100),
  `meiProjectNoName`      varchar(255) NOT NULL,
  `contractor`            varchar(255) NOT NULL,
  `subContractor`         varchar(255),
  `buildingNo`            varchar(100),
  `floorDeck`             varchar(100),
  `other`                 varchar(100),
  `specificLocation`      text,

  -- Placement Type
  `footing`               boolean NOT NULL DEFAULT false,
  `postTension`           boolean NOT NULL DEFAULT false,
  `masonryWall`           boolean NOT NULL DEFAULT false,
  `columns`               boolean NOT NULL DEFAULT false,
  `walls`                 boolean NOT NULL DEFAULT false,
  `masonryColumns`        boolean NOT NULL DEFAULT false,
  `slabOnGrade`           boolean NOT NULL DEFAULT false,
  `beams`                 boolean NOT NULL DEFAULT false,
  `masonryPrisms`         boolean NOT NULL DEFAULT false,

  -- Sample Information
  `supplier`              varchar(255),
  `material`              varchar(255),
  `sampledBy`             varchar(255),
  `ticketNo`              varchar(100),
  `dateSampled`           timestamp NULL,
  `time`                  varchar(10),
  `loadNo`                varchar(100),
  `dateReceived`          timestamp NULL,
  `setNo`                 varchar(100),
  `truckNo`               varchar(100),
  `weather`               varchar(100),
  `mixDesignNo`           varchar(100),
  `cementFactorSkCy`      decimal(10,3),
  `maxSizeAggIn`          decimal(10,3),
  `admixture`             varchar(255),
  `specifiedStrengthPsi`  int,

  -- Specified vs Measured
  `slumpInSpecified`      decimal(6,2),
  `slumpInMeasured`       decimal(6,2),
  `mixTempFSpecified`     decimal(6,2),
  `mixTempFMeasured`      decimal(6,2),
  `airTempFSpecified`     decimal(6,2),
  `airTempFMeasured`      decimal(6,2),
  `airContentSpecified`   decimal(6,2),
  `airContentMeasured`    decimal(6,2),

  -- Specimen Data (7 specimens as JSON array)
  `specimens`             json NOT NULL,

  -- Comments & Status
  `comments`              text,
  `status`                enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `createdAt`             timestamp NOT NULL DEFAULT (now()),
  `updatedAt`             timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT `concrete_tests_id` PRIMARY KEY(`id`)
);
