const axios = require("axios");

const botToken = "YOUR_BOT_TOKEN"; // Замените на токен вашего бота
const channelUsername = "@your_channel_username"; // Замените на ваше имя канала (не используйте для закрытого канала)

const getChatId = async () => {
    const url = `https://api.telegram.org/bot${botToken}/getChat`;
    try {
        const response = await axios.post(url, {
            chat_id: channelUsername, // Если канал закрытый, попробуйте добавить бота в группу и получить оттуда chat_id
        });
        console.log(response.data);
    } catch (error) {
        console.error(
            "Ошибка получения chat_id:",
            error.response ? error.response.data : error.message
        );
    }
};

getChatId();
