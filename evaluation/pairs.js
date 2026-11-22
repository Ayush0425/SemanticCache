// The second prompt can reuse the first answer only when shouldHit is true.
export const pairs = [
    {
        name: "Sky color",
        cached: "What causes the sky to look blue during the day?",
        query: "What causes the sky to appear blue during the day?",
        shouldHit: true,
    },
    {
        name: "Water freezing point",
        cached: "At standard pressure, what is the freezing point of pure water in Celsius?",
        query: "At what temperature in degrees Celsius does pure water freeze at standard atmospheric pressure?",
        shouldHit: true,
    },
    {
        name: "France capital",
        cached: "What is the capital city of France?",
        query: "Which city serves as France's capital?",
        shouldHit: true,
    },
    {
        name: "Current Git branch",
        cached: "How can I print the name of my current Git branch?",
        query: "Which Git command tells me the branch I'm on?",
        shouldHit: true,
    },
    {
        name: "CSS horizontal alignment",
        cached: "How do I horizontally center text inside a div using CSS?",
        query: "What CSS property aligns text to the center across a div?",
        shouldHit: true,
    },
    {
        name: "Photosynthesis definition",
        cached: "Explain photosynthesis in one sentence.",
        query: "In a single sentence, describe what photosynthesis is.",
        shouldHit: true,
    },
    {
        name: "Kilometers to meters",
        cached: "How many meters are in one kilometer?",
        query: "Convert 1 kilometer into meters.",
        shouldHit: true,
    },
    {
        name: "Python list length",
        cached: "How do I get the number of elements in a Python list?",
        query: "How can I count how many items a list contains in Python?",
        shouldHit: true,
    },
    {
        name: "Changed country",
        cached: "What is the capital city of France?",
        query: "What is the capital city of Italy?",
        shouldHit: false,
    },
    {
        name: "Changed units",
        cached: "At standard pressure, what is the freezing point of pure water in Celsius?",
        query: "At standard pressure, what is the freezing point of pure water in Fahrenheit?",
        shouldHit: false,
    },
    {
        name: "Boiling versus freezing",
        cached: "At standard pressure, what is the freezing point of pure water in Celsius?",
        query: "At standard pressure, what is the boiling point of pure water in Celsius?",
        shouldHit: false,
    },
    {
        name: "Changed year",
        cached: "Which country won the men's FIFA World Cup in 2018?",
        query: "Which country won the men's FIFA World Cup in 2022?",
        shouldHit: false,
    },
    {
        name: "Reversed conversion",
        cached: "How many meters are in one kilometer?",
        query: "How many kilometers are in one meter?",
        shouldHit: false,
    },
    {
        name: "Ascending versus descending",
        cached: "How do I sort a Python list in ascending order?",
        query: "How do I sort a Python list in descending order?",
        shouldHit: false,
    },
    {
        name: "Different language requirement",
        cached: "Give me a one-sentence definition of photosynthesis in English.",
        query: "Give me a one-sentence definition of photosynthesis in Spanish.",
        shouldHit: false,
    },
    {
        name: "Unrelated question",
        cached: "How do I get the number of elements in a Python list?",
        query: "Why does the moon have phases?",
        shouldHit: false,
    },
];
