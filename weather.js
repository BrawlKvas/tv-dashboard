'use strict';

(() => {
  const widget = document.querySelector('#weather');
  const canvas = document.querySelector('#weather-icon');
  const ctx = canvas.getContext('2d');
  const temperature = document.querySelector('#weather-temperature');
  const condition = document.querySelector('#weather-condition');
  const refreshInterval = 15 * 60 * 1000;
  const groups = [
    [[0, 1], 'clear', 'Ясно'],
    [[2], 'partly', 'Переменная облачность'],
    [[3], 'cloudy', 'Пасмурно'],
    [[45, 48], 'fog', 'Туман'],
    [[51, 53, 55], 'rain', 'Морось'],
    [[56, 57, 66, 67], 'rain', 'Ледяные осадки'],
    [[61, 63, 65], 'rain', 'Дождь'],
    [[80, 81, 82], 'rain', 'Ливень'],
    [[71, 73, 75, 77, 85, 86], 'snow', 'Снег'],
    [[95, 97], 'storm', 'Гроза'],
    [[96, 99], 'storm', 'Гроза с градом']
  ];

  function pixel(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }

  function disk(x, y, radius, color) {
    for (let row = -radius; row <= radius; row++) {
      const half = Math.floor(Math.sqrt(radius ** 2 - row ** 2));
      pixel(x - half, y + row, 2 * half + 1, 1, color);
    }
  }

  function skyLight(x, y, day) {
    if (!day) {
      disk(x, y, 7, '#777bb4');
      disk(x - 1, y - 1, 6, '#c8d5f8');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      disk(x + 4, y - 3, 6, '#fff');
      ctx.restore();
      pixel(x + 6, y - 4, 3, 1, '#ffe6af');
      pixel(x + 7, y - 5, 1, 3, '#ffe6af');
      pixel(x - 10, y - 5, 1, 1, '#c8d5f8');
      return;
    }

    const rays = [[0, -10], [7, -7], [10, 0], [7, 7], [0, 10], [-7, 7], [-10, 0], [-7, -7]];
    for (const [dx, dy] of rays) pixel(x + dx - 1, y + dy - 1, 2, 2, '#ffbb69');
    disk(x, y, 7, '#bd694d');
    disk(x, y - 1, 6, '#ffc46d');
    disk(x - 1, y - 2, 4, '#ffe5a1');
  }

  function cloud(x, y, dark) {
    const edge = '#444466';
    const face = dark ? '#8689b0' : '#d1d8ee';
    const shine = dark ? '#aeb2d0' : '#f7ecf3';
    disk(x + 5, y + 9, 5, edge);
    disk(x + 11, y + 6, 7, edge);
    disk(x + 18, y + 8, 5, edge);
    disk(x + 22, y + 10, 4, edge);
    pixel(x + 5, y + 8, 18, 7, edge);
    disk(x + 5, y + 8, 4, face);
    disk(x + 11, y + 6, 6, face);
    disk(x + 18, y + 8, 4, face);
    disk(x + 22, y + 10, 3, face);
    pixel(x + 5, y + 9, 18, 4, face);
    pixel(x + 9, y + 2, 5, 1, shine);
    pixel(x + 3, y + 6, 4, 1, shine);
  }

  function drawIcon(kind, day) {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (kind === 'clear') {
      skyLight(15, 13, day);
      return;
    }
    if (kind === 'partly') {
      skyLight(11, 11, day);
      cloud(6, 10, false);
      return;
    }
    if (kind === 'cloudy') {
      cloud(5, 5, true);
      cloud(0, 10, false);
      return;
    }

    cloud(3, 3, kind === 'rain' || kind === 'storm');
    if (kind === 'rain' || kind === 'storm') {
      for (const [x, y] of [[8, 19], [19, 19], [25, 20], [12, 23]]) {
        pixel(x, y, 2, 2, '#9cdaff');
        pixel(x - 1, y + 2, 2, 2, '#648ee0');
      }
    }
    if (kind === 'storm') {
      pixel(15, 14, 4, 4, '#ffe29a');
      pixel(13, 18, 7, 2, '#ffbe69');
      pixel(16, 20, 3, 3, '#ffe29a');
      pixel(15, 23, 2, 2, '#ffe29a');
    }
    if (kind === 'snow') {
      for (const [x, y] of [[8, 21], [15, 24], [22, 20], [27, 24]]) {
        pixel(x - 1, y, 3, 1, '#e8f5ff');
        pixel(x, y - 1, 1, 3, '#e8f5ff');
      }
    }
    if (kind === 'fog') {
      pixel(5, 18, 19, 2, '#b8b8d7');
      pixel(9, 22, 19, 2, '#9699c0');
      pixel(4, 26, 16, 1, '#b8b8d7');
    }
  }

  async function updateWeather() {
    try {
      const response = await fetch('./weather.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Weather unavailable');
      const { current, time } = await response.json();
      const age = Date.now() / 1000 - time;
      if (!current || !Number.isFinite(current.temperature_2m) ||
          !Number.isFinite(time) || age > 60 * 60) {
        throw new Error('Weather missing or stale');
      }

      const group = groups.find(([codes]) => codes.includes(current.weather_code));
      const degrees = Math.round(current.temperature_2m);
      temperature.textContent = (degrees < 0 ? '−' : '') + Math.abs(degrees) + '°C';
      condition.textContent = group ? group[2] : '';
      canvas.hidden = !group || !ctx;
      if (group) drawIcon(group[1], current.is_day !== 0);
      widget.hidden = false;
    } catch {
      widget.hidden = true;
    } finally {
      setTimeout(updateWeather, refreshInterval);
    }
  }

  updateWeather();
})();
