// Small country-name -> flag-emoji lookup for review author lines like
// "Conny – Netherlands". Not exhaustive — unknown countries just render
// without a flag, which is a harmless cosmetic gap, not a failure.
export const COUNTRY_FLAGS = {
  "Netherlands": "🇳🇱", "Germany": "🇩🇪", "Israel": "🇮🇱", "United Kingdom": "🇬🇧",
  "UK": "🇬🇧", "Lithuania": "🇱🇹", "France": "🇫🇷", "Spain": "🇪🇸", "Italy": "🇮🇹",
  "Portugal": "🇵🇹", "United States": "🇺🇸", "USA": "🇺🇸", "Belgium": "🇧🇪",
  "Switzerland": "🇨🇭", "Austria": "🇦🇹", "Sweden": "🇸🇪", "Norway": "🇳🇴",
  "Denmark": "🇩🇰", "Poland": "🇵🇱", "Ireland": "🇮🇪", "Canada": "🇨🇦",
  "Australia": "🇦🇺", "Brazil": "🇧🇷", "Finland": "🇫🇮", "Luxembourg": "🇱🇺",
  "Czech Republic": "🇨🇿", "Czechia": "🇨🇿", "Hungary": "🇭🇺", "Greece": "🇬🇷",
  "Slovenia": "🇸🇮", "Slovakia": "🇸🇰", "Croatia": "🇭🇷", "Romania": "🇷🇴",
  "Iceland": "🇮🇸", "New Zealand": "🇳🇿", "South Africa": "🇿🇦", "Mexico": "🇲🇽",
  "Japan": "🇯🇵", "South Korea": "🇰🇷", "India": "🇮🇳", "China": "🇨🇳",
  "Singapore": "🇸🇬", "United Arab Emirates": "🇦🇪", "Estonia": "🇪🇪",
  "Latvia": "🇱🇻", "Malta": "🇲🇹", "Cyprus": "🇨🇾", "Turkey": "🇹🇷",
};

export function flagFor(country) {
  if (!country) return "";
  return COUNTRY_FLAGS[country.trim()] || "";
}
