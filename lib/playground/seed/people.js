// The audience: ~420 deterministic guests who buy tickets, RSVP and turn up across Halcyon's
// events. Studio staff come from cast.js; these are the people outside the studio.

import { CLIENTS } from "../cast.js";
import { between, pick, weighted } from "./helpers.js";

const FIRST = [
  "Olivia", "Mateo", "Amara", "Lukas", "Inês", "Noah", "Zara", "Theo", "Leila", "Hugo",
  "Freya", "Rafael", "Nina", "Elias", "Chloe", "Diego", "Sana", "Felix", "Mia", "Tariq",
  "Clara", "Jonah", "Aisha", "Marco", "Ingrid", "Kofi", "Lena", "Omar", "Beatriz", "Sam",
  "Yuki", "Adrian", "Priyanka", "Callum", "Elena", "Malik", "Hannah", "Joao", "Saoirse", "Ethan",
  "Fatima", "Ruben", "Astrid", "Daniel", "Mei", "Oscar", "Laila", "Henrik", "Camila", "Isaac",
  "Rosa", "Kai", "Imogen", "Arjun", "Valentina", "Finn", "Noor", "Pablo", "Grace", "Emil",
];

const LAST = [
  "Almeida", "Brooks", "Castro", "Dubois", "Eriksen", "Fischer", "Garcia", "Hughes", "Ibrahim", "Jansen",
  "Kowalski", "Larsen", "Mendes", "Novak", "Okafor", "Pereira", "Quinn", "Romero", "Schmidt", "Tanaka",
  "Underwood", "Vasquez", "Walsh", "Xavier", "Yilmaz", "Zimmermann", "Adeyemi", "Bianchi", "Costa", "Delgado",
  "Evans", "Ferreira", "Gallagher", "Hoffmann", "Iversen", "Jovanovic", "Kim", "Lindqvist", "Moreira", "Nakamura",
  "O'Brien", "Petrov", "Rahman", "Silva", "Thompson", "Varga", "Wright", "Yamamoto", "Zhang", "Ahmed",
  "Bergström", "Carvalho", "Duarte", "Edwards", "Fontaine", "Grant", "Haddad", "Ito", "Jensen", "Keller",
  "Lopez", "Martins", "Nguyen", "Oliveira", "Patel", "Reyes", "Santos", "Torres", "Vieira", "Weiss",
];

const COMPANIES = [
  ...CLIENTS.map((c) => ({ name: c.name, domain: `${c.key}.example`, city: c.city })),
  { name: "Fieldnote Press", domain: "fieldnote.example", city: "London" },
  { name: "Brightwater Studio", domain: "brightwater.example", city: "Brooklyn" },
  { name: "Northbound Agency", domain: "northbound.example", city: "Berlin" },
  { name: "Pallet & Pine", domain: "palletpine.example", city: "Lisbon" },
  { name: "Lumio Labs", domain: "lumio.example", city: "Amsterdam" },
  { name: "Common Thread Co.", domain: "commonthread.example", city: "New York" },
  { name: "Saltwater Films", domain: "saltwater.example", city: "Barcelona" },
  { name: "Arcade Type Foundry", domain: "arcadetype.example", city: "Porto" },
  { name: "Moss & Marble", domain: "mossmarble.example", city: "Copenhagen" },
  { name: "Tidal Digital", domain: "tidal.example", city: "London" },
  { name: "Copperleaf", domain: "copperleaf.example", city: "Madrid" },
  { name: "Harbour Collective", domain: "harbour.example", city: "Lisbon" },
  { name: "Quietly Loud", domain: "quietlyloud.example", city: "Brooklyn" },
  { name: "Paperplane UX", domain: "paperplane.example", city: "Berlin" },
  { name: "Studio Ondas", domain: "ondas.example", city: "Lisbon" },
  { name: "Kinfolk Motion", domain: "kinfolkmotion.example", city: "Amsterdam" },
];

const TITLES = [
  "Brand Designer", "Creative Director", "Product Designer", "Marketing Manager", "Art Director",
  "Founder", "Motion Designer", "Head of Brand", "Design Lead", "Producer", "Copywriter",
  "UX Researcher", "Events Manager", "Strategist", "Illustrator", "Photographer", "Developer",
  "Community Lead", "Head of Marketing", "Design Student",
];

const CITY_BY_COUNTRY = [
  ["Lisbon", "Portugal"], ["Porto", "Portugal"], ["Brooklyn", "USA"], ["New York", "USA"],
  ["London", "United Kingdom"], ["Berlin", "Germany"], ["Amsterdam", "Netherlands"],
  ["Barcelona", "Spain"], ["Madrid", "Spain"], ["Paris", "France"], ["Copenhagen", "Denmark"],
];

function ascii(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();
}

function buildPeople(count) {
  const seen = new Set();
  const people = [];
  let i = 0;
  while (people.length < count) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7 + Math.floor(i / FIRST.length) * 3) % LAST.length];
    i += 1;
    const name = `${first} ${last}`;
    if (seen.has(name)) continue;
    seen.add(name);
    const n = people.length + 1;
    const freelance = noiseFlag(n);
    const company = freelance ? null : pick(COMPANIES, n * 13);
    const [city, country] = company
      ? [company.city, CITY_BY_COUNTRY.find(([c]) => c === company.city)?.[1] ?? "Portugal"]
      : pick(CITY_BY_COUNTRY, n * 5);
    const handle = `${ascii(first)}.${ascii(last)}`;
    people.push({
      n,
      name,
      first,
      last,
      email: company ? `${handle}@${company.domain}` : `${handle}${n % 7 === 0 ? n : ""}@mail.example`,
      phone: `+${pick(["351 91", "1 718", "44 7700", "49 151", "31 6", "34 6"], n * 3)}${String(between(n * 17, 1000000, 9999999))}`,
      company: company?.name ?? "",
      title: freelance ? weighted(n, [["Freelance Designer", 3], ["Design Student", 2], ["Illustrator", 1]]) : pick(TITLES, n * 11),
      city,
      country,
    });
  }
  return people;
}

function noiseFlag(n) {
  return n % 5 === 0;
}

export const GUESTS = buildPeople(420);

export function guest(n) {
  return GUESTS[(n - 1) % GUESTS.length];
}
