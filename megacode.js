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

const stringSession = new StringSession(loadSession()); // загрузка строки сессии

const getChannelPosts = async (channelUsername) => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    try {
        await client.start({
            phoneNumber: async () =>
                await input.text("Введите ваш номер телефона: "),
            password: async () => await input.text("Введите ваш пароль: "),
            phoneCode: async () =>
                await input.text("Введите код из Telegram: "),
            onError: (err) => console.log(err),
        });

        // Сохранение строки сессии после успешной авторизации
        saveSession(client.session.save());

        console.log("Авторизация завершена успешно");
    } catch (error) {
        console.error("Ошибка авторизации:", error);
        return [];
    }

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

    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${tonApiKey}`,
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error fetching token data:", error);
        return null;
    }
};

(async () => {
    const channelUsername = "crypton_deploys"; // замените на имя вашего канала
    const addresses = await getChannelPosts(channelUsername);

    if (addresses.length > 0) {
        for (const address of addresses) {
            const tokenData = await getTokenData(address);
            if (tokenData) {
                console.log(
                    `Данные о жетоне для адреса ${address}:`,
                    tokenData
                );
            } else {
                console.log(
                    `Не удалось получить данные о жетоне для адреса ${address}`
                );
            }
        }
    } else {
        console.log("Не удалось найти адреса CA в сообщениях канала");
    }
})();
