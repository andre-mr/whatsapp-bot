require("console-stamp")(console, "dd/mm/yyyy HH:MM:ss");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
let UserParameters = require("./parametros.json");

const COMMANDS = {
  ENVIAR: "#ENVIAR#",
  PING: "#PING#",
  LIMPAR: "#LIMPAR#",
  RECARREGAR_GRUPOS: "#RECARREGAR_GRUPOS#",
  RECARREGAR_PARAMETROS: "#RECARREGAR_PARAMETROS#",
};
const whatsappWebClient = new Client({
  authStrategy: new LocalAuth({}),
  puppeteer: {
    headless: false,
  },
});
let CHATS = {
  GROUPS: [],
  PRIVATE: [],
};
let PENDING_MESSAGES = [];
let isSending = false;
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
    console.error("❗ Erro ao inicializar bot!", error);
  }
};

// função que exibe o qrcode do whatsapp no terminal
const onQrCode = (qr) => {
  qrcode.generate(qr, { small: true });
};

// função inicial que prepara o bot para ser utilizado
const onReady = async () => {
  console.log(`Login efetuado: [${whatsappWebClient.info.pushname}]`);
  console.log(`Obtendo lista de conversas...`);
  await sleep(5);
  CHATS = await getChats(UserParameters.FILTROS_DE_PESQUISA_DE_GRUPOS);

  console.log(`${CHATS.GROUPS.length} grupos`);
  console.log(`${CHATS.PRIVATE.length} conversas privadas`);
  const welcomeMessage1 = `👋 Bot inicializado e pronto para uso`;
  const welcomeMessage2 = `(${CHATS.GROUPS.length} grupos e ${CHATS.PRIVATE.length} conversas).`;
  console.log(welcomeMessage1);
  console.log(welcomeMessage2);
  notifyWhitelist(welcomeMessage1 + "\r\n" + welcomeMessage2);
};

