import * as T from 'three';
import { distance, generate, routeAt, surfaceAt } from './generator.js';
import { createCave } from './scene.js';
import './style.css';

const get = id => document.getElementById(id);
const canvas = get('world');
const map = get('map');
const ctx = map.getContext('2d');
const input = get('seed');
const help = get('help-dialog');
const keys = new Set();
const look = new T.Euler(0, 0, 0, 'YXZ');
const worldUrl = new URL(location.href);
const defaultSeed = 'CHASM-014';
const zones = ['Старая выработка', 'Разлом', 'Кристальный грот'];
const descriptions = [
  'Тёплый на ощупь. Здесь его сорвали с крепления.',
  'В трещине остались тёмные волокна.',
  'Светится сильнее вдали от остальных жил.',
];
const activeKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'KeyF', 'KeyE'];

function notify(message) {
  const toast = get('toast');
  toast.textContent = message;
  toast.classList.toggle('visible', Boolean(message));
  clearTimeout(notify.timer);
  if (message) notify.timer = setTimeout(() => toast.classList.remove('visible'), 4500);
}

function run(renderer) {
  const scene = new T.Scene();
  scene.background = new T.Color('#122828');
  scene.fog = new T.FogExp2('#122828', .021);
  const camera = new T.PerspectiveCamera(62, 1, .08, 115);
  const vector = p => new T.Vector3(p.x, p.y, p.z);
  const player = new T.Vector3();
  const target = new T.Vector3();
  const orbit = { azimuth: 1.8, elevation: .53, radius: 20 };
  const lamp = new T.SpotLight('#d6e5ce', 85, 23, .48, .56, 1.65);
  scene.add(lamp, lamp.target);
  scene.add(new T.HemisphereLight('#bcdcd3', '#59615a', 1.35));
  const rim = new T.DirectionalLight('#9bd8ce', 1.15);
  rim.position.set(9, 26, -13);
  scene.add(rim);

  let world, cave, mode = 'intro', progress = 0;
  let flash = true, atBottom = false;
  let collected = new Set();
  let previousTime = 0;
  let hudTime = 1;
  let drag = null;

  function changeMode(next) {
    if (next !== 'walk' && document.pointerLockElement === canvas) document.exitPointerLock();
    drag = null;
    keys.clear();
    mode = next;
    const intro = get('intro');
    intro.classList.toggle('dismissed', next !== 'intro');
    intro.inert = next !== 'intro';
    document.body.classList.toggle('active', next !== 'intro');
    document.body.dataset.mode = next;
    get('crosshair').classList.toggle('visible', next === 'walk');
    get('home').hidden = next === 'intro';
    get('overview').textContent = next === 'orbit' ? 'К спуску' : 'Свободная камера';
    get('mode-label').textContent = {
      intro: 'ИССЛЕДОВАНИЕ РАЗЛОМА',
      walk: 'ПЕШИЙ СПУСК',
      tour: 'ОБЗОР МАРШРУТА',
      orbit: 'СВОБОДНАЯ КАМЕРА',
    }[next];
    if (next !== 'walk') get('prompt').hidden = true;
    hudTime = 1;
  }

  function resetPosition() {
    const [a, b] = world.nodes;
    player.copy(vector(a));
    look.set(-.045, Math.atan2(a.x - b.x, a.z - b.z), 0);
    progress = 0;
    atBottom = false;
  }

  function setWorld(seed) {
    if (cave) {
      scene.remove(cave.root);
      cave.dispose();
    }
    input.value = seed;
    worldUrl.searchParams.set('seed', seed);
    history.replaceState(null, '', worldUrl);
    world = generate(seed);
    cave = createCave(world);
    scene.add(cave.root);
    collected = new Set();
    resetPosition();
    changeMode('intro');
    notify('');
  }

  function lock() {
    if (document.pointerLockElement || !canvas.requestPointerLock || matchMedia('(pointer: coarse)').matches) return;
    try {
      canvas.requestPointerLock()?.catch(() => {});
    } catch {
      // Drag to look when the host doesn't grant pointer lock.
    }
  }

  function startWalk() {
    changeMode('walk');
    lock();
  }

  function interact() {
    const relic = nearby();
    if (!relic) return;
    collected.add(relic.id);
    cave.collect(relic.id);
    const index = world.relics.indexOf(relic);
    notify(collected.size === 3 ? 'Все три образца собраны. Дойдите до нижней площадки.' : descriptions[index]);
    hudTime = 1;
  }

  function nearby() {
    return world.relics.find(r => !collected.has(r.id) && distance(r, player) < 2.35);
  }

  get('enter').addEventListener('click', startWalk);
  get('tour').addEventListener('click', () => {
    progress = 0;
    changeMode('tour');
  });
  get('overview').addEventListener('click', () => {
    if (mode === 'orbit') startWalk();
    else changeMode('orbit');
  });
  get('home').addEventListener('click', () => {
    resetPosition();
    changeMode('intro');
    notify('');
  });
  get('regenerate').addEventListener('click', () => {
    const seed = input.value.trim();
    setWorld(seed && seed !== world.seed ? seed : 'CHASM-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase());
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setWorld(input.value.trim() || defaultSeed);
      input.blur();
    }
  });
  get('help').addEventListener('click', () => {
    keys.clear();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    help.showModal();
  });
  get('close-help').addEventListener('click', () => help.close());

  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && document.pointerLockElement === canvas) {
      document.exitPointerLock();
      keys.clear();
    }
    if (mode !== 'walk' || help.open || event.target === input || !activeKeys.includes(event.code)) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyF') {
      flash = !flash;
      notify(flash ? 'Фонарь включён' : 'Фонарь выключен');
    }
    if (event.code === 'KeyE') interact();
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); drag = null; });

  function turn(dx, dy) {
    look.y -= dx * .0023;
    look.x = T.MathUtils.clamp(look.x - dy * .0023, -1.46, 1.46);
  }
  document.addEventListener('mousemove', event => {
    if (mode === 'walk' && document.pointerLockElement === canvas) turn(event.movementX, event.movementY);
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !['walk', 'orbit'].includes(mode) || document.pointerLockElement === canvas) return;
    if (mode === 'walk' && event.pointerType === 'mouse') lock();
    canvas.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.id || document.pointerLockElement === canvas) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (mode === 'walk') turn(dx, dy);
    if (mode === 'orbit') {
      orbit.azimuth -= dx * .007;
      orbit.elevation = T.MathUtils.clamp(orbit.elevation + dy * .006, -.68, 1.26);
    }
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  canvas.addEventListener('wheel', event => {
    if (mode !== 'orbit') return;
    event.preventDefault();
    orbit.radius = T.MathUtils.clamp(orbit.radius + event.deltaY * .014, 7, 21);
  }, {passive: false});

  const touch = get('touch-controls');
  for (const button of touch.querySelectorAll('[data-key]')) {
    const code = button.dataset.key;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      keys.add(code);
    });
    button.addEventListener('lostpointercapture', () => keys.delete(code));
  }
  get('touch-sample').addEventListener('click', interact);
  get('touch-lamp').addEventListener('click', () => { flash = !flash; });

  function movePlayer(dt) {
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const side = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    look.y += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.6;
    if (!forward && !side) return;
    const step = dt * (running ? 7.3 : 4.3) / Math.hypot(forward, side);
    const dx = (side * Math.cos(look.y) - forward * Math.sin(look.y)) * step;
    const dz = (-side * Math.sin(look.y) - forward * Math.cos(look.y)) * step;
    // Slide along the boundary when a diagonal move would leave the deck.
    for (const [x, z] of [[player.x + dx, player.z + dz], [player.x + dx, player.z], [player.x, player.z + dz]]) {
      const support = surfaceAt(world, x, z, player.y);
      if (!support) continue;
      player.set(x, support.y, z);
      break;
    }
  }

  function drawMap(position) {
    const x = p => 210 + p.x * 4.1 - p.z * 1.85;
    const y = p => 133 - p.y * 4.0 + p.z * 1.65;
    ctx.clearRect(0, 0, map.width, map.height);
    ctx.lineCap = 'round';
    for (let row = 35; row < map.height; row += 50) {
      ctx.beginPath();
      ctx.strokeStyle = '#91aca123';
      ctx.lineWidth = 1;
      ctx.moveTo(23, row);
      ctx.lineTo(map.width - 23, row);
      ctx.stroke();
    }
    for (const edge of world.edges) {
      ctx.strokeStyle = edge.kind === 'bridge' ? '#d9b985' : '#799f96';
      ctx.lineWidth = edge.optional ? 2 : 3;
      ctx.setLineDash(edge.optional ? [5, 6] : []);
      ctx.beginPath();
      ctx.moveTo(x(edge.a), y(edge.a));
      ctx.lineTo(x(edge.b), y(edge.b));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const relic of world.relics) {
      ctx.beginPath();
      ctx.arc(x(relic), y(relic), 3.4, 0, Math.PI * 2);
      ctx.fillStyle = collected.has(relic.id) ? '#507e73' : '#9be3ce';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x(position), y(position), 7, 0, Math.PI * 2);
    ctx.fillStyle = '#f3d7a0';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1e3838';
    ctx.stroke();
  }

  function updateHud(position) {
    const fraction = T.MathUtils.clamp((world.nodes[0].y - position.y) / (world.nodes[0].y - world.nodes.at(-1).y), 0, 1);
    const zone = fraction < .28 ? 0 : fraction < .64 ? 1 : 2;
    get('depth').textContent = Math.round(42 + Math.max(0, world.nodes[0].y - position.y));
    get('depth-marker').style.top = (fraction * 100) + '%';
    get('zone-number').textContent = '0' + (zone + 1) + ' / 03';
    get('zone').textContent = zones[zone];
    get('samples').textContent = collected.size + ' / 3';
    drawMap(position);
  }

  function updateView(time, elapsed) {
    const dt = Math.min(elapsed, .05);
    let position = world.nodes[0];
    if (mode === 'walk') {
      movePlayer(dt);
      camera.position.copy(player).add(new T.Vector3(0, 1.65, 0));
      camera.rotation.copy(look);
      position = player;
      const relic = nearby();
      get('prompt').hidden = !relic;
      get('touch-sample').disabled = !relic;
      const reachedBottom = distance(player, world.nodes.at(-1)) < 2.1;
      if (!atBottom && reachedBottom) {
        notify(collected.size === 3 ? 'Спуск завершён. Все образцы собраны.' : 'Нижняя площадка. Можно вернуться за образцами.');
      }
      atBottom = reachedBottom;
    } else if (mode === 'tour') {
      progress = Math.min(world.length, progress + Math.min(elapsed, .25) * 11.5);
      position = routeAt(world, progress);
      const ahead = routeAt(world, Math.min(world.length, progress + 7));
      camera.position.set(position.x * .93, position.y + 2.9, position.z * .93);
      target.set(ahead.x * .80, ahead.y + .25, ahead.z * .8);
      camera.lookAt(target);
      if (progress === world.length) {
        player.copy(vector(position));
        const previous = world.nodes.at(-2);
        look.set(.02, Math.atan2(position.x - previous.x, position.z - previous.z), 0);
        atBottom = true;
        changeMode('walk');
        notify('Нижняя площадка. Маршрут можно пройти обратно.');
      }
    } else if (mode === 'orbit') {
      const radius = orbit.radius * Math.cos(orbit.elevation);
      camera.position.set(Math.cos(orbit.azimuth) * radius, 3 + orbit.radius * Math.sin(orbit.elevation), Math.sin(orbit.azimuth) * radius);
      camera.lookAt(0, 0, 0);
      position = player;
    } else {
      const a = 2.13 + Math.sin(time * .16) * .064;
      camera.position.set(Math.cos(a) * 18.8, 27.3 + Math.sin(time * .24) * .42, Math.sin(a) * 18.8);
      camera.lookAt(3.3, -1.7, -1.5);
    }
    lamp.visible = mode === 'walk' && flash;
    lamp.position.copy(camera.position);
    camera.getWorldDirection(target);
    lamp.target.position.copy(lamp.position).add(target);
    hudTime += dt;
    if (hudTime > .11) {
      hudTime = 0;
      updateHud(position);
    }
    cave.animate(time);
  }

  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  setWorld(worldUrl.searchParams.get('seed')?.trim().slice(0, 32) || defaultSeed);
  resize();
  renderer.setAnimationLoop(ms => {
    const time = ms / 1000;
    const elapsed = time - (previousTime || time);
    previousTime = time;
    updateView(time, elapsed);
    renderer.render(scene, camera);
  });
}

