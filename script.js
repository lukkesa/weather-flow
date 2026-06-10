/**
 * WeatherFlow – script.js
 * Hlavní logika aplikace: geolokace, Open-Meteo API, UI rendering
 */

'use strict';

// ============================================================
//  KONFIGURACE
// ============================================================

const CONFIG = {
  // Open-Meteo API (bez API klíče)
  API_BASE: 'https://api.open-meteo.com/v1/forecast',
  // Geocoding API pro vyhledávání měst
  GEO_API: 'https://geocoding-api.open-meteo.com/v1/search',
  // Reverse geocoding přes nominatim
  REVERSE_GEO: 'https://nominatim.openstreetmap.org/reverse',
  // Délka cache (ms) — 10 minut
  CACHE_TTL: 10 * 60 * 1000,
  // Klíče pro localStorage
  STORAGE: {
    LAST_LOC:   'wf_last_location',
    THEME:      'wf_theme',
    LAST_DATA:  'wf_last_data',
  }
};

// ============================================================
//  WMO WEATHER CODE → popis + ikona (SVG inline)
// ============================================================

const WMO = {
  getInfo(code) {
    const map = {
      0:  { label: 'Jasno',              icon: 'clear' },
      1:  { label: 'Převážně jasno',     icon: 'mostly-clear' },
      2:  { label: 'Polojasno',          icon: 'partly-cloudy' },
      3:  { label: 'Zataženo',           icon: 'cloudy' },
      45: { label: 'Mlha',               icon: 'fog' },
      48: { label: 'Namrzající mlha',    icon: 'fog' },
      51: { label: 'Mírná mrholení',     icon: 'drizzle' },
      53: { label: 'Mrholení',           icon: 'drizzle' },
      55: { label: 'Husté mrholení',     icon: 'drizzle' },
      61: { label: 'Slabý déšť',         icon: 'rain' },
      63: { label: 'Déšť',               icon: 'rain' },
      65: { label: 'Silný déšť',         icon: 'rain' },
      71: { label: 'Slabý sněžení',      icon: 'snow' },
      73: { label: 'Sněžení',            icon: 'snow' },
      75: { label: 'Silné sněžení',      icon: 'snow' },
      77: { label: 'Sněhové vločky',     icon: 'snow' },
      80: { label: 'Slabé přeháňky',     icon: 'showers' },
      81: { label: 'Přeháňky',           icon: 'showers' },
      82: { label: 'Silné přeháňky',     icon: 'showers' },
      85: { label: 'Sněhové přeháňky',   icon: 'snow-showers' },
      86: { label: 'Silné sněhové přeháňky', icon: 'snow-showers' },
      95: { label: 'Bouřka',             icon: 'thunderstorm' },
      96: { label: 'Bouřka s krupobitím',icon: 'thunderstorm' },
      99: { label: 'Bouřka – silné krupobití', icon: 'thunderstorm' },
    };
    return map[code] ?? { label: 'Neznámé počasí', icon: 'cloudy' };
  },

  // Vrátí SVG string pro daný typ ikony
  getSVG(iconName, size = 64) {
    const s = size;
    const icons = {
      'clear': `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="14" fill="#FBBF24"/>
        <g stroke="#FBBF24" stroke-width="3" stroke-linecap="round">
          <line x1="32" y1="6" x2="32" y2="12"/>
          <line x1="32" y1="52" x2="32" y2="58"/>
          <line x1="6" y1="32" x2="12" y2="32"/>
          <line x1="52" y1="32" x2="58" y2="32"/>
          <line x1="14.1" y1="14.1" x2="18.4" y2="18.4"/>
          <line x1="45.6" y1="45.6" x2="49.9" y2="49.9"/>
          <line x1="14.1" y1="49.9" x2="18.4" y2="45.6"/>
          <line x1="45.6" y1="18.4" x2="49.9" y2="14.1"/>
        </g>
      </svg>`,

      'mostly-clear': `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="26" cy="26" r="12" fill="#FBBF24" opacity="0.9"/>
        <path d="M32 40 Q35 32 42 34 Q46 27 52 30 Q56 30 56 37 Q56 43 51 43 H26 Q21 43 21 37 Q21 33 24 35" fill="#CBD5E1"/>
      </svg>`,

      'partly-cloudy': `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="22" cy="24" r="10" fill="#FBBF24" opacity="0.85"/>
        <path d="M28 40 Q31 31 40 33 Q44 25 51 28 Q57 28 57 36 Q57 43 51 43 H24 Q18 43 18 37 Q18 33 22 35" fill="#94A3B8"/>
      </svg>`,

      'cloudy': `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M18 42 Q18 34 26 32 Q26 22 36 22 Q44 22 46 30 Q52 30 52 37 Q52 44 45 44 H22 Q18 44 18 42Z" fill="#94A3B8"/>
        <path d="M10 48 Q10 42 16 40 Q18 32 26 32 Q22 34 22 42 Q18 44 10 48Z" fill="#CBD5E1" opacity="0.6"/>
      </svg>`,

      'fog': `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <g stroke="#94A3B8" stroke-width="3" stroke-linecap="round" opacity="0.8">
          <line x1="12" y1="26" x2="52" y2="26"/>
          <line x1="16" y1="34" x2="48" y2="34"/>
          <line x1="20" y1="42" x2="44" y2="42"/>
        </g>
        <path d="M22 26 Q24 18 32 18 Q40 18 40 26" fill="#CBD5E1" opacity="0.5"/>
      </svg>`,

      'drizzle': `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M16 36 Q16 27 25 25 Q25 15 35 15 Q44 15 46 24 Q53 24 53 32 Q53 40 45 40 H20 Q16 40 16 36Z" fill="#94A3B8"/>
        <g stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round" opacity="0.8">
          <line x1="24" y1="46" x2="22" y2="54"/>
          <line x1="32" y1="46" x2="30" y2="54"/>
          <line x1="40" y1="46" x2="38" y2="54"/>
        </g>
      </svg>`,

      'rain': `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M14 35 Q14 26 24 24 Q24 14 34 14 Q44 14 46 23 Q53 23 53 31 Q53 39 45 39 H18 Q14 39 14 35Z" fill="#64748B"/>
        <g stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round">
          <line x1="22" y1="44" x2="18" y2="56"/>
          <line x1="32" y1="44" x2="28" y2="56"/>
          <line x1="42" y1="44" x2="38" y2="56"/>
        </g>
      </svg>`,

      'snow': `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M14 35 Q14 26 24 24 Q24 14 34 14 Q44 14 46 23 Q53 23 53 31 Q53 39 45 39 H18 Q14 39 14 35Z" fill="#94A3B8"/>
        <g fill="#93C5FD">
          <circle cx="22" cy="50" r="3"/>
          <circle cx="32" cy="52" r="3"/>
          <circle cx="42" cy="50" r="3"/>
        </g>
      </svg>`,

      'showers': `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="22" cy="22" r="9" fill="#FBBF24" opacity="0.7"/>
        <path d="M26 36 Q29 27 38 29 Q42 21 50 24 Q57 24 57 32 Q57 40 50 40 H22 Q16 40 16 35 Q16 31 20 33" fill="#64748B"/>
        <g stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round">
          <line x1="26" y1="44" x2="23" y2="53"/>
          <line x1="34" y1="44" x2="31" y2="53"/>
          <line x1="42" y1="44" x2="39" y2="53"/>
        </g>
      </svg>`,

      'snow-showers': `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="22" cy="22" r="9" fill="#FBBF24" opacity="0.7"/>
        <path d="M26 36 Q29 27 38 29 Q42 21 50 24 Q57 24 57 32 Q57 40 50 40 H22 Q16 40 16 35 Q16 31 20 33" fill="#94A3B8"/>
        <g fill="#BAE6FD">
          <circle cx="26" cy="50" r="3.5"/>
          <circle cx="36" cy="52" r="3.5"/>
          <circle cx="46" cy="50" r="3.5"/>
        </g>
      </svg>`,

      'thunderstorm': `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M12 34 Q12 25 22 23 Q22 13 32 13 Q42 13 44 22 Q52 22 52 30 Q52 38 44 38 H16 Q12 38 12 34Z" fill="#475569"/>
        <polygon points="34,38 28,50 33,50 27,62 40,46 35,46" fill="#FBBF24"/>
      </svg>`,
    };
    return icons[iconName] ?? icons['cloudy'];
  }
};

