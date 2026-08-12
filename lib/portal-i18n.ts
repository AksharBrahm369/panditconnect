export type PortalCopy = {
  home: string; bookPandit: string; askOnline: string; myBookings: string;
  today: string; requests: string; chat: string; namaste: string; signedInAs: string;
  language: string;
};

const english: PortalCopy = { home:"Home",bookPandit:"Book Pandit",askOnline:"Ask online",myBookings:"My bookings",today:"Today",requests:"Requests",chat:"Chat",namaste:"Namaste",signedInAs:"Signed in as",language:"Language" };

export const PORTAL_TRANSLATIONS: Record<string, PortalCopy> = {
  English: english,
  Hindi: { home:"मुखपृष्ठ",bookPandit:"पंडित बुक करें",askOnline:"ऑनलाइन पूछें",myBookings:"मेरी बुकिंग",today:"आज",requests:"अनुरोध",chat:"चैट",namaste:"नमस्ते",signedInAs:"साइन इन",language:"भाषा" },
  Marathi: { home:"मुख्यपृष्ठ",bookPandit:"पंडित बुक करा",askOnline:"ऑनलाइन विचारा",myBookings:"माझ्या बुकिंग",today:"आज",requests:"विनंत्या",chat:"चॅट",namaste:"नमस्कार",signedInAs:"साइन इन",language:"भाषा" },
  Gujarati: { home:"મુખ્ય પૃષ્ઠ",bookPandit:"પંડિત બુક કરો",askOnline:"ઑનલાઇન પૂછો",myBookings:"મારી બુકિંગ",today:"આજે",requests:"વિનંતીઓ",chat:"ચેટ",namaste:"નમસ્તે",signedInAs:"સાઇન ઇન",language:"ભાષા" },
  Bengali: { home:"হোম",bookPandit:"পণ্ডিত বুক করুন",askOnline:"অনলাইনে জিজ্ঞাসা",myBookings:"আমার বুকিং",today:"আজ",requests:"অনুরোধ",chat:"চ্যাট",namaste:"নমস্কার",signedInAs:"সাইন ইন",language:"ভাষা" },
  Tamil: { home:"முகப்பு",bookPandit:"பண்டிதரை முன்பதிவு செய்க",askOnline:"ஆன்லைனில் கேளுங்கள்",myBookings:"எனது முன்பதிவுகள்",today:"இன்று",requests:"கோரிக்கைகள்",chat:"அரட்டை",namaste:"வணக்கம்",signedInAs:"உள்நுழைந்தவர்",language:"மொழி" },
  Telugu: { home:"హోమ్",bookPandit:"పండిత్‌ను బుక్ చేయండి",askOnline:"ఆన్‌లైన్‌లో అడగండి",myBookings:"నా బుకింగ్‌లు",today:"ఈ రోజు",requests:"అభ్యర్థనలు",chat:"చాట్",namaste:"నమస్కారం",signedInAs:"సైన్ ఇన్",language:"భాష" },
  Malayalam: { home:"ഹോം",bookPandit:"പണ്ഡിറ്റിനെ ബുക്ക് ചെയ്യുക",askOnline:"ഓൺലൈനിൽ ചോദിക്കുക",myBookings:"എന്റെ ബുക്കിംഗുകൾ",today:"ഇന്ന്",requests:"അഭ്യർത്ഥനകൾ",chat:"ചാറ്റ്",namaste:"നമസ്കാരം",signedInAs:"സൈൻ ഇൻ",language:"ഭാഷ" },
  Kannada: { home:"ಮುಖಪುಟ",bookPandit:"ಪಂಡಿತರನ್ನು ಬುಕ್ ಮಾಡಿ",askOnline:"ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಕೇಳಿ",myBookings:"ನನ್ನ ಬುಕಿಂಗ್‌ಗಳು",today:"ಇಂದು",requests:"ವಿನಂತಿಗಳು",chat:"ಚಾಟ್",namaste:"ನಮಸ್ಕಾರ",signedInAs:"ಸೈನ್ ಇನ್",language:"ಭಾಷೆ" },
  Punjabi: { home:"ਮੁੱਖ ਪੰਨਾ",bookPandit:"ਪੰਡਿਤ ਬੁੱਕ ਕਰੋ",askOnline:"ਆਨਲਾਈਨ ਪੁੱਛੋ",myBookings:"ਮੇਰੀਆਂ ਬੁਕਿੰਗਾਂ",today:"ਅੱਜ",requests:"ਬੇਨਤੀਆਂ",chat:"ਚੈਟ",namaste:"ਸਤ ਸ੍ਰੀ ਅਕਾਲ",signedInAs:"ਸਾਈਨ ਇਨ",language:"ਭਾਸ਼ਾ" },
  Odia: { home:"ମୁଖ୍ୟ ପୃଷ୍ଠା",bookPandit:"ପଣ୍ଡିତ ବୁକ୍ କରନ୍ତୁ",askOnline:"ଅନଲାଇନରେ ପଚାରନ୍ତୁ",myBookings:"ମୋ ବୁକିଂ",today:"ଆଜି",requests:"ଅନୁରୋଧ",chat:"ଚାଟ୍",namaste:"ନମସ୍କାର",signedInAs:"ସାଇନ୍ ଇନ୍",language:"ଭାଷା" },
  Urdu: { home:"ہوم",bookPandit:"پنڈت بک کریں",askOnline:"آن لائن پوچھیں",myBookings:"میری بکنگ",today:"آج",requests:"درخواستیں",chat:"چیٹ",namaste:"نمستے",signedInAs:"سائن ان",language:"زبان" },
};

export const portalCopy = (language: string) => PORTAL_TRANSLATIONS[language] ?? english;
