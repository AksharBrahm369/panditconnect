"use client";
import { useRouter } from "next/navigation";
import { ProfileEditor } from "./profile-editor";
export function PanditProfileSettings() { const router = useRouter(); return <ProfileEditor role="PANDIT" onSaved={() => router.refresh()} />; }
