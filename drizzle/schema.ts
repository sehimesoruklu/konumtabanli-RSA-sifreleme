import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, double, bigint } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Konum geçmişi tablosu
export const locationHistory = mysqlTable("location_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  label: varchar("label", { length: 255 }),
  latitude: double("latitude").notNull(),
  longitude: double("longitude").notNull(),
  // RSA parametrelerinin özeti (tam değerler büyük olduğu için kısaltılmış)
  nModulusSummary: text("nModulusSummary"),
  publicExponent: varchar("publicExponent", { length: 32 }).default("65537"),
  bitLength: int("bitLength").default(2048),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LocationHistory = typeof locationHistory.$inferSelect;
export type InsertLocationHistory = typeof locationHistory.$inferInsert;
