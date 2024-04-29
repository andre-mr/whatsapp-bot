# Requisitos

- Instalar 'NodeJS' versão 18 ou superior
- Criar uma pasta no disco e salvar os arquivos `app.js`, `package.json` e `parametros.json`
- O arquivo `template-parametros.json` é um modelo que pode ser copiado ou renomeado para `parametros.json`
- Editar o arquivo `parametros.json` definindo os valores pessoais que forem necessários (explicação de cada um na seção Comandos abaixo)

# Instalação

- Com o NodeJS instalado e os arquivos na pasta, abrir o prompt de comando e executar, dentro da pasta, o comando `npm install`

# Inicialização

- No Prompt de Comando, dentro da pasta, executar o comando `npm start`
- Para encerrar, pressionar CTRL+C e confirmar com 'S'

## QR Code

- Na primeira inicialização será exibido um QR Code tanto na janela do Prompt de Comando quanto na página do Chromium onde é exibido o WhatsApp Web em que o bot funcionará.
- Faça a leitura com a câmera pelo celular em que o chip do bot está executando, na opção de autorizar dispositivo do WhatsApp.
- Ocasionalmente o WhatsApp pode solicitar essa leitura novamente para checar a atividade do número de celular.

# Configurações (`parametros.json`)

### MAXIMO_MENSAGENS_ACUMULADAS

Valor numérico, define o máximo de mensagens recebidas que vão ser acumuladas antes de disparar o envio automático. Se o valor for 0, as mensagens serão enviadas assim que recebidas.

### DELAY_ENTRE_ENVIOS

Para evitar banimentos, define um valor numérico em segundos para aguardar entre cada envio de mensagens. O sistema enviará em intervalos variáveis de -1 até +1 segundo do valor configurado. Exemplo: valor: 2 o tempo de intervalo variará automaticamente entre 1 e 3 segundos.

### DELAY_ENTRE_CADA_MENSAGEM

- `true`: o DELAY_ENTRE_ENVIOS será realizado com o tempo configurado
- `false`: as mensagens serão enviadas ignorando essa pausa

### METODO_ENVIO_PADRAO

- `TEXT`: as mensagens serão enviadas como texto, possivelmente gerando preview de link se houver.
- `IMAGE`: as mensagens serão enviadas como foto, sendo o texto da mensagem original como legenda da foto. **ATENÇÃO!** Esse método gera uma imagem maior mas pode sobrecarregar o armazenamento dos dispositivos dos usuários pois cada mensagem será uma foto nova no WhatsApp, e se o usuário tiver com o WhatsApp configurado para não salvar automaticamente para evitar consumo de dados ou armazenamento, será exibido apenas uma versão borrada da imagem e um ícone para baixar em cada mensagem.

### FILTROS_DE_PESQUISA_DE_GRUPOS

Texto contido no nome do grupo, a fim de identificar grupos na lista de conversas. Exemplo: 'Promos' identificará grupos como "As Melhores Promos" ou "TopPromos" por exemplo. Cada texto precisa estar entre aspas, se houver mais de um precisam estar separados por vírgulas e dentro de colchetes como o modelo 'template' mostra.

### WHITELIST

Números WhatsApp que podem enviar comandos ao bot. Entre aspas e dentro de colchetes. Se mais de um, separados por vírgulas.

# Comandos

Os seguintes comandos enviados por mensagem de WhatsApp ao número do bot são reconhecidos:

### #ENVIAR#

Envia todas as mensagens acumuladas, caso a configuração atual em MAXIMO_MENSAGENS_ACUMULADAS esteja maior que 0.

### #PING#

Retorna a mensagem 'PONG' para verificar se a aplicação está ativa e aceitando comandos.

### #LIMPAR#

Exclui da memória as mensagens acumuladas.

### #RECARREGAR_GRUPOS#

Faz nova varredura e atualiza a lista de grupos conhecidos na memória.

### #RECARREGAR_PARAMETROS#

Faz nova leitura do arquivo parametros.json atualizando os valores em execução sem que seja preciso reiniciar o bot. Utilize após fazer alterações nos valores do arquivo.
