type MutableEnv = Record<string, string | undefined>;

export function buildApiAuthHeaders(
  env: MutableEnv = process.env,
): Record<string, string> {
  const token = env.API_AUTH_TOKEN?.trim();

  return token ? { authorization: `Bearer ${token}` } : {};
}
