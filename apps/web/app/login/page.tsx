import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const sessionToken = await getSessionToken();

  if (sessionToken) {
    redirect("/");
  }

  return (
    <main className="mx-auto grid w-[min(400px,calc(100vw-32px))] gap-6 py-20">
      <div className="grid gap-1.5 text-center">
        <h1 className="m-0 text-xl tracking-[-0.01em]">Pythia</h1>
        <p className="m-0 text-[0.9rem] text-muted-foreground">
          Sign in to your trading analyst dashboard
        </p>
      </div>

      <LoginForm />
    </main>
  );
}
