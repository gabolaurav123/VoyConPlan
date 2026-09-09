# Validación

npm test ejecuta reglas de dominio y protección de la proyección compartida.
node --experimental-strip-types tests/api.integration.mjs ejecuta peticiones al servidor local en localhost:3000 con la identidad de desarrollo de Sites. Esta prueba supone un viaje previo y Free con límite 2; crea y borra otro viaje de prueba, consumiendo cuota local. No ejecutar contra producción.
Las pruebas E2E con navegador se realizan sobre la misma vista local. La identidad local seedy@sites.test simula el inicio de sesión; no prueba dos identidades reales del proveedor SIWC.
