import 'dotenv/config';
import {
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle
} from 'discord.js';

const {
  DISCORD_TOKEN, CLIENT_ID, GUILD_ID, STAFF_ROLE_ID,
  COMPRAS_CATEGORY_ID, SUPORTE_CATEGORY_ID, PIX_KEY, PIX_NAME = 'nxFPS'
} = process.env;

for (const [k, v] of Object.entries({DISCORD_TOKEN, CLIENT_ID, GUILD_ID, STAFF_ROLE_ID, COMPRAS_CATEGORY_ID, SUPORTE_CATEGORY_ID})) {
  if (!v) { console.error(`Faltando ${k} no .env`); process.exit(1); }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName('central')
    .setDescription('Envia a Central de Atendimento da nxFPS')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
}

function centralPanel() {
  const embed = new EmbedBuilder()
    .setTitle('Central de Atendimento')
    .setDescription('Seja bem-vindo(a) à **nxFPS**.\n\nSelecione abaixo o departamento desejado e abra seu atendimento de forma rápida e segura.')
    .setColor(0x111111)
    .addFields(
      { name: '🛒 Comprar', value: 'Abra um ticket para comprar uma otimização.' },
      { name: '🛠️ Suporte', value: 'Abra um ticket para tirar dúvidas ou receber ajuda.' }
    )
    .setFooter({ text: 'nxFPS • Tecnologia & Performance' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('central_comprar').setLabel('Comprar').setEmoji('🛒').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('central_suporte').setLabel('Suporte').setEmoji('🛠️').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row] };
}

function slug(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80);
}

function isStaff(interaction) {
  return interaction.member?.roles?.cache?.has(STAFF_ROLE_ID);
}

async function createTicket(interaction, type) {
  const guild = interaction.guild;
  const user = interaction.user;
  const isBuy = type === 'compras';
  const typeLabel = isBuy ? 'Compras' : 'Suporte';
  const category = isBuy ? COMPRAS_CATEGORY_ID : SUPORTE_CATEGORY_ID;
  const topic = `nxfps:${type}:${user.id}`;

  const existing = guild.channels.cache.find(c => c.topic === topic);
  if (existing) return interaction.reply({ content: `Você já tem um ticket aberto: ${existing}`, ephemeral: true });

  const channel = await guild.channels.create({
    name: slug(`ticket-${user.username}`),
    type: ChannelType.GuildText,
    parent: category,
    topic,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ]
  });

  const embed = new EmbedBuilder()
    .setTitle(`nxFPS • Atendimento de ${typeLabel}`)
    .setDescription(`Olá ${user}, seja bem-vindo ao seu atendimento.\n\n👤 **Cliente**\n${user} (${user.username})\n\nℹ️ **Tipo**\n${typeLabel}\n\n👥 **Atendente**\nNão assumido`)
    .setColor(isBuy ? 0x00a86b : 0x5865f2)
    .setFooter({ text: 'nxFPS • Tecnologia & Performance' });

  const buttons = [
    new ButtonBuilder().setCustomId('ticket_assumir').setLabel('Assumir Ticket').setEmoji('👥').setStyle(ButtonStyle.Primary)
  ];

  if (isBuy) {
    buttons.push(
      new ButtonBuilder().setCustomId('ticket_pix').setLabel('Enviar PIX').setEmoji('💸').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket_aprovar').setLabel('Aprovar Compra').setEmoji('✅').setStyle(ButtonStyle.Success)
    );
  }

  buttons.push(
    new ButtonBuilder().setCustomId('ticket_liberar').setLabel('Liberar Atendimento').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_fechar').setLabel('Fechar Ticket').setEmoji('❌').setStyle(ButtonStyle.Danger)
  );

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));

  await channel.send({ content: `${user} <@&${STAFF_ROLE_ID}>`, embeds: [embed], components: rows });
  await interaction.reply({ content: `✅ Ticket criado com sucesso: ${channel}`, ephemeral: true });
}

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'central') return interaction.reply(centralPanel());
    if (!interaction.isButton()) return;

    if (interaction.customId === 'central_comprar') return createTicket(interaction, 'compras');
    if (interaction.customId === 'central_suporte') return createTicket(interaction, 'suporte');
    if (!interaction.channel?.topic?.startsWith('nxfps:')) return;

    if (interaction.customId === 'ticket_assumir') {
      if (!isStaff(interaction)) return interaction.reply({ content: 'Somente a staff pode assumir tickets.', ephemeral: true });
      return interaction.reply({ content: `👥 Ticket assumido por ${interaction.user}.` });
    }

    if (interaction.customId === 'ticket_pix') {
      if (!isStaff(interaction)) return interaction.reply({ content: 'Somente a staff pode enviar o Pix.', ephemeral: true });
      if (!PIX_KEY) return interaction.reply({ content: 'A chave Pix ainda não foi configurada.', ephemeral: true });
      const embed = new EmbedBuilder()
        .setTitle('nxFPS • Pagamento via PIX')
        .setDescription(`**Chave PIX:**\n\`${PIX_KEY}\`\n\n**Recebedor:** ${PIX_NAME}\n\nApós o pagamento, envie o comprovante neste ticket.`)
        .setColor(0x00a86b);
      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.customId === 'ticket_aprovar') {
      if (!isStaff(interaction)) return interaction.reply({ content: 'Somente a staff pode aprovar compras.', ephemeral: true });
      return interaction.reply({ content: `✅ **Compra aprovada** por ${interaction.user}.` });
    }

    if (interaction.customId === 'ticket_liberar') {
      if (!isStaff(interaction)) return interaction.reply({ content: 'Somente a staff pode liberar o atendimento.', ephemeral: true });
      return interaction.reply({ content: `🔓 Atendimento liberado por ${interaction.user}.` });
    }

    if (interaction.customId === 'ticket_fechar') {
      if (!isStaff(interaction)) return interaction.reply({ content: 'Somente a staff pode fechar o ticket.', ephemeral: true });
      await interaction.reply('🔒 Ticket será fechado em 5 segundos.');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
  } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      const msg = { content: 'Ocorreu um erro no bot. Verifique a configuração.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
    }
  }
});

client.once('ready', () => console.log(`nxFPS online como ${client.user.tag}`));
await registerCommands();
await client.login(DISCORD_TOKEN);
