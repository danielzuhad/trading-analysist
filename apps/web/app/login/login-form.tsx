"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LoginActionResult, loginAction } from "@/lib/auth-actions";

const labelClassName =
  "grid gap-1.5 text-[0.74rem] font-semibold tracking-widest text-muted-foreground uppercase";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<
    LoginActionResult | null,
    FormData
  >(loginAction, null);

  return (
    <form className="grid gap-3.5" action={formAction}>
      {state?.status === "error" ? (
        <p
          className="m-0 rounded-sm border border-down/30 bg-red-soft p-2.5 text-[0.9rem] font-semibold text-down"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <Label className={labelClassName}>
        Email
        <Input
          autoComplete="email"
          className="min-h-10 rounded-sm border-input bg-secondary normal-case"
          name="email"
          required
          type="email"
        />
      </Label>

      <Label className={labelClassName}>
        Password
        <Input
          autoComplete="current-password"
          className="min-h-10 rounded-sm border-input bg-secondary normal-case"
          name="password"
          required
          type="password"
        />
      </Label>

      <Button className="min-h-10" disabled={isPending} type="submit">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
