import type { Suitability } from "../types";

export type IngredientKnowledge = {
  name: string;
  aliases: string[];
  category: "Tierisch" | "Zusatzstoff" | "Unklar" | "Pflanzlich";
  status: Suitability;
  why: string;
};

export const ingredients: IngredientKnowledge[] = [
  {
    name: "Agar-Agar",
    aliases: ["E406"],
    category: "Pflanzlich",
    status: "vegan",
    why: "Pflanzliches Geliermittel aus Algen und üblicherweise vegan.",
  },
  {
    name: "Albumin",
    aliases: ["Eiklar", "Eiweiß"],
    category: "Tierisch",
    status: "not_suitable",
    why: "Protein, das häufig aus Hühnerei gewonnen wird.",
  },
  {
    name: "Bienenwachs",
    aliases: ["E901", "Cera alba"],
    category: "Tierisch",
    status: "not_suitable",
    why: "Wird von Honigbienen erzeugt und ist nicht vegan.",
  },
  {
    name: "Butterreinfett",
    aliases: ["Butterschmalz", "Ghee"],
    category: "Tierisch",
    status: "not_suitable",
    why: "Konzentriertes Milchfett und daher nicht vegan.",
  },
  {
    name: "Carnaubawachs",
    aliases: ["E903"],
    category: "Pflanzlich",
    status: "vegan",
    why: "Wachs aus Blättern der Carnaubapalme.",
  },
  {
    name: "Casein",
    aliases: ["Kasein", "Milchprotein"],
    category: "Tierisch",
    status: "not_suitable",
    why: "Milcheiweiß und deshalb nicht vegan.",
  },
  {
    name: "Carmine",
    aliases: ["Karmin", "E120", "Cochenille"],
    category: "Tierisch",
    status: "not_suitable",
    why: "Roter Farbstoff aus Schildläusen.",
  },
  {
    name: "Chitosan",
    aliases: [],
    category: "Unklar",
    status: "unclear",
    why: "Oft aus Schalentieren, teilweise inzwischen aus Pilzen. Quelle prüfen.",
  },
  {
    name: "Cystein",
    aliases: ["L-Cystein", "E920"],
    category: "Unklar",
    status: "unclear",
    why: "Kann fermentativ oder aus tierischen Rohstoffen hergestellt werden.",
  },
  {
    name: "E471",
    aliases: ["Mono- und Diglyceride von Speisefettsäuren"],
    category: "Unklar",
    status: "unclear",
    why: "Die Fettsäuren können pflanzlichen oder tierischen Ursprungs sein.",
  },
  {
    name: "E472",
    aliases: ["Speisefettsäureester"],
    category: "Unklar",
    status: "unclear",
    why: "Ohne Herstellerangabe ist die Herkunft der Fettsäuren nicht sicher.",
  },
  {
    name: "Gelatine",
    aliases: ["Speisegelatine"],
    category: "Tierisch",
    status: "not_suitable",
    why: "Tierisches Geliermittel aus Kollagen; weder vegan noch vegetarisch.",
  },
  {
    name: "Glycerin",
    aliases: ["Glycerol", "E422"],
    category: "Unklar",
    status: "unclear",
    why: "Kann pflanzlich, synthetisch oder tierisch hergestellt werden.",
  },
  {
    name: "Honig",
    aliases: [],
    category: "Tierisch",
    status: "not_suitable",
    why: "Wird von Bienen erzeugt und ist nicht vegan.",
  },
  {
    name: "Inosinmonophosphat",
    aliases: ["E631"],
    category: "Unklar",
    status: "unclear",
    why: "Geschmacksverstärker, der tierisch oder fermentativ hergestellt sein kann.",
  },
  {
    name: "Isinglass",
    aliases: ["Hausenblase"],
    category: "Tierisch",
    status: "not_suitable",
    why: "Fischkollagen zur Klärung von Getränken.",
  },
  {
    name: "Knochenkohle",
    aliases: ["Bone char"],
    category: "Tierisch",
    status: "not_suitable",
    why: "Kann bei der Raffination von Zucker eingesetzt werden; in der EU selten.",
  },
  {
    name: "Lanolin",
    aliases: ["Wollwachs", "E913"],
    category: "Tierisch",
    status: "not_suitable",
    why: "Wachs aus Schafwolle und daher nicht vegan.",
  },
  {
    name: "Lecithin",
    aliases: ["E322"],
    category: "Unklar",
    status: "unclear",
    why: "Meist aus Soja oder Sonnenblumen, gelegentlich aus Ei. Allergenhinweis prüfen.",
  },
  {
    name: "Milchsäure",
    aliases: ["E270"],
    category: "Unklar",
    status: "unclear",
    why: "Meist mikrobiell hergestellt und vegan; das Nährmedium kann unklar sein.",
  },
  {
    name: "Molke",
    aliases: ["Whey", "Süßmolkenpulver"],
    category: "Tierisch",
    status: "not_suitable",
    why: "Milchbestandteil und deshalb nicht vegan.",
  },
  {
    name: "Omega-3",
    aliases: ["DHA", "EPA"],
    category: "Unklar",
    status: "unclear",
    why: "Kann aus Fischöl oder vegan aus Mikroalgen stammen.",
  },
  {
    name: "Pektin",
    aliases: ["E440"],
    category: "Pflanzlich",
    status: "vegan",
    why: "Geliermittel aus pflanzlichen Zellwänden, häufig aus Äpfeln oder Zitrusfrüchten.",
  },
  {
    name: "Pepsin",
    aliases: [],
    category: "Tierisch",
    status: "not_suitable",
    why: "Enzym, das traditionell aus Tiermägen gewonnen wird.",
  },
  {
    name: "Schellack",
    aliases: ["E904"],
    category: "Tierisch",
    status: "not_suitable",
    why: "Sekret der Lackschildlaus und deshalb nicht vegan.",
  },
  {
    name: "Squalen",
    aliases: ["Squalane"],
    category: "Unklar",
    status: "unclear",
    why: "Kann aus Oliven, Zuckerrohr oder Haifischleber stammen.",
  },
  {
    name: "Stearinsäure",
    aliases: ["E570"],
    category: "Unklar",
    status: "unclear",
    why: "Kann pflanzlichen oder tierischen Ursprungs sein.",
  },
  {
    name: "Vitamin D3",
    aliases: ["Cholecalciferol"],
    category: "Unklar",
    status: "unclear",
    why: "Oft aus Lanolin; vegane Varianten werden aus Flechten gewonnen.",
  },
  {
    name: "Worcestersauce",
    aliases: ["Worcestershire Sauce"],
    category: "Unklar",
    status: "unclear",
    why: "Traditionelle Rezepturen enthalten Sardellen, vegane Varianten existieren.",
  },
  {
    name: "Xanthan",
    aliases: ["E415"],
    category: "Pflanzlich",
    status: "vegan",
    why: "Mikrobiell erzeugtes Verdickungsmittel, üblicherweise vegan.",
  },
];

