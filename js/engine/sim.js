// Orquestador del tick de simulación.
import * as C from "../data/constants.js";
import { S, countryVP, log } from "./state.js";
import { economyHour, tickQueues, attritionTick, regenTick, tickResearch } from "./economy.js";
import { tickMovement, tickAirPatrol } from "./movement.js";
import { tickCombat } from "./combat.js";
import { tickMissiles } from "./missiles.js";
import { tickRearm } from "./air-combat.js";
import { aiTickAll } from "./ai.js";

export function tick(state) {
  if (state.gameOver) return;
  const dt = C.MINUTES_PER_TICK_BASE * (state.speed || 0);
  if (dt <= 0) return;

  const prevHour = Math.floor(state.time / 60);
  const prevDay = Math.floor(state.time / 1440);
  const prevAi = Math.floor(state.time / (C.AI_CHECK_HOURS * 60));
  const prevAttr = Math.floor(state.time / (C.ATTRITION_EVERY_H * 60));

  state.time += dt;

  const hours = Math.floor(state.time / 60) - prevHour;
  for (let i = 0; i < Math.min(hours, 4); i++) economyHour(state);
  if (hours > 4) economyHour(state);

  tickQueues(state, dt);
  tickResearch(state, dt);
  tickMovement(state, dt);
  tickAirPatrol(state, dt);
  tickCombat(state, dt);
  tickMissiles(state, dt);
  tickRearm(state, dt);
  if (state.units.some((u) => u.dead)) state.units = state.units.filter((u) => !u.dead);

  if (Math.floor(state.time / (C.ATTRITION_EVERY_H * 60)) !== prevAttr) {
    attritionTick(state);
    regenTick(state);
  }
  if (state.units.some((u) => u.dead)) state.units = state.units.filter((u) => !u.dead);

  if (Math.floor(state.time / (C.AI_CHECK_HOURS * 60)) !== prevAi) aiTickAll(state);

  const day = Math.floor(state.time / 1440);
  if (day !== prevDay && !state.gameOver) {
    const share = countryVP(state, state.player) / S.totalVP;
    // solo avisar cuando el porcentaje controlado cambia de verdad
    if (state.lastShareLog === undefined || Math.abs(share - state.lastShareLog) > 0.001) {
      state.lastShareLog = share;
      log(state, `Controlas el ${(share * 100).toFixed(1)}% de los puntos de victoria.`, "info");
    }
    if (share >= C.VICTORY_VP_SHARE) state.gameOver = { win: true, share };
  }
}
