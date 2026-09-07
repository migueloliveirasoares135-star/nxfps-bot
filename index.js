import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder
} from 'discord.js';


const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  STAFF_ROLE_ID,
  COMPRAS_CATEGORY_ID,
  SUPORTE_CATEGORY_ID,

  PIX_KEY,
  PIX_CHAVE,
  PIX_NAME = 'nxFPS'
} = process.env;


// aceita PIX_KEY ou PIX_CHAVE
const PIX = PIX_KEY || PIX_CHAVE;


// ==============================
// VARIÁVEIS OBRIGATÓRIAS
// ==============================

const required = {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  STAFF_ROLE_ID,
  COMPRAS_CATEGORY_ID,
  SUPORTE_CATEGORY_ID
};

for (const [name, value] of Object.entries(required)) {
  if (!value) {
    console.error(`Faltando variável obrigatória: ${name}`);
    process.exit(1);
  }
}


// ==============================
// CAMINHO DOS ASSETS
// ==============================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '..', 'assets');


// ==============================
// CLIENT
// ==============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});


// ==============================
// COMANDO /CENTRAL
// ==============================

const commands = [
  new SlashCommandBuilder()
    .setName('central')
    .setDescription('Envia a Central de Atendimento da nxFPS')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    )
].map(command => command.toJSON());


async function registerCommands() {

  const rest = new REST({
    version: '10'
  }).setToken(DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      CLIENT_ID,
      GUILD_ID
    ),
    {
      body: commands
    }
  );

}


// ==============================
// LIMPAR NOME DO TICKET
// ==============================

function slug(text) {

  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

}


// ==============================
// VERIFICAR STAFF
// ==============================

function isStaff(interaction) {

  return interaction.member
    ?.roles
    ?.cache
    ?.has(STAFF_ROLE_ID);

}


// ==============================
// PAINEL CENTRAL
// ==============================

function buildCentralMessage() {

  const banner = new AttachmentBuilder(
    path.join(
      ASSETS_DIR,
      'central-banner.png'
    ),
    {
      name: 'central-banner.png'
    }
  );


  const logo = new AttachmentBuilder(
    path.join(
      ASSETS_DIR,
      'logo.png'
    ),
    {
      name: 'logo.png'
    }
  );


  const embed = new EmbedBuilder()

    .setTitle(
      'nxFPS | Tickets'
    )

    .setDescription(
      'Olá, seja bem-vindo(a) à central de atendimento da **nxFPS**.\n\n' +
      'Após abrir um ticket, aguarde um integrante da nossa equipe responder.\n\n' +
      'Selecione abaixo o tipo de atendimento desejado.'
    )

    // barra branca
    .setColor(
      0xFFFFFF
    )

    // imagem quadradinha
    .setThumbnail(
      'attachment://logo.png'
    )

    // banner grande
    .setImage(
      'attachment://central-banner.png'
    );


  // ==============================
  // MENU QUE ABRE PARA BAIXO
  // ==============================

  const menu = new StringSelectMenuBuilder()

    .setCustomId(
      'central_select'
    )

    .setPlaceholder(
      'Selecione o tipo de atendimento'
    )

    .addOptions([

      {
        label: 'Vendas',

        description:
          'Garanta sua otimização nxFPS',

        emoji: '✦',

        value: 'compras'
      },

      {
        label: 'Reotimizar',

        description:
          'Refazer ou ajustar sua otimização',

        emoji: '⚙',

        value: 'reotimizar'
      },

      {
        label: 'Dúvidas',

        description:
          'Suporte geral e ajuda',

        emoji: '✉',

        value: 'suporte'
      }

    ]);


  const row =
    new ActionRowBuilder()
      .addComponents(
        menu
      );


  return {

    files: [
      banner,
      logo
    ],

    embeds: [
      embed
    ],

    components: [
      row
    ]

  };

}


// ==============================
// CRIAR TICKET
// ==============================

