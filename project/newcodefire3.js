const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");
const axios = require("axios");
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, setDoc } = require("firebase/firestore");

const apiId = 23684756;
const apiHash = "3d8ce96bf3a257f324cf3ea44f6a9a9d";
const sessionFilePath = "session.txt";
const channelUsername = "@ton_new_deploy";
const botToken = "7286405880:AAFNtG_dXaifjzQ4ISeaGPnehNEjbiJlkWg";
const destinationChannel = "@mychansnipe";

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
        const result = await client.getMessages(channel, { limit: 20 });

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

const checkTokenExists = async (db, tokenAddress) => {
    totalRequestCount++;
    const docRef = doc(db, "tokens", tokenAddress);
    const docSnap = await getDoc(docRef);

    return docSnap.exists();
};

const saveTokenToFirestore = async (db, tokenAddress) => {
    totalRequestCount++;
    try {
        const docRef = doc(db, "tokens", tokenAddress);
        await setDoc(docRef, { createdAt: new Date() });
        console.log(`Токен ${tokenAddress} успешно записан в Firestore.`);
    } catch (error) {
        console.error("Ошибка записи токена в Firestore:", error);
    }
};

const sendMessageToChannel = async (message) => {
    totalRequestCount++;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: destinationChannel,
            text: message,
            parse_mode: "HTML",
        });
    } catch (error) {
        console.error("Ошибка отправки сообщения:", error);
    }
};

const processChannelPosts = async (client, db) => {
    const posts = await getChannelPosts(client, channelUsername);

    for (const post of posts) {
        if (post.text.includes("Deployed from sTONks bot")) {
            const tokenAddressMatch = post.text.match(/EQ[A-Za-z0-9_-]+/);
            const tokenAddress = tokenAddressMatch
                ? tokenAddressMatch[0]
                : "Адрес не найден";

            const exists = await checkTokenExists(db, tokenAddress);
            if (!exists) {
                await saveTokenToFirestore(db, tokenAddress);
                const message = `Найдено сообщение с фразой 'Deployed from sTONks bot':\n<code>${tokenAddress}</code>`;
                console.log(message);
                console.log("=========================");
                await sendMessageToChannel(message);
            } else {
                console.log(
                    `Токен ${tokenAddress} уже существует в Firestore.`
                );
            }
        }
    }
    console.log(`Количество запросов к Telegram API: ${telegramRequestCount}`);
    console.log(`Общее количество запросов: ${totalRequestCount}`);
};

const main = async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        timeout: 30000,
    });

    // Initialize Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyDsafnpErtlmQ5prrPRtzBFM0SJZbzJgb8",
        authDomain: "ton-search.firebaseapp.com",
        projectId: "ton-search",
        storageBucket: "ton-search.appspot.com",
        messagingSenderId: "719724885996",
        appId: "1:719724885996:web:cd3ac69f61756a1cfa32c9",
    };
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    await connectToTelegram(client);

    // Запускаем функцию каждые 30 секунд
    setInterval(() => {
        processChannelPosts(client, db);
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
