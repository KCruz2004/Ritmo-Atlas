// Los datos externos se insertan como texto, nunca como HTML.
const $ = id => document.getElementById(id);
const PAGE_SIZE = 20;
let allSongs = [];   // canciones descargadas de la API
let filtered = [];   // canciones que cumplen búsqueda + filtros
let page = 1, controller;

const normalize = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const totalPages = () => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

function formatDuration(ms) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function field(parent, label, value) {
  const dt = document.createElement('dt'); dt.textContent = label;
  const dd = document.createElement('dd'); dd.textContent = value || 'No disponible';
  parent.append(dt, dd);
}
function card(song) {
  const article = document.createElement('article');
  if (song.art) {
    const img = document.createElement('img');
    img.src = song.art; img.alt = `Portada de ${song.album || song.title}`; img.loading = 'lazy'; img.className = 'art';
    img.addEventListener('error', () => { img.hidden = true; });
    article.append(img);
  }
  const body = document.createElement('div'); body.className = 'content';
  const h = document.createElement('h2'); h.textContent = song.title;
  const dl = document.createElement('dl');
  [['Artista', song.artist], ['Álbum', song.album], ['Género', song.genre],
   ['Año', song.year ? String(song.year) : ''], ['Duración', formatDuration(song.duration)],
   ['Contenido', song.explicit ? 'Explícito' : 'Sin marca explícita']].forEach(([k, v]) => field(dl, k, v));
  body.append(h, dl); article.append(body); $('grid').append(article);
}
function navigation() {
  $('prev').disabled = page <= 1; $('next').disabled = page >= totalPages();
  $('page').textContent = `Página ${page} de ${totalPages()}`;
}

// --- Filtros dinámicos: se construyen con los valores reales que devuelve la API ---
function fillSelect(select, firstLabel, options) {
  select.replaceChildren(new Option(firstLabel, ''));
  options.forEach(([value, text]) => select.append(new Option(text, value)));
}
function populateFilters() {
  const genres = [...new Set(allSongs.map(s => s.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const decades = [...new Set(allSongs.filter(s => s.year).map(s => Math.floor(s.year / 10) * 10))].sort((a, b) => b - a);
  fillSelect($('genre'), 'Todos', genres.map(g => [g, g]));
  fillSelect($('decade'), 'Todas', decades.map(d => [String(d), `${d}s`]));
  $('explicit').value = ''; $('query').value = '';
}

// --- Búsqueda y filtros implementados en JavaScript sobre los datos descargados ---
function applyFilters() {
  const q = normalize($('query').value);
  const genre = $('genre').value, decade = $('decade').value, explicit = $('explicit').value;
  filtered = allSongs.filter(s =>
    (!q || normalize(`${s.title} ${s.artist} ${s.album}`).includes(q)) &&
    (!genre || s.genre === genre) &&
    (!decade || (s.year !== null && Math.floor(s.year / 10) * 10 === Number(decade))) &&
    (explicit === '' || (explicit === 'yes' ? s.explicit : !s.explicit)));
  page = 1; renderPage();
}
function renderPage() {
  page = Math.min(page, totalPages());
  $('grid').replaceChildren();
  filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).forEach(card);
  $('status').textContent = !allSongs.length ? ''
    : filtered.length ? `${filtered.length} de ${allSongs.length} canciones · ${Math.min(PAGE_SIZE, filtered.length - (page - 1) * PAGE_SIZE)} en esta página`
    : 'Sin resultados. Cambia la búsqueda o los filtros.';
  navigation();
}

// --- Consulta a la API pública (iTunes Search API) ---
function buildURL() {
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', $('term').value.trim() || 'rock');
  url.searchParams.set('media', 'music');
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', '200');
  return url;
}
function toSong(s) {
  return {
    title: s.trackName, artist: s.artistName, album: s.collectionName || '', genre: s.primaryGenreName || '',
    year: s.releaseDate ? Number(s.releaseDate.slice(0, 4)) || null : null,
    duration: s.trackTimeMillis || 0, explicit: s.trackExplicitness === 'explicit',
    art: s.artworkUrl100 ? s.artworkUrl100.replace('100x100', '300x300') : ''
  };
}
async function loadSongs() {
  controller?.abort(); controller = new AbortController();
  const active = controller;
  const timeout = setTimeout(() => active.abort(), 20000);
  $('status').textContent = 'Consultando la API…'; $('grid').replaceChildren();
  $('prev').disabled = true; $('next').disabled = true;
  try {
    const response = await fetch(buildURL(), { signal: active.signal });
    if (response.status === 403 || response.status === 429) throw new Error('demasiadas consultas, espera un minuto');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (active !== controller) return;
    allSongs = (data.results || []).filter(s => s.trackName).map(toSong);
    populateFilters();
    if (!allSongs.length) {
      filtered = []; page = 1; renderPage();
      $('status').textContent = 'No se encontraron canciones para esa búsqueda.';
      return;
    }
    applyFilters();
  } catch (error) {
    if (active !== controller) return;
    $('status').textContent = `No se pudo consultar la API (${error.name === 'AbortError' ? 'tiempo de espera agotado' : error.message}). Revisa Internet y presiona Cargar canciones para reintentar.`;
    $('page').textContent = 'Consulta pendiente';
  } finally { clearTimeout(timeout); }
}

$('fetchForm').addEventListener('submit', e => { e.preventDefault(); loadSongs(); });
$('filters').addEventListener('submit', e => e.preventDefault());
$('filters').addEventListener('input', applyFilters);
$('reset').addEventListener('click', () => { $('filters').reset(); applyFilters(); });
$('prev').addEventListener('click', () => { if (page > 1) { page--; renderPage(); } });
$('next').addEventListener('click', () => { if (page < totalPages()) { page++; renderPage(); } });
loadSongs();