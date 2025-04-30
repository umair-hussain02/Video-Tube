import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/likes.model.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid Channel ID");
    }

    // Fetch total videos
    const totalVideos = await Video.countDocuments({ user: channelId });

    // Fetch total views (sum of all video views)
    const videos = await Video.find({ user: channelId }, "views");
    const totalViews = videos.reduce(
        (acc, video) => acc + (video.views || 0),
        0
    );

    // Fetch total subscribers
    const totalSubscribers = await Subscription.countDocuments({
        channel: channelId,
    });

    // Fetch total likes (sum of all likes on videos of this channel)
    const videoIds = videos.map((video) => video._id);
    const totalLikes = await Like.countDocuments({ video: { $in: videoIds } });

    const stats = {
        totalVideos,
        totalViews,
        totalSubscribers,
        totalLikes,
    };

    return res
        .status(200)
        .json(
            new ApiResponse(200, stats, "Channel stats fetched successfully")
        );
});

const getChannelVideos = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError(400, "Invalid Channel ID");
    }

    const videos = await Video.find({ user: channelId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("user", "username avatar");

    const totalVideos = await Video.countDocuments({ user: channelId });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                videos,
                totalVideos,
                page: Number(page),
                limit: Number(limit),
            },
            "Channel videos fetched successfully"
        )
    );
});

export { getChannelStats, getChannelVideos };
