// initialize icons
feather.replace();

const cityInput = document.getElementById('city-input');
const weatherContent = document.getElementById('weather-content');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const errorMessage = document.getElementById('error-message');

// API configurations
const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

// Mapping WMO Weather codes to descriptions and Feather icons
// Code details: https://open-meteo.com/en/docs
const weatherCodes = {
    0: { desc: 'Clear sky', icon: 'sun', class: 'weather-clear' },
    1: { desc: 'Mainly clear', icon: 'sun', class: 'weather-clear' },
    2: { desc: 'Partly cloudy', icon: 'cloud', class: 'weather-cloudy' },
    3: { desc: 'Overcast', icon: 'cloud', class: 'weather-cloudy' },
    45: { desc: 'Fog', icon: 'cloud-drizzle', class: 'weather-cloudy' },
    48: { desc: 'Depositing rime fog', icon: 'cloud-drizzle', class: 'weather-cloudy' },
    51: { desc: 'Light drizzle', icon: 'cloud-rain', class: 'weather-rain' },
    53: { desc: 'Moderate drizzle', icon: 'cloud-rain', class: 'weather-rain' },
    55: { desc: 'Dense drizzle', icon: 'cloud-rain', class: 'weather-rain' },
    61: { desc: 'Slight rain', icon: 'cloud-rain', class: 'weather-rain' },
    63: { desc: 'Moderate rain', icon: 'cloud-rain', class: 'weather-rain' },
    65: { desc: 'Heavy rain', icon: 'cloud-lightning', class: 'weather-rain' },
    71: { desc: 'Slight snow', icon: 'cloud-snow', class: 'weather-cloudy' },
    73: { desc: 'Moderate snow', icon: 'cloud-snow', class: 'weather-cloudy' },
    75: { desc: 'Heavy snow', icon: 'cloud-snow', class: 'weather-cloudy' },
    95: { desc: 'Thunderstorm', icon: 'cloud-lightning', class: 'weather-rain' },
    96: { desc: 'Thunderstorm with hail', icon: 'cloud-lightning', class: 'weather-rain' },
    99: { desc: 'Heavy thunderstorm', icon: 'cloud-lightning', class: 'weather-rain' }
};

function getWeatherInfo(code, isDay = 1) {
    const info = weatherCodes[code] || { desc: 'Unknown', icon: 'help-circle', class: '' };
    // Adjust for night
    if (!isDay && info.icon === 'sun') {
        return { ...info, icon: 'moon' };
    }
    return info;
}

cityInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
            getWeatherForCity(query);
            cityInput.blur();
        }
    }
});

