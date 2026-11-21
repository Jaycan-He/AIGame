"use strict";

(function runGame() {
  const engine = globalThis.SnowTrailEngine;
  const levels = globalThis.SnowTrailLevels.map(engine.prepareLevel);
  const byId = id => document.getElementById(id);
  const board = byId("board");
  const cover = byId("cover");
  const primary = byId("cover-primary");
  const secondary = byId("cover-secondary");
  const results = byId("results");
  const help = byId("help-dialog");
  const pauseButton = byId("pause-button");
  const ghostToggle = byId("ghost-toggle");
  const soundButton = byId("sound-button");
  const routeList = byId("route-list");
  const touchButtons = Array.from(document.querySelectorAll("[data-direction]"));
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = globalThis.SnowTrailRenderer.createRenderer(board, still);
  const saveKey = "snowball-trail:v1";
  const maxSavedSteps = 1600;
  const keyboard = new Map([
    ["ArrowUp", 0], ["KeyW", 0],
    ["ArrowLeft", 1], ["KeyA", 1],
    ["ArrowDown", 2], ["KeyS", 2],
    ["ArrowRight", 3], ["KeyD", 3],
  ]);

  const AudioDevice = globalThis.AudioContext || globalThis.webkitAudioContext;
  let audioContext;
  const notes = {
    step: [[118, 0, 0.035, 0.022, "triangle"]],
    stamp: [[659, 0, 0.10, 0.10], [880, 0.07, 0.12, 0.08]],
    plate: [[349, 0, 0.16, 0.13, "triangle"], [523, 0.09, 0.17, 0.08]],
    lost: [[125, 0, 0.25, 0.18, "triangle"], [66, 0.09, 0.26, 0.10, "triangle"]],
    won: [[440, 0, 0.15, 0.12], [587, 0.10, 0.17, 0.10], [784, 0.20, 0.26, 0.10]],
  };

  function safeRecord(value, level) {
    if (!value || !Number.isInteger(value.ticks) || value.ticks < 1 ||
        ![1, 2, 3].includes(value.medal)) return null;
    const validTrail = Array.isArray(value.trail) &&
      value.trail.length <= maxSavedSteps + 1 &&
      value.trail.length === value.ticks + 1 &&
      value.trail[0] === level.start &&
      value.trail.every(cell => Number.isInteger(cell) && cell >= 0 &&
        cell < level.tiles.length && level.tiles[cell] !== "#");
    return { ticks: value.ticks, medal: value.medal, trail: validTrail ? value.trail : null };
  }

  function loadSave() {
    const empty = { sound: false, ghost: false, records: {} };
    try {
      const saved = JSON.parse(localStorage.getItem(saveKey));
      if (!saved || typeof saved !== "object") return empty;
      empty.sound = saved.sound === true;
      empty.ghost = saved.ghost === true;
      for (const level of levels) {
        const record = safeRecord(saved.records?.[level.id], level);
        if (record) empty.records[level.id] = record;
      }
    } catch {
      // The game remains playable if browser storage is disabled or corrupted.
    }
    return empty;
  }

  const save = loadSave();

  function persist() {
    try {
      localStorage.setItem(saveKey, JSON.stringify(save));
    } catch {
      // Keep the scores available in memory for this visit.
    }
  }

  function activateAudio() {
    if (!save.sound || !AudioDevice) return;
    audioContext ??= new AudioDevice();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  }

  function playSound(sound) {
    if (!save.sound || audioContext?.state !== "running") return;
    for (const [frequency, delay, length, volume, type = "sine"] of notes[sound]) {
      const when = audioContext.currentTime + delay;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, when);
      gain.gain.exponentialRampToValueAtTime(volume, when + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, when + length);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(when);
      oscillator.stop(when + length + 0.02);
    }
  }

  function formatTime(milliseconds) {
    const tenths = Math.floor(milliseconds / 100);
    const minutes = Math.floor(tenths / 600);
    const seconds = String(Math.floor(tenths / 10) % 60).padStart(2, "0");
    return minutes + ":" + seconds + "." + tenths % 10;
  }

  function announce(text) {
    byId("announcement").textContent = text;
  }

  function unlocked(index) {
    return index === 0 || levels.slice(0, index).every(level => save.records[level.id]);
  }

  const firstIncomplete = levels.findIndex(level => !save.records[level.id]);
  let levelIndex = firstIncomplete < 0 ? levels.length - 1 : firstIncomplete;
  let run = engine.createRun(levels[levelIndex]);
  let mode = "briefing";
  let accumulator = 0;
  let lastFrame = 0;
  let pendingDirection = null;
  const held = new Map();

  function clearInput() {
    held.clear();
    pendingDirection = null;
    for (const button of touchButtons) button.classList.remove("is-held");
  }

  function setSoundLabel() {
    soundButton.textContent = save.sound ? "音效开" : "音效关";
    soundButton.setAttribute("aria-pressed", String(save.sound));
    soundButton.disabled = !AudioDevice;
  }

  function renderScoreboard() {
    const best = save.records[run.level.id];
    byId("elapsed").textContent = formatTime(run.tick * engine.STEP_MS);
    byId("best-time").textContent = best ? formatTime(best.ticks * engine.STEP_MS) : "—";
    byId("stamp-count").textContent = run.stamps.size + "/" + run.level.stamps.length;
    byId("ghost-setting").hidden = !best?.trail;
    ghostToggle.checked = save.ghost;
  }

  function renderMission() {
    const open = run.pressed === run.level.plates.length;
    const door = byId("door-state");
    door.textContent = open ? "木屋已开" : "木屋未开";
    door.closest(".door-status").dataset.open = String(open);
    byId("plate-count").textContent = "机关 " + run.pressed + "/" + run.level.plates.length;
    const badges = run.level.plates.map((_, index) => {
      const pressed = index < run.pressed;
      const badge = document.createElement("span");
      badge.className = pressed ? "plate is-pressed" : "plate";
      badge.textContent = index + 1;
      badge.setAttribute("aria-label", (index + 1) + " 号机关" + (pressed ? "已触发" : "待触发"));
      return badge;
    });
    byId("plates").replaceChildren(...badges);
  }

  function renderRoutes() {
    const rows = levels.map((level, index) => {
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.level = index;
      button.disabled = !unlocked(index);
      if (index === levelIndex) button.setAttribute("aria-current", "true");

      const number = document.createElement("span");
      number.className = "route-number";
      number.textContent = index + 1;
      const title = document.createElement("span");
      title.textContent = level.title;
      button.append(number, title);

      const best = save.records[level.id];
      if (best || button.disabled) {
        const status = document.createElement("span");
        status.className = best ? "route-stars" : "route-locked";
        status.textContent = best ? "★".repeat(best.medal) + "☆".repeat(3 - best.medal) : "未解锁";
        if (best) status.setAttribute("aria-label", best.medal + " 星");
        button.append(status);
      }
      row.append(button);
      return row;
    });
    routeList.replaceChildren(...rows);
    const completed = levels.filter(level => save.records[level.id]).length;
    byId("campaign-progress").textContent = completed + "/" + levels.length + " 已送达";
  }

  function renderButtons() {
    pauseButton.disabled = mode !== "playing" && mode !== "paused";
    pauseButton.textContent = mode === "paused" ? "继续" : "暂停";
  }

  function showCover({ title, copy, icon = "✳", action, alternative, stats = [] }) {
    byId("cover-title").textContent = title;
    byId("cover-copy").textContent = copy;
    byId("cover-icon").textContent = icon;
    primary.textContent = action;
    secondary.hidden = !alternative;
    if (alternative) secondary.textContent = alternative;
    results.replaceChildren(...stats.map(({ value, rating }) => {
      const item = document.createElement("span");
      item.textContent = value;
      if (rating) item.className = "rating";
      return item;
    }));
    results.hidden = stats.length === 0;
    cover.hidden = false;
  }

  function prepare(index, focus = false) {
    levelIndex = index;
    run = engine.createRun(levels[index]);
    mode = "briefing";
    accumulator = 0;
    clearInput();
    renderer.reset();
    byId("level-label").textContent = "第 " + (index + 1) + " 关 · " + run.level.terrain;
    byId("level-title").textContent = run.level.title;
    byId("briefing").textContent = run.level.briefing;
    renderScoreboard();
    renderMission();
    renderRoutes();
    renderButtons();
    showCover({
      title: index === 0 ? "踏上雪地邮路" : run.level.title,
      copy: index === 0 ? "引雪球压下开关，把包裹送进木屋。" : run.level.briefing,
      action: "开始投递",
      stats: [{ value: "三星目标 " + formatTime(run.level.par * 1000) + " · 集齐邮戳" }],
    });
    if (focus) primary.focus({ preventScroll: true });
  }

  function begin(focus = true) {
    run = engine.createRun(levels[levelIndex]);
    mode = "playing";
    accumulator = 0;
    clearInput();
    renderer.reset();
    cover.hidden = true;
    renderScoreboard();
    renderMission();
    renderButtons();
    activateAudio();
    announce("投递开始。移动后开始计时。");
    if (focus) board.focus({ preventScroll: true });
  }

  function pause(focus = true) {
    if (mode !== "playing") return;
    mode = "paused";
    clearInput();
    renderButtons();
    showCover({ title: "投递暂停", copy: "继续后，雪球会从原处接着滚。", action: "继续投递", alternative: "重跑本关", icon: "Ⅱ" });
    if (focus) primary.focus({ preventScroll: true });
  }

  function resume() {
    mode = "playing";
    cover.hidden = true;
    renderButtons();
    activateAudio();
    board.focus({ preventScroll: true });
    announce("继续投递。");
  }

  function endRun(time) {
    clearInput();
    if (run.phase === "caught") {
      mode = "lost";
      renderer.burst(run.level, run.player, time, "#fcffff");
      playSound("lost");
      showCover({ title: "被雪球追上了", copy: "试着绕一圈，让雪球离开你要返回的路口。", action: "再跑一次", icon: "●" });
      announce("被雪球追上了。按 R 重跑本关。");
    } else {
      mode = "won";
      const { allStamps, onTime, medal } = engine.award(run);
      const previous = save.records[run.level.id];
      const personalBest = !previous || run.tick < previous.ticks;
      const record = personalBest
        ? { ticks: run.tick, trail: run.tick <= maxSavedSteps ? run.trail.slice() : null, medal }
        : { ...previous, medal };
      record.medal = Math.max(medal, previous?.medal ?? 0);
      save.records[run.level.id] = record;
      persist();
      renderRoutes();
      renderScoreboard();
      renderer.burst(run.level, run.level.exit, time, "#ffdc9d");
      playSound("won");

      const final = levelIndex === levels.length - 1;
      const nextGoal = !allStamps ? "重跑时收齐邮戳可以再得一星。" : !onTime ? "在目标时间内送达可以再得一星。" : "邮戳齐全，准时送达。";
      showCover({
        title: final ? "六趟邮路全部送达" : "包裹送达",
        copy: personalBest ? "刷新本关最佳用时。" : nextGoal,
        action: final ? "再跑一次" : "下一关",
        alternative: final ? "回到第一关" : "重跑本关",
        icon: "✓",
        stats: [
          { value: formatTime(run.tick * engine.STEP_MS) },
          { value: "邮戳 " + run.stamps.size + "/" + run.level.stamps.length },
          { value: "★".repeat(medal) + "☆".repeat(3 - medal), rating: true },
        ],
      });
      announce((final ? "全部关卡完成。" : "包裹送达。") + medal + " 星。");
    }
    renderButtons();
    primary.focus({ preventScroll: true });
  }

  function nextDirection() {
    if (pendingDirection != null) {
      const direction = pendingDirection;
      pendingDirection = null;
      return direction;
    }
    return Array.from(held.values()).at(-1);
  }

  function step(direction, time) {
    const event = engine.advance(run, direction);
    renderScoreboard();
    if (event.pressedPlate) {
      renderMission();
      renderer.burst(run.level, run.ball, time, "#b1f4c9");
      playSound("plate");
      announce("雪球压下 " + run.pressed + " 号开关。" +
        (run.pressed === run.level.plates.length ? "木屋已开。" : ""));
    }
    if (event.collected) {
      renderer.burst(run.level, run.player, time, "#ffd999");
      playSound("stamp");
    }
    if (event.caught || event.delivered) endRun(time);
    else if (event.moved && run.tick % 2 === 0 && !event.collected && !event.pressedPlate) playSound("step");
  }

  function frame(time) {
    const delta = lastFrame ? Math.min(90, time - lastFrame) : 0;
    lastFrame = time;
    if (mode === "playing") {
      if (run.tick === 0) {
        const direction = nextDirection();
        if (engine.nextCell(run, direction) !== run.player) {
          step(direction, time);
          accumulator = 0;
        }
      } else {
        accumulator += delta;
        while (mode === "playing" && accumulator >= engine.STEP_MS) {
          accumulator -= engine.STEP_MS;
          step(nextDirection(), time);
        }
      }
    }
    const fraction = mode === "playing" || mode === "paused" ? accumulator / engine.STEP_MS : 1;
    const ghost = save.ghost ? save.records[run.level.id]?.trail : null;
    renderer.draw(run, fraction, time, ghost);
    requestAnimationFrame(frame);
  }

  function hold(token, direction) {
    if (mode === "briefing") begin(false);
    if (mode !== "playing") return false;
    activateAudio();
    if (!held.has(token)) {
      held.set(token, direction);
      pendingDirection = direction;
    }
    return true;
  }

  primary.addEventListener("click", () => {
    if (mode === "paused") resume();
    else if (mode === "won" && levelIndex + 1 < levels.length) prepare(levelIndex + 1, true);
    else begin();
  });

  secondary.addEventListener("click", () => {
    if (mode === "won" && levelIndex === levels.length - 1) prepare(0, true);
    else begin();
  });

  byId("restart-button").addEventListener("click", () => begin());
  pauseButton.addEventListener("click", () => {
    if (mode === "paused") resume();
    else pause();
  });

  byId("help-button").addEventListener("click", () => {
    pause(false);
    help.showModal();
  });
  byId("close-help").addEventListener("click", () => help.close());
  byId("dismiss-help").addEventListener("click", () => help.close());

  soundButton.addEventListener("click", () => {
    save.sound = !save.sound;
    activateAudio();
    if (save.sound) playSound("stamp");
    setSoundLabel();
    persist();
  });

  ghostToggle.addEventListener("change", () => {
    save.ghost = ghostToggle.checked;
    persist();
  });

  routeList.addEventListener("click", event => {
    const button = event.target.closest("button[data-level]");
    if (!button || button.disabled) return;
    prepare(Number(button.dataset.level), true);
  });

  window.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || help.open ||
        event.target.matches?.("input, textarea, [contenteditable]")) return;
    if (keyboard.has(event.code)) {
      event.preventDefault();
      if (!event.repeat) hold(event.code, keyboard.get(event.code));
    } else if (event.code === "KeyR" && !event.repeat) {
      event.preventDefault();
      begin();
    } else if (event.code === "Escape" && !event.repeat) {
      if (mode === "playing") pause();
      else if (mode === "paused") resume();
    } else if (event.code === "Enter" && !event.repeat && !cover.hidden && !event.target.closest?.("button")) {
      event.preventDefault();
      primary.click();
    }
  });
  window.addEventListener("keyup", event => held.delete(event.code));

  for (const button of touchButtons) {
    const direction = Number(button.dataset.direction);
    button.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !hold(event.pointerId, direction)) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      button.classList.add("is-held");
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(name, event => {
        held.delete(event.pointerId);
        button.classList.remove("is-held");
      });
    }
    button.addEventListener("click", event => {
      if (event.detail !== 0) return;
      const token = "touch-key-" + direction;
      hold(token, direction);
      held.delete(token);
    });
  }

  window.addEventListener("blur", () => {
    if (mode === "playing" && run.tick > 0) pause(false);
    else clearInput();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause(false);
  });
  setSoundLabel();
  prepare(levelIndex);
  requestAnimationFrame(frame);
})();