async function createTicket(
  interaction,
  type
) {

  const guild =
    interaction.guild;

  const user =
    interaction.user;


  let typeKey;
  let typeLabel;
  let category;


  // VENDAS
  if (type === 'compras') {

    typeKey =
      'compras';

    typeLabel =
      'Vendas';

    category =
      COMPRAS_CATEGORY_ID;

  }


  // REOTIMIZAÇÃO
  else if (type === 'reotimizar') {

    typeKey =
      'reotimizar';

    typeLabel =
      'Reotimização';

    category =
      SUPORTE_CATEGORY_ID;

  }


  // DÚVIDAS
  else {

    typeKey =
      'suporte';

    typeLabel =
      'Dúvidas / Suporte';

    category =
      SUPORTE_CATEGORY_ID;

  }


  // ==============================
  // VERIFICAR TICKET EXISTENTE
  // ==============================

  const existing =
    guild.channels.cache.find(
      channel =>
        channel.topic ===
        `nxfps:${typeKey}:${user.id}`
    );


  if (existing) {

    return interaction.reply({

      content:
        `Você já possui um atendimento aberto: ${existing}`,

      ephemeral: true

    });

  }


  // ==============================
  // CRIAR CANAL
  // ==============================

  const channel =
    await guild.channels.create({

      name:
        slug(
          `${typeKey}-${user.username}`
        ),

      type:
        ChannelType.GuildText,

      parent:
        category,

      topic:
        `nxfps:${typeKey}:${user.id}`,

      permissionOverwrites: [

        {

          id:
            guild.roles.everyone.id,

          deny: [
            PermissionFlagsBits.ViewChannel
          ]

        },

        {

          id:
            user.id,

          allow: [

            PermissionFlagsBits.ViewChannel,

            PermissionFlagsBits.SendMessages,

            PermissionFlagsBits.ReadMessageHistory

          ]

        },

        {

          id:
            STAFF_ROLE_ID,

          allow: [

            PermissionFlagsBits.ViewChannel,

            PermissionFlagsBits.SendMessages,

            PermissionFlagsBits.ReadMessageHistory

          ]

        }

      ]

    });


  // ==============================
  // EMBED DO TICKET
  // ==============================

  const embed =
    new EmbedBuilder()

      .setTitle(
        `nxFPS • ${typeLabel}`
      )

      .setDescription(

        `Olá ${user}, seja bem-vindo ao seu atendimento.\n\n` +

        `◈ **Cliente**\n` +
        `${user} (${user.username})\n\n` +

        `◇ **Tipo**\n` +
        `${typeLabel}\n\n` +

        `♟ **Atendente**\n` +
        `Não assumido`

      )

      // barra branca
      .setColor(
        0xFFFFFF
      );


  // sem footer
  // sem timestamp


  // ==============================
  // BOTÕES STAFF
  // ==============================

  const rows = [];


  // PRIMEIRA LINHA
  rows.push(

    new ActionRowBuilder()

      .addComponents(

        new ButtonBuilder()

          .setCustomId(
            'ticket_assumir'
          )

          .setLabel(
            'Assumir Ticket'
          )

          .setEmoji(
            '♟'
          )

          .setStyle(
            ButtonStyle.Primary
          ),


        new ButtonBuilder()

          .setCustomId(
            'ticket_liberar'
          )

          .setLabel(
            'Liberar Atendimento'
          )

          .setEmoji(
            '◇'
          )

          .setStyle(
            ButtonStyle.Secondary
          )

      )

  );


  // ==============================
  // BOTÕES VENDAS
  // ==============================

  if (
    type === 'compras'
  ) {

    rows.push(

      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()

            .setCustomId(
              'ticket_pix'
            )

            .setLabel(
              'Enviar PIX'
            )

            .setEmoji(
              '✦'
            )

            .setStyle(
              ButtonStyle.Success
            ),


          new ButtonBuilder()

            .setCustomId(
              'ticket_aprovar'
            )

            .setLabel(
              'Aprovar Compra'
            )

            .setEmoji(
              '✓'
            )

            .setStyle(
              ButtonStyle.Success
            ),


          new ButtonBuilder()

            .setCustomId(
              'ticket_fechar'
            )

            .setLabel(
              'Fechar Ticket'
            )

            .setEmoji(
              '✕'
            )

            .setStyle(
              ButtonStyle.Danger
            )

        )

    );

  }


  // ==============================
  // BOTÃO FECHAR - SUPORTE
  // ==============================

  else {

    rows.push(

      new ActionRowBuilder()

        .addComponents(

          new ButtonBuilder()

            .setCustomId(
              'ticket_fechar'
            )

            .setLabel(
              'Fechar Ticket'
            )

            .setEmoji(
              '✕'
            )

            .setStyle(
              ButtonStyle.Danger
            )

        )

    );

  }


  // ==============================
  // ENVIAR TICKET
  // ==============================

  await channel.send({

    content:
      `${user} <@&${STAFF_ROLE_ID}>`,

    embeds: [
      embed
    ],

    components:
      rows

  });


  return interaction.reply({

    content:
      `Seu atendimento foi aberto em ${channel}.`,

    ephemeral:
      true

  });

}


// ==============================
// BOT ONLINE
// ==============================

client.once(
  'ready',
  () => {

    console.log(
      `nxFPS online como ${client.user.tag}`
    );

  }
);


// ==============================
// INTERAÇÕES
// ==============================