function setupAudio() {
  const button = get('sound');
  let audio, master;
  button.addEventListener('click', async () => {
    try {
      if (!audio) {
        audio = new AudioContext();
        master = audio.createGain();
        master.gain.value = 0;
        master.connect(audio.destination);
        const hum = audio.createOscillator();
        hum.type = 'sine';
        hum.frequency.value = 47;
        const humVolume = audio.createGain();
        humVolume.gain.value = .04;
        hum.connect(humVolume).connect(master);
        hum.start();
        const buffer = audio.createBuffer(1, audio.sampleRate * 4, audio.sampleRate);
        const samples = buffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < samples.length; i++) {
          previous = (previous + .028 * (Math.random() * 2 - 1)) / 1.028;
          samples[i] = previous * 2.6;
        }
        const air = audio.createBufferSource();
        air.buffer = buffer;
        air.loop = true;
        const filter = audio.createBiquadFilter();
        filter.frequency.value = 290;
        air.connect(filter).connect(master);
        air.start();
      }
      await audio.resume();
      const on = button.getAttribute('aria-pressed') !== 'true';
      master.gain.setTargetAtTime(on ? .23 : 0, audio.currentTime, .12);
      button.setAttribute('aria-pressed', String(on));
      button.textContent = 'ЗВУК: ' + (on ? 'ВКЛ' : 'ВЫКЛ');
      button.setAttribute('aria-label', on ? 'Выключить звук' : 'Включить звук');
    } catch {
      notify('Браузер не разрешил воспроизведение звука.');
    }
  });
}

try {
  const renderer = new T.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setClearColor('#122828');
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.19;
  run(renderer);
  setupAudio();
} catch (error) {
  console.error(error);
  get('fatal').hidden = false;
  get('fatal').textContent = 'Не удалось открыть трёхмерную пещеру. Проверьте, доступен ли WebGL 2 в браузере.';
}
