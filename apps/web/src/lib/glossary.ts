// Glosario fijo (primer nivel de ayuda): rápido, sin costo y sin depender de la IA.
// Cada término puede abrirse después en el asistente para una explicación con tu caso.

export interface Term {
  title: string;
  text: string;
  source?: string;
}

export const GLOSSARY: Record<string, Term> = {
  margen: {
    title: "Ganancia estimada (margen bruto)",
    text: "Lo que quedaría de vender la cosecha menos los gastos de sembrarla, sumando todas las campañas de los próximos 24 meses. No descuenta alquiler, impuestos ni intereses, y no es una ganancia garantizada.",
  },
  agua_bruta: {
    title: "Agua que necesitas llevar",
    text: "El agua que el cultivo pide según el clima de esas fechas (datos NASA de 11 años), más la que se pierde al regar. Con goteo se pierde menos que con aspersión o gravedad.",
    source: "NASA-POWER",
  },
  agua_tipica: {
    title: "Agua típica de Majes",
    text: "Si no sabes cuánta agua recibes, usamos 22 500 m³ por hectárea al año, el consumo de riego que AUTODEMA reportó para Majes en 2023, repartido igual cada mes. Es un supuesto: confírmalo con tu Junta de Usuarios.",
    source: "AUTODEMA-INDICADORES-2023",
  },
  eficiencia: {
    title: "Eficiencia del riego",
    text: "Qué parte del agua que llevas llega realmente a las raíces. Según la FAO: goteo 90 %, aspersión 75 %, gravedad 60 %.",
    source: "FAO-EFICIENCIA",
  },
  sal: {
    title: "Sal en el suelo (CE)",
    text: "La conductividad eléctrica (CE) mide cuánta sal hay en el suelo. El frejol y la cebolla sufren con poca sal; el maíz tolera algo más. Las costras blancas son una señal, pero solo un análisis de suelo lo mide.",
    source: "FAO29-SAL",
  },
  leguminosa: {
    title: "Leguminosa",
    text: "Plantas como el frejol que, con ayuda de bacterias, toman nitrógeno del aire. Pueden dejar algo al siguiente cultivo, pero depende de cuánto residuo quede en la chacra; no es un abono gratis asegurado.",
    source: "INIA-RIZOBIOS",
  },
  nasa: {
    title: "Clima NASA",
    text: "Usamos 11 años (2015–2025) de datos diarios de NASA POWER para la zona de Majes: temperatura, humedad, viento y sol. Sirven para comparar fechas de siembra; no son un pronóstico.",
    source: "NASA-POWER",
  },
  supuesto: {
    title: "Supuesto",
    text: "Un valor que usamos porque no lo sabías. Siempre lo marcamos y puedes cambiarlo. Tus propios datos siempre valen más que un supuesto.",
  },
};
