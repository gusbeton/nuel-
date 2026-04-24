require("dotenv").config();
const fs = require("fs");

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
  EmbedBuilder
} = require("discord.js");

const { joinVoiceChannel } = require("@discordjs/voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});


// =======================
// 💵 FORMAT DOLLAR
// =======================
function formatDollar(angka) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(angka);
}


// =======================
// 💰 SALDO SYSTEM
// =======================
function getSaldo() {
  if (!fs.existsSync("./saldo.json")) {
    fs.writeFileSync("./saldo.json", JSON.stringify({ saldo: 0 }, null, 2));
  }
  return JSON.parse(fs.readFileSync("./saldo.json")).saldo;
}

function setSaldo(newSaldo) {
  fs.writeFileSync("./saldo.json", JSON.stringify({ saldo: newSaldo }, null, 2));
}


// =======================
// 🔘 BUTTON PANEL
// =======================
function getPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("masuk")
      .setLabel("💰 Uang Masuk")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("keluar")
      .setLabel("💸 Uang Keluar")
      .setStyle(ButtonStyle.Danger)
  );
}


// =======================
// 💵 EMBED KEUANGAN
// =======================
function generateEmbed(jumlah, status, keterangan, image, guild, user) {
  const icon = guild.iconURL({ dynamic: true });
  const saldo = getSaldo();

  const embed = new EmbedBuilder()
    .setColor(status === "MASUK" ? 0x16a34a : 0xdc2626)
    .setTitle(
      status === "MASUK"
        ? "🟢 PEMASUKAN UANG"
        : "🔴 PENGELUARAN UANG"
    )
    .setThumbnail(icon)
    .setAuthor({
      name: user.tag,
      iconURL: user.displayAvatarURL()
    })
    .setDescription(
      `📅 **${new Date().toLocaleDateString("id-ID")}**\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 **Jumlah :** ${formatDollar(jumlah)}\n` +
      `💳 **Saldo  :** ${formatDollar(saldo)}\n` +
      `📝 **Keterangan :** ${keterangan}\n` +
      `📸 **Foto :** ${image ? "Ada" : "Tidak ada"}`
    )
    .setFooter({
      text: "BETLEHEM • Copyright ©️2018 - BTHL",
      iconURL: icon || undefined
    });

  if (image) embed.setImage(image);

  return embed;
}


// =======================
// 📦 PANEL AUTO
// =======================
async function sendPanelIfNotExist(client) {
  const data = JSON.parse(fs.readFileSync("./panel.json"));

  const channel = await client.channels.fetch(data.channelId);
  if (!channel) return console.log("Channel tidak ditemukan");

  if (data.messageId) {
    try {
      await channel.messages.fetch(data.messageId);
      return;
    } catch {}
  }

  const icon = channel.guild.iconURL({ dynamic: true });

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("💵 KEUANGAN BETLEHEM")
    .setThumbnail(icon)
    .setDescription(
      "Kelola pemasukan & pengeluaran uang dengan mudah.\n\n" +
      "🟢 **Masuk** = Uang masuk\n" +
      "🔴 **Keluar** = Uang keluar\n\n" +
      "━━━━━━━━━━━━━━━━━━\n" +
      "Klik tombol di bawah untuk mulai input"
    )
    .setFooter({
      text: "BETLEHEM • Copyright ©️2018 - BTHL",
      iconURL: icon || undefined
    });

  const msg = await channel.send({
    embeds: [embed],
    components: [getPanelButtons()]
  });

  data.messageId = msg.id;
  fs.writeFileSync("./panel.json", JSON.stringify(data, null, 2));
}


// =======================
// 🎧 AUTO JOIN VOICE
// =======================
async function joinVoice(client) {
  const data = JSON.parse(fs.readFileSync("./panel.json"));

  try {
    const channel = await client.channels.fetch(data.voiceChannelId);
    if (!channel) return console.log("Voice channel tidak ditemukan");

    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    console.log("Bot masuk voice channel");
  } catch (err) {
    console.log("Gagal join voice:", err.message);
  }
}


// =======================
// 🚀 READY
// =======================
client.once("ready", async () => {
  console.log(`Login sebagai ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: "Sistem Keuangan", type: 0 }],
    status: "online"
  });

  await sendPanelIfNotExist(client);
  await joinVoice(client);
});


// =======================
// ⚙️ INTERACTION
// =======================
client.on(Events.InteractionCreate, async (interaction) => {

  // BUTTON
  if (interaction.isButton()) {
    const status = interaction.customId === "masuk" ? "MASUK" : "KELUAR";

    const modal = new ModalBuilder()
      .setCustomId(`modal_${status}`)
      .setTitle(`Input ${status === "MASUK" ? "Uang Masuk" : "Uang Keluar"}`);

    const jumlah = new TextInputBuilder()
      .setCustomId("jumlah")
      .setLabel("Jumlah Uang")
      .setStyle(TextInputStyle.Short);

    const ket = new TextInputBuilder()
      .setCustomId("keterangan")
      .setLabel("Keterangan")
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
      new ActionRowBuilder().addComponents(jumlah),
      new ActionRowBuilder().addComponents(ket)
    );

    await interaction.showModal(modal);
  }

  // MODAL SUBMIT
  if (interaction.isModalSubmit()) {
    const jumlah = interaction.fields.getTextInputValue("jumlah");
    const keterangan = interaction.fields.getTextInputValue("keterangan");

    if (isNaN(jumlah)) {
      return interaction.reply({
        content: "❌ Jumlah uang harus berupa angka!",
        ephemeral: true
      });
    }

    const status = interaction.customId.includes("MASUK") ? "MASUK" : "KELUAR";

    let saldo = getSaldo();

    if (status === "MASUK") {
      saldo += Number(jumlah);
    } else {
      saldo -= Number(jumlah);
    }

    setSaldo(saldo);

    const icon = interaction.guild.iconURL({ dynamic: true });

    const notice = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("📸 Upload Foto (Opsional)")
      .setThumbnail(icon)
      .setDescription(
        "Silakan upload foto / bukti dalam **30 detik**.\n\n" +
        "Jika tidak ada foto:\n" +
        "👉 **abaikan saja dan tunggu**, data tetap akan dikirim."
      )
      .setFooter({
        text: "BETLEHEM • Copyright ©️2018 - BTHL",
        iconURL: icon || undefined
      });

    await interaction.reply({
      embeds: [notice],
      ephemeral: true
    });

    const collector = interaction.channel.createMessageCollector({
      filter: m =>
        m.author.id === interaction.user.id &&
        m.attachments.size > 0,
      time: 30000,
      max: 1
    });

    let sent = false;

    collector.on("collect", async (msg) => {
      const url = msg.attachments.first().url;

      const embed = generateEmbed(
        jumlah,
        status,
        keterangan,
        url,
        interaction.guild,
        interaction.user
      );

      await interaction.followUp({
        embeds: [embed],
        components: [getPanelButtons()]
      });

      await msg.delete().catch(() => {});

      sent = true;
      collector.stop();
    });

    collector.on("end", async () => {
      if (!sent) {
        const embed = generateEmbed(
          jumlah,
          status,
          keterangan,
          null,
          interaction.guild,
          interaction.user
        );

        await interaction.followUp({
          embeds: [embed],
          components: [getPanelButtons()]
        });
      }
    });
  }

});


// =======================
// 🔑 LOGIN
// =======================
client.login(process.env.TOKEN);
