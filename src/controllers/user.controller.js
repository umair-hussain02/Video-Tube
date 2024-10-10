import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    const { userName, password, email, fullName } = req.body;

    // validation - not empty
    if (
        [userName, password, email, fullName].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All Fiels Are Required!");
    }

    // check if user already exists: username, email
    const existedUser = await User.findOne({
        $or: [{ userName }, { email }],
    });
    if (existedUser) {
        throw new ApiError(
            409,
            "User Already exists with this email or username"
        );
    }

    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImagePath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImagePath = req.files.coverImage[0].path;
    }
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar Image File is Required!");
    }

    // upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImagePath);
    if (!avatar) {
        throw new ApiError(400, "Avatar Image file is required!");
    }

    // create user object - create entry in db
    const user = await User.create({
        fullName,
        Avatar: avatar.url,
        coverImage: coverImage.url || "",
        email,
        userName: userName.toLowerCase(),
        password,
    });

    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // check for user creation
    if (!createdUser) {
        throw new ApiError(
            500,
            "Error has been occured when registering user!"
        );
    }

    // return res
    return res
        .status(201)
        .json(
            new ApiResponse(200, createdUser, "User Registerd Successfully!")
        );
});

export { registerUser };
