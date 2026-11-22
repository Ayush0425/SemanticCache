const unitGroups = {
    temperature: [
        ["celsius", "centigrade"],
        ["fahrenheit"],
        ["kelvin", "kelvins"],
    ],
    length: [
        ["millimeter", "millimeters", "millimetre", "millimetres", "mm"],
        ["centimeter", "centimeters", "centimetre", "centimetres", "cm"],
        ["meter", "meters", "metre", "metres"],
        ["kilometer", "kilometers", "kilometre", "kilometres", "km"],
        ["inch", "inches"],
        ["foot", "feet"],
        ["yard", "yards"],
        ["mile", "miles"],
    ],
};

const units = new Map();
for (const [dimension, groups] of Object.entries(unitGroups)) {
    for (const group of groups) {
        const unit = { dimension, name: group[0] };
        for (const alias of group) units.set(alias, unit);
    }
}

const numberWords = new Map(
    ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
        .map((word, value) => [word, String(value)]),
);
const temperatureSymbols = { c: "celsius", f: "fahrenheit", k: "kelvin" };

function constraints(prompt) {
    const normalized = prompt.toLowerCase().replaceAll("−", "-")
        .replace(/(?:°\s*|\bdegrees?\s+)(celsius|fahrenheit|kelvin|[cfk])\b/g, (_, unit) =>
            ` ${temperatureSymbols[unit] ?? unit}`);
    const tokens = [...normalized.matchAll(/[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)|\p{L}+/gu)];
    const byDimension = new Map();
    for (const [index, [token]] of tokens.entries()) {
        const unit = units.get(token);
        if (!unit) continue;
        if (!byDimension.has(unit.dimension)) {
            byDimension.set(unit.dimension, { names: new Set(), amounts: new Set() });
        }
        const detail = byDimension.get(unit.dimension);
        detail.names.add(unit.name);

        const previous = tokens[index - 1];
        if (!previous || !/^\s*-?\s*$/.test(normalized.slice(previous.index + previous[0].length, tokens[index].index))) {
            continue;
        }
        const numeric = Number(previous[0].replaceAll(",", ""));
        const amount = numberWords.get(previous[0]) ?? (Number.isFinite(numeric) ? String(numeric) : undefined);
        if (amount !== undefined) detail.amounts.add(`${amount} ${unit.name}`);
    }
    return byDimension;
}

function sameValues(first, second) {
    return first.size === second.size && [...first].every((value) => second.has(value));
}

export function hasUnitConflict(cachedPrompt, prompt) {
    const cached = constraints(cachedPrompt);
    const requested = constraints(prompt);
    for (const [dimension, existing] of cached) {
        const incoming = requested.get(dimension);
        if (!incoming) continue;
        if (!sameValues(existing.names, incoming.names)) return true;
        if (existing.amounts.size && incoming.amounts.size && !sameValues(existing.amounts, incoming.amounts)) {
            return true;
        }
    }
    return false;
}
