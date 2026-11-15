# Despliegue de CERES en Azure

Definición del 14 de noviembre de 2026. El usuario encargó el despliegue a este chat, utilizando el grupo existente y priorizando la cuota de estudiante. Este documento distingue preparación, aprovisionamiento y publicación de la aplicación.

## Estado y comprobaciones

- Suscripción conectada: **Azure for Students**, habilitada; límite de gasto observado: **On**.
- Grupo de destino: **`rodrygo-resource-group`**. No crear otro grupo ni borrar el existente: contiene otros proyectos.
- Región candidata de los recursos nuevos: **`northcentralus`**. La ubicación del grupo es `eastus2`, lo que no obliga a que cada recurso esté en esa región.
- Existe una VM de otro proyecto, `vm-inti-ley`, `Standard_B2as_v2`, observada como desasignada. No forma parte de CERES ni está autorizada su modificación.
- SKU candidata: **`Standard_B2ats_v2`**, 2 vCPU, 1 GiB, x64; sin restricciones de suscripción listadas en la región consultada. `B1s` figura restringida allí.
- Imagen comprobada: Canonical `ubuntu-24_04-lts:server:24.04.202610250`, x64, generación 2.
- Plantilla y bootstrap preparados en `infra/azure/vm.arm.json` e `infra/azure/cloud-init.yaml`.
- El usuario **autorizó consumir crédito estudiantil y permite una eventual migración a pago por uso**. Por ahora se mantiene `spendingLimit: On`; no ha sido necesario cambiar la oferta. La cobertura efectiva del beneficio gratuito y el saldo restante no se han confirmado; no se trataron los campos de costo no interpretables como saldo cero ni como gratuidad.
- Validación de Azure: **Succeeded**. What-if: **Succeeded**, cinco recursos CERES explícitos previstos para creación y los recursos ajenos como `Ignore`, sin modificación/borrado. El disco del sistema se crea implícitamente con la VM.
- Aprovisionamiento **`ceres-mvp`: Succeeded**. `ceres-vm` comprobada como **VM running**.
- IPv4 asignada: **`64.236.243.209`**. FQDN: **`ceres-f7ctifta45nnk.northcentralus.cloudapp.azure.com`**. Son direcciones de la infraestructura; todavía no hay aplicación ni certificado publicados.
- Reglas NSG comprobadas: solo `allow-http` 80 y `allow-https` 443 como reglas públicas nuevas; SSH no habilitado. Disco CERES etiquetado con proyecto/entorno.
- Inicialización remota comprobada: **cloud-init `status: done`**, Docker **29.1.3**, Compose **2.40.3** y swap **2 GiB** activa. El sistema informa 887 MiB de memoria utilizable; el consumo del MVP debe medirse una vez desplegado.
- Servicio Docker comprobado como **active** y API NASA POWER accesible desde la VM con **HTTP 200** en una consulta puntual de conectividad. No equivale a validar un paquete agronómico ni una descarga histórica completa.
- **La aplicación no está publicada ni validada en esta VM.** Su publicación queda pendiente de los artefactos y verificaciones del desarrollo; aprovisionar la infraestructura no significa publicar un MVP funcional.

## Costos y límites

