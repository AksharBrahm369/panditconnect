export type RequestType = "PANDIT_SOS" | "NEED_GUIDANCE" | "KNOWN_PUJA" | "SCHEDULED_PUJA";

export type RitualRecommendation = {
  serviceId: string;
  title: string;
  reason: string;
  checklist: string[];
};

const recommendations: Record<string, Omit<RitualRecommendation, "serviceId">> = {
  "ganesh-puja": {
    title: "Ganesh Puja",
    reason: "A suitable starting ritual for new beginnings, important work and removing initial obstacles.",
    checklist: ["Clean Puja space", "Photo or murti of Lord Ganesh", "Flowers and fruits", "Diya, kumkum and rice"],
  },
  "griha-pravesh": {
    title: "Griha Pravesh",
    reason: "Traditionally performed when entering or beginning life in a new home.",
    checklist: ["Confirm the new-home address", "Keep the main entrance clean", "Kalash and coconut", "Ask the Pandit about regional customs"],
  },
  satyanarayan: {
    title: "Satyanarayan Puja",
    reason: "Often chosen for family wellbeing, gratitude and important family occasions.",
    checklist: ["Prepare a clean family seating area", "Fruits and flowers", "Prasad ingredients", "Keep family members available for the katha"],
  },
  "lakshmi-puja": {
    title: "Lakshmi Puja",
    reason: "Commonly chosen for a new business, prosperity, Diwali or financial wellbeing.",
    checklist: ["Clean the business or home entrance", "Account book or business item", "Flowers and diya", "Coins or symbolic offering"],
  },
  havan: {
    title: "Havan / Homam",
    reason: "A fire ritual commonly requested for purification, peace and a spiritually focused atmosphere.",
    checklist: ["Choose a ventilated safe space", "Keep water nearby", "Confirm whether a havan kund is available", "Ask if the Pandit should bring samagri"],
  },
  "shraddha-puja": {
    title: "Shraddha / Ancestor Ritual",
    reason: "For a recent bereavement or remembrance ceremony. The correct rite and date depend on the tithi, time since passing and your family tradition, so the Pandit will confirm these details before booking.",
    checklist: ["Keep the date of passing ready", "Share your relationship to the departed", "Mention your family tradition or native place", "Wait for the Pandit to confirm the tithi and materials"],
  },
};

export function ritualForService(serviceId: string): RitualRecommendation {
  const recommendation = recommendations[serviceId] ?? recommendations["ganesh-puja"];
  return { serviceId: recommendations[serviceId] ? serviceId : "ganesh-puja", ...recommendation };
}

export function recommendRitual(situation: string): RitualRecommendation {
  const value = situation.toLowerCase();
  const isBereavement = /\b(die|died|death|dead|passed away|passing away|expired|demise|funeral|bereavement|mourning|shraddh?a?|shraadh|pind\s?daan|pitru|pitra|barsi|terahvi|tervi|antim sanskar|asthi)\b/.test(value);
  if (isBereavement) {
    const isRecent = /\b(last month|one month|1 month|recent|recently|few weeks?|this month|monthly|masik|maasik)\b/.test(value);
    const recommendation = ritualForService("shraddha-puja");
    return isRecent
      ? {
          ...recommendation,
          title: "Masik Shraddha / Ancestor Ritual",
          reason: "Because you mentioned a death last month, your family may need Masik Shraddha or a related ancestor ritual. The exact ceremony and date depend on the date of passing, tithi and family tradition; the matched Pandit will confirm them before you book.",
        }
      : recommendation;
  }
  if (/(new home|new house|griha|house warming|shift|moving|vastu)/.test(value)) {
    return ritualForService("griha-pravesh");
  }
  if (/(business|shop|office|diwali|money|prosper|wealth|finance)/.test(value)) {
    return ritualForService("lakshmi-puja");
  }
  if (/(birthday|anniversary|family|gratitude|katha|wellbeing|well-being)/.test(value)) {
    return ritualForService("satyanarayan");
  }
  if (/(purif|peace|negative|health|illness|havan|homam|shanti)/.test(value)) {
    return ritualForService("havan");
  }
  return ritualForService("ganesh-puja");
}
