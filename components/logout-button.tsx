"use client";

import { LogOut } from "lucide-react";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return <button type="button" className="settings-logout" onClick={() => void logout()}><LogOut size={17} /> Sign out</button>;
}
