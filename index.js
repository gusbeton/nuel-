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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});


// =======================
// 🔘 BUTTON PANEL
// =======================
function getPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("masuk")
      .setLabel("📥 Barang Masuk")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("keluar")
      .setLabel("📤 Barang Keluar")
      .setStyle(ButtonStyle.Danger)
  );
}


// =======================
// 📦 EMBED INVENTORY (WITH ICON)
// =======================
function generateEmbed(nama, jumlah, status, keterangan, image, guild, user) {
  const icon = guild.iconURL({ dynamic: true });

  const embed = new EmbedBuilder()
    .setColor(status === "MASUK" ? 0x16a34a : 0xdc2626)
    .setTitle(status === "MASUK" ? "🟢 BARANG MASUK" : "🔴 BARANG KELUAR")
    .setThumbnail(icon)
    .setAuthor({
      name: user.tag,
      iconURL: user.displayAvatarURL()
    })
    .setDescription(
      `📅 **${new Date().toLocaleDateString("id-ID")}**\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `**Nama Barang :** ${nama}\n` +
      `**Jumlah      :** ${jumlah}\n` +
      `**Keterangan  :** ${keterangan}\n` +
      `**Foto        :** ${image ? "Ada" : "Tidak ada"}`
    )
    .setFooter({
      text: "BETLEHEM • Copyright ©️2018 - BTHL",
      iconURL: icon || undefined
    });

  if (image) embed.setImage(image);

  return embed;
}


// =======================
// 📦 PANEL AUTO (CLEAN)
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
    .setTitle("📦 INVENTORY BETLEHEM")
    .setThumbnail(icon)
    .setDescription(
      "Kelola barang masuk & keluar dengan mudah.\n\n" +
      "🟢 **Masuk** = Barang masuk\n" +
      "🔴 **Keluar** = Barang keluar\n\n" +
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
// 🚀 READY
// =======================
client.once("ready", async () => {
  console.log(`Login sebagai ${client.user.tag}`);
  await sendPanelIfNotExist(client);
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
      .setTitle(`Barang ${status}`);

    const nama = new TextInputBuilder()
      .setCustomId("nama")
      .setLabel("Nama Barang")
      .setStyle(TextInputStyle.Short);

    const jumlah = new TextInputBuilder()
      .setCustomId("jumlah")
      .setLabel("Jumlah")
      .setStyle(TextInputStyle.Short);

    const ket = new TextInputBuilder()
      .setCustomId("keterangan")
      .setLabel("Keterangan")
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nama),
      new ActionRowBuilder().addComponents(jumlah),
      new ActionRowBuilder().addComponents(ket)
    );

    await interaction.showModal(modal);
  }

  // MODAL SUBMIT
  if (interaction.isModalSubmit()) {
    const nama = interaction.fields.getTextInputValue("nama");
    const jumlah = interaction.fields.getTextInputValue("jumlah");
    const keterangan = interaction.fields.getTextInputValue("keterangan");

    const status = interaction.customId.includes("MASUK") ? "MASUK" : "KELUAR";

    await interaction.reply({
      content: "📸 Upload foto (opsional, 30 detik)",
      ephemeral: true
    });

    const filter = m =>
      m.author.id === interaction.user.id &&
      m.attachments.size > 0;

    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 30000
    });

    let sent = false;

    collector.on("collect", async (msg) => {
      const url = msg.attachments.first().url;

      const embed = generateEmbed(
        nama,
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

      setTimeout(() => msg.delete().catch(() => {}), 1000);

      sent = true;
      collector.stop();
    });

    collector.on("end", async () => {
      if (!sent) {
        const embed = generateEmbed(
          nama,
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
