require("console-stamp")(console, "dd/mm/yyyy HH:MM:ss");
const qrcode = require("qrcode-terminal");
const UserParameters = require("./parametros.json");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

const whatsappWebClient = new Client({
  authStrategy: new LocalAuth({}),
  puppeteer: {
    headless: false,
  },
});
UserParameters.COMANDOS = {
  ENVIAR: "#ENVIAR#",
  PING: "#PING#",
  LIMPAR_MENSAGENS_ACUMULADAS: "#LIMPAR#",
  RECARREGAR_GRUPOS: "#RECARREGAR_GRUPOS#",
};
let CHATS = {
  GROUPS: [],
  PRIVATE: [],
};
let PENDING_MESSAGES = [];
const WA_USERID_SUFFIX = "@c.us";

// função que inicializa o bot
const initializeBot = async () => {
  console.log("Inicializando bot...");

  whatsappWebClient.on("qr", onQrCode);
  whatsappWebClient.on("ready", onReady);
  whatsappWebClient.on("message", onMessage);

  try {
    await whatsappWebClient.initialize();
    return true;
  } catch (error) {
    console.log(error.message);
    console.error(error);
    throw error;
  }
};

// função que exibe o qrcode do whatsapp no terminal
const onQrCode = (qr) => {
  qrcode.generate(qr, { small: true });
};

// função inicial que prepara o bot para ser utilizado
const onReady = async () => {
  console.log(`Login efetuado | [${whatsappWebClient.info.pushname}]`);
  console.log(`Obtendo lista de conversas...`);
  await sleep(5);
  CHATS = await getChats(UserParameters.CONFIGURACOES.FILTROS_DE_PESQUISA_DE_GRUPOS);

  console.log(`${CHATS.GROUPS.length} grupos`);
  console.log(`${CHATS.PRIVATE.length} conversas privadas`);
  const _welcomeText = `👋 Bot inicializado e pronto para uso \r\n(${CHATS.GROUPS.length} grupos e ${CHATS.PRIVATE.length} conversas).`;
  console.log(_welcomeText);
  notifyWhitelist(_welcomeText);
};

// função que detecta uma mensagem recebida, verifica se é da whitelist, checa se é comando e executa as ações
const onMessage = async (receivedMessage) => {
  console.log("# Mensagem recebida");
  console.log("----------------------");
  const senderNumber = receivedMessage.from.replace(WA_USERID_SUFFIX, "");
  if (UserParameters.WHITELIST.includes(senderNumber)) {
    console.log("Mensagem recebida de um número que está na whitelist");
    console.log(`Mensagem recebida | Tipo: ${receivedMessage.type}`);
    console.log(`De: ${receivedMessage._data.notifyName} (${receivedMessage.from})`);

    if (receivedMessage.type == "chat") {
      console.log(`${receivedMessage.body}`);
    }
    const commandAndParams = getCommandAndParameters(receivedMessage.body);
    if (commandAndParams) {
      switch (commandAndParams.command) {
        case UserParameters.COMANDOS.ENVIAR:
          const sendMethod = commandAndParams.parameters[0];
          await sendAllPendingMessages(sendMethod);
          break;

        case UserParameters.COMANDOS.PING:
          receivedMessage.reply("PONG");
          break;

        case UserParameters.COMANDOS.LIMPAR_MENSAGENS_ACUMULADAS:
          console.log(`Mensagens pendentes: ${PENDING_MESSAGES.length}`);
          PENDING_MESSAGES = [];
          console.log(`Mensagens removidas!`);
          console.log(`Mensagens pendentes: ${PENDING_MESSAGES.length}`);
          break;

        case UserParameters.COMANDOS.RECARREGAR_GRUPOS:
          console.log(`Obtendo lista de conversas...`);
          await sleep(1);
          CHATS = await getChats(UserParameters.CONFIGURACOES.FILTROS_DE_PESQUISA_DE_GRUPOS);
          console.log(`${CHATS.GROUPS.length} grupos`);
          console.log(`${CHATS.PRIVATE.length} conversas privadas`);
          console.log(`Pronto para uso`);
          receivedMessage.reply(`${CHATS.GROUPS.length} grupos\n${CHATS.PRIVATE.length} conversas privadas`);
          break;

        default:
          console.log(`Comando inválido detectado: ${commandAndParams.command}
a mensagem será adicionada à lista de envios pendentes...`);
          PENDING_MESSAGES.push(receivedMessage);
          console.log(
            `Mesagem adicionada à lista de espera (${PENDING_MESSAGES.length}/${UserParameters.CONFIGURACOES.MAXIMO_MENSAGENS_ACUMULADAS})`
          );

          if (PENDING_MESSAGES.length >= UserParameters.CONFIGURACOES.MAXIMO_MENSAGENS_ACUMULADAS) {
            await sendAllPendingMessages();
          }
          break;
      }
    } else {
      PENDING_MESSAGES.push(receivedMessage);
      console.log(
        `Mesagem adicionada à lista de espera (${PENDING_MESSAGES.length}/${UserParameters.CONFIGURACOES.MAXIMO_MENSAGENS_ACUMULADAS})`
      );

      if (PENDING_MESSAGES.length >= UserParameters.CONFIGURACOES.MAXIMO_MENSAGENS_ACUMULADAS) {
        await sendAllPendingMessages();
      }
    }
  }
  console.log(" ");
};

