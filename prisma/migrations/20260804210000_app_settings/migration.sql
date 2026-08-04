-- Configuración global (preview minutes, etc.)
CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

INSERT INTO "AppSetting" ("key", "value", "updatedAt")
VALUES ('previewMinutes', '5', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
