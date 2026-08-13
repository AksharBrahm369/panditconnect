export type PujaPreparation = {
  title: string;
  essentials: string[];
  optional: string[];
  confirmation: string;
};

const preparation: Record<string, PujaPreparation> = {
  "ganesh-puja": {
    title: "Ganesh Puja samagri",
    essentials: ["Lord Ganesh murti or picture", "Clean red or yellow cloth", "Kalash, clean water, mango leaves and coconut", "Diya, oil or ghee, cotton wicks and matchbox", "Kumkum, turmeric, sandalwood paste and akshat", "Fresh flowers, durva grass, fruits and modak or another satvik sweet", "Incense, camphor, betel leaves, betel nuts and dakshina"],
    optional: ["Panchamrit ingredients", "Sacred thread", "Small bell and Puja thali"],
    confirmation: "The Pandit may adjust the list for your family tradition and the form of Ganesh Puja being performed.",
  },
  "griha-pravesh": {
    title: "Griha Pravesh samagri",
    essentials: ["Kalash, clean water, mango leaves and coconut", "Turmeric, kumkum, sandalwood paste, akshat and flowers", "Diya, ghee or oil, cotton wicks, incense and camphor", "Fresh fruits, sweets, betel leaves, betel nuts and dakshina", "Milk for the traditional first boiling, plus a clean new vessel", "Havan kund, dry wood, havan samagri and ghee if Havan is included", "House keys and a clean cloth for the entrance"],
    optional: ["Panchamrit ingredients", "Navadhanya", "Vastu or regional items requested by the Pandit"],
    confirmation: "Griha Pravesh muhurta and Vastu steps depend on location, property orientation, tradition and sometimes owner details. The matched Pandit must confirm them before the visit.",
  },
  satyanarayan: {
    title: "Satyanarayan Puja samagri",
    essentials: ["Lord Satyanarayan or Vishnu picture or murti", "Clean yellow cloth and Puja chowki", "Kalash, clean water, mango leaves and coconut", "Tulsi leaves, flowers, fruits and bananas", "Diya, ghee or oil, incense and camphor", "Turmeric, kumkum, sandalwood paste, akshat and sacred thread", "Ingredients for sheera or halwa prasad, plus betel leaves, betel nuts and dakshina"],
    optional: ["Panchamrit ingredients", "Banana leaves or stems for decoration", "Satyanarayan Katha book"],
    confirmation: "Confirm the number of Katha participants, prasad quantity and local family customs with the Pandit.",
  },
  "lakshmi-puja": {
    title: "Lakshmi Puja samagri",
    essentials: ["Lakshmi and Ganesh picture or murti", "Clean red cloth and Puja chowki", "Kalash, water, mango leaves and coconut", "Lotus or other fresh flowers, fruits and sweets", "Diya, ghee or oil, cotton wicks, incense and camphor", "Kumkum, turmeric, sandalwood paste, akshat and coins", "Betel leaves, betel nuts, account book or business item and dakshina"],
    optional: ["Sri Yantra", "Panchamrit ingredients", "New broom or regional Diwali items"],
    confirmation: "Diwali, business-opening and household Lakshmi Pujas use different sequences; the Pandit will confirm the exact list.",
  },
  havan: {
    title: "Havan / Homam samagri",
    essentials: ["Fire-safe havan kund and heat-resistant base", "Dry havan wood or samidha", "Havan samagri and pure ghee", "Camphor, matchbox and a long safe spoon", "Kalash with water, flowers, fruits and akshat", "Kumkum, turmeric, sandalwood paste, incense and dakshina", "Water bucket or extinguisher kept nearby for safety"],
    optional: ["Navagraha samagri", "Specific herbs or offerings requested by the Pandit", "Floor covering and ventilation fan"],
    confirmation: "Only perform a fire ritual in a ventilated, fire-safe place and follow building rules. The Pandit must confirm the Havan type and offerings.",
  },
  "shraddha-puja": {
    title: "Shraddha / ancestor ritual samagri",
    essentials: ["Date, time and place of passing, if known", "Black sesame seeds and darbha or kusha grass", "Rice or barley flour as instructed for pinda", "Clean water vessel, spoon and simple white cloth", "Seasonal satvik food ingredients and fruits", "Flowers, diya, incense and dakshina", "Names and gotra details available to the family"],
    optional: ["Additional items required by your regional tradition", "Food or donation arrangements advised by the Pandit"],
    confirmation: "Do not rely on a generic date for Shraddha. The correct tithi, rite and samagri depend on the passing details, annual or monthly observance, region and family tradition; a qualified Pandit must confirm them.",
  },
};

export function pujaPreparation(serviceId: string) {
  return preparation[serviceId] ?? preparation["ganesh-puja"];
}
