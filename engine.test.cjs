"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
require("./levels.js");
require("./engine.js");

const engine = globalThis.SnowTrailEngine;
const campaign = globalThis.SnowTrailLevels.map(engine.prepareLevel);
const direction = { U: 0, L: 1, D: 2, R: 3, ".": null };
const goldRoutes = {
  pines: "UURUUURRRRRULLLLDDURRRRRRRRR.DDDDDUUUUU",
  ravine: "RUURRRRRRRUULLLLUURDDRRDDRRRRRRRRDRRRUUURUUR.....",
  lake: "DR.......UURRRRRUUUURRRRRDDDRDDDLLUDLLLULLLLLUUUUUUL....",
  gates: "UURRUULUULDRRRRRRRRRRRRRDRRRLDDDRRRRRRRRRRRRRRDUURRUUUU.........",
  storm: "RRRUUUUURRUUULLLLLDRRRRDDDDDLLLLLUULLUUUUUU...",
  aurora: "LUURRUUUURRRDRRRRRRRRRRRRRRDRDUDLLDLLUUUUULLLLLLL",
};

for (const level of campaign) {
  test(level.id + " can be completed with all three stars", () => {
    const run = engine.createRun(level);
    for (const action of goldRoutes[level.id]) engine.advance(run, direction[action]);
    assert.equal(run.phase, "delivered");
    assert.equal(run.pressed, level.plates.length);
    assert.deepEqual(engine.award(run), { allStamps: true, onTime: true, medal: 3 });
  });
}

test("the snowball catches a courier who stays still", () => {
  const level = campaign[0];
  const run = engine.createRun(level);
  for (let tick = 0; tick < level.delay - 1; tick++) engine.advance(run, null);
  assert.equal(run.ball, null);
  engine.advance(run, null);
  assert.equal(run.ball, level.start);
  assert.equal(run.phase, "caught");
  assert.equal(engine.advance(run, 0), null);
});

test("a head-on swap with the snowball counts as a collision", () => {
  const level = engine.prepareLevel({ id: "head-on", delay: 3, rows: [
    "#######", "#S...E#", "#######",
  ] });
  const run = engine.createRun(level);
  for (const move of "RRRL") engine.advance(run, direction[move]);
  assert.equal(run.phase, "running");
  engine.advance(run, direction.L);
  assert.equal(run.phase, "caught");
  assert.equal(run.player, run.previousBall);
  assert.equal(run.ball, run.previousPlayer);
});

test("only the snowball presses switches, and the gates follow the engraved order", () => {
  const level = campaign[1];
  const run = engine.createRun(level);
  run.player = level.gates[0] - 1;
  assert.equal(engine.nextCell(run, direction.R), run.player);
  run.pressed = 1;
  assert.equal(engine.nextCell(run, direction.R), level.gates[0]);
  run.pressed = 0;
  run.player = level.plates[0];
  engine.advance(run, null);
  assert.equal(run.pressed, 0);

  run.trail[0] = level.plates[1];
  run.tick = level.delay - 1;
  engine.advance(run, null);
  assert.equal(run.ball, level.plates[1]);
  assert.equal(run.pressed, 0);
});

test("ice carries the player forward until a wall stops the slide", () => {
  const level = engine.prepareLevel({ id: "ice", delay: 12, rows: [
    "#######", "#S~~#E#", "#.....#", "#######",
  ] });
  const run = engine.createRun(level);
  engine.advance(run, direction.R);
  engine.advance(run, direction.D);
  assert.deepEqual(engine.position(level, run.player), { x: 3, y: 1 });
  engine.advance(run, direction.D);
  assert.deepEqual(engine.position(level, run.player), { x: 3, y: 2 });
  assert.equal(run.slide, null);
});