// função que detecta uma mensagem recebida, verifica se é da whitelist, checa se é comando e executa as ações
const onMessage = async (receivedMessage) => {
  console.log(" ");
  console.log("----------------------------------------");
  console.log("📨 Mensagem recebida!");

  const senderNumber = receivedMessage.from.replace(WA_USERID_SUFFIX, "");
  if (UserParameters.WHITELIST.includes(senderNumber)) {
    console.log("O número está na whitelist");
    console.log(`Tipo: ${receivedMessage.type}`);
    console.log(`De: ${receivedMessage._data.notifyName} (${receivedMessage.from})`);

    if (receivedMessage.type == "chat") {
      console.log(`Conteúdo:`);
      console.log(`${receivedMessage.body}`);
      console.log(" ");
    }
    const commandAndParams = getCommandAndParameters(receivedMessage.body);
    if (commandAndParams) {
      console.log(`Comando recebido: [${commandAndParams.command}]`);
      if (commandAndParams.parameters) {
        console.log(`Parâmetros: [${commandAndParams.command}]`);
      }
      switch (commandAndParams.command) {
        case COMMANDS.ENVIAR:
          const sendMethod = commandAndParams.parameters[0];
          await sendAllPendingMessages(sendMethod);
          break;

        case COMMANDS.PING:
          receivedMessage.reply("PONG");
          break;

        case COMMANDS.LIMPAR:
          const removingMessagesCount = PENDING_MESSAGES.length;
          PENDING_MESSAGES = [];
          console.log(`🗑 ${removingMessagesCount} mensagens removidas!`);
          console.log(`Mensagens pendentes: ${PENDING_MESSAGES.length}`);
          break;

        case COMMANDS.RECARREGAR_GRUPOS:
          console.log(`Obtendo lista de conversas...`);
          await sleep(1);
          CHATS = await getChats(UserParameters.FILTROS_DE_PESQUISA_DE_GRUPOS);
          console.log(`Lista atualizada!`);
          console.log(`${CHATS.GROUPS.length} grupos`);
          console.log(`${CHATS.PRIVATE.length} conversas privadas`);
          receivedMessage.reply(`${CHATS.GROUPS.length} grupos\r\n${CHATS.PRIVATE.length} conversas privadas`);
          break;

        case COMMANDS.RECARREGAR_PARAMETROS:
          console.log(`Recarregando arquivo de parametros...`);
          await reloadParameters();
          await sleep(1);
          const parametersContent = JSON.stringify(UserParameters);
          console.log(`Parâmetros recarregados:\n${parametersContent}`);
          receivedMessage.reply(`Parâmetros recarregados!`);
          break;

        default:
          console.log(`Comando inválido detectado: [${commandAndParams.command}]`);
      }
    } else {
      PENDING_MESSAGES.push(receivedMessage);
      if (Number.parseInt(UserParameters.MAXIMO_MENSAGENS_ACUMULADAS || "0") > 0) {
        console.log(`Mesagem enfileirada (${PENDING_MESSAGES.length}/${UserParameters.MAXIMO_MENSAGENS_ACUMULADAS})`);
      } else {
        console.log(`Mesagem enfileirada. ${PENDING_MESSAGES.length} na espera`);
      }

      if (PENDING_MESSAGES.length >= UserParameters.MAXIMO_MENSAGENS_ACUMULADAS && !isSending) {
        isSending = true;
        sendAllPendingMessages().finally(() => {
          isSending = false;
        });
      }
    }
  }
  console.log("----------------------------------------");
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
          console.log(`Grupo adicionado: [${chatName}]`);
          filteredChats.GROUPS.push(chat);
        } else {
          console.log(`Conversa privada adicionada: [${chatName}]`);
          filteredChats.PRIVATE.push(chat);
        }
      }
    });
    return filteredChats;
  } catch (error) {
    console.error("❗ Erro ao obter lista de conversas!", error);
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
  let delayDefault = UserParameters.DELAY_ENTRE_ENVIOS;
  let delay = 0;
  if (delayDefault && delayDefault > 0) {
    const min = delayDefault - 1;
    const max = delayDefault + 1;
    delay = Math.random() * (max - min) + min;
  }

  while (PENDING_MESSAGES.length > 0) {
    const message = PENDING_MESSAGES.shift();
    for (let i = 0; i < CHATS.GROUPS.length; i++) {
      try {
        if (!method) {
          method = UserParameters.METODO_ENVIO_PADRAO;
        }

        // TEXT, IMAGE, FORWARD
        switch (method) {
          case "IMAGE":
            await sendImageToWhatsApp(CHATS.GROUPS[i], message.body);
            console.log(
              `Imagem enviada para o grupo [${CHATS.GROUPS[i].name}]. ${
                CHATS.GROUPS.length - i - 1
              } grupo(s) restante(s).`
            );
            break;
          case "FORWARD":
            await message.forward(CHATS.GROUPS[i]); // there's a bug on whatsapp-web.js forward function at 04/2024
            console.log(
              `Mensagem encaminhada para o grupo [${CHATS.GROUPS[i].name}]. ${
                CHATS.GROUPS.length - i - 1
              } grupo(s) restante(s).`
            );
            break;
          default:
            await CHATS.GROUPS[i].sendMessage(message.body, { linkPreview: true });
            console.log(
              `Mensagem enviada para o grupo [${CHATS.GROUPS[i].name}]. ${
                CHATS.GROUPS.length - i - 1
              } grupos restantes.`
            );
            break;
        }

        if (UserParameters.DELAY_ENTRE_CADA_MENSAGEM && i < CHATS.GROUPS.length) {
          await sleep(delay);
        }
      } catch (error) {
        console.error("❗ Erro ao enviar mensagem!", error);
        PENDING_MESSAGES.unshift(message);
        break;
      }
    }
    if (PENDING_MESSAGES.length > 0) {
      console.log(`${PENDING_MESSAGES.length} mensagens restantes.`);
    } else {
      console.log(`✅ Todas mensagens foram enviadas!`);
    }
  }

  const notifyText =
    `👋 Todas as mensagens foram disparadas.` + `\r\n` + `Se necessário, verifique as mensagens enviadas.`;
  notifyWhitelist(notifyText);
};

// função que notifica os números da whitelist
const notifyWhitelist = async (message) => {
  for (const number of UserParameters.WHITELIST) {
    try {
      await whatsappWebClient.sendMessage(`${number}${WA_USERID_SUFFIX}`, message);
      console.log(`Mensagem enviada para ${number}`);
    } catch (error) {
      console.error(`❗ Erro ao enviar mensagem para ${number}`, error);
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
      console.error("❗ Erro ao obter URL da imagem!", error);
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
      console.error("❗ Erro ao baixar a imagem!", error);
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
        await chat.sendMessage(media, {
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

// função para recarregar o arquivo de parâmetros
const reloadParameters = async () => {
  const pathParameters = require.resolve("./parametros.json");
  delete require.cache[pathParameters];
  UserParameters = require("./parametros.json");
};

initializeBot();
