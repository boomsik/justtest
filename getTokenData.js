const axios = require("axios");

const apiKey =
    "AHTYLS2LZP6DJGIAAAABOJO43BSRTVCP3KJ6HLDMH45I3C42R2G7HCMBR6HLSD2XUMPZHVA";
const baseUrl = "https://tonapi.io/v2"; // Базовый URL API

const getTokenData = async (tokenAddress) => {
    const url = `${baseUrl}/jettons/${tokenAddress}`;

    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error fetching token data:", error);
        return null;
    }
};

(async () => {
    const tokenAddress = "EQCzib4cPUKq2gUlemJTOdg1CcbCw_nIFA1-jE9yw7DgRj_2"; // замените на адрес вашего жетона
    const tokenData = await getTokenData(tokenAddress);

    if (tokenData) {
        console.log("Данные о жетоне:", tokenData);
    } else {
        console.log("Не удалось получить данные о жетоне");
    }
})();
