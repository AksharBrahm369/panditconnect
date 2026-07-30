import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      services: [
        { id: "ganesh-puja", name: "Ganesh Puja", description: "Auspicious worship for new beginnings.", base_price: 1100, duration_minutes: 45 },
        { id: "lakshmi-puja", name: "Lakshmi Puja", description: "Worship for prosperity and harmony.", base_price: 1600, duration_minutes: 60 },
        { id: "satyanarayan", name: "Satyanarayan Puja", description: "Complete katha and puja for family wellbeing.", base_price: 2100, duration_minutes: 75 },
        { id: "havan", name: "Havan / Homam", description: "Sacred fire ritual for purification.", base_price: 2500, duration_minutes: 75 },
        { id: "griha-pravesh", name: "Griha Pravesh", description: "Traditional ceremony for entering a new home.", base_price: 3100, duration_minutes: 90 },
      ],
    },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } },
  );
}
