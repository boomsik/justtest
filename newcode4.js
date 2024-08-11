const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");
const axios = require("axios");

const apiId = 23684756;
const apiHash = "3d8ce96bf3a257f324cf3ea44f6a9a9d";
const sessionFilePath = "session.txt";
const tonApiKey =
    "AEW3PQ3O2KTJWRYAAAAPWEQ6OYX24Q2PH6OW6H33YG2ESFGBPYRAQGMWTSDE6PJQTIP6GAI";
const baseUrl = "https://tonapi.io/v2";

let telegramRequestCount = 0;
let tonApiRequestCount = 0;

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

const connectToTelegram = async (client, retries = 5) => {
    while (retries > 0) {
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
            return;
        } catch (error) {
            if (error.message.includes("TIMEOUT")) {
                console.log(
                    "Ошибка TIMEOUT при авторизации. Повторная попытка..."
                );
            } else {
                console.error("Ошибка авторизации:", error);
            }
            retries--;
            console.log(`Повторная попытка через ${6 - retries} секунд...`);
            await delay((6 - retries) * 1000);
        }
    }
    console.error(
        "Не удалось подключиться к Telegram после нескольких попыток."
    );
};

const getChannelPosts = async (client, channelUsername) => {
    telegramRequestCount++;
    try {
        const channel = await client.getEntity(channelUsername);
        const result = await client.getMessages(channel, { limit: 10 });

        if (result && result.length > 0) {
            return result
                .map((message) => {
                    const match = message.message.match(
                        /CA: (EQ[A-Za-z0-9_-]+)/
                    );
                    return match ? match[1] : null;
                })
                .filter((message) => message !== null);
        } else {
            console.log("Сообщения не найдены");
            return [];
        }
    } catch (error) {
        console.error("Ошибка получения сообщений из канала:", error);
        return [];
    }
};

const getTokenData = async (tokenAddress, retries = 5) => {
    const url = `${baseUrl}/jettons/${tokenAddress}`;
    tonApiRequestCount++;

    while (retries > 0) {
        try {
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${tonApiKey}`,
                },
            });

            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                console.log("Превышен лимит запросов. Повторная попытка...");
                await delay(30000); // Ждём 30 секунд перед повторной попыткой
                retries--;
            } else {
                console.error("Ошибка получения данных жетона:", error);
                return null;
            }
        }
    }
    return null;
};

const processChannelPosts = async (retries = 5) => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        timeout: 20000, // Увеличение времени ожидания
    });

    try {
        await connectToTelegram(client);

        const channelUsername = "crypton_deploys";
        const addresses = await getChannelPosts(client, channelUsername);

        if (addresses.length > 0) {
            for (const address of addresses) {
                const tokenData = await getTokenData(address);
                if (tokenData) {
                    const description =
                        tokenData.metadata?.description || "Нет описания";
                    if (description.includes("Deployed from sTONks bot")) {
                        console.log(`Адрес: ${address}`);
                        console.log(`Описание: ${description}`);
                    }
                } else {
                    console.log(
                        `Не удалось получить данные о жетоне для адреса ${address}`
                    );
                }
            }
        } else {
            console.log("Не удалось найти адреса CA в сообщениях канала");
        }

        console.log(
            `Количество запросов к Telegram API: ${telegramRequestCount}`
        );
        console.log(`Количество запросов к TON API: ${tonApiRequestCount}`);
    } catch (error) {
        if (error.message.includes("TIMEOUT")) {
            console.log(
                "Ошибка TIMEOUT при обработке сообщений. Повторная попытка..."
            );
            if (retries > 0) {
                setTimeout(() => processChannelPosts(retries - 1), 30000);
            }
        } else {
            console.error("Произошла ошибка:", error);
        }
    } finally {
        try {
            await client.disconnect();
        } catch (disconnectError) {
            console.error("Ошибка при отключении клиента:", disconnectError);
        }
        if (retries > 0) {
            console.log("Процесс завершен. Перезапуск через 30 секунд...");
            setTimeout(() => processChannelPosts(retries - 1), 30000);
        }
    }
};

process.on("SIGINT", () => {
    console.log("Процесс остановлен.");
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("Процесс остановлен.");
    process.exit(0);
});

processChannelPosts();
