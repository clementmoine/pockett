-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "markets" TEXT NOT NULL,
    "input_type" TEXT NOT NULL,
    "expected_manual_input_character_set" TEXT NOT NULL,
    "searchTerms" TEXT NOT NULL,
    "default_barcode_format" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "provider_visuals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "logo_url" TEXT,
    "color" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    CONSTRAINT "provider_visuals_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "logo" TEXT,
    "color" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "country" TEXT,
    "provider_id" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cards_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_visuals_provider_id_key" ON "provider_visuals"("provider_id");
