const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");
const axios = require("axios");
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc } = require("firebase/firestore");

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDsafnpErtlmQ5prrPRtzBFM0SJZbzJgb8",
    authDomain: "ton-search.firebaseapp.com",
    projectId: "ton-search",
    storageBucket: "ton-search.appspot.com",
    messagingSenderId: "719724885996",
    appId: "1:719724885996:web:cd3ac69f61756a1cfa32c9",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const apiId = 23684756;
const apiHash = "3d8ce96bf3a257f324cf3ea44f6a9a9d";
const sessionFilePath = "session.txt";
const channelUsername = "@ton_new_deploy"; // Публичное имя вашего канала
const botToken = "7286405880:AAFNtG_dXaifjzQ4ISeaGPnehNEjbiJlkWg";
const destinationChannel = "@mychansnipe"; // Ваш целевой канал для отправки сообщений

let telegramRequestCount = 0;

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
        const result = await client.getMessages(channel, { limit: 50 });

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

const sendMessageToChannel = async (message) => {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: destinationChannel,
            text: message,
            parse_mode: "HTML", // Добавляем поддержку HTML разметки
        });
    } catch (error) {
        console.error("Ошибка отправки сообщения:", error);
    }
};

const saveTokenToFirestore = async (tokenAddress) => {
    try {
        const docRef = await addDoc(collection(db, "tokens"), {
            address: tokenAddress,
            timestamp: new Date(),
        });
        console.log("Токен записан в Firestore с ID: ", docRef.id);
    } catch (e) {
        console.error("Ошибка записи токена в Firestore: ", e);
    }
};

const main = async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        timeout: 30000,
    });

    await connectToTelegram(client);

    const posts = await getChannelPosts(client, channelUsername);

    posts.forEach((post) => {
        if (post.text.includes("Deployed from sTONks bot")) {
            const tokenAddressMatch = post.text.match(/EQ[A-Za-z0-9_-]+/);

            const tokenAddress = tokenAddressMatch
                ? tokenAddressMatch[0]
                : "Адрес не найден";

            const message = `Найдено сообщение с фразой 'Deployed from sTONks bot':\n<code>${tokenAddress}</code>`;
            console.log(message);
            console.log("=========================");

            sendMessageToChannel(message);
            saveTokenToFirestore(tokenAddress); // Сохраняем токен в Firestore
        }
    });

    console.log(`Количество запросов к Telegram API: ${telegramRequestCount}`);

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
