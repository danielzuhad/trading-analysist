import { createApiToken, createUser } from "../src/users.js";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: bun run scripts/create-admin.ts <email> <password>");
    process.exit(1);
  }

  const user = await createUser({
    email,
    password,
    role: "admin",
  });
  const { token } = await createApiToken(user.id);

  console.log(`Created admin user ${user.id} (${user.email}).`);
  console.log(`API token (save this now, it will not be shown again):`);
  console.log(token);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
