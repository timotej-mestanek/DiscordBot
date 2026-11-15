"use client";

import type { FormEvent } from "react";
import { useConfirm } from "./confirm-dialog-context";

export default function LogoutForm() {
  const confirm = useConfirm();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const confirmed = await confirm({
      title: "Log out?",
      message: "Are you sure you want to log out?",
      confirmLabel: "Log out",
      cancelLabel: "Stay signed in",
      danger: true,
    });

    if (confirmed) form.submit();
  }

  return (
    <form action="/api/logout" method="post" onSubmit={handleSubmit}>
      <button className="app-signout-button" type="submit">
        Logout
      </button>
    </form>
  );
}
