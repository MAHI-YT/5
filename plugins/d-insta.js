
const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "instagram",
    alias: ["ig", "instadl", "insta"],
    desc: "Download Instagram videos and send them on WhatsApp",
    category: "downloader",
    react: "🎥",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply, react }) => {
    try {
        // Validate input
        if (!q) return reply("Please provide a valid Instagram video or reel link.\nExample: `.instagram <url>`");

        // Call API
        const apiUrl = `https://api.elrayyxml.web.id/api/downloader/instagram?url=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl);

        // Validate API response
        if (!data || !data.result || !data.result.length || !data.result[0].url) {
            await react("❌");
            return reply("Failed to fetch video data from Instagram. Please check the link or try again later.");
        }

        const video = data.result[0];

        // Notify user of progress
        await reply(
            `🎬 *Instagram Video Detected!*\n\n` +
            `*👤 Author:* ${data.author || 'Unknown'}\n` +
            `*🖼 Thumbnail:* ${video.thumbnail ? 'Available' : 'Not found'}\n\n` +
            `📥 Downloading and uploading video... please wait!`
        );

        // Download video as buffer
        const response = await axios.get(video.url, { responseType: 'arraybuffer' });

        // Send video to chat
        await conn.sendMessage(from, {
            video: Buffer.from(response.data),
            caption: `🎥 > *IT'S ERFAN AHMAD*`,
            mimetype: 'video/mp4'
        }, { quoted: mek });

        await react("✅");

    } catch (e) {
        console.error("Error in Instagram command:", e);
        await react("❌");
        reply("An error occurred while downloading or sending the Instagram video.");
    }
});
