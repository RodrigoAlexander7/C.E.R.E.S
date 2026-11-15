# Requisitos verificables de CERES

Estado: especificación para implementar, no funcionalidades ya construidas. Ámbito: demo de Majes I, Arequipa. Fechas de interfaz en America/Lima; fechas agrícolas sin hora y marcas de auditoría en UTC.

## Reglas generales

La aplicación evalúa estrategias con los datos y supuestos disponibles. No garantiza rendimientos, precios, ahorro ni salud del suelo. La decisión final es del agricultor. Todos los criterios siguientes deben quedar vinculados a tareas y pruebas; la validación agronómica local es distinta de pasar pruebas de software.

## R01 — mapa público y parcela

- Un visitante puede explorar Perú → departamento → provincia → distrito sin iniciar sesión; cada selección ajusta el mapa y los selectores se mantienen sincronizados.
- Puede dibujar/seleccionar un terreno y ver su área estimada, o introducir ubicación y área cuando no tenga polígono.
- «Usar mi ubicación» solicita permiso solamente al activarlo. Si se deniega o falla, continúa la selección manual.
- Un punto GPS nunca se presenta como límite real de la parcela. Rechazar geometrías inválidas y áreas no positivas.
- Mostrar origen/fecha y atribución de capas. Si falla el mapa base, conservar selector y geometría local disponible.
- La zona piloto se reconoce explícitamente. Fuera de ella se puede explorar información disponible, sin presentar recomendaciones agronómicas locales validadas.

## R02 — acceso, login y aislamiento

- Registro, login, logout y recuperación de sesión tras recargar.
- Mapa, fuentes públicas y caso demo público no requieren cuenta. Crear parcelas, resultados personales y conversaciones sí requiere sesión válida.
- Una cuenta solo puede leer, cambiar o eliminar sus propios datos. Comprobar autorización en cada ruta y antes de recuperar contexto para IA.
- Sesiones expiran y logout las revoca en servidor. Contraseñas con hash Argon2; no almacenar credenciales ni tokens en texto accesible al navegador o logs.
- Cookies HttpOnly, SameSite y Secure en HTTPS; protección CSRF/origen para operaciones con cambios. La excepción de desarrollo local HTTP debe ser explícita.
- Dos usuarios conociendo el ID de una parcela, resultado o conversación ajena no pueden acceder a ella. No compartir caché de páginas/datos privados.

## R03 — perfil progresivo e historial

- Cada usuario puede tener varias parcelas y seleccionar una activa.
- Inicio mínimo: ubicación/área, cultivo actual o anterior, estado cosechado/en cultivo, fecha prevista cuando corresponda, agua disponible o «no sé», y prioridad.
- Nombre de parcela y datos técnicos adicionales no convierten el inicio en un cuestionario extenso.
- Perfil ampliable: cultivos previos, fechas, riego/dotación por periodo, costos/precios, suelo, análisis de laboratorio, abonos, residuos y restricciones.
- Campos desconocidos permanecen desconocidos; no rellenarlos como cero, suelo sano o agua suficiente.
- Los análisis registran fecha, profundidad, unidad y método. Las declaraciones se distinguen de mediciones.
- Login recupera el último perfil guardado. Registrar una cosecha o actualizar un análisis conserva el antecedente; las recomendaciones pasadas mantienen sus entradas originales.

## R04 — NASA real y procedencia

- La demo aceptada incluye un archivo real de NASA POWER con coordenadas de consulta, variables, periodo, unidades, estándar temporal y fecha de obtención.
- Manejar valores ausentes, errores, timeouts y unidades sin sustituirlos silenciosamente por ceros.
- Mostrar fecha y escala regional de la fuente. Un polígono fino no convierte el dato NASA en medición parcelaria.
- Una fecha/calendario alternativo debe recalcular exposición térmica o demanda hídrica usando esa evidencia. No se exige que el orden cambie si los datos no lo justifican.
- Conservar entradas y versión de fuente en cada resultado. Si NASA falla, usar la última copia real identificada o mostrar indisponibilidad; un fixture sintético nunca se etiqueta como dato NASA real.
- No mostrar el histórico como pronóstico de la próxima campaña.

## R05 — ciclos propuestos y justificación

