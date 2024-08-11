require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");
const axios = require("axios");
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, setDoc } = require("firebase/firestore");

// Преобразуем API_ID в число
const apiId = parseInt(process.env.API_ID, 10);
const apiHash = process.env.API_HASH;
const sessionFilePath = process.env.SESSION_FILE_PATH;
const channelUsername = process.env.CHANNEL_USERNAME;
const botToken = process.env.BOT_TOKEN;
const destinationChannel = process.env.DESTINATION_CHANNEL;

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
        const result = await client.getMessages(channel, { limit: 15 });

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

const getTokenDataFromTonApi = async (tokenAddress) => {
    totalRequestCount++;
    try {
        const url = `https://tonapi.io/v1/nft/getItem?account=${tokenAddress}`;
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${process.env.TON_API_KEY}`, // Используем ваш ключ TON API
            },
        });

        const tokenData = response.data;

        if (tokenData) {
            const isMintable = tokenData.mintable ? "Да" : "Нет";
            return {
                mintable: isMintable,
                tokenData,
            };
        } else {
            console.log(
                `Не удалось получить данные для токена: ${tokenAddress}`
            );
            return null;
        }
    } catch (error) {
        console.error(
            `Ошибка при запросе данных токена через TON API: ${error}`
        );
        return null;
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
                const tokenData = await getTokenDataFromTonApi(tokenAddress);

                if (tokenData) {
                    await saveTokenToFirestore(db, tokenAddress);
                    const message = `Найдено сообщение с фразой 'Deployed from sTONks bot':\n<code>${tokenAddress}</code>\nMintable: ${tokenData.mintable}`;
                    console.log(message);
                    console.log("=========================");
                    await sendMessageToChannel(message);
                }
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
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
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
