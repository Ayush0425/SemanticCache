// Keep these prompts separate when comparing settings on pairs.js.
export const holdoutPairs = [
    {
        name: "JavaScript string length",
        cached: "How do I find the length of a string in JavaScript?",
        query: "How can I get the length of a JavaScript string?",
        shouldHit: true,
    },
    {
        name: "Inner join",
        cached: "What does an SQL INNER JOIN return?",
        query: "In SQL, what rows are returned by an INNER JOIN?",
        shouldHit: true,
    },
    {
        name: "Keyboard shortcut",
        cached: "What keyboard shortcut opens Find in VS Code on Windows?",
        query: "In Windows VS Code, what keys open the Find box?",
        shouldHit: true,
    },
    {
        name: "HTTP 404",
        cached: "What does HTTP status code 404 mean?",
        query: "What's the meaning of a 404 HTTP status code?",
        shouldHit: true,
    },
    {
        name: "Minutes in an hour",
        cached: "How many minutes are there in one hour?",
        query: "How many minutes make up an hour?",
        shouldHit: true,
    },
    {
        name: "Changed date",
        cached: "How many days are there from June 1 to July 1 in the same year?",
        query: "How many days are there from June 1 to July 2 in the same year?",
        shouldHit: false,
    },
    {
        name: "Negated filter",
        cached: "Give me a JavaScript expression that keeps even numbers from an array.",
        query: "Give me a JavaScript expression that does not keep even numbers from an array.",
        shouldHit: false,
    },
    {
        name: "Changed output format",
        cached: "List three primary colors as a JSON array.",
        query: "List three primary colors as a comma-separated line of plain text.",
        shouldHit: false,
    },
    {
        name: "Changed word count",
        cached: "Describe a rainbow in exactly five words.",
        query: "Describe a rainbow in exactly ten words.",
        shouldHit: false,
    },
    {
        name: "Different status code",
        cached: "What does HTTP status code 401 mean?",
        query: "What does HTTP status code 403 mean?",
        shouldHit: false,
    },
];
