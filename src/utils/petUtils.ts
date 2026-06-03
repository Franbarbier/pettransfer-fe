import type { PetRow } from "@/types/quote";

export const CUSTOM_CRATE_ID = "__custom_crate__";
export const CLIENT_CRATES_FIELD_KEY = "crate-client-provided";

export function emptyPet(): PetRow {
  return {
    id: crypto.randomUUID(),
    tipo: "",
    raza: "",
    nombre: "",
    crateId: "",
    customCrateSize: "",
    costo: "",
    hasCrate: false,
    crateRegistered: false,
  };
}

export function formatAnimalsLine(count: number, petsList: PetRow[]): string {
  if (count <= 0) return "—";
  const rows = petsList.slice(0, count);
  const parts = rows.map((p, i) => {
    const tipoLabel =
      p.tipo === "perro" ? "Dog" : p.tipo === "gato" ? "Cat" : "Pet";
    const name = p.nombre.trim() || `#${i + 1}`;
    const raza = p.raza.trim();
    const core = `${tipoLabel} · ${name}`;
    return raza ? `${core} (${raza})` : core;
  });
  return parts.join(" | ") || `${count} animal(s)`;
}

export function buildPetTypeLabel(petsList: PetRow[], count: number): string {
  const active = petsList.slice(0, count);
  const dogs = active.filter((p) => p.tipo === "perro").length;
  const cats = active.filter((p) => p.tipo === "gato").length;
  if (dogs > 0 && cats === 0) return dogs === 1 ? "dog" : "dogs";
  if (cats > 0 && dogs === 0) return cats === 1 ? "cat" : "cats";
  return count === 1 ? "pet" : "pets";
}
