import { vs as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.uplaod(localFilePath, {
            resource_type: "auto",
        });

        // file has been uploaded successfull
        //console.log("file is uploaded on cloudinary ", response.url);

        fs.unlink(localFilePath);
        return response;
    } catch (error) {
        fs.unlink(localFilePath);
        return null;
    }
};
