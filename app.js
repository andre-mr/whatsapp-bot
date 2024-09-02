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
const COLORS = {
  RESET: "\x1b[0m",
  BRIGHT: "\x1b[1m",
  REVERSE: "\x1b[7m",

  RED: "\x1b[91m",
  GREEN: "\x1b[92m",
  YELLOW: "\x1b[93m",
  CYAN: "\x1b[96m",
};

// função auxiliar para colorir o texto do console
const consoleLogColor = (color, text, errorMessage) => {
  if (errorMessage) {
    console.error(`${color}${text}${COLORS.RESET}`, errorMessage);
  } else {
    console.log(`${color}${text}${COLORS.RESET}`);
  }
};

// função que inicializa o bot
const initializeBot = async () => {
  consoleLogColor(COLORS.BRIGHT, "Inicializando bot...");

  whatsappWebClient.on("qr", onQrCode);
  whatsappWebClient.on("ready", onReady);
  whatsappWebClient.on("message", onMessage);

  try {
    await whatsappWebClient.initialize();
    return true;
  } catch (error) {
    consoleLogColor(COLORS.RED, "❗ Erro ao inicializar bot!", error);
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

  const welcomeMessage =
    "👋 Bot inicializado e pronto para uso: " +
    `${CHATS.GROUPS.length} grupos e ${CHATS.PRIVATE.length} conversas privadas.`;
  consoleLogColor(COLORS.BRIGHT, welcomeMessage);
  notifyAuthorizedPhones(welcomeMessage);
};

// função que detecta uma mensagem recebida, verifica se é de celular autorizado, checa se é comando e executa as ações
const onMessage = async (receivedMessage) => {
  console.log(" ");
  console.log("----------------------------------------");
  console.log("📨 Mensagem recebida!");

  const senderNumber = receivedMessage.from.replace(WA_USERID_SUFFIX, "");
  if (UserParameters.CELULARES_AUTORIZADOS.includes(senderNumber)) {
    console.log("O número é de celular autorizado.");
    console.log(`Tipo: ${receivedMessage.type}`);
    console.log(`De: ${receivedMessage._data.notifyName} (${receivedMessage.from})`);

    if (receivedMessage.type == "chat") {
      console.log(`Conteúdo:`);
      console.log(`${receivedMessage.body}`);
      console.log(" ");
    }
    const commandAndParams = getCommandAndParameters(receivedMessage.body);
    if (commandAndParams) {
      consoleLogColor(COLORS.YELLOW, `Comando recebido: [${commandAndParams.command}]`);
      if (commandAndParams.parameters) {
        console.log(`Parâmetros: [${commandAndParams.command}]`);
      }
      switch (commandAndParams.command) {
        case COMMANDS.ENVIAR:
          const sendMethod = commandAndParams.parameters[0];
          await sendAllPendingMessages(sendMethod);
          break;

        case COMMANDS.PING:
          consoleLogColor(COLORS.BRIGHT, "🆗 Ping-pong! ;)");
          receivedMessage.reply("PONG");
          break;

        case COMMANDS.LIMPAR:
          const removingMessagesCount = PENDING_MESSAGES.length;
          PENDING_MESSAGES = [];
          consoleLogColor(
            COLORS.BRIGHT,
            `🆗 ${removingMessagesCount} mensagens removidas! ${PENDING_MESSAGES.length} mensagens pendentes.`
          );
          receivedMessage.reply("Mensagens pendentes removidas!");
          break;

        case COMMANDS.RECARREGAR_GRUPOS:
          await sleep(1);
          CHATS = await getChats(UserParameters.FILTROS_DE_PESQUISA_DE_GRUPOS);
          consoleLogColor(
            COLORS.BRIGHT,
            `🆗 Lista atualizada! ${CHATS.GROUPS.length} grupos e ${CHATS.PRIVATE.length} conversas privadas.`
          );
          receivedMessage.reply(
            `Lista atualizada! ${CHATS.GROUPS.length} grupos e ${CHATS.PRIVATE.length} conversas privadas.`
          );
          break;

        case COMMANDS.RECARREGAR_PARAMETROS:
          await reloadParameters();
          await sleep(1);
          const parametersContent = JSON.stringify(UserParameters);
          consoleLogColor(COLORS.BRIGHT, `🆗 Parâmetros recarregados:\n${parametersContent}`);
          receivedMessage.reply(`Parâmetros recarregados!`);
          break;

        default:
          consoleLogColor(COLORS.RED, `❗ Comando inválido detectado: [${commandAndParams.command}]`);
      }
    } else {
      PENDING_MESSAGES.push(receivedMessage);
      if (Number.parseInt(UserParameters.MAXIMO_MENSAGENS_ACUMULADAS || "0") > 0) {
        console.log(
          `📥 Mensagem enfileirada (${PENDING_MESSAGES.length}/${UserParameters.MAXIMO_MENSAGENS_ACUMULADAS})`
        );
      } else {
        console.log(`📥 Mensagem enfileirada. ${PENDING_MESSAGES.length} na espera`);
      }
    }
    console.log("----------------------------------------");
    console.log(" ");

    if (!commandAndParams && PENDING_MESSAGES.length >= UserParameters.MAXIMO_MENSAGENS_ACUMULADAS && !isSending) {
      isSending = true;
      await sendAllPendingMessages().finally(() => {
        isSending = false;
      });
    }
  }
};

// função que obtém as conversas existentes
const getChats = async (filters) => {
  try {
    const filteredChats = {
      GROUPS: [],
      PRIVATE: [],
    };
    const chatsList = await whatsappWebClient.getChats();
    // Ordenar os chats pelo nome antes de filtrar e imprimir
    chatsList.sort((a, b) => {
      const nameA = (a.name || "").toUpperCase();
      const nameB = (b.name || "").toUpperCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
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
    consoleLogColor(COLORS.RED, "❗ Erro ao obter lista de conversas!", error);
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
  consoleLogColor(COLORS.YELLOW, "🚚 Iniciando envio de mensagens pendentes...");
  console.log(" ");
  const MAX_RETRIES = 3;

  if (!method) {
    method = UserParameters.METODO_ENVIO_PADRAO;
  }

  while (PENDING_MESSAGES.length > 0) {
    const message = PENDING_MESSAGES.shift();

    let startGroupIndex = 0;
    message.retryCount = message.retryCount || 0;
    if (message.failedGroupIndex !== undefined) {
      startGroupIndex = message.failedGroupIndex;
      delete message.failedGroupIndex;
    }

    for (let i = startGroupIndex; i < CHATS.GROUPS.length; i++) {
      try {
        // TEXT, IMAGE, FORWARD
        switch (method) {
          case "IMAGE":
            await sendImageToWhatsApp(CHATS.GROUPS[i], message.body);
            console.log(
              `✔ Mensagem enviada para o grupo [${CHATS.GROUPS[i].name}]. ${
                CHATS.GROUPS.length - i - 1 > 0
                  ? CHATS.GROUPS.length - i - 1 == 1
                    ? `(${CHATS.GROUPS.length - i - 1} grupo restante)`
                    : `(${CHATS.GROUPS.length - i - 1} grupos restantes)`
                  : ""
              }`
            );
            break;
          case "FORWARD": // não utilizar por enquanto, há um bug na função forward do whatsapp-web.js em 04/2024
            await message.forward(CHATS.GROUPS[i]);
            console.log(
              `✔ Mensagem enviada para o grupo [${CHATS.GROUPS[i].name}]. ${
                CHATS.GROUPS.length - i - 1 > 0
                  ? CHATS.GROUPS.length - i - 1 == 1
                    ? `${CHATS.GROUPS.length - i - 1} grupo restante.`
                    : `${CHATS.GROUPS.length - i - 1} grupos restantes.`
                  : ""
              }`
            );
            break;
          default:
            await CHATS.GROUPS[i].sendMessage(message.body, { linkPreview: true });
            console.log(
              `✔ Mensagem enviada para o grupo [${CHATS.GROUPS[i].name}]. ${
                CHATS.GROUPS.length - i - 1 > 0
                  ? CHATS.GROUPS.length - i - 1 == 1
                    ? `${CHATS.GROUPS.length - i - 1} grupo restante.`
                    : `${CHATS.GROUPS.length - i - 1} grupos restantes.`
                  : ""
              }`
            );
            break;
        }

        if (UserParameters.PAUSA_ENTRE_GRUPOS > 0 && i < CHATS.GROUPS.length - 1) {
          let min, max, variation;
          if (UserParameters.PAUSA_ENTRE_GRUPOS <= 10) {
            variation = 1;
            min = UserParameters.PAUSA_ENTRE_GRUPOS - variation;
            max = UserParameters.PAUSA_ENTRE_GRUPOS + variation;
          } else {
            variation = Math.ceil(UserParameters.PAUSA_ENTRE_GRUPOS * 0.1);
            min = UserParameters.PAUSA_ENTRE_GRUPOS - variation;
            max = UserParameters.PAUSA_ENTRE_GRUPOS + variation;
          }
          const groupsDelay = Math.random() * (max - min) + min;
          console.log(`⏳ Pausa de ${groupsDelay.toFixed(2)} segundos após envio para grupo...`);
          await sleep(groupsDelay);
        }
      } catch (error) {
        consoleLogColor(COLORS.RED, "❗ Erro ao enviar mensagem!", error);
        message.failedGroupIndex = i;
        message.retryCount += 1;
        if (message.retryCount < MAX_RETRIES) {
          PENDING_MESSAGES.unshift(message);
        } else {
          consoleLogColor(
            COLORS.YELLOW,
            `❗ Limite de tentativas atingido para o grupo [${CHATS.GROUPS[i].name}]. Mensagem não enviada!`
          );
        }
        break;
      }
    }
    console.log(`✅ Mensagem enviada para todos os grupos.`);
    console.log(" ");

    if (PENDING_MESSAGES.length > 0) {
      if (PENDING_MESSAGES.length == 1) {
        console.log(`${PENDING_MESSAGES.length} mensagem pendente.`);
      } else {
        console.log(`${PENDING_MESSAGES.length} mensagens pendentes.`);
      }
    }

    if (PENDING_MESSAGES.length > 0 && UserParameters.PAUSA_ENTRE_MENSAGENS > 0) {
      let min, max, variation;
      if (UserParameters.PAUSA_ENTRE_MENSAGENS <= 10) {
        variation = 1;
        min = UserParameters.PAUSA_ENTRE_MENSAGENS - variation;
        max = UserParameters.PAUSA_ENTRE_MENSAGENS + variation;
      } else {
        variation = Math.ceil(UserParameters.PAUSA_ENTRE_MENSAGENS * 0.1);
        min = UserParameters.PAUSA_ENTRE_MENSAGENS - variation;
        max = UserParameters.PAUSA_ENTRE_MENSAGENS + variation;
      }
      const messagesDelay = Math.random() * (max - min) + min;
      console.log(`⏳ Pausa de ${messagesDelay.toFixed(2)} segundos entre mensagens...`);
      await sleep(messagesDelay);
    }

    if (PENDING_MESSAGES.length > 0) {
      console.log(" ");
    }

    if (PENDING_MESSAGES.length > 0 && PENDING_MESSAGES[0].failedGroupIndex !== undefined) {
      consoleLogColor(COLORS.BRIGHT`🔂 Tentando novamente a última mensagem para grupos que falharam...`);
    } else if (PENDING_MESSAGES.length === 0) {
      consoleLogColor(COLORS.GREEN, `✅ Todas as mensagens pendentes foram enviadas!`);
      const notifyText = `👋 Todas as mensagens foram disparadas. Se necessário, verifique as mensagens enviadas.`;
      notifyAuthorizedPhones(notifyText);
    }
  }
};

// função que notifica os números autorizados
const notifyAuthorizedPhones = async (message) => {
  for (const number of UserParameters.CELULARES_AUTORIZADOS) {
    try {
      await whatsappWebClient.sendMessage(`${number}${WA_USERID_SUFFIX}`, message);
      consoleLogColor(COLORS.CYAN, `📱 Notificação enviada para ${number}`);
    } catch (error) {
      consoleLogColor(COLORS.RED, `❗ Erro ao enviar mensagem para ${number}`, error);
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
      consoleLogColor(COLORS.RED, "❗ Erro ao obter URL da imagem!", error);
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
      consoleLogColor(COLORS.RED, "❗ Erro ao baixar a imagem!", error);
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
