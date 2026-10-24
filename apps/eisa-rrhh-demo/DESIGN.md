# EISA Data Assistant — referencia visual

Referencia: https://ei.cl/, consultada el 23 de octubre de 2026 mediante Firecrawl
(`branding`, HTML, Markdown y captura de página completa). La captura se descargó
y se inspeccionó visualmente. No se replica el sitio corporativo ni sus cifras.

Se observaron una cabecera blanca con logo cian, tipografía sans serif,
titulares de peso alto, secciones amplias y paneles azul oscuro. La extracción
reportó `#0598D5` como primario, `#001951` como secundario y `#268ACA` como acento,
sobre blanco. Reportó Dosis, Raleway y Lato; para esta SPA se usa la pila local
Arial/Helvetica/sans-serif para evitar conexiones externas y mantener CSP estricta.
Los tamaños de texto extraídos de la web no se trasladaron a la interfaz de chat.

| Token | Valor | Procedencia |
|---|---|---|
| Primario | `#0598D5` | Extracción de branding del sitio |
| Azul oscuro | `#001951` | Extracción de branding del sitio |
| Fondo | `#F4F7FA` | Elección para el workspace |
| Superficie | `#FFFFFF` | Sitio y adaptación |
| Borde | `#E1E8EE` | Elección para el workspace |
| Espaciado | 4, 8, 12, 16, 20, 24 px | Escala propuesta para la app |
| Radio | 4–6 px | Adaptación, no medición exacta del sitio |

Logo: https://ei.cl/wp-content/uploads/2026/01/logotipo-echeverria-izquierdo.png.
Se descargó sin modificar a `web/public/ei-logo.png`; corresponde al logo
azul suministrado por el usuario. No es una reconstrucción ni una imagen generada.

El icono de Fabric se obtuvo sin modificar de `@fabric-msft/svg-icons@11.1.0`,
`svg/fabric_28_color.svg`, distribuido por Microsoft. Se muestra junto a la referencia
de arquitectura solicitada, con su nombre. Fuente y condiciones:
https://learn.microsoft.com/en-us/fabric/fundamentals/icons.

El layout de escritorio tiene preguntas, conversación y un panel SQL dedicado.
En móvil los paneles se apilan y el SQL permanece disponible. Estos layouts son
adaptaciones específicas para la app, comprobadas con Chromium, no inferencias
sobre el comportamiento móvil del sitio corporativo.

El aviso académico permanece visible. El identificador de workspace suministrado
por el usuario es una referencia de arquitectura; no se presenta como una conexión
verificada a Fabric. El origen efectivo de las consultas es SQLite3 Gold sintética.
