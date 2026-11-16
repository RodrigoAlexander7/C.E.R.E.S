"""Aporte alimentario potencial; separado de la fertilidad y de resultados clínicos.

Referencias cualitativas de alimentos, no cantidades cosechadas o consumidas.
La composición no prueba acceso, consumo, adecuación de dieta ni efecto sanitario.
"""

from __future__ import annotations

from copy import deepcopy

INS_FOOD_SOURCE_ID = "INS-TPCA-ALIMENTOS"
FAO_PULSES_SOURCE_ID = "FAO-LEGUMBRES-ALIMENTACION"
HIS_SOURCE_ID = "INS-SIEN-HIS-ADOLESCENTES-AREQUIPA-2026-08"

# Código y denominación de las Tablas Peruanas, consultadas el 15-nov-2026.
# Los códigos son referencias de alimento; no son análisis del producto de un lote.
_FOODS = {
    "maiz_grano": (
        "Maíz amarillo", "A29", ("carbohidratos", "proteína vegetal"),
        "Si el grano es apto y se destina a alimentación humana, puede aportar energía "
        "y proteína vegetal. El maíz amarillo duro del catálogo puede destinarse a "
        "alimentación animal; su aporte humano directo queda condicionado al destino.",
    ),
    "frejol_grano": (
        "Frejol canario (grano seco; consumir preparado)", "T15/T16",
        ("proteína vegetal", "fibra dietaria", "hierro"),
        "El frejol puede diversificar la alimentación con proteína vegetal, fibra y hierro. "
        "T15 corresponde al grano seco y T16 al cocido; no se equiparan sus cantidades. "
        "El hierro presente no equivale a hierro absorbido ni a un cambio de hemoglobina.",
    ),
    "cebolla": (
        "Cebolla de cabeza", "B29", ("fibra dietaria", "vitamina C"),
        "La cebolla aporta fibra y vitamina C como parte de las preparaciones. "
        "La ficha es de cebolla de cabeza; no caracteriza una variedad local específica.",
    ),
    "papa": (
        "Papa blanca (referencia de tubérculo)", "U19", ("carbohidratos", "vitamina C"),
        "La papa puede aportar energía procedente de carbohidratos y vitamina C. "
        "La variedad y la preparación cambian su composición.",
    ),
    "ajo": (
        "Ajo sin cáscara", "B13", ("carbohidratos", "fibra dietaria"),
        "El ajo contiene carbohidratos y fibra. Su uso como condimento no permite "
        "suponer un aporte importante por ración.",
    ),
    "arveja_verde": (
        "Arveja fresca sin vaina", "T2", ("proteína vegetal", "fibra dietaria", "vitamina C"),
        "La parte comestible de la arveja verde aporta proteína vegetal, fibra y vitamina C. "
        "La referencia excluye la vaina; no se aplica al peso total cosechado con vaina.",
    ),
    "haba_verde": (
        "Habas frescas sin cáscara y sin vaina", "T47",
        ("proteína vegetal", "fibra dietaria", "vitamina C"),
        "Las habas frescas aportan proteína vegetal, fibra y vitamina C. "
        "La referencia corresponde a la parte comestible sin cáscara ni vaina.",
    ),
    "tomate": (
        "Tomate", "B79", ("vitamina C", "fibra dietaria"),
        "El tomate puede diversificar las hortalizas disponibles y aportar vitamina C y fibra.",
    ),
    "zanahoria": (
        "Zanahoria", "B85", ("betacaroteno (provitamina A)", "fibra dietaria"),
        "La zanahoria aporta betacaroteno, precursor de vitamina A, y fibra dietaria.",
    ),
    "trigo": (
        "Trigo (grano)", "A73", ("carbohidratos", "proteína vegetal", "fibra dietaria"),
        "El trigo aporta carbohidratos, proteína vegetal y fibra. "
        "La ficha del grano no representa harina refinada ni harina fortificada.",
    ),
    # Propuestas del segundo XLSX, contrastadas con INS; no activan cultivos
    # ni policultivos en los catálogos agronómicos.
    "maiz_choclo": (
        "Maíz, grano fresco (choclo)", "A34",
        ("carbohidratos", "proteína vegetal", "fibra dietaria"),
        "El grano fresco de choclo aporta carbohidratos, proteína vegetal y fibra. "
        "No equivale al maíz amarillo duro seco ni al peso de una mazorca completa.",
    ),
    "zapallo_macre": (
        "Zapallo macre", "B89", ("betacaroteno (provitamina A)", "fibra dietaria"),
        "El zapallo macre contiene betacaroteno y fibra. "
        "La ficha no representa todas las variedades de zapallo ni un tratamiento de anemia.",
    ),
    "aji_amarillo": (
        "Ají amarillo fresco", "B3", ("vitamina C",),
        "El ají amarillo fresco contiene vitamina C; su aporte depende de la porción y preparación. "
        "La fibra dietaria no está reportada en esta ficha y no se interpreta como cero.",
    ),
}
_ALIASES = {"cebolla_roja": "cebolla"}
_ASSOCIATIONS = {"maiz_frejol_asociado": ("maiz_grano", "frejol_grano")}


