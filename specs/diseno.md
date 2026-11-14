# Diseño técnico de CERES

Diseño propuesto para implementar, no descripción de código existente. Las decisiones de producto están en `main.md`; el comportamiento verificable, en `specs/requisitos.md`. Consultar documentación oficial y fijar versiones compatibles al comenzar.

## 1. Arquitectura

```text
Navegador: Next.js + TypeScript + MapLibre, tema claro
        │ solicitudes del mismo origen /api/v1
        ▼
Python/FastAPI: autorización y presentación HTTP
        ▼
Casos de uso: parcelas, historial, comparación, consulta IA
        ▼
Dominio: ciclos, restricciones, métricas, razones y procedencia
        │ puertos definidos hacia fuera del dominio
        ├── PostgreSQL / SQLAlchemy / Alembic
        ├── NASA POWER y caché de datos
        ├── catálogo y fuentes documentales curadas
        ├── geometría / área geodésica
        └── LLM / OpenAI Responses
```

El dominio no importa FastAPI, SQLAlchemy, SDK de IA ni componentes web. Los adaptadores implementan interfaces de aplicación; el punto de composición los conecta. El LLM no participa en las fórmulas ni decide permisos. Next.js no accede directamente a tablas ni recalcula un ranking diferente.

Estructura inicial orientativa:

```text
apps/web/                    # app router, componentes y cliente API por función
apps/api/src/ceres/
  domain/                    # entidades, reglas puras y objetos de valor
  application/               # casos de uso, DTO y puertos
  infrastructure/            # db, nasa, llm, catálogo, auth y geometría
  presentation/              # rutas FastAPI, autenticación HTTP y serialización
  bootstrap.py               # composición
apps/api/migrations/
apps/api/tests/               # dominio, integración y contrato
data/                        # paquetes de demo trazables; nunca secretos
specs/
```

La estructura puede ajustarse al checkout real, conservando la dirección de dependencias. Inicialmente bastan una API y una base; no se requieren microservicios, colas ni base vectorial separada.

## 2. Modelo persistente mínimo

| Entidad | Contenido principal y reglas |
|---|---|
| `User` | ID, email único normalizado, hash de contraseña, fechas. No incluir contraseñas en DTO de salida. |
| `Session` | Hash de token opaco aleatorio, propietario, expiración y revocación. La cookie contiene el token, no datos agronómicos. |
| `Parcel` | Propietario, nombre opcional, GeoJSON/punto, área y su origen, identificadores administrativos, zona piloto y revisión activa. |
| `ParcelProfileRevision` | Copia versionada de estado actual, agua, restricciones, costos y prioridades. Registrar origen y fecha de cada dato relevante. |
| `CropEvent` | Cultivo/variedad/destino, siembra, cosecha prevista/real, estado y área. Corregir con trazabilidad, no borrar silenciosamente el antecedente. |
| `SoilObservation` | Fecha, profundidad, método, parámetros con unidad y origen; valores desconocidos distintos de cero. |
| `ManagementRecord` | Abono/fertilizante, composición y cantidad declaradas, fechas, costo, disponibilidad estimada, destino de residuos. |
| `CropProfile` / `AssociationProfile` | Cultivo y destino, etapas, ventanas, familia, parámetros hídricos/nutricionales, costos/rendimientos de referencia, fuentes y estado de revisión. |
| `StrategyTemplate` | Secuencia/etapas, manejo y asociaciones explícitas, restricciones y evidencia. No representa una recomendación por sí sola. |
| `Source` / `EvidenceFragment` | Registro de procedencia y fichas textuales acotadas con sección, ámbito, permisos y fecha. Diferenciar referencias públicas y privadas. |
| `DatasetSnapshot` | Proveedor, coordenadas/ámbito, periodo, parámetros, unidades, archivo/JSON bruto, hash, calidad, transformaciones y fecha. |
| `RecommendationRun` | Propietario/parcela, revisión de perfil, horizonte, entradas y parámetros congelados, versiones de motor/catálogo/datos. |
| `StrategyAssessment` | Ciclo, estado, métricas con unidades, razones, supuestos, faltantes y referencias por métrica/regla. |
| `Conversation` / `Message` | Propietario, parcela, run consultado, preguntas/respuestas, referencias utilizadas y estado real del proveedor. |

