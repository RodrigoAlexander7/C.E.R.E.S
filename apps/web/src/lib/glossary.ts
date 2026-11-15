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
    title: "Agua típica de la zona",
    text: "Si no sabes cuánta agua recibes, usamos un valor típico de tu zona repartido igual cada mes. En Majes I: 22 500 m³ por hectárea al año, el consumo que AUTODEMA reportó en 2023. En el Valle de Chilina: unos 23 000 m³ por hectárea al año, calculados con el volumen de la Comisión Pampas Nuevas de Chilina (ANA 2022) y las hectáreas de su canal (ANA 2025). Es un supuesto: confírmalo con tu junta o comisión de usuarios.",
    source: "ZONA-MAJES",
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
    text: "Usamos 11 años (2015–2025) de datos diarios de NASA POWER para la celda de tu zona: temperatura, humedad, viento y sol. Sirven para comparar fechas de siembra; no son un pronóstico. En el Valle de Chilina la celda está unos 900 m más alta que el valle, así que es más fría y exagera las heladas.",
    source: "NASA-POWER",
  },
  supuesto: {
    title: "Supuesto",
    text: "Un valor que usamos porque no lo sabías. Siempre lo marcamos y puedes cambiarlo. Tus propios datos siempre valen más que un supuesto.",
  },
  riesgo: {
    title: "Rango probable y probabilidad de perder",
    text: "Simulamos 1 000 campañas posibles: en cada una tomamos un año real de clima NASA POWER (que cambia el agua que pide el cultivo), un precio de venta que sube o baja y un rendimiento algo mejor o peor. El rango probable deja fuera el 10 % peor y el 10 % mejor. «Probabilidad de perder» es la parte de esas campañas que terminaron con ganancia negativa. No es un pronóstico: el precio de hoy no garantiza el de tu cosecha.",
    source: "NASA-POWER",
  },
  plan_sugerido: {
    title: "Plan sugerido por CERES",
    text: "Entre todas las combinaciones de cultivos y meses de siembra de los próximos 24 meses, la que más deja en promedio sin arriesgar de más (pesa igual el promedio y el 20 % de campañas malas). Solo usa cultivos validados en tu zona, respeta tu agua del mes más exigente en 9 de cada 10 años NASA, castiga repetir el mismo tipo de cultivo y descarta meses con frío o calor frecuente.",
    source: "NASA-POWER",
  },
  precio_mayorista: {
    title: "Precio mayorista y precio en chacra",
    text: "El precio mayorista es lo que se paga en el mercado mayorista de la ciudad (MIDAGRI-SISAP). En la chacra te pagan menos: hay flete, merma y la ganancia del acopiador. Por eso usamos una fracción del mayorista; si nos dices cuánto te pagan, usamos tu precio.",
    source: "MIDAGRI-SISAP",
  },
};