// função que obtém as conversas existentes
const getChats = async (filters) => {
  try {
    const filteredChats = {
      GROUPS: [],
      PRIVATE: [],
    };
    const chatsList = await whatsappWebClient.getChats();
    chatsList.forEach((chat) => {
      const chatName = chat.name || "";
      const isRelevant = filters && filters.some((filter) => chatName.toUpperCase().includes(filter.toUpperCase()));
      if (!filters || isRelevant) {
        if (chat.isGroup) {
          console.log(`GRUPO ADICIONADO [${chatName}]`);
          filteredChats.GROUPS.push(chat);
        } else {
          console.log(`CHAT ADICIONADO [${chatName}]`);
          filteredChats.PRIVATE.push(chat);
        }
      }
    });
    return filteredChats;
  } catch (error) {
    console.error("Erro ao obter chats:", error);
    throw error;
  }
};

// função que extrai o comando e os parâmetros da mensagem
const getCommandAndParameters = (message) => {
  const commandMatch = message.match(/#(.*?)(\/|#)/);
  let command = "";
  let parameters = [];

  if (commandMatch) {
    command = `#${commandMatch[1]}#`;

    const afterCommand = message.substring(commandMatch[0].length - 1);
    const parametersMatch = afterCommand.match(/^\/(.*?)(#|$)/);
    if (parametersMatch && parametersMatch[1]) {
      parameters = parametersMatch[1].split("/").map((param) => param.trim());
    }

    console.log("command", command);
    console.log("parameters", parameters);
    return {
      command,
      parameters,
    };
  } else {
    return null;
  }
};

// função que envia todas as mensagens pendentes
const sendAllPendingMessages = async (method) => {
  const localPendingMessages = [...PENDING_MESSAGES];
  PENDING_MESSAGES = [];
  let delayDefault = UserParameters.CONFIGURACOES.DELAY_ENTRE_ENVIOS;
  let delay = 0;
  if (delayDefault && delayDefault > 0) {
    const min = delayDefault - 1;
    const max = delayDefault + 1;
    delay = Math.random() * (max - min) + min;
  }

  for (const chat of CHATS.GROUPS) {
    for (const message of localPendingMessages) {
      try {
        if (!method) {
          method = UserParameters.CONFIGURACOES.METODO_ENVIO_PADRAO;
        }

        // TEXT, IMAGE, FORWARD
        switch (method) {
          case "IMAGE":
            await sendImageToWhatsApp(chat, message.body);
            console.log(`Mensagem com imagem enviada para o grupo [${chat.name}]`);
            break;
          case "FORWARD":
            await message.forward(chat); // there's a bug on whatsapp-web.js forward function at 04/2024
            console.log(`Mensagem encaminhada para o grupo [${chat.name}]`);
            break;
          default:
            await chat.sendMessage(message.body, { linkPreview: true });
            console.log(`Mensagem enviada para o grupo [${chat.name}]`);
            break;
        }

        if (UserParameters.CONFIGURACOES.DELAY_ENTRE_CADA_MENSAGEM) {
          await sleep(delay);
        }
      } catch (error) {
        console.error(`Erro ao enviar mensagem: ${error.message}`);
      }
    }
    if (!UserParameters.CONFIGURACOES.DELAY_ENTRE_CADA_MENSAGEM) {
      await sleep(delay);
    }
  }

  const notifyText = `👋 Rotina finalizada, todas as mensagens foram disparadas mas isso não quer dizer que o envio foi finalizado.
Verifique as mensagens enviadas.`;
  notifyWhitelist(notifyText);
};

// função que notifica os números da whitelist
const notifyWhitelist = async (message) => {
  for (const number of UserParameters.WHITELIST) {
    try {
      await whatsappWebClient.sendMessage(`${number}${WA_USERID_SUFFIX}`, message);
      console.log(`Mensagem enviada para ${number}`);
    } catch (error) {
      console.error(`Erro ao enviar mensagem para ${number}: ${error.message}`);
    }
  }
};

// função para aguardar um tempo antes de continuar a execução do código
const sleep = async (s) => {
  await new Promise((resolve) => setTimeout(resolve, s * 1000));
};

// Função para enviar a imagem
const sendImageToWhatsApp = async (chat, message) => {
  // Função interna para extrair a primeira URL da mensagem
  const extractUrlFromMessage = (message) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.match(urlRegex);
    return urls ? urls[0] : null;
  };

  // Função interna para extrair URL da imagem de preview
  const fetchImageUrl = async (url) => {
    try {
      const response = await fetch(url);
      const html = await response.text();
      const regex = /<meta property="og:image" content="(.*?)"/i;
      const match = regex.exec(html);
      if (match && match[1]) {
        return match[1];
      }
      return null;
    } catch (error) {
      console.error("Erro ao obter URL da imagem:", error);
      return null;
    }
  };

  // Função interna para baixar a imagem e retornar como buffer
  const downloadImage = async (imageUrl) => {
    try {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      console.error("Erro ao baixar a imagem:", error);
      return null;
    }
  };

  // Extrair a URL do link na mensagem recebida
  const messageUrl = extractUrlFromMessage(message);
  if (messageUrl) {
    const imageUrl = await fetchImageUrl(messageUrl);
    if (imageUrl) {
      const imageBuffer = await downloadImage(imageUrl);
      if (imageBuffer) {
        const media = new MessageMedia("image/webp", imageBuffer.toString("base64"));
        chat.sendMessage(media, {
          caption: message,
        });
      } else {
        whatsappWebClient.sendMessage(chat, "Não foi possível baixar a imagem.");
      }
    } else {
      whatsappWebClient.sendMessage(chat, "Não foi possível obter a imagem.");
    }
  } else {
    whatsappWebClient.sendMessage(chat, "Nenhum link válido encontrado na mensagem.");
  }
};

initializeBot();
