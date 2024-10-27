import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";

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
        throw new ApiError(400, "All Fields are required...!");
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

export { registerUser, loginUser, logoutUser };
