"use strict";

(function exposeEngine(global) {
  const STEP_MS = 175;
  const DIRECTIONS = [
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 0 },
  ];
  const PLATES = "123";
  const GATES = "ABC";

  function prepareLevel(spec) {
    const width = spec.rows[0].length;
    const height = spec.rows.length;
    const tiles = spec.rows.join("");
    if (spec.rows.some(row => row.length !== width) || !tiles.includes("S") || !tiles.includes("E")) {
      throw new Error("Invalid level " + spec.id);
    }

    const plates = Array.from(PLATES).flatMap(label => {
      const cell = tiles.indexOf(label);
      return cell < 0 ? [] : [cell];
    });
    const stamps = Array.from(tiles).flatMap((tile, cell) => tile === "*" ? [cell] : []);
    return {
      ...spec,
      width,
      height,
      tiles,
      plates,
      stamps,
      start: tiles.indexOf("S"),
      exit: tiles.indexOf("E"),
      gates: Array.from(tiles).flatMap((tile, cell) => GATES.includes(tile) ? [cell] : []),
    };
  }

  function createRun(level) {
    return {
      level,
      phase: "running",
      tick: 0,
      player: level.start,
      previousPlayer: level.start,
      ball: null,
      previousBall: null,
      heading: 3,
      slide: null,
      trail: [level.start],
      pressed: 0,
      stamps: new Set(),
    };
  }

  function position(level, cell) {
    return { x: cell % level.width, y: Math.floor(cell / level.width) };
  }

  function nextCell(run, direction) {
    if (direction == null || !DIRECTIONS[direction]) return run.player;
    const level = run.level;
    const origin = position(level, run.player);
    const vector = DIRECTIONS[direction];
    const x = origin.x + vector.x;
    const y = origin.y + vector.y;
    if (x < 0 || x >= level.width || y < 0 || y >= level.height) return run.player;
    const cell = y * level.width + x;
    const tile = level.tiles[cell];
    const gate = GATES.indexOf(tile);
    return tile === "#" || gate >= run.pressed ? run.player : cell;
  }

  // Occupying a tile for one tick leaves a trace, even when the player waits.
  // The snowball always consumes that trace at the same fixed delay.
  function advance(run, requestedDirection) {
    if (run.phase !== "running") return null;

    let direction = run.slide ?? requestedDirection;
    let target = nextCell(run, direction);
    if (target === run.player && run.slide != null) {
      direction = requestedDirection;
      target = nextCell(run, direction);
    }

    const moved = target !== run.player;
    run.previousPlayer = run.player;
    run.previousBall = run.ball;
    run.player = target;
    if (moved) run.heading = direction;
    run.slide = moved && run.level.tiles[target] === "~" ? direction : null;
    run.tick += 1;
    run.trail.push(target);
    run.ball = run.trail[run.tick - run.level.delay] ?? null;

    const swapped = run.ball === run.previousPlayer && run.previousBall === run.player;
    if (run.ball === target || swapped) {
      run.phase = "caught";
      return { moved, caught: true };
    }

    const plate = run.level.plates[run.pressed];
    const pressedPlate = run.ball != null && run.ball === plate && run.ball !== run.previousBall;
    if (pressedPlate) run.pressed += 1;
    const collected = run.level.tiles[target] === "*" && !run.stamps.has(target);
    if (collected) run.stamps.add(target);

    if (target === run.level.exit && run.pressed === run.level.plates.length) {
      run.phase = "delivered";
    }
    return { moved, pressedPlate, collected, delivered: run.phase === "delivered" };
  }

  function award(run) {
    const allStamps = run.stamps.size === run.level.stamps.length;
    const onTime = Math.floor(run.tick * STEP_MS / 100) <= run.level.par * 10;
    return { allStamps, onTime, medal: 1 + Number(allStamps) + Number(onTime) };
  }

  global.SnowTrailEngine = Object.freeze({
    STEP_MS, DIRECTIONS, GATES, prepareLevel, createRun, position, nextCell, advance, award,
  });
})(globalThis);
