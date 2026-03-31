CREATE TABLE `notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `recipientUserId` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `category` enum('submission','approval','rejection','system') NOT NULL DEFAULT 'system',
  `sourceFormType` enum('daily','concrete'),
  `sourceFormId` int,
  `readAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