La oferta pública de estudiante incluye cantidades mensuales de B1s, B2ats v2 y B2pts v2 durante el periodo aplicable. Esto no garantiza la cobertura concreta de esta cuenta, región o componentes asociados. [Azure for Students](https://azure.microsoft.com/en-us/free/students/), [seguimiento del beneficio](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/check-free-service-usage).

Precios minoristas de referencia consultados para `northcentralus`, USD, sin descuentos, impuestos ni cobertura gratuita:

| Componente | Referencia observada | Equivalente orientativo |
|---|---|---|
| B2ats v2 Linux, consumo normal | US$0,0094/h | US$6,86 por 730 h si no se aplica el beneficio |
| IPv4 pública Standard regional | US$0,005/h | US$3,65 por 730 h |
| SSD Standard E4 LRS, 32 GiB | US$2,40/mes | Más medidores de operaciones y montaje cuando apliquen |

IP y disco representan aproximadamente **US$6–7/mes**, más operaciones/tráfico. Si el cómputo no queda cubierto, el conjunto base se aproxima a **US$13–14/mes**, más esos conceptos. Son estimaciones, no cotización final ni límite automático. Fuente: consultas a [Azure Retail Prices API](https://prices.azure.com/api/retail/prices) filtradas por región, producto y SKU; [precios de IP](https://azure.microsoft.com/en-us/pricing/details/ip-addresses/).

El usuario permite pago por uso si fuera necesario. La configuración actual funciona con crédito estudiantil y conserva el límite de gasto; el agente de desarrollo no debe cambiar la suscripción por su cuenta. Una futura migración se coordinará desde el despliegue con su efecto de costo documentado. Azure indica que los consumos fuera de las cantidades gratuitas descuentan crédito y que agotarlo puede deshabilitar la suscripción, afectando también a otros proyectos. [Condiciones de estudiante y crédito](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/azurestudents-subscription-disabled).

No usar Spot para la demo principal ni habilitar por defecto Bastion, NAT Gateway, balanceador, registro de imágenes de pago, planes Defender o nuevos servicios administrados. Las llamadas a OpenAI son un servicio separado; no asumir que las cubre el crédito Azure.

## Infraestructura prevista

Despliegue **incremental dentro del grupo existente**:

- `ceres-vm`, Ubuntu y autenticación SSH por clave pública, sin contraseña.
- `ceres-osdisk`, SSD Standard de 32 GiB; preservar datos al eliminar únicamente la VM mediante `deleteOption: Detach`.
- `ceres-vnet`, subred propia y `ceres-nsg`.
- `ceres-nic` y `ceres-pip`, IPv4 Standard regional con etiqueta DNS.
- Entradas públicas: TCP 80/443. SSH cerrado por defecto; habilitarlo solo para un CIDR de administración verificado si se necesita. Administración inicial disponible mediante Azure Run Command.

No publicar 3000, 8000 ni 5432 en Internet. La IP de la NIC proporciona salida para paquetes y APIs sin añadir un NAT Gateway. La plantilla no toca recursos existentes de otros proyectos y no incluye operaciones a nivel de creación de grupos.

El bootstrap instala Docker/Compose, limita logs y configura 2 GiB de swap. Swap no aumenta la RAM real ni garantiza capacidad. Construir imágenes fuera de la VM, usar el LLM remoto y comprobar memoria/CPU con la demo completa. Si no cabe, documentar mediciones y revisar costo antes de ampliar.

## Validación y aprovisionamiento

1. Confirmar cuenta, grupo, cobertura/saldo y uso permitido de crédito. Revalidar cuota y disponibilidad al crear; las lecturas actuales no reservan capacidad.
2. Validar JSON/YAML y ejecutar `az deployment group validate` con la plantilla y la clave **pública** de administración.
3. Ejecutar `az deployment group what-if` en modo `Incremental`. Revisar que únicamente haya creaciones CERES previstas, sin cambios o borrados de recursos ajenos. What-if no calcula el costo ni confirma gratuidad.
4. Crear el deployment de grupo solo dentro del alcance de costo acordado. Registrar IDs, estado y salidas; no repetir una creación a ciegas ante timeout.
5. Comprobar VM, disco, red, salida, estado de cloud-init, Docker y memoria. Etiquetar también el disco creado implícitamente con `project=CERES`.
6. Registrar resultado real en este documento. No confundir `validate` exitoso con recursos creados, ni VM creada con aplicación desplegada.

Los parámetros son ubicación, prefijo, tamaño, usuario/clave pública, CIDR de administración opcional y cloud-init codificado. La clave privada no se lee para crear Azure y no se almacena en el repositorio. El cloud-init no contiene secretos de aplicación.

## Contrato con el agente de desarrollo

Entregar Dockerfiles de producción y Compose con Next.js, FastAPI, PostgreSQL y proxy HTTPS. Preparar el artefacto de Next.js fuera del VPS y limitar memoria/logs. Un worker API inicial; PostgreSQL ajustado al consumo de la demo. Los límites concretos se fijan después de medir, no por asumir que 1 GiB siempre alcanza.

Transferir imágenes mediante un canal autorizado o registro ya aprobado; no publicar código/imágenes privadas en un registro público por conveniencia. Configurar credenciales en el servidor, fuera de git y de los datos de inicialización. No incluirlas en comandos que se registren ni en la imagen.

El proxy servirá frontend y API bajo el mismo origen y terminará HTTPS; utilizar el FQDN asignado o un dominio del usuario si existe. Obtener y comprobar certificado antes de habilitar el login público. Migraciones y seed se ejecutan explícitamente; un redeploy no debe reiniciar o borrar el volumen PostgreSQL.

Antes de publicar: respaldo comprobado, healthchecks, HTTPS/cookies/CSRF, aislamiento entre cuentas, NASA real y asistente IA con configuración efectiva. Mantener las claves del proveedor exclusivamente en backend. No afirmar una validación de campo por haber desplegado el software.

## Operación, datos y apagado

- Registrar identificadores CERES, versión de imagen, migración, fuentes NASA y configuración no secreta de cada publicación.
- Respaldo PostgreSQL y procedimiento de restauración comprobado antes de actualizaciones relevantes; copiar el respaldo fuera de la misma VM según un destino autorizado.
- Medir consumo y crédito; evitar monitoreo de pago no solicitado. Un presupuesto/alerta no debe tratarse como un corte de gasto garantizado.
- Para dejar de consumir cómputo, desasignar la VM desde Azure; apagar solo el sistema invitado no equivale a desasignarla.
- Disco e IP pueden seguir costando con VM desasignada. El disco y NIC se preservan al eliminar la VM por separado; limpiar únicamente recursos CERES enumerados, después de respaldar datos y con autorización para la eliminación.
- **Nunca eliminar `rodrygo-resource-group` para limpiar CERES**, porque aloja otros proyectos. No modificar ni detener sus servicios para obtener cuota.