export type TravelGuide = {
  code: string;
  dishes: string[];
  warnings: string[];
  phrases: { de: string; local: string }[];
  tip: string;
};

export type TravelQuestion = {
  topic: string;
  de: string;
  local: string;
};

const questionTranslations: Record<string, string[]> = {
  de: [
    "Enthält dieses Gericht Milch oder Sahne?",
    "Enthält es Butter oder Butterschmalz?",
    "Ist Käse oder Parmesan enthalten?",
    "Enthält es Ei oder Mayonnaise?",
    "Wurde Fleisch-, Fisch- oder Hühnerbrühe verwendet?",
    "Können Sie es ohne diese Zutaten zubereiten?",
  ],
  it: [
    "Questo piatto contiene latte o panna?",
    "Contiene burro o burro chiarificato?",
    "Contiene formaggio o parmigiano?",
    "Contiene uova o maionese?",
    "È stato usato brodo di carne, pesce o pollo?",
    "Può prepararlo senza questi ingredienti?",
  ],
  es: [
    "¿Este plato contiene leche o nata?",
    "¿Contiene mantequilla o manteca?",
    "¿Contiene queso o parmesano?",
    "¿Contiene huevo o mayonesa?",
    "¿Han usado caldo de carne, pescado o pollo?",
    "¿Puede prepararlo sin estos ingredientes?",
  ],
  fr: [
    "Ce plat contient-il du lait ou de la crème ?",
    "Contient-il du beurre ?",
    "Contient-il du fromage ou du parmesan ?",
    "Contient-il des œufs ou de la mayonnaise ?",
    "Avez-vous utilisé un bouillon de viande, de poisson ou de poulet ?",
    "Pouvez-vous le préparer sans ces ingrédients ?",
  ],
  en: [
    "Does this dish contain milk or cream?",
    "Does it contain butter or ghee?",
    "Does it contain cheese or parmesan?",
    "Does it contain egg or mayonnaise?",
    "Was meat, fish or chicken stock used?",
    "Can you prepare it without these ingredients?",
  ],
  el: [
    "Περιέχει αυτό το πιάτο γάλα ή κρέμα;",
    "Περιέχει βούτυρο;",
    "Περιέχει τυρί ή παρμεζάνα;",
    "Περιέχει αυγό ή μαγιονέζα;",
    "Χρησιμοποιήθηκε ζωμός κρέατος, ψαριού ή κοτόπουλου;",
    "Μπορείτε να το ετοιμάσετε χωρίς αυτά;",
  ],
  tr: [
    "Bu yemekte süt veya krema var mı?",
    "Tereyağı veya sade yağ var mı?",
    "Peynir veya parmesan var mı?",
    "Yumurta veya mayonez var mı?",
    "Et, balık veya tavuk suyu kullanıldı mı?",
    "Bunlar olmadan hazırlayabilir misiniz?",
  ],
  hi: [
    "क्या इस व्यंजन में दूध या क्रीम है?",
    "क्या इसमें घी या मक्खन है?",
    "क्या इसमें पनीर या चीज़ है?",
    "क्या इसमें अंडा या मेयोनेज़ है?",
    "क्या मांस, मछली या चिकन का शोरबा इस्तेमाल हुआ है?",
    "क्या इसे इन चीज़ों के बिना बना सकते हैं?",
  ],
  th: [
    "อาหารจานนี้มีนมหรือครีมหรือไม่?",
    "มีเนยหรือกีหรือไม่?",
    "มีชีสหรือพาร์เมซานหรือไม่?",
    "มีไข่หรือมายองเนสหรือไม่?",
    "ใช้น้ำสต๊อกเนื้อ ปลา หรือไก่หรือไม่?",
    "ทำโดยไม่ใส่ส่วนผสมเหล่านี้ได้ไหม?",
  ],
  vi: [
    "Món này có sữa hoặc kem không?",
    "Có bơ hoặc bơ tinh khiết không?",
    "Có phô mai hoặc parmesan không?",
    "Có trứng hoặc sốt mayonnaise không?",
    "Có dùng nước hầm thịt, cá hoặc gà không?",
    "Có thể làm món này không có các nguyên liệu đó không?",
  ],
  ja: [
    "この料理に牛乳やクリームは入っていますか？",
    "バターやギーは入っていますか？",
    "チーズやパルメザンは入っていますか？",
    "卵やマヨネーズは入っていますか？",
    "肉・魚・鶏のだしを使っていますか？",
    "これらを抜いて作れますか？",
  ],
};

