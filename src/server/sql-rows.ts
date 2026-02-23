import prisma from "@/server/db";

export const queryRowsUnsafe = async <TRow>(
  query: string,
  ...values: unknown[]
): Promise<TRow[]> => {
  return (await prisma.$queryRawUnsafe(query, ...values)) as TRow[];
};