client.on(
  'interactionCreate',

  async interaction => {

    try {


      // ============================
      // COMANDO /CENTRAL
      // ============================

      if (
        interaction.isChatInputCommand()
      ) {

        if (
          interaction.commandName ===
          'central'
        ) {

          return interaction.reply(
            buildCentralMessage()
          );

        }

        return;

      }


      // ============================
      // MENU DROPDOWN
      // ============================

      if (
        interaction.isStringSelectMenu()
      ) {

        if (
          interaction.customId ===
          'central_select'
        ) {

          const value =
            interaction.values[0];


          if (
            value === 'compras'
          ) {

            return createTicket(
              interaction,
              'compras'
            );

          }


          if (
            value === 'reotimizar'
          ) {

            return createTicket(
              interaction,
              'reotimizar'
            );

          }


          if (
            value === 'suporte'
          ) {

            return createTicket(
              interaction,
              'suporte'
            );

          }

        }

        return;

      }


      // ============================
      // BOTÕES
      // ============================

      if (
        !interaction.isButton()
      ) {
        return;
      }


      if (
        !interaction.channel
          ?.topic
          ?.startsWith(
            'nxfps:'
          )
      ) {
        return;
      }


      // ============================
      // ASSUMIR
      // ============================

      if (
        interaction.customId ===
        'ticket_assumir'
      ) {

        if (
          !isStaff(interaction)
        ) {

          return interaction.reply({

            content:
              'Somente a staff pode assumir tickets.',

            ephemeral:
              true

          });

        }


        return interaction.reply({

          content:
            `♟ Atendimento assumido por ${interaction.user}.`

        });

      }


      // ============================
      // LIBERAR
      // ============================

      if (
        interaction.customId ===
        'ticket_liberar'
      ) {

        if (
          !isStaff(interaction)
        ) {

          return interaction.reply({

            content:
              'Somente a staff pode liberar o atendimento.',

            ephemeral:
              true

          });

        }


        return interaction.reply({

          content:
            `◇ Atendimento liberado por ${interaction.user}.`

        });

      }


      // ============================
      // PIX
      // ============================

      if (
        interaction.customId ===
        'ticket_pix'
      ) {

        if (
          !isStaff(interaction)
        ) {

          return interaction.reply({

            content:
              'Somente a staff pode enviar o PIX.',

            ephemeral:
              true

          });

        }


        if (
          !PIX
        ) {

          return interaction.reply({

            content:
              'A chave PIX ainda não foi configurada no Railway.',

            ephemeral:
              true

          });

        }


        const pixEmbed =
          new EmbedBuilder()

            .setTitle(
              'nxFPS • Pagamento PIX'
            )

            .setDescription(

              `✦ **Chave PIX**\n` +
              `\`${PIX}\`\n\n` +

              `◇ **Recebedor**\n` +
              `${PIX_NAME}\n\n` +

              `Após realizar o pagamento, envie o comprovante neste ticket.`

            )

            .setColor(
              0xFFFFFF
            );


        return interaction.reply({

          embeds: [
            pixEmbed
          ]

        });

      }


      // ============================
      // APROVAR COMPRA
      // ============================

      if (
        interaction.customId ===
        'ticket_aprovar'
      ) {

        if (
          !isStaff(interaction)
        ) {

          return interaction.reply({

            content:
              'Somente a staff pode aprovar compras.',

            ephemeral:
              true

          });

        }


        return interaction.reply({

          content:
            `✓ Compra aprovada por ${interaction.user}.`

        });

      }


      // ============================
      // FECHAR TICKET
      // ============================

      if (
        interaction.customId ===
        'ticket_fechar'
      ) {

        if (
          !isStaff(interaction)
        ) {

          return interaction.reply({

            content:
              'Somente a staff pode fechar tickets.',

            ephemeral:
              true

          });

        }


        await interaction.reply(
          '✕ Ticket será fechado em 5 segundos.'
        );


        setTimeout(
          () => {

            interaction.channel
              .delete()
              .catch(() => {});

          },

          5000
        );

      }


    } catch (error) {

      console.error(
        error
      );


      if (
        interaction.isRepliable()
      ) {

        const payload = {

          content:
            'Ocorreu um erro. Verifique a configuração do bot.',

          ephemeral:
            true

        };


        if (
          interaction.replied ||
          interaction.deferred
        ) {

          await interaction
            .followUp(
              payload
            )
            .catch(() => {});

        }

        else {

          await interaction
            .reply(
              payload
            )
            .catch(() => {});

        }

      }

    }

  }
);


// ==============================
// INICIAR
// ==============================

await registerCommands();

await client.login(
  DISCORD_TOKEN
);