// ============================================================
//  STAV APLIKACE
// ============================================================

const state = {
  currentData: null,  // poslední data z API
  lastCoords: null,   // {lat, lon, name}
  theme: 'auto',      // 'light' | 'dark' | 'auto'
  searchTimeout: null,
};

// ============================================================
//  DOM REFERENCE
// ============================================================

const $ = id => document.getElementById(id);

const DOM = {
  splash:        $('splash'),
  splashStatus:  $('splash-status'),
  app:           $('app'),
  errorBanner:   $('error-banner'),
  errorText:     $('error-text'),
  cityName:      $('city-name'),
  updatedTime:   $('updated-time'),
  mainIcon:      $('main-weather-icon'),
  tempMain:      $('temp-main'),
  tempFeels:     $('temp-feels'),
  weatherDesc:   $('weather-desc'),
  humidity:      $('d-humidity'),
  precip:        $('d-precip'),
  wind:          $('d-wind'),
  pressure:      $('d-pressure'),
  uv:            $('d-uv'),
  visibility:    $('d-visibility'),
  hourlyScroll:  $('hourly-scroll'),
  dailyList:     $('daily-list'),
  searchInput:   $('city-search'),
  searchResults: $('search-results'),
  searchClear:   $('search-clear'),
  themeToggle:   $('theme-toggle'),
  gpsBtn:        $('gps-btn'),
  metaTheme:     $('meta-theme-color'),
};

