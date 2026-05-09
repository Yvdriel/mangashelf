export interface TagContext {
  series: string;
  volume: number;
  page: number;
  date?: Date;
}

const TAG_VARIABLES = ["{series}", "{volume}", "{page}", "{date}"] as const;

export function expandTags(tags: string[], ctx: TagContext): string[] {
  const date = ctx.date ?? new Date();
  const iso = date.toISOString().slice(0, 10);
  const safe = (s: string) => s.replace(/\s+/g, "_");

  const replacements: Record<(typeof TAG_VARIABLES)[number], string> = {
    "{series}": safe(ctx.series),
    "{volume}": String(ctx.volume),
    "{page}": String(ctx.page),
    "{date}": iso,
  };

  return tags
    .map((tag) =>
      TAG_VARIABLES.reduce(
        (acc, key) => acc.split(key).join(replacements[key]),
        tag,
      ),
    )
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function listTagVariables(): readonly string[] {
  return TAG_VARIABLES;
}
