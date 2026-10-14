-- CreateTable
CREATE TABLE "Event" (
    "id" BIGSERIAL NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "method" TEXT,
    "status" INTEGER,
    "durationMs" INTEGER,
    "userId" TEXT,
    "anonId" TEXT,
    "certSlug" TEXT,
    "mode" TEXT,
    "domain" TEXT,
    "difficulty" TEXT,
    "search" TEXT,
    "country" TEXT,
    "device" TEXT,
    "referrerHost" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStat" (
    "day" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT '',
    "value" INTEGER NOT NULL,

    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("day","metric","dimension")
);

-- CreateIndex
CREATE INDEX "Event_ts_idx" ON "Event"("ts");

-- CreateIndex
CREATE INDEX "Event_type_ts_idx" ON "Event"("type", "ts");

-- CreateIndex
CREATE INDEX "Event_userId_ts_idx" ON "Event"("userId", "ts");

-- CreateIndex
CREATE INDEX "Event_path_ts_idx" ON "Event"("path", "ts");

-- CreateIndex
CREATE INDEX "DailyStat_metric_day_idx" ON "DailyStat"("metric", "day");

