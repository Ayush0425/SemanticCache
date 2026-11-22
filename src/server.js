import app from "./app.js";
import { env } from "./config/env.js";
import { startPublicRetention } from "./public-demo.js";

app.listen(env.PORT, env.HOST, (error) => {
    if (error) {
        console.error("Server startup failed:", error);
        process.exitCode = 1;
        return;
    }
    console.log(`SemanticCache server running at http://${env.HOST}:${env.PORT}`);
    startPublicRetention();
});
