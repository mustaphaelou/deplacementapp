export interface VilleData {
  name: string
  region: string
}

export const REGIONS = [
  "Tanger-Tétouan-Al Hoceïma",
  "L'Oriental",
  "Fès-Meknès",
  "Rabat-Salé-Kénitra",
  "Béni Mellal-Khénifra",
  "Casablanca-Settat",
  "Marrakech-Safi",
  "Drâa-Tafilalet",
  "Souss-Massa",
  "Guelmim-Oued Noun",
  "Laâyoune-Sakia El Hamra",
  "Dakhla-Oued Ed Dahab",
] as const

export const MOROCCAN_CITIES: VilleData[] = [
  { name: "Tanger", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Tétouan", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Al Hoceïma", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Chefchaouen", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Larache", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Ksar El Kebir", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Ouezzane", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Fnideq", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Martil", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "M'diq", region: "Tanger-Tétouan-Al Hoceïma" },
  { name: "Asilah", region: "Tanger-Tétouan-Al Hoceïma" },

  { name: "Oujda", region: "L'Oriental" },
  { name: "Nador", region: "L'Oriental" },
  { name: "Berkane", region: "L'Oriental" },
  { name: "Taourirt", region: "L'Oriental" },
  { name: "Jerada", region: "L'Oriental" },
  { name: "Figuig", region: "L'Oriental" },
  { name: "Driouch", region: "L'Oriental" },
  { name: "Guercif", region: "L'Oriental" },
  { name: "Saidia", region: "L'Oriental" },
  { name: "Ahfir", region: "L'Oriental" },
  { name: "Zaïo", region: "L'Oriental" },
  { name: "El Aioun Sidi Mellouk", region: "L'Oriental" },

  { name: "Fès", region: "Fès-Meknès" },
  { name: "Meknès", region: "Fès-Meknès" },
  { name: "Taza", region: "Fès-Meknès" },
  { name: "Sefrou", region: "Fès-Meknès" },
  { name: "Moulay Idriss Zerhoun", region: "Fès-Meknès" },
  { name: "El Hajeb", region: "Fès-Meknès" },
  { name: "Ifrane", region: "Fès-Meknès" },
  { name: "Azrou", region: "Fès-Meknès" },
  { name: "Missour", region: "Fès-Meknès" },
  { name: "Oulad Tayeb", region: "Fès-Meknès" },
  { name: "Bhalil", region: "Fès-Meknès" },
  { name: "Ahermoumou", region: "Fès-Meknès" },

  { name: "Rabat", region: "Rabat-Salé-Kénitra" },
  { name: "Salé", region: "Rabat-Salé-Kénitra" },
  { name: "Kénitra", region: "Rabat-Salé-Kénitra" },
  { name: "Skhirat", region: "Rabat-Salé-Kénitra" },
  { name: "Témara", region: "Rabat-Salé-Kénitra" },
  { name: "Sidi Kacem", region: "Rabat-Salé-Kénitra" },
  { name: "Sidi Slimane", region: "Rabat-Salé-Kénitra" },
  { name: "Khémisset", region: "Rabat-Salé-Kénitra" },
  { name: "Rommani", region: "Rabat-Salé-Kénitra" },
  { name: "Maâziz", region: "Rabat-Salé-Kénitra" },

  { name: "Béni Mellal", region: "Béni Mellal-Khénifra" },
  { name: "Khénifra", region: "Béni Mellal-Khénifra" },
  { name: "Kasba Tadla", region: "Béni Mellal-Khénifra" },
  { name: "Fkih Ben Salah", region: "Béni Mellal-Khénifra" },
  { name: "Oued Zem", region: "Béni Mellal-Khénifra" },
  { name: "Azilal", region: "Béni Mellal-Khénifra" },
  { name: "Demnate", region: "Béni Mellal-Khénifra" },
  { name: "El Ksiba", region: "Béni Mellal-Khénifra" },
  { name: "Ouaouizeght", region: "Béni Mellal-Khénifra" },

  { name: "Casablanca", region: "Casablanca-Settat" },
  { name: "Settat", region: "Casablanca-Settat" },
  { name: "Mohammédia", region: "Casablanca-Settat" },
  { name: "El Jadida", region: "Casablanca-Settat" },
  { name: "Berrechid", region: "Casablanca-Settat" },
  { name: "Nouaceur", region: "Casablanca-Settat" },
  { name: "Médiouna", region: "Casablanca-Settat" },
  { name: "Bouskoura", region: "Casablanca-Settat" },
  { name: "Dar Bouazza", region: "Casablanca-Settat" },
  { name: "Sidi Bennour", region: "Casablanca-Settat" },
  { name: "Bir Jdid", region: "Casablanca-Settat" },
  { name: "Oulad Ziane", region: "Casablanca-Settat" },

  { name: "Marrakech", region: "Marrakech-Safi" },
  { name: "Safi", region: "Marrakech-Safi" },
  { name: "Essaouira", region: "Marrakech-Safi" },
  { name: "Chichaoua", region: "Marrakech-Safi" },
  { name: "El Kelâa des Sraghna", region: "Marrakech-Safi" },
  { name: "Youssoufia", region: "Marrakech-Safi" },
  { name: "Tahannaout", region: "Marrakech-Safi" },
  { name: "Aït Ourir", region: "Marrakech-Safi" },
  { name: "Amizmiz", region: "Marrakech-Safi" },
  { name: "Oualidia", region: "Marrakech-Safi" },
  { name: "Benguerir", region: "Marrakech-Safi" },

  { name: "Errachidia", region: "Drâa-Tafilalet" },
  { name: "Ouarzazate", region: "Drâa-Tafilalet" },
  { name: "Midelt", region: "Drâa-Tafilalet" },
  { name: "Tinghir", region: "Drâa-Tafilalet" },
  { name: "Zagora", region: "Drâa-Tafilalet" },
  { name: "Rissani", region: "Drâa-Tafilalet" },
  { name: "Boumalne Dades", region: "Drâa-Tafilalet" },
  { name: "Agdz", region: "Drâa-Tafilalet" },
  { name: "M'Hamid El Ghizlane", region: "Drâa-Tafilalet" },
  { name: "Goulmima", region: "Drâa-Tafilalet" },

  { name: "Agadir", region: "Souss-Massa" },
  { name: "Inezgane", region: "Souss-Massa" },
  { name: "Taroudant", region: "Souss-Massa" },
  { name: "Oulad Teïma", region: "Souss-Massa" },
  { name: "Tiznit", region: "Souss-Massa" },
  { name: "Taghazout", region: "Souss-Massa" },
  { name: "Aït Melloul", region: "Souss-Massa" },
  { name: "Biougra", region: "Souss-Massa" },
  { name: "Taliouine", region: "Souss-Massa" },
  { name: "Akka", region: "Souss-Massa" },
  { name: "Tata", region: "Souss-Massa" },
  { name: "Aït Baha", region: "Souss-Massa" },

  { name: "Guelmim", region: "Guelmim-Oued Noun" },
  { name: "Tan-Tan", region: "Guelmim-Oued Noun" },
  { name: "Sidi Ifni", region: "Guelmim-Oued Noun" },
  { name: "Assa", region: "Guelmim-Oued Noun" },
  { name: "Bouizakarne", region: "Guelmim-Oued Noun" },
  { name: "Taghjijt", region: "Guelmim-Oued Noun" },

  { name: "Laâyoune", region: "Laâyoune-Sakia El Hamra" },
  { name: "Boujdour", region: "Laâyoune-Sakia El Hamra" },
  { name: "Smara", region: "Laâyoune-Sakia El Hamra" },
  { name: "Tarfaya", region: "Laâyoune-Sakia El Hamra" },
  { name: "El Marsa", region: "Laâyoune-Sakia El Hamra" },

  { name: "Dakhla", region: "Dakhla-Oued Ed Dahab" },
  { name: "Aousserd", region: "Dakhla-Oued Ed Dahab" },
  { name: "Bir Anzarane", region: "Dakhla-Oued Ed Dahab" },
]

const cityNames = new Set(MOROCCAN_CITIES.map((c) => c.name))

export function isValidCity(name: string): boolean {
  return cityNames.has(name)
}

export function getCityRegion(name: string): string | undefined {
  return MOROCCAN_CITIES.find((c) => c.name === name)?.region
}