const guideLanguages: Record<string, keyof typeof questionTranslations> = {
  DE: "de",
  AT: "de",
  CH: "de",
  IT: "it",
  ES: "es",
  MX: "es",
  FR: "fr",
  GB: "en",
  US: "en",
  IN: "hi",
  GR: "el",
  TR: "tr",
  TH: "th",
  VN: "vi",
  JP: "ja",
};

const questionTopics = [
  "Milch/Sahne",
  "Butter/Ghee",
  "Käse/Parmesan",
  "Ei/Mayonnaise",
  "Tierische Brühe",
  "Ohne zubereiten",
];
const germanQuestions = questionTranslations.de ?? [];

export function getTravelQuestions(code: string): TravelQuestion[] {
  const language = guideLanguages[code];
  if (!language) return [];
  const local = questionTranslations[language] ?? germanQuestions;
  return questionTopics.map((topic, index) => ({
    topic,
    de: germanQuestions[index] ?? topic,
    local: local[index] ?? germanQuestions[index] ?? topic,
  }));
}

export const travelGuides: TravelGuide[] = [
  {
    code: "DE",
    dishes: ["Kartoffelsalat ohne Mayo", "Gemüseeintopf", "Brezel ohne Butter"],
    warnings: ["Speck und Fleischbrühe", "Butter in Beilagen"],
    phrases: [
      { de: "Ist das vollständig vegan?", local: "Ist das vollständig vegan?" },
      {
        de: "Bitte ohne Butter und Käse.",
        local: "Bitte ohne Butter und Käse.",
      },
    ],
    tip: "Auf V-Label und Zutaten bei Backwaren achten.",
  },
  {
    code: "AT",
    dishes: ["Gemüsestrudel ohne Ei", "Erdäpfelgulasch"],
    warnings: ["Schmalz", "Rindsuppe", "Ei im Teig"],
    phrases: [{ de: "Ist das vegan?", local: "Ist das vegan?" }],
    tip: "Auch scheinbar pflanzliche Suppen können Rindsuppe enthalten.",
  },
  {
    code: "CH",
    dishes: ["Rösti ohne Butter", "Gemüsegerichte"],
    warnings: ["Käse", "Butter", "Rahm"],
    phrases: [
      { de: "Ohne Milchprodukte, bitte.", local: "Ohne Milchprodukte, bitte." },
    ],
    tip: "Bei Rösti nach Butter und Käse fragen.",
  },
  {
    code: "IT",
    dishes: ["Pasta all’arrabbiata", "Pizza marinara", "Pasta aglio e olio"],
    warnings: ["Parmesan", "Ei in frischer Pasta", "Fleischfond"],
    phrases: [
      { de: "Ist das vegan?", local: "È vegano?" },
      { de: "Ohne Käse, bitte.", local: "Senza formaggio, per favore." },
    ],
    tip: "Getrocknete Pasta ist meist ohne Ei; frische Pasta häufig nicht.",
  },
  {
    code: "ES",
    dishes: ["Pan con tomate", "Pimientos de padrón", "Gazpacho"],
    warnings: ["Fleischbrühe in Reis", "Thunfisch", "Ei in Aioli"],
    phrases: [
      { de: "Ist das vegan?", local: "¿Es vegano?" },
      { de: "Ohne Käse und Ei.", local: "Sin queso ni huevo, por favor." },
    ],
    tip: "‚Vegetal‘ bedeutet nicht automatisch vegan.",
  },
  {
    code: "FR",
    dishes: ["Ratatouille", "Salade de lentilles"],
    warnings: ["Butter", "Sahne", "Fleischfond"],
    phrases: [
      { de: "Ist das vegan?", local: "Est-ce végétalien ?" },
      { de: "Ohne Butter, bitte.", local: "Sans beurre, s’il vous plaît." },
    ],
    tip: "‚Végétarien‘ erlaubt Milch und Ei; frage nach ‚végétalien‘.",
  },
  {
    code: "GB",
    dishes: ["Baked beans on toast", "Vegetable curry", "Vegan pie"],
    warnings: ["Butter", "Worcestersauce", "Fisch in Chips-Frittieröl"],
    phrases: [
      { de: "Ist das vegan?", local: "Is this fully vegan?" },
      { de: "Wurde es getrennt frittiert?", local: "Is it fried separately?" },
    ],
    tip: "Vegane Kennzeichnung ist weit verbreitet, Kreuzkontamination trotzdem erfragen.",
  },
  {
    code: "GR",
    dishes: ["Fava", "Dolmadakia", "Gigantes"],
    warnings: ["Feta", "Honig", "Fleischbrühe"],
    phrases: [{ de: "Ohne Käse, bitte.", local: "Χωρίς τυρί, παρακαλώ." }],
    tip: "‚Nistisimo‘ bezeichnet oft fastende und damit pflanzliche Gerichte, kann aber Meeresfrüchte einschließen.",
  },
  {
    code: "TR",
    dishes: ["Mercimek çorbası", "İmam bayıldı", "Çiğ köfte ohne Fleisch"],
    warnings: ["Butter", "Joghurt", "Fleischbrühe"],
    phrases: [
      {
        de: "Enthält es Fleisch oder Milch?",
        local: "Et veya süt içeriyor mu?",
      },
    ],
    tip: "Bei Suppen immer nach Brühe und Butter fragen.",
  },
  {
    code: "IN",
    dishes: ["Chana masala", "Dal", "Aloo gobi", "Dosa"],
    warnings: ["Ghee", "Paneer", "Joghurt"],
    phrases: [
      {
        de: "Bitte ohne Ghee und Milchprodukte.",
        local: "Bina ghee aur dairy ke, please.",
      },
    ],
    tip: "‚Pure veg‘ ist vegetarisch, nicht automatisch vegan.",
  },
  {
    code: "TH",
    dishes: ["Pad pak", "Tom yum ohne Fischsauce", "Mango sticky rice"],
    warnings: ["Fischsauce", "Austernsauce", "Garnelenpaste", "Ei"],
    phrases: [
      { de: "Ohne Fischsauce und Ei.", local: "Mai sai nam pla lae khai." },
    ],
    tip: "‚Jay‘ kennzeichnet streng pflanzliche buddhistische Küche.",
  },
  {
    code: "VN",
    dishes: ["Phở chay", "Gỏi cuốn chay", "Bánh mì chay"],
    warnings: ["Fischsauce", "Fleischbrühe", "Ei-Mayonnaise"],
    phrases: [{ de: "Ich esse vegan.", local: "Tôi ăn chay thuần." }],
    tip: "‚Chay‘ ist vegetarisch; konkret nach Ei und Milch fragen.",
  },
  {
    code: "JP",
    dishes: ["Kappa maki", "Edamame", "Tofu-Gerichte"],
    warnings: ["Dashi-Fischbrühe", "Bonitoflocken", "Ei"],
    phrases: [
      { de: "Ohne Fischbrühe, bitte.", local: "Dashi nashi de onegaishimasu." },
    ],
    tip: "Auch Gemüsegerichte enthalten häufig Dashi.",
  },
  {
    code: "MX",
    dishes: ["Tacos de nopales", "Frijoles", "Guacamole"],
    warnings: ["Schmalz in Bohnen", "Käse", "Hühnerbrühe"],
    phrases: [
      {
        de: "Ohne Schmalz und Käse.",
        local: "Sin manteca ni queso, por favor.",
      },
    ],
    tip: "Bei Bohnen und Reis nach Schmalz beziehungsweise Brühe fragen.",
  },
  {
    code: "US",
    dishes: ["Veggie burger", "Bean burrito", "Salad bowls"],
    warnings: ["Käse", "Ei in Saucen", "Honig"],
    phrases: [
      { de: "Ist das komplett vegan?", local: "Is this completely vegan?" },
    ],
    tip: "‚Plant-based‘ kann je nach Betrieb tierische Zusätze oder gemeinsame Zubereitung einschließen.",
  },
];