// ============================================================
//  POMOCNÉ FUNKCE
// ============================================================

/** Zformátuje hodiny do "HH:MM" */
function fmtTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

/** Zformátuje den v týdnu */
function fmtDay(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Dnes';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return 'Zítra';
  return d.toLocaleDateString('cs-CZ', { weekday: 'long' });
}

/** Kapitalizuje první písmeno */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Převod stupňů na světovou stranu */
function windDirection(deg) {
  const dirs = ['S', 'SSV', 'SV', 'VSV', 'V', 'VJV', 'JV', 'JJV', 'J', 'JJZ', 'JZ', 'ZJZ', 'Z', 'ZSZ', 'SZ', 'SSZ'];
  return dirs[Math.round(deg / 22.5) % 16];
}

/** UV index → popis */
function uvLabel(uv) {
  if (uv <= 2) return 'Nízký';
  if (uv <= 5) return 'Střední';
  if (uv <= 7) return 'Vysoký';
  if (uv <= 10) return 'Velmi vysoký';
  return 'Extrémní';
}

// ============================================================
//  THEME MANAGEMENT
// ============================================================

function applyTheme(theme) {
  state.theme = theme;
  const isDark = theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  DOM.metaTheme.content = isDark ? '#0B1121' : '#3B82F6';
  localStorage.setItem(CONFIG.STORAGE.THEME, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ============================================================
//  GEOLOKACE
// ============================================================

function getGPSLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolokace není v tomto prohlížeči dostupná.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('Přístup k poloze byl zamítnut. Povolte jej v nastavení prohlížeče.'));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('Poloha není dostupná. Zkuste to znovu nebo vyhledejte město ručně.'));
            break;
          case err.TIMEOUT:
            reject(new Error('Zjišťování polohy trvá příliš dlouho. Zkuste to znovu.'));
            break;
          default:
            reject(new Error('Nepodařilo se zjistit polohu.'));
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

/** Obrácené geokódování: souřadnice → název místa */
async function reverseGeocode(lat, lon) {
  try {
    const url = `${CONFIG.REVERSE_GEO}?lat=${lat}&lon=${lon}&format=json&accept-language=cs`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'cs', 'User-Agent': 'WeatherFlow/1.0' }
    });
    if (!res.ok) throw new Error('Reverse geocoding selhal');
    const data = await res.json();
    const addr = data.address || {};
    return addr.city || addr.town || addr.village || addr.municipality || addr.county || 'Vaše poloha';
  } catch {
    return 'Vaše poloha';
  }
}

