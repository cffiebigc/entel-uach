// api/getTutorials.js
import { google } from "googleapis";

function groupVideosByTutorial(videos) {
  const tutorials = {};

  videos.forEach((video, index) => {
    const title = video.snippet.title;
    const videoId = video.snippet.resourceId.videoId;

    // Split by ' - ' to separate tutorial name from step
    const parts = title.split(" - ");
    if (parts.length >= 2) {
      const tutorialName = parts[0].trim();
      const stepName = parts.slice(1).join(" - ").trim(); // In case there are multiple hyphens

      if (!tutorials[tutorialName]) {
        tutorials[tutorialName] = {
          title: tutorialName,
          videos: [],
        };
      }

      tutorials[tutorialName].videos.push({
        id: videoId,
        title: stepName,
        order: tutorials[tutorialName].videos.length + 1,
        originalTitle: title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
      });
    } else {
      // If no hyphen found, create a single-video tutorial
      const tutorialName = title;
      tutorials[tutorialName] = {
        title: tutorialName,
        videos: [
          {
            id: videoId,
            title: title,
            order: 1,
            originalTitle: title,
            description: video.snippet.description,
            thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
          },
        ],
      };
    }
  });

  // Convert object to array and sort videos within each tutorial
  return Object.values(tutorials).map((tutorial) => ({
    ...tutorial,
    videos: tutorial.videos.sort((a, b) => a.order - b.order),
  }));
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "http://localhost:3000/oauth2callback" // This won't be used in production
    );

    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    });

    // Create YouTube API client
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // Fetch playlist items
    let allVideos = [];
    let nextPageToken = null;

    do {
      const response = await youtube.playlistItems.list({
        part: "snippet",
        playlistId: process.env.PLAYLIST_ID,
        maxResults: 50,
        pageToken: nextPageToken,
      });

      allVideos = allVideos.concat(response.data.items);
      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    // Group videos into tutorials
    const tutorials = groupVideosByTutorial(allVideos);

    res.status(200).json({
      success: true,
      tutorials: tutorials,
      totalVideos: allVideos.length,
      totalTutorials: tutorials.length,
    });
  } catch (error) {
    console.error("Error fetching tutorials:", error);
    res.status(500).json({
      error: "Failed to fetch tutorials",
      message: error.message,
    });
  }
}
