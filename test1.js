const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input"); // пакет для получения ввода от пользователя
const fs = require("fs");

const apiId = 23684756; // ваш api_id
const apiHash = "3d8ce96bf3a257f324cf3ea44f6a9a9d"; // ваш api_hash
const sessionFilePath = "session.txt";

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
        return result.map((message) => message.message || "[Без текста]");
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
