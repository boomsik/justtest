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
const botToken = "7286405880:AAFNtG_dXaifjzQ4ISeaGPnehNEjbiJlkWg";
const channelUsername = "@mychansnipe"; // Публичное имя вашего канала
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

const sendMessageToChannel = async (message) => {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: channelUsername,
            text: message,
        });
    } catch (error) {
        console.error("Ошибка отправки сообщения:", error);
    }
};

const processChannelPosts = async (client) => {
    try {
        const channelUsername = "crypton_deploys";
        const addresses = await getChannelPosts(client, channelUsername);

        if (addresses.length > 0) {
            for (const address of addresses) {
                const tokenData = await getTokenData(address);
                if (tokenData) {
                    const description =
                        tokenData.metadata?.description || "Нет описания";
                    if (description.includes("Deployed from sTONks bot")) {
                        const message = `Адрес: ${address}\nОписание: ${description}`;
                        console.log(message);
                        await sendMessageToChannel(message);
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
        console.error("Произошла ошибка:", error);
    }
};

let isProcessing = false;

const startProcessing = async (client) => {
    if (!isProcessing) {
        isProcessing = true;
        try {
            await processChannelPosts(client);
        } catch (error) {
            console.error("Ошибка в процессе обработки:", error);
        } finally {
            isProcessing = false;
        }
    }
};

const main = async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        timeout: 30000, // Увеличение времени ожидания до 30 секунд
    });

    await connectToTelegram(client);

    setInterval(() => startProcessing(client), 40000); // Запускаем startProcessing каждые 40 секунд

    // Начальный запуск функции
    startProcessing(client);

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
