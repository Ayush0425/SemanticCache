export class ModelError extends Error {}

export function toFloatVector(vector) {
    if (!Array.isArray(vector) || vector.length > 16_000 || !vector.every(Number.isFinite)) {
        throw new ModelError("The model provider returned an invalid embedding.");
    }
    const floatVector = vector.map(Math.fround);
    if (!floatVector.every(Number.isFinite) || !floatVector.some((value) => value !== 0)) {
        throw new ModelError("The model provider returned an invalid embedding.");
    }
    return floatVector;
}

export function validateAnswer(answer) {
    if (typeof answer !== "string" || !answer.trim() || answer.includes("\0")) {
        throw new ModelError("The model provider returned an invalid answer.");
    }
    return answer;
}