- Comparar plan declarado y dos alternativas curadas. Si una no puede evaluarse, mantener visible su motivo en vez de fabricar una opción viable.
- Cada estrategia presenta cultivos, etapas, fechas orientativas de siembra/cosecha, preparación y descansos, con igual superficie, estado inicial y horizonte.
- No solapar monocultivos sobre toda la misma área; una asociación simultánea debe modelarse explícitamente.
- Respetar la liberación del terreno, ventanas de siembra y ciclos completos. No ignorar una cosecha pendiente al cerrar el horizonte.
- Cada paso indica por qué se propone: antecedente, ventana/clima histórico, agua, criterio de suelo y prioridad, con los factores que realmente lo sustentan.
- Fecha desconocida o calendario sin revisar produce un pendiente; no presentar una fecha «óptima» calculada sin respaldo.
- Alfalfa establecida no se reemplaza automáticamente ni se compara como una anual recién instalada.

## R06 — viabilidad y prioridades

- Clasificar cada estrategia como `viable_con_supuestos`, `no_viable`, `requiere_datos` o `exploratoria`, mostrando razones y supuestos.
- Una restricción obligatoria incumplida no se compensa con margen alto ni con pesos del usuario.
- Una dotación anual no demuestra disponibilidad mensual. La comparación hídrica necesita el mismo periodo y punto de entrega.
- Cambiar agua, fecha o prioridad genera un nuevo resultado reproducible, sin reescribir el anterior.
- Ordenar solo opciones comparables y con datos suficientes para el criterio. Si faltan costos, no producir un ranking de rentabilidad preciso.
- Fórmulas, unidades, reglas de orden y desempate son consultables. Si se introduce un puntaje, sus pesos/normalización deben especificarse y probarse antes de usarlo.

## R07 — agua, economía y suelo

- ET0/ETc y riego neto/bruto se distinguen. Usar coeficientes por etapa y fuentes; verificar conversiones y eficiencia antes de mostrar m³.
- Si el cálculo hídrico no está validado, mostrar exposición climática y volúmenes pendientes, sin inventar cifras.
- Margen bruto: ingresos comercializables menos costos variables de todos los ciclos, incluidas transiciones y fertilización. Mostrar costos excluidos y escenarios; no llamarlo ganancia neta.
- Precio en chacra, mayorista y precio supuesto tienen etiquetas diferentes. El precio de hoy no se garantiza para la cosecha futura.
- Suelo: diferenciar análisis, requerimientos, extracción estimada, aportes disponibles y prácticas de manejo. No inferir NPK de NDVI ni convertir automáticamente una concentración de laboratorio en dosis.
- No asignar fijación de nitrógeno al trigo ni un crédito universal a cualquier leguminosa. Registrar cosecha, residuos y condiciones de manejo.
- Una dosis de abono/fertilizante requiere datos y reglas agronómicas suficientes; de lo contrario, mostrar información faltante.

## R08 — policultivo y nutrición complementaria

- Incluir una ficha de asociación candidata, con especies, densidades, calendario, agua, rendimiento y manejo propios o pendientes explícitos.
- No sumar Kc, ingresos o rendimientos de dos monocultivos sobre la misma área como si describieran la asociación.
- La evidencia de rotación maíz–frejol no valida automáticamente la asociación simultánea maíz + frejol.
- Sin parámetros/revisión local, la ficha permanece exploratoria y no se recomienda como viable.
- Si se muestra composición alimentaria INS, indicar alimento/código, versión, unidad/porción y estado crudo/cocido. Ausentes no son cero. No prometer tratamiento de anemia o beneficios clínicos.

## R09 — asistente virtual IA

- Un usuario autenticado pregunta sobre una parcela y un resultado propios, y recibe una respuesta breve en español sencillo.
- La respuesta explica el ciclo o la comparación con contexto de la aplicación: datos, reglas, supuestos y documentos; no responde como si hubiera visitado el lote.
- Toda cifra presentada debe tener respaldo en el contexto y toda cita debe resolver a una fuente autorizada y utilizada. No aceptar enlaces inventados ni atribuciones generales que no sustentan la afirmación.
- Puede explicar «por qué frejol después del maíz», «qué cambia con menos agua» y «qué falta saber del suelo», distinguiendo evidencia de hipótesis.
- Cuando no haya respaldo, lo reconoce y pide el dato concreto necesario. No diagnostica suelo, prescribe herbicidas ni hace promesas médicas.
- El motor sigue siendo la única autoridad de cálculos/estados. El chat no hace SQL libre ni ejecuta acciones externas. Solo puede *proponer* registros y simulaciones según R17–R18; nada se guarda sin confirmación del usuario.
- No se recupera contexto ajeno aunque el usuario lo pida o un documento contenga instrucciones. Los textos recuperados son evidencia, no instrucciones de sistema.
- Sin clave/modelo o ante fallo del proveedor, mostrar indisponibilidad y acceso a fichas; no simular una respuesta generativa exitosa.
- Guardar conversación vinculada a propietario, parcela y versión del resultado; mostrar si el perfil actual ya cambió respecto al resultado consultado.

