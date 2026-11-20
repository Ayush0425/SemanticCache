import express from "express";

const app = express();

// Global middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "SemanticCache API is running",
    });
});

export default app;