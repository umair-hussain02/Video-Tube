import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { getVideoDurationInSeconds } from "get-video-duration";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/likes.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        query = "",
        sortBy = "createdAt",
        sortType = "desc",
        userId,
    } = req.query;
    const filter = {};

    if (query) {
        filter.title = { $regex: query, $options: "i" }; // case-insensitive search
    }

    if (userId && isValidObjectId(userId)) {
        filter.creater = userId;
    }

    const sortOption = { [sortBy]: sortType === "asc" ? 1 : -1 };

    const videos = await Video.find(filter)
        .sort(sortOption)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("creater", "userName avatar");

    const total = await Video.countDocuments(filter);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { videos, total, page: Number(page), limit: Number(limit) },
                "Videos fetched successfully"
            )
        );
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title || !description) {
        throw new ApiError(400, "Title and description are required");
    }

    if (!req.files?.videoFile || !req.files?.thumbnail) {
        throw new ApiError(400, "Video file and thumbnail are required");
    }
    // console.log(req.files);

    const videoLocalPath = req.files.videoFile[0]?.path;
    const thumbnailLocalPath = req.files.thumbnail[0]?.path;

    if (!videoLocalPath || !thumbnailLocalPath) {
        throw new ApiError(400, "Video or thumbnail file missing");
    }

    const videoDuration = await getVideoDurationInSeconds(videoLocalPath);

    const uploadedVideo = await uploadOnCloudinary(videoLocalPath);
    const uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!uploadedVideo?.url || !uploadedThumbnail?.url) {
        throw new ApiError(500, "Failed to upload video or thumbnail");
    }

    const video = await Video.create({
        title,
        description,
        videoFile: uploadedVideo.url,
        thumbnail: uploadedThumbnail.url,
        creater: req.user._id, // fixed here
        duration: videoDuration,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, video, "Video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findByIdAndUpdate(
        videoId,
        { $inc: { views: 1 } }, // Increment views
        { new: true } // Return updated document
    ).populate("creater", "userName avatar");

    const subscriberCount = await Subscription.countDocuments({
        channel: video.creater._id,
    });

    const likes = await Like.countDocuments({ video: video._id });

    const responseVideo = {
        ...video.toObject(),
        creater: {
            ...video.creater.toObject(),
            subscriberCount,
        },
        likes,
    };

    return res
        .status(200)
        .json(
            new ApiResponse(200, responseVideo, "Video fetched successfully")
        );
});

//     if (!video) {
//         throw new ApiError(404, "Video not found");
//     }

//     return res
//         .status(200)
//         .json(new ApiResponse(200, video, "Video fetched successfully"));
// });

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }
    //console.log(video.creater.toString());
    //console.log(req.user._id.toString());

    if (video.creater.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this video");
    }

    if (title) video.title = title;
    if (description) video.description = description;

    // Optional: handle new thumbnail upload
    if (req.files?.thumbnail) {
        const thumbnailLocalPath = req.files.thumbnail[0]?.path;
        const uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        if (uploadedThumbnail?.url) {
            video.thumbnail = uploadedThumbnail.url;
        }
    }

    await video.save();

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.creater.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video");
    }

    await video.deleteOne();

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.creater.toString() !== req.user._id.toString()) {
        throw new ApiError(
            403,
            "You are not authorized to change publish status"
        );
    }

    video.isPublished = !video.isPublished;
    await video.save();

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                video,
                `Video ${video.isPublished ? "published" : "unpublished"} successfully`
            )
        );
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
};