GeoJSON/JSONB sirve inicialmente para geometría y estructuras variables; relaciones, propietarios, fechas y restricciones importantes serán columnas/FK. No guardar toda la aplicación en un JSON sin integridad. Los códigos administrativos se conservarán como texto y con proveedor/versión, no como números sin ceros iniciales.

Un cambio de perfil crea revisión; un recálculo crea run. Historial y chat podrán seguir explicando el run original. Si la revisión activa difiere, mostrarlo y ofrecer recalcular desde la UI. No mezclar sin aviso la dotación actual con el resultado de otro presupuesto.

## 3. Sesión y autorización

- Email/contraseña con `pwdlib` y Argon2. Usar bibliotecas mantenidas para hashing y mecanismos HTTP; no crear criptografía propia.
- Sesión opaca con token generado mediante fuente criptográfica, al menos 256 bits de entropía; almacenar su hash y expiración en PostgreSQL. Logout revoca el registro.
- Cookie HttpOnly, Secure bajo HTTPS, SameSite explícito y path coherente. Desarrollo HTTP local puede desactivar Secure solo con configuración de desarrollo.
- Servir/proxificar API bajo el mismo origen de Next.js, reenviando correctamente cookies y Set-Cookie. Evitar CORS abierto con credenciales.
- Proteger mutaciones frente a CSRF con comprobación de origen y mecanismo de token apropiado. Limitar intentos de login y entradas del chat.
- Resolver usuario desde sesión, nunca desde un `user_id` enviado por cliente. Cada repositorio/caso de uso privado filtra por propietario antes de leer o escribir.
- No compartir cachés SSR de parcelas/conversaciones. Evitar revelar existencia de IDs ajenos; usar una respuesta coherente de no encontrado/no autorizado.
- La evidencia privada, incluidos análisis aportados por el agricultor, conserva el mismo control de acceso.

## 4. Contratos de API

Prefijo sugerido `/api/v1`; ajustar nombres sin cambiar permisos ni semántica. Generar OpenAPI desde FastAPI y mantener tipos/contratos del cliente alineados.

| Operación | Acceso | Resultado esperado |
|---|---|---|
| `GET /health` | Público | Estado del proceso; no revelar secretos. |
| `GET /regions`, `GET /regions/{id}/children` | Público | Jerarquía administrativa, proveedor y geometría/versiones disponibles. |
| `GET /public/context`, `GET /public/demo` | Público | Contexto ambiental o caso explícitamente público; nunca parcelas privadas. |
| `GET /sources/{id}` | Público o propietario según fuente | Procedencia autorizada; no publicar archivos privados. |
| `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` | Según operación | Cuenta y sesión; logout revoca. Documentar también el intercambio CSRF. |
| `GET /me` | Sesión | Perfil de cuenta y parcela activa opcional. |
| `GET/POST /parcels` | Sesión | Listar/crear parcelas propias. |
| `GET/PATCH/DELETE /parcels/{id}` | Propietario | Leer/cambiar/eliminar con política de historial documentada. |
| `GET/POST /parcels/{id}/profile-revisions` | Propietario | Consultar/guardar revisión y procedencia; validar consistencia con eventos. |
| `GET/POST /parcels/{id}/crop-events` | Propietario | Historial y nuevo evento de cultivo/cosecha. |
| `POST /parcels/{id}/recommendations` | Propietario | Crear run con snapshot, tres evaluaciones y faltantes. |
| `GET /parcels/{id}/recommendations`, `GET /recommendations/{id}` | Propietario | Historial y resultado inmutable. |
| `POST /parcels/{id}/conversations`, `POST /conversations/{id}/messages` | Propietario | Conversación vinculada al run y respuesta contextual con citas. |

Validar fechas, unidades y tamaños de geometría/texto. Usar errores estructurados con código y mensaje sencillo. Una respuesta de comparación con `requiere_datos` es un resultado válido; no equivale a un error HTTP. Un proveedor IA no configurado produce un estado explícito de indisponibilidad, no una respuesta generativa ficticia.

