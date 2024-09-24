import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const connectDB = async () => {
    try {
        const connectionInstanse = await mongoose.connect(
            `${process.env.MONGO_URI}/${DB_NAME}`
        );
        console.log(
            `\n MongoDB connected !! DB Host: ${connectionInstanse.connection.host}`
        );
    } catch (error) {
        console.log("Mongodb connection Failed", error);
        process.exit(1);
    }
};

export default connectDB;