// ============================================================
//  OPEN-METEO API
// ============================================================

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude:  lat,
    longitude: lon,
    // Aktuální data
    current: [
      'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
      'weather_code', 'wind_speed_10m', 'wind_direction_10m',
      'surface_pressure', 'visibility', 'uv_index',
      'precipitation_probability', 'is_day'
    ].join(','),
    // Hodinová předpověď (48 hodin)
    hourly: [
      'temperature_2m', 'weather_code', 'precipitation_probability', 'is_day'
    ].join(','),
    // Denní předpověď (7 dní)
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min',
      'precipitation_probability_max'
    ].join(','),
    timezone:    'auto',
    forecast_days: 7,
  });

  const res = await fetch(`${CONFIG.API_BASE}?${params}`);
  if (!res.ok) throw new Error(`API chyba: ${res.status}`);
  return res.json();
}

// ============================================================
//  VYHLEDÁVÁNÍ MĚST
// ============================================================

async function searchCities(query) {
  const params = new URLSearchParams({ name: query, count: 6, language: 'cs', format: 'json' });
  const res = await fetch(`${CONFIG.GEO_API}?${params}`);
  if (!res.ok) throw new Error('Geocoding selhal');
  const data = await res.json();
  return data.results || [];
}

// ============================================================
//  RENDROVÁNÍ UI
// ============================================================

/** Zobrazí error banner */
function showError(msg) {
  DOM.errorText.textContent = msg;
  DOM.errorBanner.classList.remove('hidden');
  setTimeout(() => DOM.errorBanner.classList.add('hidden'), 8000);
}

/** Aktualizuje aktuální počasí v UI */
function renderCurrent(data, cityName) {
  const c = data.current;
  const code = c.weather_code;
  const info = WMO.getInfo(code);

  // Název + čas
  DOM.cityName.textContent = cityName;
  DOM.updatedTime.textContent = `Aktualizováno ${fmtTime(c.time)}`;

  // Ikona
  DOM.mainIcon.innerHTML = WMO.getSVG(info.icon, 64);

  // Teplota
  DOM.tempMain.textContent = `${Math.round(c.temperature_2m)}°`;
  DOM.tempFeels.textContent = `${Math.round(c.apparent_temperature)}°`;
  DOM.weatherDesc.textContent = info.label;

  // Detail
  DOM.humidity.textContent   = `${c.relative_humidity_2m} %`;
  DOM.precip.textContent     = `${c.precipitation_probability ?? 0} %`;
  DOM.wind.textContent       = `${Math.round(c.wind_speed_10m)} km/h ${windDirection(c.wind_direction_10m)}`;
  DOM.pressure.textContent   = `${Math.round(c.surface_pressure)} hPa`;
  DOM.uv.textContent         = `${Math.round(c.uv_index)} – ${uvLabel(c.uv_index)}`;
  const visMeter = c.visibility;
  DOM.visibility.textContent = visMeter >= 1000
    ? `${(visMeter / 1000).toFixed(1)} km`
    : `${visMeter} m`;

  DOM.weatherDesc.classList.add('fade-in');
  setTimeout(() => DOM.weatherDesc.classList.remove('fade-in'), 400);
}

/** Vykreslí hodinovou předpověď */
function renderHourly(data) {
  const { hourly, current } = data;
  const now = new Date(current.time);
  const nowHour = now.getHours();

  // Najdeme aktuální index
  const startIdx = hourly.time.findIndex(t => new Date(t) >= now);
  if (startIdx === -1) return;

  const items = [];
  // Zobrazíme 24 hodin od teď
  for (let i = startIdx; i < Math.min(startIdx + 24, hourly.time.length); i++) {
    const t = new Date(hourly.time[i]);
    const hr = t.getHours();
    const isNow = i === startIdx;
    const code = hourly.weather_code[i];
    const info = WMO.getInfo(code);
    const precip = hourly.precipitation_probability[i];

    const div = document.createElement('div');
    div.className = `hourly-item${isNow ? ' current-hour' : ''}`;
    div.setAttribute('role', 'listitem');
    div.innerHTML = `
      <span class="hourly-time">${isNow ? 'Nyní' : (hr < 10 ? '0' + hr : hr) + ':00'}</span>
      <span class="hourly-icon">${WMO.getSVG(info.icon, 28)}</span>
      <span class="hourly-temp">${Math.round(hourly.temperature_2m[i])}°</span>
      ${precip > 0 ? `<span class="hourly-precip">💧 ${precip}%</span>` : '<span class="hourly-precip" aria-hidden="true">&nbsp;</span>'}
    `;
    items.push(div);
  }

  DOM.hourlyScroll.innerHTML = '';
  items.forEach(item => DOM.hourlyScroll.appendChild(item));
}