## R10 — fuentes, estados y errores

- Abrir la evidencia de una métrica o explicación muestra fuente, ámbito, periodo, unidad, transformación y si es observada, declarada, derivada o supuesto de demo.
- Las citas de documentos públicos no exponen archivos privados del agricultor. Una referencia de laboratorio se abre solo con autorización.
- Catálogos y datos precargados llevan versión. Mostrar carga, falta de datos y errores de servicios con mensajes útiles.
- La caída de un portal complementario no inutiliza login, perfil, historial ni evidencia ya guardada.

## R11 — experiencia sencilla

- Español y únicamente tema claro, incluso con preferencia oscura del sistema.
- Diseño usable en móvil y escritorio. Mapa y chat no esconden el recorrido principal.
- Etiquetas como «¿Qué sembraste?» y «¿Cuándo cosechas?». Explicar términos técnicos al abrir detalle.
- Cada tarjeta resume cultivo/ciclo, agua estimada o pendiente, margen estimado o pendiente y razón principal.
- Usar estados con texto, no solo colores; formularios, controles y mensajes accesibles por teclado.

## R12 — entrega técnica

- Arranque local reproducible de frontend, API y PostgreSQL; migraciones y seed de demo explícitos.
- Dominio agronómico independiente de FastAPI, Next.js, SQLAlchemy y LLM.
- Dependencias fijadas, `.env.example` sin secretos y README con comandos realmente comprobados.
- Pruebas significativas: dos cuentas aisladas; sesión revocada; calendario coherente; agua/unidades; margen por ciclo; faltantes; citas/contexto IA y recorrido principal.
- Los tests con mocks de NASA/LLM no se presentan como validación de descarga o conexión real.

## Recorrido de aceptación de la demo

La preparación para Azure añade el requisito R13 indicado al final; la aceptación funcional siguiente sigue aplicando con independencia del alojamiento.

1. Visitante explora Perú y llega a Majes; acepta o deniega geolocalización sin bloquearse.
2. Se registra/inicia sesión, guarda una parcela y puede recuperarla tras recargar.
3. Completa historial mínimo y agua conocida o desconocida; ve tres ciclos con estados honestos.
4. Abre evidencia NASA real y justificación de una etapa del ciclo.
5. Cambia agua o prioridad, observa recálculo y conserva ambas versiones.
6. Pregunta al asistente por una diferencia; ve una explicación respaldada y sus fuentes, o una limitación clara si faltan datos/credenciales.
7. Cierra sesión; otra cuenta no puede consultar esa parcela, sus recomendaciones ni su chat.

Para declarar **demo completa**, NASA real y el asistente conectado deben estar comprobados; si falta alguno, entregar el avance ejecutable y registrar exactamente esa validación pendiente. No confundir una aplicación técnicamente funcional con recomendaciones agronómicas validadas para uso en campo.

## R13 — artefactos y publicación en Azure

- Entregar imágenes de producción Linux x64 y Compose de despliegue; construir fuera del VPS pequeño, sin servidor de desarrollo.
- Proxy HTTPS como única entrada pública 80/443, API y PostgreSQL internos, cookies y origen coherentes con HTTPS.
- Volumen PostgreSQL persistente, migraciones explícitas, healthchecks, logs acotados y respaldo/restauración comprobables.
- Ajustar consumo y medir la demo antes de declarar suficiente una VM de 1 GiB. No alojar un LLM ni entrenar modelos en ella.
- El agente de desarrollo no duplica infraestructura ni modifica otros proyectos; despliegue coordinado por este chat en `rodrygo-resource-group`.
- Documentar versión, pruebas y configuración no secreta de cada publicación. No incluir claves en imagen, repositorio o cloud-init.
- Distinguir infraestructura creada de aplicación publicada; seguir el estado y autorización de costos de `despliegue.md`.

---

# Requisitos de la nueva dirección (15-nov-2026)

Origen: `main.md` sección 11. Prevalecen sobre R01–R12 cuando los contradigan; R02 (aislamiento), R04 (NASA real), R09 (citas/cifras validadas) y R10 (procedencia) siguen vigentes.

## R14 — landing pública

- Explica en menos de 10 segundos qué hace CERES, para quién y qué decisión ayuda a tomar, en español sencillo.
- Muestra evidencia **real**: la serie NASA POWER de Majes (meses, ET0, lluvia) se obtiene de la API, no de cifras escritas a mano.
- Distingue funciones **disponibles** de **próximas**; no presenta como operativo algo que no lo esté.
- Lleva a probar (caso demo y comparación de parcela) sin exigir cuenta.
- Responsive, accesible por teclado, solo tema claro, respeta `prefers-reduced-motion` y carga sin bloquear por el mapa.

