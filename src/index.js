
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

const PIX = PIX_KEY || PIX_CHAVE;

const required = {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  STAFF_ROLE_ID,
  COMPRAS_CATEGORY_ID,
  SUPORTE_CATEGORY_ID
};

for (const [k, v] of Object.entries(required)) {
  if (!v) {
    console.error(`Faltando variável obrigatória: ${k}`);
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName('central')
    .setDescription('Envia a Central de Atendimento da nxFPS')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
}

function slug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function isStaff(interaction) {
  return interaction.member?.roles?.cache?.has(STAFF_ROLE_ID);
}

function buildCentralMessage() {
  const banner = new AttachmentBuilder(path.join(ASSETS_DIR, 'central-banner.png'), { name: 'central-banner.png' });
  const logo = new AttachmentBuilder(path.join(ASSETS_DIR, 'logo.png'), { name: 'logo.png' });

  const embed = new EmbedBuilder()
    .setTitle('Central de Atendimento')
    .setDescription(
      'Seja bem-vindo à **nxFPS**.\n' +
      'Estamos prontos para ajudar você. Selecione abaixo o departamento desejado e abra seu atendimento de forma rápida e segura.'
    )
    .setColor(0xFFFFFF)
    .setThumbnail('attachment://logo.png')
    .setImage('attachment://central-banner.png')
    .setFooter({ text: 'nxFPS • Tecnologia & Performance' })
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId('central_select')
    .setPlaceholder('Selecione o departamento...')
    .addOptions([
      {
        label: 'Compras',
        description: 'Adquira uma de nossas otimizações ou tire dúvidas sobre nossos produtos.',
        emoji: '🛒',
        value: 'compras'
      },
      {
        label: 'Suporte & Ajuda',
        description: 'Precisa de ajuda? Nossa equipe está pronta para auxiliar você.',
        emoji: '🛠️',
        value: 'suporte'
      }
    ]);

  const row = new ActionRowBuilder().addComponents(menu);

  return { files: [banner, logo], embeds: [embed], components: [row] };
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;
  const user = interaction.user;

  const typeKey = type === 'compras' ? 'compras' : 'suporte';
  const typeLabel = type === 'compras' ? 'Compras' : 'Suporte & Ajuda';
  const category = type === 'compras' ? COMPRAS_CATEGORY_ID : SUPORTE_CATEGORY_ID;

  const existing = guild.channels.cache.find(c => c.topic === `nxfps:${typeKey}:${user.id}`);
  if (existing) {
    return interaction.reply({
      content: `Você já possui um ticket aberto: ${existing}`,
      ephemeral: true
    });
  }

  const channel = await guild.channels.create({
    name: slug(`ticket-${user.username}`),
    type: ChannelType.GuildText,
    parent: category,
    topic: `nxfps:${typeKey}:${user.id}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      },
      {
        id: STAFF_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ]
  });

  const embed = new EmbedBuilder()
    .setTitle(`nxFPS • Atendimento de ${typeLabel}`)
    .setDescription(
      `Olá ${user}, seja bem-vindo ao seu atendimento exclusivo.\n\n` +
      `👤 **Cliente**\n${user} (${user.username})\n\n` +
      `ℹ️ **Tipo**\n${typeLabel}\n\n` +
      `👥 **Atendente**\nNão assumido`
    )
    .setColor(0xFFFFFF)
    .setFooter({ text: 'nxFPS • Tecnologia & Performance' })
    .setTimestamp();

  const rows = [];

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_assumir')
        .setLabel('Assumir Ticket')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_liberar')
        .setLabel('Liberar Atendimento')
        .setEmoji('🔓')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  if (type === 'compras') {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_pix')
          .setLabel('Enviar PIX')
          .setEmoji('💸')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ticket_aprovar')
          .setLabel('Aprovar Compra')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ticket_fechar')
          .setLabel('Fechar Ticket')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
      )
    );
  } else {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_fechar')
          .setLabel('Fechar Ticket')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
      )
    );
  }

  await channel.send({
    content: `${user} <@&${STAFF_ROLE_ID}>`,
    embeds: [embed],
    components: rows
  });

  return interaction.reply({
    content: `✅ Seu atendimento foi aberto com sucesso em ${channel}.`,
    ephemeral: true
  });
}

client.once('ready', () => {
  console.log(`nxFPS online como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'central') {
        return interaction.reply(buildCentralMessage());
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'central_select') {
        const value = interaction.values[0];
        if (value === 'compras') return createTicket(interaction, 'compras');
        if (value === 'suporte') return createTicket(interaction, 'suporte');
      }
      return;
    }

    if (!interaction.isButton()) return;
    if (!interaction.channel?.topic?.startsWith('nxfps:')) return;

    if (interaction.customId === 'ticket_assumir') {
      if (!isStaff(interaction)) {
        return interaction.reply({ content: 'Somente a staff pode assumir tickets.', ephemeral: true });
      }
      return interaction.reply({ content: `👥 Ticket assumido por ${interaction.user}.` });
    }

    if (interaction.customId === 'ticket_liberar') {
      if (!isStaff(interaction)) {
        return interaction.reply({ content: 'Somente a staff pode liberar o atendimento.', ephemeral: true });
      }
      return interaction.reply({ content: `🔓 Atendimento liberado por ${interaction.user}.` });
    }

    if (interaction.customId === 'ticket_pix') {
      if (!isStaff(interaction)) {
        return interaction.reply({ content: 'Somente a staff pode enviar o PIX.', ephemeral: true });
      }
      if (!PIX) {
        return interaction.reply({ content: 'A chave PIX ainda não foi configurada no Railway.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('nxFPS • Pagamento via PIX')
        .setDescription(
          `**Chave PIX:**\n\`${PIX}\`\n\n` +
          `**Recebedor:** ${PIX_NAME}\n\n` +
          'Após o pagamento, envie o comprovante neste ticket.'
        )
        .setColor(0xFFFFFF);

      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.customId === 'ticket_aprovar') {
      if (!isStaff(interaction)) {
        return interaction.reply({ content: 'Somente a staff pode aprovar compras.', ephemeral: true });
      }
      return interaction.reply({ content: `✅ Compra aprovada por ${interaction.user}.` });
    }

    if (interaction.customId === 'ticket_fechar') {
      if (!isStaff(interaction)) {
        return interaction.reply({ content: 'Somente a staff pode fechar tickets.', ephemeral: true });
      }
      await interaction.reply('🔒 Ticket será fechado em 5 segundos.');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
  } catch (error) {
    console.error(error);
    if (interaction.isRepliable()) {
      const payload = { content: 'Ocorreu um erro. Verifique a configuração do bot.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
});

await registerCommands();
await client.login(DISCORD_TOKEN);
