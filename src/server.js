import app from "./app.js";
import { env } from "./config/env.js";

const startServer = () => {
    try {
        app.listen(env.PORT, () => {
            console.log(
                `SemanticCache server running on port ${env.PORT}`
            );
        });
    } catch (error) {
        console.error("Server startup failed:", error);
        process.exit(1);
    }
};

startServer();