## 5. Flujo del motor

### Entradas y construcción del calendario

Leer la revisión autorizada, eventos previos, restricciones, preferencias, catálogo y fuentes versionadas. Cada parámetro indica origen y ámbito de aplicación. Proponer la continuidad declarada y dos alternativas curadas; no generar combinaciones ilimitadas mediante el LLM.

El terreno debe estar disponible antes de la nueva siembra. Respetar ventanas documentadas, preparación entre campañas, duraciones y cosechas completas. Para el horizonte común, verificar también fechas bisiestas y cambios de año. Una asociación tiene etapas/densidades propias y solapamiento intencional; no es un error de doble ocupación.

Las fechas son escenarios de planificación orientativos. Usar bloques históricos completos comparables, documentando cómo se alinean con el calendario futuro; no rellenar años desconocidos como observaciones futuras. Un calendario sin parámetros suficientes queda pendiente.

### Agua y clima

1. Obtener la instantánea NASA regional aplicable y validar unidades, ausentes y periodo. Caché por consulta normalizada/versión; reutilizar la misma evidencia regional donde corresponda, mostrando esa escala.
2. Calcular exposición térmica por etapa solo con umbrales documentados. Presentar frecuencia histórica y rango, sin probabilidades futuras calibradas.
3. Si se implementa ET0, usar FAO Penman–Monteith y comprobar temperatura, humedad, radiación, viento a altura adecuada y elevación. Radiación: convertir según los metadatos, no aplicar un factor ciego.
4. `ETc = Kc × ET0`, con Kc por etapa y manejo respaldados. No usar una suma de Kc para policultivo sin modelo validado.
5. Calcular riego neto/bruto únicamente con método de lluvia efectiva, eficiencia y balance explícitos. Una aproximación debe indicar reservas del suelo, ascenso capilar y manejo de sales omitidos.
6. Convertir mm a volumen usando área: `1 mm × 1 ha = 10 m³`. Eficiencia como fracción en `(0, 1]`, no porcentaje sin convertir.
7. Comparar con dotación del mismo periodo/punto de entrega. Horas de riego requieren caudal comprobado. Si esos datos faltan, la viabilidad hídrica queda pendiente.

Las métricas de ETc potencial no se etiquetan como riego aplicado ni ahorro observado. Si solo se verifica exposición térmica, esa señal puede contribuir al resultado; los volúmenes no se inventan.

### Economía y fertilidad

Por ciclo, ingreso = rendimiento comercializable × precio en chacra. El margen bruto resta costos variables y transiciones; agregar fertilizantes, abonos y aplicación. Mantener unidad/destino del cultivo: maíz para grano y maíz para forraje no comparten automáticamente precio o rendimiento. No contar dos veces el valor de forraje vendido y autoconsumido. Comparar todo el horizonte y escenarios documentados de sensibilidad.

Suelo: conservar mediciones con método/unidad, requerimientos del cultivo, extracción estimada y aportes disponibles con supuestos. N total, concentración analítica y N disponible no son intercambiables. Sin parámetros no producir un balance cuantitativo ni dosis. Registrar cobertura, familias, residuos y leguminosas como indicadores de manejo, no como mejoras ya medidas.

### Estados, orden y razones

- `no_viable`: una regla obligatoria incumplida, con evidencia o supuesto identificable.
- `requiere_datos`: falta entrada/parámetro crítico para evaluar.
- `exploratoria`: asociación/secuencia cuyo respaldo local todavía no permite recomendar.
- `viable_con_supuestos`: pasa las reglas evaluadas bajo las condiciones y supuestos visibles; no es garantía de éxito.

Con prioridad dinero, ordenar por margen comparable; con agua, por demanda calculada bajo el mismo método/punto de entrega. Con suelo, usar criterios cualitativos documentados del catálogo y explicar empates. En modo equilibrado, mostrar compromisos sin inventar un puntaje único. Si posteriormente se decide puntuar, especificar pesos/normalización y actualizar requisitos antes de implementarlo.

