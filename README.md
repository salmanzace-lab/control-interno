# Control Interno 2026 · GitHub Pages + Google Apps Script + Drive

## Arquitectura elegida

- **GitHub Pages:** interfaz web estática.
- **Acceso compartido por área:** selección de área + código compartido del área (no cuentas individuales).
- **Google Apps Script:** backend que valida códigos, registra respuestas y administra las carpetas.
- **Google Sheets:** base de datos ligera de respuestas y metadatos de archivos.
- **Google Drive institucional:** archivos de evidencia en carpetas privadas.
- **Acciones con varias áreas:** cada área genera un registro independiente.
- **Tablero administrativo:** consulta consolidada por área, componente y estado.

La estructura del Plan 2026 se importa desde `data/plan2026.json` (96 acciones y documentos de referencia asociados). El Excel de 2025 y el código anterior fueron referencias conceptuales; no se migraron respuestas ni IDs de Drive.

## A. Preparar Google Drive y Sheets

1. Desde una cuenta institucional autorizada, crea una carpeta raíz nueva: `Control Interno 2026 - Evidencias`.
2. Crea una hoja de cálculo nueva: `Control Interno 2026 - Registro de entregas`.
3. Copia el ID de ambos recursos desde sus URL.
4. No reutilices carpetas o archivos del ejercicio 2025 sin autorización.
5. Mantén la carpeta raíz privada y compártela únicamente con quienes deban administrar las evidencias. No uses "cualquiera con el enlace".

## B. Configurar Apps Script

1. Entra a `script.google.com` con la cuenta institucional que será propietaria de los archivos.
2. Crea un proyecto nuevo y copia `apps-script/Code.gs`.
3. En Project Settings, agrega estas Script Properties:

| Propiedad | Valor |
|---|---|
| `SPREADSHEET_ID` | ID de la hoja de cálculo nueva |
| `DRIVE_FOLDER_ID` | ID de la carpeta raíz de evidencias |
| `ADMIN_TOKEN` | Clave administrativa larga y aleatoria |
| `AREA_CODES_JSON` | JSON con el código de cada área |

Ejemplo ilustrativo de `AREA_CODES_JSON` (cambia nombres y códigos; no uses estos valores en producción):

```json
{
  "Dirección de Planeación": "cambia-este-codigo",
  "Dirección de Administración": "otro-codigo-distinto"
}
```

4. Ejecuta manualmente `setup_()` desde el editor y autoriza los permisos solicitados. Se crearán las pestañas `Respuestas` y `Evidencias`.
5. Despliega como **Web app**:
   - Execute as: **Me** (la cuenta institucional propietaria).
   - Who has access: **Anyone**.
6. Copia la URL terminada en `/exec`.

> La opción "Anyone" permite que el navegador de GitHub Pages llegue al endpoint. Por eso los códigos compartidos son controles básicos, no autenticación fuerte. Antes de usar datos institucionales reales, TI debe revisar este diseño. Si la institución exige identidad verificable por persona, este modo compartido no cumple ese requisito.

## C. Conectar GitHub Pages

1. Duplica `config.example.js` y nómbralo `config.js`.
2. Pega la URL `/exec` del despliegue de Apps Script en `API_URL`.
3. Sube el contenido de esta carpeta a un repositorio GitHub.
4. En Settings > Pages, publica la rama `main`, carpeta `/ (root)`.
5. Prueba la URL con códigos de área de prueba, no con evidencias reales inicialmente.

## D. Cómo se organiza Drive

El backend crea automáticamente:

```text
Control Interno 2026 - Evidencias/
  Dirección de Planeación/
    Accion_1/
    Accion_2/
  Dirección de Administración/
    Accion_1/
```

Cada área captura su propia respuesta para una acción compartida. Las carpetas se nombran por área y número de acción.

## E. Tablero administrativo

El botón "Acceso de administración" solicita el `ADMIN_TOKEN`. El tablero muestra los registros guardados y los enlaces de Drive asociados. Filtra por área, componente y estado.

El token administrativo se transmite como parámetro en la consulta JSONP del prototipo. **No es una solución de seguridad robusta**: puede quedar expuesto en historial, registros o herramientas del navegador. Para una puesta en producción, sustituirlo por autenticación institucional real y una API con autorización del lado servidor. No compartir el token por correo o chat.

## F. Límites de la primera versión

- Hasta 5 archivos por envío.
- Máximo 5 MB por archivo.
- El navegador envía archivos codificados en Base64 a Apps Script; esto tiene límites de tamaño y tiempo. Para lotes grandes, conviene implementar carga directa autenticada a Drive.
- Las respuestas se pueden actualizar por combinación de acción + área. Los archivos nuevos se agregan a la carpeta y no se borran automáticamente los anteriores.
- No hay aprobación/rechazo, comentarios del administrador ni bitácora inmutable.
- Los códigos de área son compartidos: no permiten atribuir con certeza quién realizó una captura.
- El indicador de avance cuenta registros, no determina si la evidencia es suficiente.
- La administración ve enlaces de Drive. La carpeta raíz debe permanecer restringida a administradores autorizados.

## G. Validaciones imprescindibles antes de liberar

1. Confirmar con TI que Google Apps Script y Drive institucional están autorizados para este uso.
2. Probar que el código de un área no permite consultar otra.
3. Probar acceso de administración, registro, actualización y carga de varios tipos de archivo.
4. Definir responsables de altas/bajas y rotación de códigos.
5. Definir retención, respaldo, nomenclatura y eliminación documental.
6. Revisar las cinco acciones sin referencia documental coincidente y validar la matriz de áreas responsables.
7. No usar información sensible en el repositorio GitHub. El catálogo de acciones es visible públicamente si el repositorio/página es público.

## Archivos

```text
/
├── index.html
├── styles.css
├── app.js
├── config.example.js
├── data/plan2026.json
└── apps-script/
    ├── Code.gs
    └── appsscript.json
```
