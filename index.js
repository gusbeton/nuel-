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
  intents: [GatewayIntentBits.Guilds]
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
// 📦 EMBED INVENTORY (FINAL CLEAN)
// =======================
function generateInventoryEmbed(nama, jumlah, status, keterangan) {
  const tanggal = new Date().toLocaleDateString("id-ID");

  return new EmbedBuilder()
    .setColor(status === "MASUK" ? 0x16a34a : 0xdc2626)
    .setTitle(
      status === "MASUK"
        ? "🟢 BARANG MASUK"
        : "🔴 BARANG KELUAR"
    )
    .setDescription(
      `📅 **${tanggal}**\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `**Nama Barang :** ${nama}\n` +
      `**Jumlah      :** ${jumlah}\n` +
      `**Keterangan  :** ${keterangan}`
    )
    .setFooter({ text: "BETLEHEM • Inventory System" });
}


// =======================
// 📦 PANEL AUTO (ANTI SPAM)
// =======================
async function sendPanelIfNotExist(client) {
  const data = JSON.parse(fs.readFileSync("./panel.json"));

  const channel = await client.channels.fetch(data.channelId);
  if (!channel) return console.log("Channel tidak ditemukan");

  if (data.messageId) {
    try {
      await channel.messages.fetch(data.messageId);
      console.log("Panel sudah ada");
      return;
    } catch {
      console.log("Panel hilang, kirim ulang...");
    }
  }

  const msg = await channel.send({
    content:
      "📦 **INVENTORY BETLEHEM**\n" +
      "Klik tombol di bawah:\n\n" +
      "🟢 **Masuk** = Barang masuk\n" +
      "🔴 **Keluar** = Barang keluar\n" +
      "━━━━━━━━━━━━━━━━━━",
    components: [getPanelButtons()]
  });

  data.messageId = msg.id;
  fs.writeFileSync("./panel.json", JSON.stringify(data, null, 2));

  console.log("Panel dikirim");
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

  // 🔘 BUTTON CLICK
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


  // 📥 MODAL SUBMIT
  if (interaction.isModalSubmit()) {
    const nama = interaction.fields.getTextInputValue("nama");
    const jumlah = interaction.fields.getTextInputValue("jumlah");
    const keterangan = interaction.fields.getTextInputValue("keterangan");

    const status = interaction.customId.includes("MASUK") ? "MASUK" : "KELUAR";

    const embed = generateInventoryEmbed(nama, jumlah, status, keterangan);

    await interaction.reply({
      embeds: [embed],
      components: [getPanelButtons()] // 🔥 NO SCROLL SYSTEM
    });
  }

});


// =======================
// 🔑 LOGIN
// =======================
client.login(process.env.TOKEN);
