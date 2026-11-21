"use strict";

(function exposeRenderer(global) {
  const { position, GATES } = global.SnowTrailEngine;
  const TILE = 64;
  const courierAngle = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

  function randomSource(seed) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function circle(ctx, x, y, radius, fill) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function rectangle(ctx, x, y, width, height, radius, fill, border) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function shadow(ctx, x, y, radius, depth, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, radius, depth, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function pine(ctx, x, y, size, theme) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    shadow(ctx, 10, 13, 23, 10, "#244d663b");
    rectangle(ctx, -4, 6, 8, 16, 2, "#526475");
    for (let i = 0; i < 3; i++) {
      const base = 15 - i * 12;
      const width = 23 - i * 4;
      ctx.beginPath();
      ctx.moveTo(0, base - 40);
      ctx.lineTo(width, base - 5);
      ctx.quadraticCurveTo(width + 1, base + 1, width - 7, base + 1);
      ctx.quadraticCurveTo(0, base - 3, -width + 2, base + 2);
      ctx.quadraticCurveTo(-width - 1, base + 3, -width, base - 4);
      ctx.closePath();
      ctx.fillStyle = theme[i === 0 ? 3 : 2];
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, base - 37);
      ctx.quadraticCurveTo(width * 0.46, base - 22, width - 4, base - 9);
      ctx.quadraticCurveTo(width - 10, base - 5, 3, base - 12);
      ctx.quadraticCurveTo(-6, base - 6, -width + 5, base - 6);
      ctx.closePath();
      ctx.fillStyle = i === 2 ? "#f3fcff" : "#c7e0e9";
      ctx.fill();
    }
    ctx.restore();
  }

  function rock(ctx, x, y, size, theme) {
    ctx.save();
    ctx.translate(x, y + 3);
    ctx.scale(size, size);
    shadow(ctx, 6, 13, 25, 11, "#244d6635");
    ctx.beginPath();
    ctx.moveTo(-24, 12);
    ctx.lineTo(-21, -5);
    ctx.lineTo(-6, -21);
    ctx.lineTo(14, -17);
    ctx.lineTo(25, 3);
    ctx.lineTo(20, 13);
    ctx.lineTo(-9, 18);
    ctx.closePath();
    ctx.fillStyle = theme[2];
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-21, -3);
    ctx.lineTo(-6, -21);
    ctx.lineTo(14, -17);
    ctx.lineTo(20, -5);
    ctx.lineTo(5, 1);
    ctx.lineTo(-11, 0);
    ctx.closePath();
    ctx.fillStyle = "#e7f4f8";
    ctx.fill();
    ctx.restore();
  }

  function iceTile(ctx, x, y, random) {
    rectangle(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 5, "#66bcc4a0");
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#f3ffffa0";
    ctx.beginPath();
    const off = 8 + 13 * random();
    ctx.moveTo(x + off, y + 36);
    ctx.lineTo(x + off + 9, y + 26);
    ctx.lineTo(x + off + 16, y + 31);
    ctx.lineTo(x + off + 29, y + 16);
    ctx.stroke();
    ctx.strokeStyle = "#387a9545";
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 51);
    ctx.lineTo(x + 37, y + 46);
    ctx.lineTo(x + 42, y + 38);
    ctx.stroke();
  }

  function center(level, cell) {
    const point = position(level, cell);
    return { x: (point.x + 0.5) * TILE, y: (point.y + 0.5) * TILE };
  }

  function interpolate(level, from, to, fraction) {
    const end = center(level, to);
    if (from == null || from === to) return end;
    const start = center(level, from);
    return {
      x: start.x + (end.x - start.x) * fraction,
      y: start.y + (end.y - start.y) * fraction,
    };
  }

  function makeLandscape(level) {
    const layer = document.createElement("canvas");
    layer.width = level.width * TILE;
    layer.height = level.height * TILE;
    const ctx = layer.getContext("2d");
    const theme = level.theme;
    const random = randomSource(level.start * 163 + level.delay * 19);
    const gradient = ctx.createLinearGradient(0, 0, layer.width * 0.62, layer.height);
    gradient.addColorStop(0, theme[0]);
    gradient.addColorStop(1, theme[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, layer.width, layer.height);

    for (let cell = 0; cell < level.tiles.length; cell++) {
      const { x, y } = position(level, cell);
      const left = x * TILE;
      const top = y * TILE;
      const tile = level.tiles[cell];
      if (tile === "~") iceTile(ctx, left, top, random);
      ctx.strokeStyle = "#45758a21";
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 0.5, top + 0.5, TILE, TILE);
      const speck = random();
      if (tile !== "~" && speck > 0.25) {
        shadow(ctx, left + 11 + random() * 39, top + 13 + random() * 37, 4 + random() * 10, 1.2 + random() * 2, "#ffffff70");
      }
      if (tile === "#") rectangle(ctx, left + 2, top + 2, TILE - 4, TILE - 4, 6, "#4c7a992c");
    }

    for (let cell = 0; cell < level.tiles.length; cell++) {
      if (level.tiles[cell] !== "#") continue;
      const { x, y } = center(level, cell);
      const size = 0.77 + random() * 0.26;
      const drift = (random() - 0.5) * 9;
      if (random() > 0.74 || level.terrain === "冰湖") {
        rock(ctx, x + drift, y, size, theme);
      } else {
        pine(ctx, x + drift, y + 8, size, theme);
      }
    }

    const edge = ctx.createLinearGradient(0, 0, 0, layer.height);
    edge.addColorStop(0, "#29496448");
    edge.addColorStop(0.15, "#29496400");
    edge.addColorStop(0.81, "#29496400");
    edge.addColorStop(1, "#29496435");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, layer.width, layer.height);
    return layer;
  }

  function printTrail(ctx, run) {
    const tail = run.tick - run.level.delay;
    const start = Math.max(1, run.trail.length - 39);
    for (let i = start; i < run.trail.length; i++) {
      const from = run.trail[i - 1];
      const to = run.trail[i];
      if (from === to) continue;
      const previous = center(run.level, from);
      const next = center(run.level, to);
      const angle = Math.atan2(next.y - previous.y, next.x - previous.x) - Math.PI / 2;
      ctx.save();
      ctx.translate((previous.x + next.x) / 2, (previous.y + next.y) / 2);
      ctx.rotate(angle);
      const color = i <= tail ? "#33587035" : "#215b7e89";
      shadow(ctx, -5, -5, 3.4, 6.4, color);
      shadow(ctx, 5, 6, 3.4, 6.4, color);
      ctx.restore();
    }
  }

  function showGhost(ctx, level, route, tick, fraction) {
    const index = Math.min(tick, route.length - 1);
    const end = Math.min(index + 6, route.length - 1);
    ctx.save();
    ctx.strokeStyle = "#1b826eaa";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    for (let step = Math.max(0, index - 24); step <= end; step++) {
      const point = center(level, route[step]);
      if (step === Math.max(0, index - 24)) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
    const p = interpolate(level, route[Math.max(0, index - 1)], route[index], fraction);
    circle(ctx, p.x, p.y, 14, "#17837345");
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = "#146f65be";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawPlate(ctx, point, index, pressed, next) {
    const { x, y } = point;
    if (next) circle(ctx, x, y, 29, "#db792d30");
    shadow(ctx, x + 2, y + 8, 24, 13, "#1b3b5455");
    circle(ctx, x, y + 3, 22, pressed ? "#427764" : "#8a5636");
    circle(ctx, x, y, 20, pressed ? "#93e6b3" : "#ffbc72");
    circle(ctx, x, y, 15, pressed ? "#b7f4cb" : "#ffda9e");
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = pressed ? "#2a5b46" : "#773f26";
    ctx.fillText(String(index), x, y);
  }

  function drawGate(ctx, point, open) {
    const { x, y } = point;
    shadow(ctx, x + 6, y + 17, 17, 15, "#24486545");
    rectangle(ctx, x - 12, y - 25, 24, 50, 4, open ? "#63a89265" : "#547386", "#4f6d75");
    rectangle(ctx, x - 9, y - 25, 18, 8, 2, open ? "#9ff3c7" : "#f3b36f");
    rectangle(ctx, x - 9, y + 17, 18, 8, 2, open ? "#9ff3c7" : "#f3b36f");
    if (!open) {
      for (let bar = -6; bar <= 6; bar += 6) {
        rectangle(ctx, x + bar - 1, y - 16, 2, 32, 1, "#d9e9ed");
      }
    }
  }

  function drawStamp(ctx, x, y, time, still) {
    const offset = still ? 0 : Math.sin(time / 330 + x * 0.03) * 3.5;
    shadow(ctx, x, y + 12, 13, 5, "#5f54355a");
    circle(ctx, x, y, 24, "#ffe19666");
    ctx.save();
    ctx.translate(x, y + offset);
    ctx.rotate(-0.19);
    rectangle(ctx, -13, -10, 26, 20, 4, "#ffe2a7", "#825332");
    ctx.strokeStyle = "#b77040";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -5);
    ctx.lineTo(0, 3);
    ctx.lineTo(9, -5);
    ctx.stroke();
    ctx.restore();
  }

  function drawCabin(ctx, point, open) {
    const { x, y } = point;
    ctx.save();
    ctx.translate(x, y);
    if (open) {
      const halo = ctx.createRadialGradient(1, 10, 2, 1, 10, 51);
      halo.addColorStop(0, "#ffe4a8d2");
      halo.addColorStop(1, "#ffc88100");
      circle(ctx, 1, 10, 51, halo);
    }
    shadow(ctx, 9, 16, 41, 18, "#24425b65");
    rectangle(ctx, -28, -8, 56, 31, 3, "#895e4d", "#504354");
    rectangle(ctx, -27, 0, 54, 2.5, 1, "#b57c60");
    rectangle(ctx, -27, 10, 54, 2, 1, "#b57c60");
    rectangle(ctx, -4, 1, 14, 23, 2, open ? "#ffda91" : "#454657", "#513c45");
    rectangle(ctx, -21, 0, 10, 9, 2, "#ffcf77", "#614953");
    rectangle(ctx, 16, 0, 9, 9, 2, "#ffcf77", "#614953");
    ctx.beginPath();
    ctx.moveTo(-38, -9);
    ctx.lineTo(-6, -41);
    ctx.lineTo(35, -10);
    ctx.lineTo(31, -4);
    ctx.lineTo(-36, -4);
    ctx.closePath();
    ctx.fillStyle = "#614858";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-38, -10);
    ctx.lineTo(-6, -44);
    ctx.lineTo(37, -10);
    ctx.quadraticCurveTo(26, -6, 11, -12);
    ctx.quadraticCurveTo(-7, -8, -17, -11);
    ctx.quadraticCurveTo(-28, -5, -38, -10);
    ctx.closePath();
    ctx.fillStyle = "#f2fbff";
    ctx.fill();
    rectangle(ctx, 15, -36, 8, 14, 2, "#926d64", "#604651");
    rectangle(ctx, 13, -37, 12, 5, 2, "#eaf7fc");
    ctx.restore();
  }

  function drawCourier(ctx, point, heading, moving, phase) {
    const { x, y } = point;
    shadow(ctx, x + 4, y + 12, 18, 10, "#25496354");
    const stride = moving ? Math.sin(phase * Math.PI * 2) * 3.5 : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(courierAngle[heading]);
    rectangle(ctx, -10, 8 + stride, 7, 12, 3, "#273b57");
    rectangle(ctx, 3, 8 - stride, 7, 12, 3, "#273b57");
    rectangle(ctx, -14, -8, 28, 25, 8, "#cb5c45", "#633e48");
    rectangle(ctx, -12, -6, 24, 7, 3, "#fa8660");
    rectangle(ctx, -13, 5, 10, 11, 3, "#f5bd62", "#674449");
    rectangle(ctx, -10, 7, 5.5, 4.5, 1, "#fff2cb");
    rectangle(ctx, -10, -20, 20, 17, 7, "#f59054", "#744a4b");
    rectangle(ctx, -9, -11, 18, 5, 2, "#ffcc83");
    rectangle(ctx, -7, -8, 14, 5, 2, "#ffe0b6");
    rectangle(ctx, 8, -8, 8, 5, 2, "#e46f5c");
    ctx.restore();
  }

  function drawBall(ctx, point, angle) {
    const { x, y } = point;
    shadow(ctx, x + 6, y + 18, 26, 13, "#22435e66");
    const frost = ctx.createRadialGradient(x - 9, y - 13, 2, x, y, 29);
    frost.addColorStop(0, "#ffffff");
    frost.addColorStop(0.53, "#e2f8fc");
    frost.addColorStop(1, "#73a3bb");
    circle(ctx, x, y, 27, "#355a75");
    circle(ctx, x, y, 25, frost);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = "#6c9cb758";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(1, -3, 20, 12, 0.5, -0.4, Math.PI * 1.15);
    ctx.stroke();
    circle(ctx, -9, -8, 3, "#7dacc453");
    circle(ctx, 8, 6, 4, "#7dacc453");
    circle(ctx, 2, -14, 2.5, "#ffffffba");
    ctx.restore();
  }

  function createRenderer(canvas, still) {
    const ctx = canvas.getContext("2d");
    let terrain = null;
    let landscape = null;
    let particles = [];
    const random = randomSource(20712);
    const snow = Array.from({ length: 58 }, () => ({
      x: random(), y: random(), speed: 12 + random() * 18, size: 1 + random() * 2.1,
    }));

    function burst(level, cell, time, color) {
      if (still) return;
      const point = center(level, cell);
      for (let i = 0; i < 12; i++) {
        const angle = random() * Math.PI * 2;
        const speed = 23 + random() * 62;
        particles.push({ ...point, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, time, color });
      }
    }

    function reset() {
      particles = [];
    }

    function draw(run, fraction, time, ghost) {
      const level = run.level;
      if (terrain !== level) {
        terrain = level;
        landscape = makeLandscape(level);
        canvas.width = landscape.width;
        canvas.height = landscape.height;
      }
      ctx.drawImage(landscape, 0, 0);
      if (ghost) showGhost(ctx, level, ghost, run.tick, fraction);
      printTrail(ctx, run);
      for (const [index, cell] of level.plates.entries()) {
        drawPlate(ctx, center(level, cell), index + 1, run.pressed > index, run.pressed === index);
      }
      for (const cell of level.gates) {
        drawGate(ctx, center(level, cell), run.pressed > GATES.indexOf(level.tiles[cell]));
      }
      for (const cell of level.stamps) {
        if (run.stamps.has(cell)) continue;
        const { x, y } = center(level, cell);
        drawStamp(ctx, x, y, time, still);
      }
      drawCabin(ctx, center(level, level.exit), run.pressed === level.plates.length);

      if (run.ball != null) {
        drawBall(ctx, interpolate(level, run.previousBall, run.ball, fraction), (run.tick + fraction) * 0.46);
      }
      if (run.phase !== "caught") {
        drawCourier(ctx, interpolate(level, run.previousPlayer, run.player, fraction),
          run.heading, !still && run.previousPlayer !== run.player, fraction);
      }

      particles = particles.filter(particle => time - particle.time < 610);
      for (const particle of particles) {
        const elapsed = Math.max(0, time - particle.time) / 1000;
        ctx.globalAlpha = 1 - elapsed / 0.61;
        circle(ctx, particle.x + elapsed * particle.dx, particle.y + elapsed * particle.dy + 24 * elapsed ** 2,
          2.75, particle.color);
      }
      ctx.globalAlpha = 1;
      if (!still) {
        for (const flake of snow) {
          const elapsed = time / 1000;
          const x = (flake.x * canvas.width + elapsed * flake.speed) % canvas.width;
          const y = (flake.y * canvas.height + elapsed * flake.speed * 0.55) % canvas.height;
          circle(ctx, x, y, flake.size, "#fcffffb4");
        }
      }
    }

    return { draw, burst, reset };
  }

  global.SnowTrailRenderer = Object.freeze({ createRenderer });
})(globalThis);
