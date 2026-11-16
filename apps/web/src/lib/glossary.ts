// Glosario fijo (primer nivel de ayuda): rápido, sin costo y sin depender de la IA.
// Cada término puede abrirse después en el asistente para una explicación con tu caso.

export interface Term {
  title: string;
  text: string;
  source?: string;
}

export const GLOSSARY: Record<string, Term> = {
  margen: {
    title: "Margen bruto estimado",
    text: "Lo que quedaría de vender la cosecha menos los gastos de sembrarla, sumando todas las campañas de los próximos 24 meses. No descuenta alquiler, impuestos ni intereses, y no es una ganancia garantizada.",
  },
  agua_bruta: {
    title: "Agua que necesitas llevar",
    text: "El agua que el cultivo pide según el clima de esas fechas (datos NASA de 11 años), más la que se pierde al regar. Con goteo se pierde menos que con aspersión o gravedad.",
    source: "NASA-POWER",
  },
  agua_tipica: {
    title: "Referencia de agua y escenario supuesto",
    text: "Tu respuesta (muy poca, poca, media, alta o no es problema) describe la disponibilidad para el tamaño de tu campo. CERES la explora mediante un intervalo supuesto respecto a la referencia de SU zona, repartida por mes. Los factores no están calibrados con mediciones de tu canal. No significan que recibirás ese volumen; confirma tus turnos antes de decidir. Sin referencia local, la cantidad sigue desconocida.",
    source: "CERES-AGUA-CUALITATIVA",
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
    text: "Entre las combinaciones evaluadas de cultivos y fechas de los próximos 24 meses, busca un mejor margen según escenarios con supuestos (pesa igual el promedio y el 20 % de escenarios peores). Revisa el agua del mes más exigente en al menos 9 de los 11 años NASA. Impide una tercera siembra seguida del mismo producto, contando el antecedente. Repetir familia tiene una penalización supuesta; no demuestra una mejora medida del suelo.",
    source: "NASA-POWER",
  },
  precio_mayorista: {
    title: "Precio mayorista y precio en chacra",
    text: "El precio mayorista es lo que se paga en el mercado mayorista de la ciudad (MIDAGRI-SISAP). En la chacra te pagan menos: hay flete, merma y la ganancia del acopiador. Por eso usamos una fracción del mayorista; si nos dices cuánto te pagan, usamos tu precio.",
    source: "MIDAGRI-SISAP",
  },
};
