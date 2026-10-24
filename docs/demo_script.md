# Script de Demo: AmalIA - Cinépolis Core 🎬

Este guion está diseñado para demostrar la capacidad de AmalIA de profundizar en datos críticos de operación y finanzas con una interfaz visual premium.

---

## ⚡ Cheat Sheet: Preguntas Clave
| Acto | Objetivo | Pregunta (Prompt) |
| :--- | :--- | :--- |
| **1. Analítica** | Gráficos de Productividad | *"¿AmalIA, cómo va la productividad de GBS este mes? Necesito una comparativa visual por área."* |
| **2. Caja Chica** | Gestión y Auditoría | *"¿Cuáles son los registros de caja chica pendientes de aprobación?"* |
| **3. Conciliación** | Detección de Anomalías | *"¿Hay alguna anomalía en la conciliación de hoy? Dime la razón exacta de la excepción del Cine 105."* |
| **4. Drill Down** | Árbol de Dependencias | *"¿Cómo se concilió el depósito consolidado semanal (BT-0004)? Muéstrame el desglose profundo."* |
| **5. Acción** | Aprobación por Voz | *"AmalIA, aprueba la solicitud PC-0001 de María Rojas."* |
| **6. Gestión** | Ciclo CRUD Vivo | *"Crea un pedido de caja chica de 1200 pesos para Mantenimiento... ahora cámbiale el monto a 1500."* |

---

## ## Acto 1: Introducción y Análisis Visual 📊
**Mensaje**: *"AmalIA no solo habla, ella analiza y visualiza."*

1.  **Pregunta**: "¿AmalIA, cómo va la productividad de GBS este mes? Necesito una comparativa visual por área."
    -   *Lo que verás*: Resumen verbal y un **gráfico de barras dinámico** (Cian para Compras, Púrpura para Cuentas por Pagar, Esmeralda para Ingresos).
    -   **Tip**: Resalta que las etiquetas son totalmente legibles y los colores mapean áreas reales del ERP (dim_processes).

2.  **Pregunta de profundización**: "¿Qué área tiene mayor volumen de productividad?"
    -   *Lo que verás*: Análisis de datos técnicos directo de la base de datos (fact_activity).

## ## Acto 2: Visibilidad y Control (Caja Chica) 💸
**Mensaje**: *"Transparencia total en el flujo de efectivo."*

3.  **Pregunta**: "¿AmalIA, cuáles son todos los registros de caja chica que tenemos?"
4.  **Pregunta de filtrado**: "Ahora fíltrame solo las que están **pendientes** de aprobación."
    -   *Lo que verás*: Filtrado instantáneo en la tabla de evidencias. Verás la solicitud de **Aminael (PC-7521)** y la de **María Rojas (PC-0001)** que acabamos de resetear para la demo.

## ## Acto 3: Integridad Financiera (Historiador) 🔍
**Mensaje**: *"Detección proactiva y auditoría histórica total."*

5.  **Pregunta**: "¿AmalIA, muéstrame el historial completo de conciliaciones bancarias?"
    -   *Lo que verás*: Listado total de registros.
6.  **Pregunta**: "Dime la razón exacta de la excepción del **Cine 105 (BT-0002)** y compara los montos."
    -   *Lo que verás*: Amalia identificará la **Diferencia de 50 MXN (posible ajuste)**.

## ## Acto 4: Drill Down (Análisis Jerárquico) 🌳
**Mensaje**: *"Descifrando la complejidad de la data."*

7.  **Pregunta**: "¿Cómo se concilió el depósito consolidado semanal **BT-0004**? Necesito ver el desglose."
    -   *Lo que verás*: Generación de un **Árbol de Dependencias (Dependency Graph)** vinculando el depósito bancario de 55,000 MXN con múltiples registros de PeopleSoft.
    -   **Tip**: Observen cómo el grafo muestra la relación jerárquica: Banco -> Match -> ERP Ledger.

## ## Acto 5: Aprobación y Ciclo de Vida ⚡
**Mensaje**: *"Acciones críticas con la simplicidad de la voz."*

8.  **Pregunta**: "AmalIA, aprueba la solicitud de caja chica **PC-0001** de María Rojas."
    -   *Lo que verás*: Confirmación de aprobación y actualización en tiempo real del estado a `APPROVED`.

9.  **Interacción CRUD**: *"Crea un pedido de 1200 para Mantenimiento... cámbiale el monto a 1500... ahora bórralo."*
    -   *Resultado*: Demostración de control total sobre los registros operativos.

---
> [!IMPORTANT]
> **Base de Datos Activa**: La demo utiliza `apps/api/data/amalia.db`. He reseteado el estado de `PC-0001` a `PENDING_APPROVAL` para que el Acto 5 funcione perfectamente.
