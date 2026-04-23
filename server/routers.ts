// @ts-nocheck
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { locationHistory } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  geo: router({
    /**
     * Konum geçmişine kaydet
     */
    saveLocation: publicProcedure
      .input(
        z.object({
          latitude: z.number(),
          longitude: z.number(),
          label: z.string().optional(),
          nModulusSummary: z.string().optional(),
          bitLength: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(locationHistory).values({
          userId: null,
          latitude: input.latitude,
          longitude: input.longitude,
          label: input.label ?? `Konum (${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)})`,
          nModulusSummary: input.nModulusSummary ?? null,
          bitLength: input.bitLength ?? 1024,
          publicExponent: "65537",
        });
        return { success: true };
      }),

    /**
     * Konum geçmişini listele (son 20 kayıt)
     */
    getHistory: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(locationHistory)
        .orderBy(desc(locationHistory.createdAt))
        .limit(20);
    }),

    /**
     * Konum geçmişinden sil
     */
    deleteLocation: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(locationHistory).where(eq(locationHistory.id, input.id));
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
