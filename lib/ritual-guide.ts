export type RequestType = "PANDIT_SOS" | "NEED_GUIDANCE" | "KNOWN_PUJA";

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
};

export function ritualForService(serviceId: string): RitualRecommendation {
  const recommendation = recommendations[serviceId] ?? recommendations["ganesh-puja"];
  return { serviceId: recommendations[serviceId] ? serviceId : "ganesh-puja", ...recommendation };
}

export function recommendRitual(situation: string): RitualRecommendation {
  const value = situation.toLowerCase();
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
