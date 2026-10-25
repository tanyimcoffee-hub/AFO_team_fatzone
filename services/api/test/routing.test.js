import { test } from "node:test";
import assert from "node:assert/strict";
import { createRouter, isValidPoint, thinGeometry, RouteError } from "../routing.js";

const okBody = {
  code: "Ok",
  routes: [{
    distance: 245300,
    duration: 12600,
    legs: [{ distance: 120000, duration: 6000 }, { distance: 125300, duration: 6600 }],
    geometry: { coordinates: [[100.5, 13.75], [101.2, 13.1], [102.12, 12.65]] },
  }],
};

const fakeFetch = (body, { ok = true, calls = [] } = {}) => async (url) => {
  calls.push(url);
  return { ok, json: async () => body };
};

const points = [{ lat: 13.75, lon: 100.5 }, { lat: 13.1, lon: 101.2 }, { lat: 12.65, lon: 102.12 }];

test("route แปลงผล OSRM เป็นกม./นาที และพิกัด [lat, lon]", async () => {
  const calls = [];
  const router = createRouter({ baseUrl: "http://osrm.test/", fetchImpl: fakeFetch(okBody, { calls }) });
  const result = await router.route(points);
  assert.equal(result.distanceKm, 245.3);
  assert.equal(result.durationMin, 210);
  assert.deepEqual(result.legs, [{ distanceKm: 120, durationMin: 100 }, { distanceKm: 125.3, durationMin: 110 }]);
  assert.deepEqual(result.geometry[0], [13.75, 100.5]);
  assert.equal(result.provider, "osrm");
  assert.match(calls[0], /^http:\/\/osrm\.test\/route\/v1\/driving\/100\.50000,13\.75000;101\.20000,13\.10000;102\.12000,12\.65000\?overview=full/);
});

test("route ใช้ cache สำหรับจุดชุดเดิม", async () => {
  const calls = [];
  const router = createRouter({ baseUrl: "http://osrm.test", fetchImpl: fakeFetch(okBody, { calls }) });
  await router.route(points);
  await router.route(points);
  assert.equal(calls.length, 1);
});

test("route แจ้ง 422 เมื่อหาเส้นทางไม่ได้ และ 502 เมื่อบริการผิดพลาด", async () => {
  const noRoute = createRouter({ fetchImpl: fakeFetch({ code: "NoRoute", routes: [] }, { ok: false }) });
  await assert.rejects(noRoute.route(points), (error) => error instanceof RouteError && error.status === 422);

  const broken = createRouter({ fetchImpl: fakeFetch(null, { ok: false }) });
  await assert.rejects(broken.route(points), (error) => error instanceof RouteError && error.status === 502);

  const offline = createRouter({ fetchImpl: async () => { throw new Error("ECONNREFUSED"); } });
  await assert.rejects(offline.route(points), (error) => error instanceof RouteError && error.status === 502);
});

test("isValidPoint ตรวจช่วงพิกัด", () => {
  assert.ok(isValidPoint({ lat: 13.7, lon: 100.5 }));
  assert.ok(!isValidPoint({ lat: 91, lon: 100 }));
  assert.ok(!isValidPoint({ lat: "13", lon: 100 }));
  assert.ok(!isValidPoint(null));
});

test("thinGeometry ลดจุดแต่เก็บจุดแรกและจุดสุดท้าย", () => {
  const coords = Array.from({ length: 10001 }, (_, i) => [i, i]);
  const thin = thinGeometry(coords, 4000);
  assert.ok(thin.length <= 4001);
  assert.deepEqual(thin[0], [0, 0]);
  assert.deepEqual(thin[thin.length - 1], [10000, 10000]);
  assert.equal(thinGeometry([[1, 1]]).length, 1);
});
