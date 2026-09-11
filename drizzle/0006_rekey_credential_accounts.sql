UPDATE "account" SET "accountId" = "userId" WHERE "providerId" = 'credential';--> statement-breakpoint
CREATE UNIQUE INDEX "account_providerId_accountId_unique" ON "account" USING btree ("providerId","accountId");
