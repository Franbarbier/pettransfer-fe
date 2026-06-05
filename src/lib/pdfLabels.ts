export type PdfLang = "es" | "en";

type LabelSet = {
  customer: string;
  customerAgent: string;
  origin: string;
  destination: string;
  quotationDate: string;
  tripDate: string;
  notConfirmed: string;
  pets: string;
  itemsDescription: string;
  amount: string;
  total: string;
  conditionsOfContract: string;
  page: (n: number) => string;
  months: readonly string[];
};

export const PDF_LABELS: Record<PdfLang, LabelSet> = {
  en: {
    customer: "Customer",
    customerAgent: "Customer — Agent",
    origin: "Origin",
    destination: "Destination",
    quotationDate: "Quotation date",
    tripDate: "Trip date",
    notConfirmed: "Not confirmed",
    pets: "Pets",
    itemsDescription: "Items — Description",
    amount: "Amount",
    total: "Total",
    conditionsOfContract: "Conditions of contract",
    page: (n) => `Page ${n}`,
    months: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  },
  es: {
    customer: "Cliente",
    customerAgent: "Cliente — Agente",
    origin: "Origen",
    destination: "Destino",
    quotationDate: "Fecha de cotización",
    tripDate: "Fecha de viaje",
    notConfirmed: "Sin confirmar",
    pets: "Mascotas",
    itemsDescription: "Ítems — Descripción",
    amount: "Monto",
    total: "Total",
    conditionsOfContract: "Condiciones de contrato",
    page: (n) => `Página ${n}`,
    months: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
  },
};
