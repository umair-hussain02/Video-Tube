import { app } from "./app.js";
import connectDB from "./db/index.js";
import { config } from "dotenv";
config();

const port = process.env.PORT || 3000;

connectDB()
    .then(() => {
        app.listen(port, () => {
            console.log(`Your App is Running at http://localhost:${port}`);
        });
    })
    .catch((err) => {
        console.log("connection failed with mongodb", err);
    });
