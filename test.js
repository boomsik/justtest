const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input"); // пакет для получения ввода от пользователя

const apiId = 23684756; // ваш api_id
const apiHash = "3d8ce96bf3a257f324cf3ea44f6a9a9d"; // ваш api_hash
const stringSession = new StringSession(""); // или используйте существующую строку сессии

const getChannelPosts = async (channelUsername) => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () =>
            await input.text("Введите ваш номер телефона: "),
        password: async () => await input.text("Введите ваш пароль: "),
        phoneCode: async () => await input.text("Введите код из Telegram: "),
        onError: (err) => console.log(err),
    });

    console.log("Авторизация завершена успешно");

    // Получение сообщений из канала
    const channel = await client.getEntity(channelUsername);
    const result = await client.getMessages(channel, { limit: 10 });

    // Проверка структуры результата и вывод сообщений
    if (result && result.length > 0) {
        return result.map((message) => message.message);
    } else {
        console.log("Сообщения не найдены");
        return [];
    }
};

(async () => {
    const channelUsername = "crypton_deploys"; // замените на имя вашего канала
    const messages = await getChannelPosts(channelUsername);
    console.log("Сообщения из канала:", messages);
})();
