import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { notifyUser } from "@/lib/push-notifications";

export async function POST() {
  try {
    const user = await requireUser();
    const delivery = await notifyUser(user.id, { title: "PanditConnect test alert", body: "Notifications and sound are connected on this device.", url: user.role === "PANDIT" ? "/pandit" : user.role === "ADMIN" ? "/admin" : "/customer", eventType: "TEST_ALERT" });
    return NextResponse.json({ success: true, delivery });
  } catch (error) { return authorizationResponse(error) ?? NextResponse.json({ error: "Unable to send test alert" }, { status: 500 }); }
}
