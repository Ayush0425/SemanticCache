import assert from "node:assert/strict";
import test from "node:test";
import { hasUnitConflict } from "../src/unit-constraints.js";

test("rejects a change in the requested temperature scale", () => {
    assert.equal(hasUnitConflict("Give the freezing point in Celsius.", "Give the freezing point in Fahrenheit."), true);
});

test("accepts alternative spellings for the same scale and amount", () => {
    assert.equal(hasUnitConflict("Convert 0 degrees Celsius to Fahrenheit.", "Convert 0°C to °F."), false);
});

test("detects reversed conversion when the same two units appear", () => {
    assert.equal(hasUnitConflict("How many meters are in one kilometer?", "How many kilometers are in 1 meter?"), true);
    assert.equal(hasUnitConflict("How many meters are in one kilometer?", "Convert 1 kilometre to metres."), false);
});

test("detects an explicitly changed quantity", () => {
    assert.equal(hasUnitConflict("Convert 1.5 kilometres to metres.", "Convert 2 kilometres to metres."), true);
    assert.equal(hasUnitConflict("Convert 1,000 meters to kilometers.", "Convert 1000 metres to kilometres."), false);
});

test("leaves unit-free comparisons to the similarity check", () => {
    assert.equal(hasUnitConflict("What makes the daytime sky blue?", "Why is the sky blue during the day?"), false);
});
