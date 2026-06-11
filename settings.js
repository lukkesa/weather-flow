const STORAGE_KEY = 'wf_theme';
const TIME_RANGE_KEY = 'wf_time_range';
const SAVED_LOCATIONS_KEY = 'wf_saved_locations';
const SELECTED_LOCATION_KEY = 'wf_selected_location_id';
const MANUAL_CITY_KEY = 'wf_manual_city';
const MAX_LOCATIONS = 4;
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
const themeInputs = Array.from(document.querySelectorAll('input[name="theme"]'));
const timeStart = document.getElementById('time-start');
const timeEnd = document.getElementById('time-end');
const timeSettings = document.getElementById('time-settings');
const cityInput = document.getElementById('manual-city');
const cityStatus = document.getElementById('city-settings-status');
const citySuggestions = document.getElementById('city-suggestions');
const savedLocationsContainer = document.getElementById('saved-locations');
const addGpsButton = document.getElementById('add-gps-card');
let citySearchTimeout = null;

function getSavedTimeRange() {
  const saved = localStorage.getItem(TIME_RANGE_KEY);
  if (!saved) return { start: 7, end: 20 };
  try {
    return JSON.parse(saved);
  } catch {
    return { start: 7, end: 20 };
  }
}

function saveTimeRange(range) {
  localStorage.setItem(TIME_RANGE_KEY, JSON.stringify(range));
}

function getSavedLocations() {
  const saved = localStorage.getItem(SAVED_LOCATIONS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }

  const legacy = localStorage.getItem(MANUAL_CITY_KEY);
  if (!legacy) return [];

  try {
    const parsed = JSON.parse(legacy);
    if (parsed?.name) {
      const migrated = [{ id: 'city-legacy', type: 'city', name: parsed.name, lat: parsed.lat, lon: parsed.lon }];
      localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(migrated));
      localStorage.setItem(SELECTED_LOCATION_KEY, migrated[0].id);
      localStorage.removeItem(MANUAL_CITY_KEY);
      return migrated;
    }
  } catch {
    return [];
  }

  return [];
}

function saveSavedLocations(locations) {
  localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations));
}

function getSelectedLocationId() {
  const selected = localStorage.getItem(SELECTED_LOCATION_KEY);
  return selected || null;
}

function saveSelectedLocationId(id) {
  localStorage.setItem(SELECTED_LOCATION_KEY, id);
}

function createLocationId(type, name, lat, lon) {
  if (type === 'gps') return 'gps';
  return `city-${name}-${lat}-${lon}`;
}

function addLocation(location) {
  const locations = getSavedLocations();
  const key = createLocationId(location.type, location.name, location.lat, location.lon);
  const alreadyExists = locations.some(item => createLocationId(item.type, item.name, item.lat, item.lon) === key);

  if (alreadyExists) {
    saveSelectedLocationId(key);
    renderSavedLocations();
    if (cityStatus) cityStatus.textContent = location.type === 'gps' ? 'GPS karta je vybraná.' : `Vybrané město: ${location.name}`;
    return true;
  }

  if (locations.length >= MAX_LOCATIONS) {
    if (cityStatus) cityStatus.textContent = 'Můžete mít maximálně 4 polohy.';
    return false;
  }

  const entry = { ...location, id: key };
  locations.push(entry);
  saveSavedLocations(locations);
  saveSelectedLocationId(entry.id);
  renderSavedLocations();
  if (cityStatus) cityStatus.textContent = location.type === 'gps' ? 'GPS karta byla přidána.' : `Přidáno město: ${location.name}`;
  return true;
}

function removeLocation(id) {
  const locations = getSavedLocations().filter(location => location.id !== id);
  saveSavedLocations(locations);

  const currentSelected = getSelectedLocationId();
  if (currentSelected === id) {
    saveSelectedLocationId(locations[0]?.id || '');
  }

  renderSavedLocations();
  if (cityStatus) cityStatus.textContent = 'Poloha byla odebrána.';
}

function selectLocation(id) {
  saveSelectedLocationId(id);
  renderSavedLocations();
  const selected = getSavedLocations().find(location => location.id === id);
  if (cityStatus) {
    cityStatus.textContent = selected?.type === 'gps'
      ? 'Vybrána je karta GPS.'
      : `Vybrané město: ${selected?.name || ''}`;
  }
}

function renderSavedLocations() {
  const locations = getSavedLocations();
  const selectedId = getSelectedLocationId();

  if (!savedLocationsContainer) return;

  if (!locations.length) {
    savedLocationsContainer.innerHTML = '<div class="settings-location-empty">Zatím nemáš žádné uložené polohy.</div>';
    return;
  }

  savedLocationsContainer.innerHTML = '';
  locations.forEach(location => {
    const card = document.createElement('article');
    card.className = `settings-location-card${location.id === selectedId ? ' is-selected' : ''}`;

    const button = document.createElement('button');
    button.className = 'settings-location-card__select';
    button.type = 'button';
    button.innerHTML = `
      <strong>${location.type === 'gps' ? 'GPS' : location.name}</strong>
      <span>${location.type === 'gps' ? 'Aktuální poloha' : (location.country || 'Město')}</span>
    `;
    button.addEventListener('click', () => selectLocation(location.id));

    const removeButton = document.createElement('button');
    removeButton.className = 'settings-location-card__remove';
    removeButton.type = 'button';
    removeButton.textContent = '×';
    removeButton.setAttribute('aria-label', 'Odebrat položku');
    removeButton.addEventListener('click', () => removeLocation(location.id));

    card.appendChild(button);
    card.appendChild(removeButton);
    savedLocationsContainer.appendChild(card);
  });
}