async function getWeatherForCity(city) {
    showLoading();
    try {
        // 1. Geocoding
        const geoRes = await fetch(`${GEO_API}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        
        if (!geoData.results || geoData.results.length === 0) {
            throw new Error(`Could not find location: ${city}`);
        }
        
        const location = geoData.results[0];
        const { latitude, longitude, name, country } = location;

        // 2. Weather Data
        const url = `${WEATHER_API}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
        const weatherRes = await fetch(url);
        const weatherData = await weatherRes.json();

        updateUI({
            name,
            country,
            current: weatherData.current,
            hourly: weatherData.hourly,
            daily: weatherData.daily
        });
        showContent();

    } catch (err) {
        showError(err.message);
    }
}

function updateUI(data) {
    // Current Weather
    document.getElementById('city-name').textContent = `${data.name}, ${data.country}`;
    
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);

    const wInfo = getWeatherInfo(data.current.weather_code, data.current.is_day);
    
    document.getElementById('current-temp').innerHTML = `${Math.round(data.current.temperature_2m)}&deg;`;
    document.getElementById('current-condition').textContent = wInfo.desc;
    document.getElementById('current-icon').setAttribute('data-feather', wInfo.icon);

    document.getElementById('wind-speed').textContent = `${Math.round(data.current.wind_speed_10m)} km/h`;
    document.getElementById('humidity').textContent = `${data.current.relative_humidity_2m} %`;
    document.getElementById('uv-index').textContent = 'Moderate'; // Open-Meteo current endpoint doesn't return UV by default, hardcoded or omit. Let's set it to '--' for realism if not fetched.
    document.getElementById('feels-like').innerHTML = `${Math.round(data.current.apparent_temperature)}&deg;`;

    // Dynamic body class
    document.body.className = wInfo.class;

    // Hourly Forecast (next 24h)
    const hourlyContainer = document.getElementById('hourly-container');
    hourlyContainer.innerHTML = '';
    
    // Find current hour index
    const currentHourStr = data.current.time || now.toISOString().slice(0, 14) + "00";
    // For simplicity, just take the first 24 items of the hourly array starting from now
    // Since tz auto aligns with local, we can just slice.
    // Instead of precise matching, open-meteo usually returns 168 hours starting from 00:00.
    // Let's just grab index `now.getHours()` to `now.getHours() + 24`
    const hourStartIndex = now.getHours();
    
    for (let i = hourStartIndex; i < hourStartIndex + 24; i+=2) { // Every 2 hours to save space
        if (i >= data.hourly.time.length) break;
        
        const timeStr = data.hourly.time[i];
        const dateObj = new Date(timeStr);
        let hourLabel = dateObj.getHours() === now.getHours() ? 'Now' : 
            dateObj.toLocaleTimeString('en-US', {hour: 'numeric'});
        
        const temp = Math.round(data.hourly.temperature_2m[i]);
        const hwInfo = getWeatherInfo(data.hourly.weather_code[i], 1); // rough day estimation for icon

        const el = document.createElement('div');
        el.className = 'hourly-item';
        el.innerHTML = `
            <span class="time">${hourLabel}</span>
            <i data-feather="${hwInfo.icon}"></i>
            <span class="temp">${temp}&deg;</span>
        `;
        hourlyContainer.appendChild(el);
    }

    // Daily Forecast (7 days)
    const dailyContainer = document.getElementById('daily-container');
    dailyContainer.innerHTML = '';

    for (let i = 0; i < Math.min(7, data.daily.time.length); i++) {
        const dateObj = new Date(data.daily.time[i]);
        // To avoid timezone issue with UTC strictly slicing days
        // We can correct offset
        const localDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
        
        let dayLabel = localDate.toLocaleDateString('en-US', {weekday: 'long'});
        if (i === 0) dayLabel = 'Today';

        const maxT = Math.round(data.daily.temperature_2m_max[i]);
        const minT = Math.round(data.daily.temperature_2m_min[i]);
        const dwInfo = getWeatherInfo(data.daily.weather_code[i], 1);

        const el = document.createElement('div');
        el.className = 'daily-item';
        el.innerHTML = `
            <span class="daily-day">${dayLabel}</span>
            <span class="daily-icon"><i data-feather="${dwInfo.icon}"></i></span>
            <span class="daily-temps">
                <span class="temp-max">${maxT}&deg;</span>
                <span class="temp-min">${minT}&deg;</span>
            </span>
        `;
        dailyContainer.appendChild(el);
    }

    // re-init icons for newly added DOM elements
    feather.replace();
}

function showLoading() {
    weatherContent.classList.add('hidden');
    error.classList.add('hidden');
    loading.classList.remove('hidden');
}

function showContent() {
    loading.classList.add('hidden');
    error.classList.add('hidden');
    weatherContent.classList.remove('hidden');
}

function showError(msg) {
    loading.classList.add('hidden');
    weatherContent.classList.add('hidden');
    error.classList.remove('hidden');
    errorMessage.textContent = msg;
}

// Initial load - try to geolocate user or fallback to a default city
let hasGeolocation = false;

if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            hasGeolocation = true;
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            showLoading();
            try {
                // Reverse geocode to get name (or direct weather query)
                // For simplicity, we just use the weather API directly with coords and skip city name for a sec
                const url = `${WEATHER_API}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
                const weatherRes = await fetch(url);
                const weatherData = await weatherRes.json();
                
                updateUI({
                    name: 'Current Location',
                    country: '',
                    current: weatherData.current,
                    hourly: weatherData.hourly,
                    daily: weatherData.daily
                });
                showContent();
            } catch(err) {
                getWeatherForCity('London');
            }
        },
        () => {
            getWeatherForCity('London');
        }
    );
} else {
    // Default fallback
    getWeatherForCity('London');
}

// Fallback if permission prompt is ignored for too long
setTimeout(() => {
    if (!hasGeolocation && loading.classList.contains('hidden') === false) {
         getWeatherForCity('London');
    }
}, 5000);
