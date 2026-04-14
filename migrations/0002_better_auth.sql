-- BetterAuth tables
CREATE TABLE IF NOT EXISTS `user` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `emailVerified` integer NOT NULL DEFAULT 0,
  `image` text,
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `user_email_idx` ON `user` (`email`);

CREATE TABLE IF NOT EXISTS `session` (
  `id` text PRIMARY KEY NOT NULL,
  `expiresAt` text NOT NULL,
  `token` text NOT NULL,
  `ipAddress` text,
  `userAgent` text,
  `userId` text NOT NULL REFERENCES `user`(`id`),
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `session_token_idx` ON `session` (`token`);

CREATE TABLE IF NOT EXISTS `account` (
  `id` text PRIMARY KEY NOT NULL,
  `accountId` text NOT NULL,
  `providerId` text NOT NULL,
  `userId` text NOT NULL REFERENCES `user`(`id`),
  `accessToken` text,
  `refreshToken` text,
  `idToken` text,
  `accessTokenExpiresAt` text,
  `refreshTokenExpiresAt` text,
  `scope` text,
  `password` text,
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `verification` (
  `id` text PRIMARY KEY NOT NULL,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expiresAt` text NOT NULL,
  `createdAt` text,
  `updatedAt` text
);
