# Loading Screen Panel

Panel web para configurar la pantalla de carga del servidor (`qb-loading`)
sin tocar archivos ni reiniciar el servidor: imagenes del slideshow,
cancion de fondo, logo, textos rotativos y tiempos, todo editable desde
el navegador y guardado directo en un repositorio de GitHub.

Es un sitio 100% estatico (HTML/CSS/JS, sin frameworks ni backend),
pensado para hostear gratis en **GitHub Pages**. Los cambios se guardan
como commits en el propio repositorio, usando la API de GitHub desde el
navegador.

## Como funciona

- Este panel lee y escribe un archivo `config.json` (y sube imagenes /
  audio a `assets/`) directamente en un repo de GitHub, usando la API
  de GitHub.
- El resource `qb-loading` del servidor (carpeta
  `resources/[qb]/qb-loading`) lee ese mismo `config.json` (via URL
  "raw" publica) cada vez que un jugador se conecta, y arma la pantalla
  de carga con esas imagenes/cancion/textos. Si no puede llegar a
  internet, usa un set de imagenes/audio locales de respaldo, para que
  la pantalla de carga nunca se rompa.
- El repo que aloja este panel (y sus assets) tiene que ser **publico**,
  porque el juego necesita poder descargar las imagenes/cancion sin
  ningun tipo de login. Esto es normal para pantallas de carga: ese
  contenido ya es visible para cualquiera que entre al server.
- Lo que SI esta protegido es quien puede *editar* el contenido: para
  entrar al panel hace falta una "clave de acceso", que en realidad es
  un **token de GitHub** (Personal Access Token) con permiso de
  escritura sobre este repo. Sin ese token, el panel no deja guardar
  nada. El token nunca queda guardado en el codigo del sitio, solo en
  el navegador de quien lo escribe (sessionStorage, o localStorage si
  tilda "Recordar en este dispositivo").

## Deploy (una sola vez)

1. **Crea un repositorio nuevo en GitHub**, publico, por ejemplo
   `loadscreen-panel`. Subi todo el contenido de esta carpeta a la
   rama `main`.

2. **Activa GitHub Pages**: en el repo, `Settings` -> `Pages` -> Source:
   `Deploy from a branch`, Branch: `main` / `/ (root)`. Guarda. Te va a
   quedar disponible en `https://<tu-usuario>.github.io/<tu-repo>/`
   despues de un par de minutos.

3. **Edita `site.config.js`** (en GitHub, se puede editar directo desde
   la web con el lapicito) y completa:

   ```js
   window.SITE_CONFIG = {
       owner: 'tu-usuario-de-github',
       repo: 'loadscreen-panel',
       branch: 'main',
       configPath: 'config.json',
       imagesPath: 'assets/images',
       audioPath: 'assets/audio'
   };
   ```

4. **Crea un token de acceso (Personal Access Token)** para poder
   guardar cambios desde el panel:
   - GitHub -> `Settings` (de tu cuenta) -> `Developer settings` ->
     `Personal access tokens` -> `Fine-grained tokens` -> `Generate new token`.
   - `Repository access`: `Only select repositories` -> elegi este repo.
   - `Permissions` -> `Repository permissions` -> `Contents`: `Read and write`.
   - Genera el token y **compartilo solo con las personas de confianza**
     que van a poder editar la pantalla de carga (es, en la practica, la
     "contraseña" del panel). Se puede revocar/regenerar en cualquier
     momento desde GitHub si se filtra o alguien deja de tener acceso.

5. **Apunta `qb-loading` a este repo**: en
   `resources/[qb]/qb-loading/html/app.js`, completa la constante
   `REMOTE_CONFIG_URL` con la URL "raw" de tu `config.json`, por ejemplo:

   ```js
   const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/tu-usuario/loadscreen-panel/main/config.json';
   ```

   (Alternativa mas rapida de actualizar, usando jsDelivr como CDN,
   opcional: `https://cdn.jsdelivr.net/gh/tu-usuario/loadscreen-panel@main/config.json`)

6. Entra a `https://<tu-usuario>.github.io/<tu-repo>/`, pega el token
   del paso 4, y ya podes cargar imagenes, cancion, logo y textos. Los
   cambios quedan reflejados en el juego la proxima vez que alguien se
   conecte (puede tardar unos minutos si usas jsDelivr, por el cache
   del CDN; con raw.githubusercontent.com es casi inmediato).

## Uso del panel

- **Imagenes**: se suben directo desde tu PC, quedan en el slideshow en
  el orden que se muestran (se puede reordenar con las flechas). El
  boton ✕ las saca de la lista y borra el archivo del repo.
- **Cancion de fondo**: subi un mp3/ogg, ajusta el volumen con el
  control deslizante. "Quitar cancion" deja la pantalla de carga sin
  musica.
- **Logo**: opcional, aparece abajo a la izquierda.
- **Textos rotativos**: tips/avisos que van rotando arriba a la
  izquierda (por ejemplo, comandos utiles o el link del Discord).
- **Tiempos**: cada cuantos segundos rota la imagen y cada cuanto rota
  el texto.
- **Vista previa en vivo**: se actualiza sola mientras editas, incluso
  antes de guardar, para que veas como va a quedar.
- **Guardar cambios**: los textos/tiempos/orden se guardan recien al
  apretar este boton (las imagenes/cancion se suben apenas las
  seleccionas, ya quedan en el repo, pero el `config.json` que las
  referencia se actualiza al guardar).

## Seguridad, notas importantes

- Cualquiera que entre a la URL del panel puede VER el formulario de
  login, pero sin el token no puede leer ni escribir nada (la API de
  GitHub lo rechaza).
- El token da acceso de escritura **solo a este repo** si lo creaste
  como "fine-grained" y limitado como se explica arriba. Aun asi,
  tratalo como una contraseña: no lo publiques, y regeneralo si se
  filtra.
- Si en algun momento queres cortarle el acceso a alguien, regenera el
  token en GitHub (esto invalida el anterior para todos) y compartí el
  nuevo solo con quienes deban seguir teniendo acceso.