## R15 — aplicación sencilla por módulos y detalle progresivo

- Alta en tres preguntas: cultivo actual o último, fecha de cosecha (o «ya coseché») y prioridad. Ubicación por zona o mapa opcional; área declarada aceptada.
- Resultado: tres opciones con un nivel en lenguaje cotidiano («Buena opción», «Posible, confirma X», «No conviene») y una frase que las justifique; el estado técnico R06 se conserva y se muestra en «¿Por qué?».
- «¿Por qué?» se abre en capas: razón principal → datos usados y supuestos → detalle técnico y fuentes.
- Junto a términos difíciles hay un botón de ayuda: primero un glosario fijo y, bajo demanda, explicación de la IA con fuentes.
- El recorrido completo funciona en un móvil de 375 px con tres preguntas y dos toques hasta ver opciones.
- Una sola aplicación sencilla por módulos. «Ver más» permite consultar la misma comparación técnica, editar el perfil completo y recuperar resultados anteriores. El mapa es opcional en «Mi chacra».

## R16 — supuestos de zona y dato decisivo

- Un dato desconocido puede sustituirse por un **supuesto de zona** con valor, unidad, fuente (o etiqueta `supuesto_zona` si no hay fuente) y fecha; nunca se presenta como medición ni declaración.
- Con supuestos de zona el motor puede clasificar una opción como «Posible, confirma X», pero no como «Buena opción» si el supuesto afecta a una restricción obligatoria (agua mensual, salinidad de cultivo sensible, presupuesto).
- Para cada opción, el motor identifica el **dato que cambiaría la decisión** (sensibilidad: con qué valor cambia el nivel) y lo formula como una pregunta observable.
- Reemplazar el supuesto por un dato propio recalcula y conserva el resultado anterior (R06).

## R17 — cuaderno de campo y registro por chat/voz

- Registros privados por parcela: campañas (cultivo, área, siembra, cosecha, rendimiento), ventas (cantidad, precio, comprador opcional), costos y ganancia declarada; cada uno con fecha, origen (`declarado`, `declarado_chat_confirmado`) y revisión.
- El motor usa rendimientos, precios y costos propios cuando existen y lo indica en la procedencia.
- Texto o audio se transcriben y se convierten en una **propuesta estructurada**; la interfaz muestra «¿Guardo esto?» con los campos editables. Sin confirmación no se escribe nada.
- La revisión mensual pregunta solo lo que falta en el cuaderno; las notificaciones del navegador son opcionales y revocables.
- El audio no se almacena; la transcripción solo se conserva si el usuario confirma el registro.
- Pruebas: extracción con proveedor simulado, rechazo de campos inválidos, confirmación obligatoria y aislamiento entre cuentas.

## R18 — asistente conversacional «Ceres»

- Conversa sobre qué sembrar usando el cuaderno, los resultados y las fichas autorizadas; recuerda campañas anteriores citando el registro concreto (fecha, cultivo, cifra).
- Puede pedir al motor una simulación; el resultado se guarda como run nuevo y se muestra como tal. No calcula cifras por su cuenta.
- Distingue «ganancia que declaraste» (registro) de «margen estimado» (motor).
- Voz de entrada (audio) y de salida (síntesis del navegador), opcionales.
- Mantiene la validación de citas y cifras de R09 y el rechazo de instrucciones insertadas.

## R19 — evidencia NASA visible y NDVI

- «¿Cuándo me conviene sembrar?»: para cada mes de siembra, demanda de agua y exposición térmica calculadas con los 11 años de NASA POWER; cambiar el mes cambia la cifra.
- Comparación de años El Niño y normales dentro de la serie, con las fases tomadas de una fuente citada (NOAA).
- NDVI mensual de la parcela desde HLS (30 m), con fecha de escena, nubosidad y advertencia de que no diagnostica nutrientes ni causas.

## R20 — aceptación de la nueva dirección

1. Visitante entra a la landing, entiende la propuesta y ve datos NASA reales de Majes.
2. En modo sencillo responde tres preguntas (aceptando «no sé») y ve tres opciones útiles, sin callejones sin salida.
3. Abre «¿Por qué?» y llega hasta las fuentes; ve qué dato cambiaría la decisión.
4. Registra por voz o texto una cosecha y una venta, confirma y ve el cuaderno actualizado.
5. Conversa con Ceres, que recuerda ese registro y pide una simulación al motor.
6. Abre «Ver más» y encuentra la misma comparación con detalle técnico dentro del módulo.
