-- Payment durability: idempotency, per-step state log, webhook deduplication

-- Add idempotency and lifecycle fields to Payment
ALTER TABLE "Payment"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "expiresAt"      TIMESTAMP(3),
  ADD COLUMN "emailAttempts"  INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateTable: PaymentEvent — immutable log of every status transition
CREATE TABLE "PaymentEvent" (
    "id"         TEXT NOT NULL,
    "paymentId"  TEXT NOT NULL,
    "fromStatus" "PaymentStatus",
    "toStatus"   "PaymentStatus" NOT NULL,
    "source"     TEXT NOT NULL,
    "metadata"   JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");
CREATE INDEX "PaymentEvent_createdAt_idx" ON "PaymentEvent"("createdAt");

ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: WebhookEvent — deduplicates Razorpay webhook retries
CREATE TABLE "WebhookEvent" (
    "id"              TEXT NOT NULL,
    "razorpayEventId" TEXT,
    "eventType"       TEXT NOT NULL,
    "orderId"         TEXT,
    "processed"       BOOLEAN NOT NULL DEFAULT false,
    "processedAt"     TIMESTAMP(3),
    "error"           TEXT,
    "payload"         JSONB NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookEvent_razorpayEventId_key" ON "WebhookEvent"("razorpayEventId");
CREATE INDEX "WebhookEvent_orderId_idx" ON "WebhookEvent"("orderId");
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");
