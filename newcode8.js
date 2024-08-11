const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");

const apiId = 23684756;
const apiHash = "3d8ce96bf3a257f324cf3ea44f6a9a9d";
const sessionFilePath = "session.txt";
const channelUsername = "@ton_new_deploy"; // Публичное имя вашего канала

const saveSession = (session) => {
    fs.writeFileSync(sessionFilePath, session, "utf8");
};

const loadSession = () => {
    if (fs.existsSync(sessionFilePath)) {
        return fs.readFileSync(sessionFilePath, "utf8");
    }
    return "";
};

const stringSession = new StringSession(loadSession());

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectToTelegram = async (client) => {
    try {
        await client.start({
            phoneNumber: async () =>
                await input.text("Введите ваш номер телефона: "),
            password: async () => await input.text("Введите ваш пароль: "),
            phoneCode: async () =>
                await input.text("Введите код из Telegram: "),
            onError: (err) => console.log(err),
        });

        saveSession(client.session.save());
        console.log("Авторизация завершена успешно");
    } catch (error) {
        console.error("Ошибка авторизации:", error);
    }
};

const getChannelPosts = async (client, channelUsername) => {
    try {
        const channel = await client.getEntity(channelUsername);
        const result = await client.getMessages(channel, { limit: 20 });

        if (result && result.length > 0) {
            return result.map((message) => {
                return {
                    id: message.id,
                    date: message.date,
                    senderId: message.senderId,
                    text: message.message,
                };
            });
        } else {
            console.log("Сообщения не найдены");
            return [];
        }
    } catch (error) {
        console.error("Ошибка получения сообщений из канала:", error);
        return [];
    }
};

const main = async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        timeout: 30000, // Увеличение времени ожидания до 30 секунд
    });

    await connectToTelegram(client);

    const posts = await getChannelPosts(client, channelUsername);

    posts.forEach((post) => {
        if (post.text.includes("Deployed from sTONks bot")) {
            console.log(`ID: ${post.id}`);
            console.log(`Date: ${post.date}`);
            console.log(`Sender ID: ${post.senderId}`);
            console.log(`Message: ${post.text}`);
            console.log("=========================");
        }
    });

    process.on("SIGINT", async () => {
        console.log("Процесс остановлен.");
        await client.disconnect();
        process.exit(0);
    });

    process.on("SIGTERM", async () => {
        console.log("Процесс остановлен.");
        await client.disconnect();
        process.exit(0);
    });
};

main();
