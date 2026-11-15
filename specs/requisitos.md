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
- El motor sigue siendo la única autoridad de cálculos/estados. El chat no modifica datos, hace SQL libre ni ejecuta acciones externas.
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
