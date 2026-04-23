/**
 * resolveEntityId — Helper pour résoudre un ID qui peut être un UUID (uid) ou un ID numérique
 *
 * Le frontend peut envoyer soit un uid (UUID) soit un id numérique (String).
 * Ce helper construit la bonne condition Drizzle pour chercher dans les deux cas.
 */
import { eq, or } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";

/**
 * Retourne une condition Drizzle qui cherche par uid OU par id numérique.
 * @param uidColumn - La colonne uid (varchar UUID)
 * @param idColumn - La colonne id (int auto-increment)
 * @param value - La valeur à chercher (peut être un UUID ou un nombre sous forme de string)
 */
export function resolveEntityCondition(
  uidColumn: MySqlColumn,
  idColumn: MySqlColumn,
  value: string,
) {
  const isNumericId = /^\d+$/.test(value);
  if (isNumericId) {
    return or(eq(uidColumn, value), eq(idColumn, Number(value)));
  }
  return eq(uidColumn, value);
}