async function resolveCityToCoords(cityName) {
  const params = new URLSearchParams({ name: cityName, count: '1', language: 'cs', format: 'json' });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!res.ok) throw new Error('Nepodařilo se najít město.');
  const data = await res.json();
  const result = data.results?.[0];
  if (!result) throw new Error('Město nebylo nalezeno.');
  return { name: result.name, lat: result.latitude, lon: result.longitude };
}

async function searchCitySuggestions(query) {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    if (citySuggestions) citySuggestions.innerHTML = '';
    if (citySuggestions) citySuggestions.hidden = true;
    return;
  }

  try {
    const params = new URLSearchParams({ name: trimmed, count: '5', language: 'cs', format: 'json' });
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    if (!res.ok) throw new Error('Nepodařilo se načíst návrhy.');
    const data = await res.json();
    const results = data.results || [];

    if (!results.length) {
      if (citySuggestions) citySuggestions.innerHTML = '<li class="settings-suggestion-item settings-suggestion-item--empty">Žádné výsledky</li>';
      if (citySuggestions) citySuggestions.hidden = false;
      return;
    }

    if (citySuggestions) {
      citySuggestions.innerHTML = '';
      results.forEach(result => {
        const li = document.createElement('li');
        li.className = 'settings-suggestion-item';
        const country = [result.admin1, result.country].filter(Boolean).join(', ');
        li.innerHTML = `<strong>${result.name}</strong><span>${country}</span>`;
        li.addEventListener('click', () => {
          if (cityInput) cityInput.value = result.name;
          if (citySuggestions) {
            citySuggestions.innerHTML = '';
            citySuggestions.hidden = true;
          }
          addLocation({ type: 'city', name: result.name, country: result.country, lat: result.latitude, lon: result.longitude });
        });
        citySuggestions.appendChild(li);
      });
      citySuggestions.hidden = false;
    }
  } catch {
    if (citySuggestions) {
      citySuggestions.innerHTML = '<li class="settings-suggestion-item settings-suggestion-item--empty">Nelze načíst návrhy</li>';
      citySuggestions.hidden = false;
    }
  }
}

function toggleTimeControls(visible) {
  if (timeSettings) {
    timeSettings.hidden = !visible;
    timeSettings.style.display = visible ? 'flex' : 'none';
    timeSettings.setAttribute('aria-hidden', String(!visible));
  }
}

function getTimeBasedTheme() {
  const hour = new Date().getHours();
  const { start, end } = getSavedTimeRange();
  const normalizedStart = Number(start);
  const normalizedEnd = Number(end);

  if (normalizedStart < normalizedEnd) {
    return hour >= normalizedStart && hour < normalizedEnd ? 'light' : 'dark';
  }

  return hour >= normalizedStart || hour < normalizedEnd ? 'light' : 'dark';
}

function applyTheme(theme) {
  let isDark = false;

  if (theme === 'dark') {
    isDark = true;
  } else if (theme === 'light') {
    isDark = false;
  } else if (theme === 'time') {
    isDark = getTimeBasedTheme() === 'dark';
  } else {
    isDark = mediaQuery.matches;
  }

  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  const metaTheme = document.getElementById('meta-theme-color');
  if (metaTheme) {
    metaTheme.content = isDark ? '#0B1121' : '#3B82F6';
  }
  localStorage.setItem(STORAGE_KEY, theme);
  themeInputs.forEach(input => {
    input.checked = input.value === theme;
  });

  toggleTimeControls(theme === 'time');
}

function initSettings() {
  const savedTheme = localStorage.getItem(STORAGE_KEY) || 'auto';
  const savedRange = getSavedTimeRange();
  const savedLocations = getSavedLocations();
  const selectedLocation = savedLocations.find(location => location.id === getSelectedLocationId());

  if (timeStart) timeStart.value = String(savedRange.start);
  if (timeEnd) timeEnd.value = String(savedRange.end);
  if (cityInput) cityInput.value = selectedLocation?.type === 'city' ? selectedLocation.name : '';

  toggleTimeControls(savedTheme === 'time');
  renderSavedLocations();
  if (cityStatus) {
    cityStatus.textContent = selectedLocation?.type === 'gps'
      ? 'Vybrána je karta GPS.'
      : selectedLocation?.name
        ? `Vybrané město: ${selectedLocation.name}`
        : 'Přidejte si až 4 polohy.';
  }
  applyTheme(savedTheme);

  themeInputs.forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) {
        applyTheme(input.value);
      }
    });
  });

  [timeStart, timeEnd].forEach(input => {
    input?.addEventListener('change', () => {
      const range = {
        start: Number(timeStart?.value ?? 7),
        end: Number(timeEnd?.value ?? 20),
      };
      saveTimeRange(range);
      if (localStorage.getItem(STORAGE_KEY) === 'time') {
        applyTheme('time');
      }
    });
  });

  if (addGpsButton) {
    addGpsButton.addEventListener('click', () => {
      addLocation({ type: 'gps', name: 'GPS', country: 'Aktuální poloha' });
    });
  }

  if (cityInput) {
    cityInput.addEventListener('input', () => {
      if (citySearchTimeout) clearTimeout(citySearchTimeout);
      citySearchTimeout = setTimeout(() => searchCitySuggestions(cityInput.value), 250);
    });

    cityInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (citySuggestions) {
          citySuggestions.innerHTML = '';
          citySuggestions.hidden = true;
        }
      }, 150);
    });
  }

  mediaQuery.addEventListener('change', () => {
    const currentTheme = localStorage.getItem(STORAGE_KEY) || 'auto';
    if (currentTheme === 'auto') {
      applyTheme('auto');
    }
  });

  setInterval(() => {
    const currentTheme = localStorage.getItem(STORAGE_KEY) || 'auto';
    if (currentTheme === 'time') {
      applyTheme('time');
    }
  }, 60000);
}

initSettings();
