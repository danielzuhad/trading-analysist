import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const serviceHeartbeats = pgTable("service_heartbeats", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceName: text("service_name").notNull().unique(),
  status: text("status").notNull(),
  payload: jsonb("payload")
    .$type<Record<string, unknown> | null>()
    .default(null),
  checkedAt: timestamp("checked_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

export const schema = {
  serviceHeartbeats,
};
