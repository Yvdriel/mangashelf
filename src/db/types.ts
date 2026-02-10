import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { manga, volume, readingProgress } from "./schema";

export type Manga = InferSelectModel<typeof manga>;
export type NewManga = InferInsertModel<typeof manga>;
export type Volume = InferSelectModel<typeof volume>;
export type NewVolume = InferInsertModel<typeof volume>;
export type ReadingProgress = InferSelectModel<typeof readingProgress>;
