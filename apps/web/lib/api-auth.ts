import { getSessionToken } from "@/lib/session";

export async function buildApiAuthHeaders(): Promise<Record<string, string>> {
  const token = await getSessionToken();

  return token ? { authorization: `Bearer ${token}` } : {};
}
