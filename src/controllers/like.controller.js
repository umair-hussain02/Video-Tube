import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/likes.model.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const existingLike = await Like.findOne({
        user: req.user._id,
        video: videoId,
    });

    if (existingLike) {
        await existingLike.deleteOne();
        return res
            .status(200)
            .json(new ApiResponse(200, null, "Video unliked successfully"));
    }

    await Like.create({
        user: req.user._id,
        video: videoId,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, null, "Video liked successfully"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    const existingLike = await Like.findOne({
        user: req.user._id,
        comment: commentId,
    });

    if (existingLike) {
        await existingLike.deleteOne();
        return res
            .status(200)
            .json(new ApiResponse(200, null, "Comment unliked successfully"));
    }

    await Like.create({
        user: req.user._id,
        comment: commentId,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, null, "Comment liked successfully"));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    const existingLike = await Like.findOne({
        user: req.user._id,
        tweet: tweetId,
    });

    if (existingLike) {
        await existingLike.deleteOne();
        return res
            .status(200)
            .json(new ApiResponse(200, null, "Tweet unliked successfully"));
    }

    await Like.create({
        user: req.user._id,
        tweet: tweetId,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, null, "Tweet liked successfully"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const likes = await Like.find({
        user: req.user._id,
        video: { $exists: true },
    })
        .populate("video", "title thumbnail createdAt") // assuming video model has these fields
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .sort({ createdAt: -1 });

    const total = await Like.countDocuments({
        user: req.user._id,
        video: { $exists: true },
    });

    const likedVideos = likes.map((like) => like.video);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                likedVideos,
                total,
                page: Number(page),
                limit: Number(limit),
            },
            "Liked videos fetched successfully"
        )
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
