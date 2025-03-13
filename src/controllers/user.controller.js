import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

// -----------Cookies Option------------
const option = {
    httpOnly: true,
    secure: true,
};

// ------------------Generate refresh and access tokes Function----------
const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        // finding user
        const user = await User.findById(userId);
        // generating tokens
        const refreshToken = user.generateRefreshToken();
        const accessToken = user.generateAccessToken();
        // add refresh token in user object
        user.refreshToken = refreshToken;
        // save user
        await user.save({ validateBeforeSave: false });
        // return tokens
        return { refreshToken, accessToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
};

// ------------------Register User Controller----------
const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    const { userName, email, fullName, password } = req.body;
    // validation - not empty
    if (
        [userName, email, fullName, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All * Fields are required...!");
    }
    // check if user already exists: username, email
    const existedUser = await User.findOne({
        $or: [{ userName }, { email }],
    });
    if (existedUser) {
        throw new ApiError(
            400,
            "User with this email or Username is already exists!"
        );
    }

    // console.log(req.files);

    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0].path;
    // console.log(avatarLocalPath);

    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files?.coverImage[0].path;
    }

    // upload them to cloudinary, avatar
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar Path is required...!");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar Image is Required...!");
    }
    // create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
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
            400,
            "Something Went Wrong When Registering the User"
        );
    }

    // return res
    return res
        .status(201)
        .json(
            new ApiResponse(200, createdUser, "User Created Successfully..!")
        );
});

// ------------------Login User Controller--------------
const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    const { userName, email, password } = req.body;

    // username or email
    if (!userName && !email) {
        throw new ApiError(400, "Email or Username is required...!");
    }

    // find the user
    const user = await User.findOne({
        $or: [{ email }, { userName }],
    });
    if (!user) {
        throw new ApiError(
            400,
            "No User Exists with this Email or password...!"
        );
    }

    // password check
    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Given Credentials are not correct...!");
    }

    // access and referesh token
    const { refreshToken, accessToken } =
        await generateAccessTokenAndRefreshToken(user._id);

    // Logged In User
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // Set Cookies & send Response
    res.status(200)
        .cookie("RefreshToken", refreshToken, option)
        .cookie("AccessToken", accessToken, option)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    refreshToken,
                    accessToken,
                },
                "User Logged In Successfully..."
            )
        );
});

//------------------Logout User Controller--------------
const logoutUser = asyncHandler(async (req, res) => {
    // Find Correct User
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refresh: 1,
            },
        },
        {
            new: true,
        }
    );
    // Clear Cookies and send response
    return res
        .status(200)
        .clearCookie("accessToken", option)
        .clearCookie("refreshToken", option)
        .json(new ApiResponse(200, {}, "User Logged Out..!"));
});

//------------------Refresh AccessToken Controller--------------
const refreshAccessToken = asyncHandler(async (req, res) => {
    // get token of the logged IN User
    const incomingToken = req.cookies.RefreshToken || req.body.RefreshToken;
    if (!incomingToken) {
        throw new ApiError(401, "Unauthorized Request...!");
    }

    try {
        // decode the token
        const decodedToken = jwt.verify(
            incomingToken,
            process.env.REFRESH_TOKEN_SECRET
        );
        // find the user using token
        const user = await User.findById(decodedToken?._id);
        if (!user) {
            throw new ApiError(400, "Invalid Refresh Token...!");
        }
        if (incomingToken !== user?.refreshToken) {
            throw new ApiError(400, "Refresh token is user or expired...!");
        }
        // set new token
        const { accessToken, newRefreshToken } =
            await generateAccessTokenAndRefreshToken(user?._id);
        // send response
        res.status(200)
            .cookie("accessToken", accessToken, option)
            .cookie("refreshToken", newRefreshToken, option)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access Token Refreshed..."
                )
            );
    } catch (error) {
        throw new ApiError(400, error.message || "Invalid Refresh Token...");
    }
});

//------------------Change Current Password Controller--------------
const changeCurrentPassword = asyncHandler(async (req, res) => {
    // Get old and new password
    const { oldPassword, newPassword } = req.body;
    // Check the password is correct
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Old Password...!");
    }
    // Save the new password
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
    // Send new response
    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Your Password is updated Successfully...")
        );
});

//------------------Get Current User Controller--------------
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "User Fetched Successfully..."));
});

//------------------Update Account Details Controller--------------
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    if ((!fullName, !email)) {
        throw new ApiError(400, "Full Name and Email is required...!");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                email,
                fullName,
            },
        },
        { new: true }
    ).select("-password");
    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Account Details updated Successfully..")
        );
});

//------------------Update Avatar Image Controller--------------
const updateUserAvatar = asyncHandler(async (req, res) => {
    // Get new Avatar
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar Image is required...");
    }
    // upload on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
        throw new ApiError(400, "Error While uploading Avatar Image...");
    }

    // delete old one

    // update in user
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            },
        },
        { new: true }
    ).select("-password");

    // return res
    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar Image updated Successfully"));
});

//------------------Update Avatar Image Controller--------------
const updateUserCoverImage = asyncHandler(async (req, res) => {
    // Get new Avatar
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image is required...");
    }
    // upload on cloudinary
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage) {
        throw new ApiError(400, "Error While uploading Cover Image...");
    }

    // delete old one

    // update in user
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: coverImage.url,
            },
        },
        { new: true }
    ).select("-password");

    // return res
    return res
        .status(200)
        .json(new ApiResponse(200, user, "Cover Image updated Successfully"));
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
};