/** Vykreslí denní předpověď */
function renderDaily(data) {
  const { daily } = data;

  DOM.dailyList.innerHTML = '';
  daily.time.forEach((dateStr, i) => {
    const code = daily.weather_code[i];
    const info = WMO.getInfo(code);
    const max  = Math.round(daily.temperature_2m_max[i]);
    const min  = Math.round(daily.temperature_2m_min[i]);

    const div = document.createElement('div');
    div.className = 'daily-item';
    div.setAttribute('role', 'listitem');
    div.innerHTML = `
      <span class="daily-day">${capitalize(fmtDay(dateStr))}</span>
      <span class="daily-icon">${WMO.getSVG(info.icon, 32)}</span>
      <div class="daily-temps">
        <span class="daily-high">${max}°</span>
        <span class="daily-low">${min}°</span>
      </div>
    `;
    DOM.dailyList.appendChild(div);
  });
}

/** Zobrazí aplikaci a schová splash */
function showApp() {
  DOM.splash.classList.add('fade-out');
  setTimeout(() => {
    DOM.splash.classList.add('hidden');
    DOM.app.classList.remove('hidden');
  }, 400);
}

// ============================================================
//  CACHE
// ============================================================

function saveCache(coords, cityName, weatherData) {
  try {
    localStorage.setItem(CONFIG.STORAGE.LAST_LOC, JSON.stringify({ ...coords, name: cityName }));
    localStorage.setItem(CONFIG.STORAGE.LAST_DATA, JSON.stringify({
      ts: Date.now(),
      city: cityName,
      coords,
      data: weatherData,
    }));
  } catch (e) {
    console.warn('Cache save failed:', e);
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE.LAST_DATA);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts < CONFIG.CACHE_TTL) return cached;
  } catch { /* ignore */ }
  return null;
}

function loadLastLocation() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE.LAST_LOC);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ============================================================
//  HLAVNÍ FETCH + RENDER
// ============================================================

async function loadWeatherForCoords(lat, lon, cityName = null) {
  try {
    // Zjistíme název města (pokud neznáme)
    if (!cityName) {
      DOM.splashStatus && (DOM.splashStatus.textContent = 'Načítám název místa…');
      cityName = await reverseGeocode(lat, lon);
    }

    DOM.splashStatus && (DOM.splashStatus.textContent = 'Načítám data o počasí…');
    const weatherData = await fetchWeather(lat, lon);

    // Uložit do cache
    saveCache({ lat, lon }, cityName, weatherData);
    state.currentData = weatherData;
    state.lastCoords = { lat, lon, name: cityName };

    // Vykreslit
    renderCurrent(weatherData, cityName);
    renderHourly(weatherData);
    renderDaily(weatherData);

    showApp();
  } catch (err) {
    console.error('loadWeatherForCoords error:', err);
    showApp();
    showError(err.message || 'Nepodařilo se načíst data o počasí.');
  }
}

// ============================================================
//  INICIALIZACE
// ============================================================

async function init() {
  // 1. Načíst theme
  const savedTheme = localStorage.getItem(CONFIG.STORAGE.THEME) || 'auto';
  applyTheme(savedTheme);

  // 2. Zkusit cache
  const cached = loadCache();
  if (cached) {
    // Zobrazíme ihned z cache, pak případně refresh
    renderCurrent(cached.data, cached.city);
    renderHourly(cached.data);
    renderDaily(cached.data);
    state.currentData = cached.data;
    state.lastCoords = { ...cached.coords, name: cached.city };
    showApp();
    // Tiché obnovení dat na pozadí
    refreshInBackground(cached.coords.lat, cached.coords.lon, cached.city);
    return;
  }

  // 3. Zkusit GPS
  try {
    DOM.splashStatus.textContent = 'Zjišťuji vaši polohu…';
    const { lat, lon } = await getGPSLocation();
    await loadWeatherForCoords(lat, lon);
  } catch (gpsErr) {
    console.warn('GPS failed:', gpsErr);
    // 4. Fallback: poslední uložená poloha
    const lastLoc = loadLastLocation();
    if (lastLoc) {
      DOM.splashStatus.textContent = 'Používám poslední polohu…';
      await loadWeatherForCoords(lastLoc.lat, lastLoc.lon, lastLoc.name);
    } else {
      // 5. Žádná data — zobrazit app s chybou
      showApp();
      showError(gpsErr.message + ' Vyhledejte město ručně.');
    }
  }
}