def nutrition_impact(crop_ids: list[str], regional_context: dict | None) -> dict:
    """Devuelve una ficha por cultivo único, en orden de entrada.

    Expande únicamente asociaciones conocidas. Los cultivos sin ficha conservan
    nutrients=None (desconocido); alfalfa es forraje sin aporte humano calculado.
    No lee archivos, no llama modelos y devuelve copias independientes del contexto.
    El llamador debe cargar/validar y congelar el contexto con los inputs del run.
    """
    if not isinstance(crop_ids, list) or any(not isinstance(c, str) or not c.strip() for c in crop_ids):
        raise ValueError("crop_ids debe ser una lista de identificadores no vacíos")
    if regional_context is not None and (
        not isinstance(regional_context, dict)
        or regional_context.get("region") != "Arequipa"
        or regional_context.get("region_code") != "04"
    ):
        raise ValueError("El contexto nutricional debe corresponder exclusivamente a Arequipa (04)")
    if regional_context is not None:
        context_sources = regional_context.get("source_ids", [])
        if not isinstance(context_sources, list) or any(not isinstance(s, str) or not s.strip() for s in context_sources):
            raise ValueError("source_ids del contexto debe ser una lista de identificadores no vacíos")

    expanded = list(dict.fromkeys(part for c in crop_ids for part in _ASSOCIATIONS.get(c, (c,))))
    foods = []
    source_ids = set()
    for crop_id in expanded:
        profile = _FOODS.get(_ALIASES.get(crop_id, crop_id))
        if profile is None:
            forage = crop_id == "alfalfa"
            foods.append({
                "crop_id": crop_id,
                "food": None,
                "status": "forraje" if forage else "sin_evidencia",
                "nutrients": None,
                "explanation": (
                    "La alfalfa del catálogo es forraje; no se equipara con brotes comestibles. "
                    "No se calcula su conversión en leche, "
                    "carne ni nutrientes para personas."
                    if forage else "No hay una ficha alimentaria verificada para este cultivo; su aporte es desconocido."
                ),
                "source_ids": [],
                "reference": None,
            })
            continue
        food, code, nutrients, explanation = profile
        foods.append({
            "crop_id": crop_id,
            "food": food,
            "status": "potencial_condicionado" if crop_id == "maiz_grano" else "referencia_alimentaria",
            "nutrients": list(nutrients),
            "explanation": explanation,
            "source_ids": [INS_FOOD_SOURCE_ID],
            "reference": {"source_id": INS_FOOD_SOURCE_ID, "food_code": code},
        })
        source_ids.add(INS_FOOD_SOURCE_ID)

    explanation = (
        "El aporte alimentario es potencial y cualitativo: depende del destino humano, "
        "la parte comestible, la preparación, el acceso y el consumo efectivo. "
        "No se estiman raciones ni reducciones de anemia o desnutrición por sembrar estos cultivos."
    )
    if "frejol_grano" in expanded and any(c in expanded for c in ("maiz_grano", "maiz_choclo", "trigo")):
        explanation += (
            " Si se consumen juntos, cereal y frejol pueden complementar los aminoácidos "
            "de la comida (FAO). Esto no demuestra un beneficio clínico ni una ventaja "
            "agronómica de la asociación; no se suman rendimientos de monocultivos."
        )
        source_ids.add(FAO_PULSES_SOURCE_ID)
    if regional_context is not None:
        source_ids.update(context_sources)
        explanation += (
            " El contexto SIEN-HIS describe adolescentes evaluados en establecimientos "
            "de salud de Arequipa; no mide fertilidad del suelo ni predice el efecto de la cosecha. "
            "Se presenta como contexto agregado, sin puntuación económica ni de salud individual."
        )
    else:
        explanation += " El contexto regional no está disponible."
    return {
        "foods": foods,
        "explanation": explanation,
        "source_ids": sorted(source_ids),
        "regional_context": deepcopy(regional_context),
    }
