const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input"); // пакет для получения ввода от пользователя
const fs = require("fs");
const axios = require("axios");

const apiId = 23684756; // ваш api_id
const apiHash = "3d8ce96bf3a257f324cf3ea44f6a9a9d"; // ваш api_hash
const sessionFilePath = "session.txt";
const tonApiKey =
    "AEW3PQ3O2KTJWRYAAAAPWEQ6OYX24Q2PH6OW6H33YG2ESFGBPYRAQGMWTSDE6PJQTIP6GAI";
const baseUrl = "https://tonapi.io/v2"; // Базовый URL API

// Переменные для подсчета запросов
let telegramRequestCount = 0;
let tonApiRequestCount = 0;

// Функция для сохранения строки сессии в файл
const saveSession = (session) => {
    fs.writeFileSync(sessionFilePath, session, "utf8");
};

// Функция для загрузки строки сессии из файла
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
            console.error("Ошибка авторизации:", error);
            retries--;
            console.log(`Повторная попытка через ${6 - retries} секунд...`);
            await delay((6 - retries) * 1000);
        }
    }
    console.error(
        "Не удалось подключиться к Telegram после нескольких попыток."
    );
};

const getChannelPosts = async (channelUsername) => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await connectToTelegram(client);
    telegramRequestCount++; // Увеличение счетчика запросов к Telegram

    // Получение сообщений из канала
    const channel = await client.getEntity(channelUsername);
    const result = await client.getMessages(channel, { limit: 10 });

    // Проверка структуры результата и вывод сообщений
    if (result && result.length > 0) {
        return result
            .map((message) => {
                const match = message.message.match(/CA: (EQ[A-Za-z0-9_-]+)/);
                return match ? match[1] : null;
            })
            .filter((message) => message !== null);
    } else {
        console.log("Сообщения не найдены");
        return [];
    }
};

const getTokenData = async (tokenAddress) => {
    const url = `${baseUrl}/jettons/${tokenAddress}`;
    tonApiRequestCount++; // Увеличение счетчика запросов к TON API

    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${tonApiKey}`,
            },
        });

        return response.data;
    } catch (error) {
        console.error("Ошибка получения данных жетона:", error);
        return null;
    }
};

const processChannelPosts = async () => {
    const channelUsername = "crypton_deploys"; // замените на имя вашего канала
    const addresses = await getChannelPosts(channelUsername);

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

    // Вывод количества запросов после обработки каждого цикла
    console.log(`Количество запросов к Telegram API: ${telegramRequestCount}`);
    console.log(`Количество запросов к TON API: ${tonApiRequestCount}`);
};

// Запуск функции каждые 30 секунд
const intervalId = setInterval(processChannelPosts, 30000);

// Начальный запуск
processChannelPosts();

// Обработка сигналов для остановки
process.on("SIGINT", () => {
    clearInterval(intervalId);
    console.log("Процесс остановлен.");
    process.exit(0);
});

process.on("SIGTERM", () => {
    clearInterval(intervalId);
    console.log("Процесс остановлен.");
    process.exit(0);
});