/** Tiché obnovení dat na pozadí (bez splash screenu) */
async function refreshInBackground(lat, lon, cityName) {
  try {
    const weatherData = await fetchWeather(lat, lon);
    saveCache({ lat, lon }, cityName, weatherData);
    state.currentData = weatherData;
    renderCurrent(weatherData, cityName);
    renderHourly(weatherData);
    renderDaily(weatherData);
  } catch (e) {
    console.warn('Background refresh failed:', e);
  }
}

// ============================================================
//  GPS TLAČÍTKO
// ============================================================

DOM.gpsBtn.addEventListener('click', async () => {
  DOM.gpsBtn.disabled = true;
  DOM.gpsBtn.style.opacity = '0.5';
  try {
    const { lat, lon } = await getGPSLocation();
    const cityName = await reverseGeocode(lat, lon);
    await loadWeatherForCoords(lat, lon, cityName);
  } catch (err) {
    showError(err.message);
  } finally {
    DOM.gpsBtn.disabled = false;
    DOM.gpsBtn.style.opacity = '';
  }
});

// ============================================================
//  THEME TOGGLE
// ============================================================

DOM.themeToggle.addEventListener('click', toggleTheme);

// Sleduj systémovou preferenci
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'auto') applyTheme('auto');
});

// ============================================================
//  VYHLEDÁVÁNÍ
// ============================================================

DOM.searchInput.addEventListener('input', () => {
  const val = DOM.searchInput.value.trim();
  DOM.searchClear.classList.toggle('hidden', val.length === 0);

  clearTimeout(state.searchTimeout);
  if (val.length < 2) {
    DOM.searchResults.classList.add('hidden');
    return;
  }

  // Debounce 350ms
  state.searchTimeout = setTimeout(() => performSearch(val), 350);
});

DOM.searchClear.addEventListener('click', () => {
  DOM.searchInput.value = '';
  DOM.searchClear.classList.add('hidden');
  DOM.searchResults.classList.add('hidden');
  DOM.searchInput.focus();
});

// Zavřít dropdown při kliknutí jinam
document.addEventListener('click', e => {
  if (!DOM.searchInput.contains(e.target) && !DOM.searchResults.contains(e.target)) {
    DOM.searchResults.classList.add('hidden');
  }
});

async function performSearch(query) {
  DOM.searchResults.innerHTML = '<li class="loading-item" style="padding:13px 16px">Hledám…</li>';
  DOM.searchResults.classList.remove('hidden');

  try {
    const results = await searchCities(query);
    renderSearchResults(results);
  } catch (err) {
    DOM.searchResults.innerHTML = '<li class="no-result" style="padding:13px 16px">Vyhledávání selhalo.</li>';
  }
}

function renderSearchResults(results) {
  if (!results.length) {
    DOM.searchResults.innerHTML = '<li class="no-result" style="padding:13px 16px">Žádné výsledky.</li>';
    return;
  }

  DOM.searchResults.innerHTML = '';
  results.forEach(r => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.setAttribute('tabindex', '0');
    const country = [r.admin1, r.country].filter(Boolean).join(', ');
    li.innerHTML = `
      <strong>${r.name}</strong>
      <span class="result-country">${country}</span>
    `;
    const selectCity = () => {
      DOM.searchInput.value = '';
      DOM.searchClear.classList.add('hidden');
      DOM.searchResults.classList.add('hidden');
      loadWeatherForCoords(r.latitude, r.longitude, r.name);
    };
    li.addEventListener('click', selectCity);
    li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectCity(); });
    DOM.searchResults.appendChild(li);
  });
}

// ============================================================
//  SERVICE WORKER REGISTRACE
// ============================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ============================================================
//  START
// ============================================================

init();
