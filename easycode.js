require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");

// Преобразуем API_ID в число
const apiId = parseInt(process.env.API_ID, 10);
const apiHash = process.env.API_HASH;
const sessionFilePath = process.env.SESSION_FILE_PATH;
const channelUsername = process.env.CHANNEL_USERNAME;

let telegramRequestCount = 0;
let totalRequestCount = 0;

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
    telegramRequestCount++;
    totalRequestCount++;
    try {
        const channel = await client.getEntity(channelUsername);
        const result = await client.getMessages(channel, { limit: 10 }); // Получаем последние 10 сообщений

        if (result && result.length > 0) {
            return result.map((message) => {
                return {
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

const processChannelPosts = async (client) => {
    const posts = await getChannelPosts(client, channelUsername);

    posts.forEach((post) => {
        // Ищем строки с адресом токена
        const tokenAddressMatch = post.text.match(/EQ[A-Za-z0-9_-]+/);
        const tokenAddress = tokenAddressMatch ? tokenAddressMatch[0] : null;

        // Ищем текст с VULTURES
        const vulturesTextMatch = post.text.match(
            /VULTURES 1 is the debut studio album from the reborn duo of Kanye West and Ty Dolla \$ign, known as \$/
        );
        const vulturesText = vulturesTextMatch ? vulturesTextMatch[0] : null;

        // Если найдены оба элемента, выводим их
        if (tokenAddress && vulturesText) {
            console.log(`Адрес токена: ${tokenAddress}`);
            console.log(`Сообщение: ${vulturesText}`);
            console.log("=========================");
        }
    });

    console.log(`Количество запросов к Telegram API: ${telegramRequestCount}`);
    console.log(`Общее количество запросов: ${totalRequestCount}`);
};

const main = async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        timeout: 30000,
    });

    await connectToTelegram(client);

    // Запускаем функцию каждые 30 секунд
    setInterval(() => {
        processChannelPosts(client);
    }, 30000);

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