Cada razón tendrá `rule_id`, estado, métrica/entrada relevante, explicación breve, `source_ids`, supuestos y faltantes. La explicación determinista inicial debe funcionar aun sin LLM.

## 6. Recuperación y asistente IA

Caso de uso `AnswerFarmerQuestion`:

1. Autorizar usuario, parcela, conversación y run en servidor.
2. Reunir revisión usada por ese run, métricas/razones, preguntas previas relevantes y fichas pertinentes.
3. Recuperar documentos curados con búsqueda textual/FTS en PostgreSQL y filtros de ámbito/permisos. El catálogo pequeño no requiere embeddings ni otra base.
4. Construir contexto con IDs de evidencia y valores del motor. Minimizar datos personales: no enviar email, contraseña, tokens ni archivos completos si no son necesarios.
5. Llamar al puerto `LanguageModel`, inicialmente mediante Responses API. Configurar modelo/clave, timeout y límites; usar `store=false` cuando el proveedor lo soporte y documentar la configuración efectiva.
6. Solicitar salida estructurada: respuesta, referencias a métricas/fuentes, supuestos y datos faltantes. Validar IDs contra el contexto; la UI resuelve URLs desde el registro, no desde enlaces inventados por el modelo.
7. Contrastar afirmaciones numéricas con los valores disponibles. Rechazar/reintentar o devolver explicación basada en fichas si hay citas o cifras sin respaldo; no garantizar exactitud solo porque exista una cita.
8. Guardar respuesta, fuentes utilizadas, run y estado real de ejecución. Una caída del proveedor no modifica la recomendación.

Las fichas recuperadas son datos, no instrucciones. El asistente es de lectura: no cambia el perfil ni tiene SQL libre, acceso a otras cuentas o herramientas de acciones externas. Para otro presupuesto/fecha, enlaza los controles de simulación que crean un nuevo run. No simular un recálculo solo con texto generado.

Ejemplo de forma de respuesta, sin cifras inventadas: «Esta opción alterna familias después de tu cultivo anterior. La comparación usa el clima histórico de NASA y estos parámetros agronómicos. Todavía falta confirmar la disponibilidad de riego; por eso no aparece como viable». Cada afirmación mostrará las fuentes concretas que correspondan.

## 7. Frontend y límites del MVP

Vistas principales: mapa público; acceso; perfil/parcela; comparación con línea de tiempo; panel de chat y evidencia integrado. Evitar una pantalla distinta por cada fuente. Formularios progresivos con «no sé», lenguaje cotidiano, teclado y estados con texto. Solo tema claro.

Guardar la selección temporal durante login sin publicarla. Tras logout, limpiar estado privado del cliente. Los resultados históricos muestran la revisión utilizada. La tarjeta nutricional, si hay fichas INS verificadas, se mantiene separada de fertilidad y sin afirmaciones clínicas.

HLS, simulación genérica de policultivos, lectura automática de análisis PDF, pronóstico, WhatsApp, malezas, macheteo y herbicidas no son dependencias del recorrido principal.

## 8. Verificación y reproducibilidad

Pruebas de dominio con casos conocidos: calendario sin solapamientos, restricciones, agua/unidades, costos por varios ciclos y faltantes. Reproducir un ejemplo técnico publicado para ET0 antes de habilitar m³. Pruebas de integración contra PostgreSQL para autorización, transacciones y snapshots; no sustituirlas íntegramente por SQLite.

Pruebas de asistente con proveedor simulado: citas inexistentes, métricas ajenas, falta de contexto e instrucciones maliciosas dentro de documentos. Comprobación de conexión LLM real separada y explícita. E2E: mapa → login → parcela → ciclos → cambio de agua → fuentes → pregunta → logout/aislamiento.

Documentar comandos reales de arranque, migración, carga de demo y tests. El modo de demo sin red reutiliza archivos NASA reales y geometrías permitidas previamente descargadas; no descarga teselas OSM masivamente. Hasta obtener esos archivos, marcar el paquete de datos como pendiente, sin presentar fixtures sintéticos como evidencia real.
