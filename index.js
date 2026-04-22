require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  Events
} = require("discord.js");

const { createCanvas } = require("canvas");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});


// =======================
// 🎨 CANVAS FUNCTION
// =======================
async function generateInventory(nama, jumlah, status, keterangan) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext("2d");

  const tanggal = new Date().toLocaleDateString("id-ID");

  // background
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // border
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 780, 380);

  // title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px Sans";
  ctx.fillText("INVENTORY CARD", 220, 60);

  ctx.font = "20px Sans";
  ctx.fillText("BETLEHEM", 330, 90);

  // garis
  ctx.beginPath();
  ctx.moveTo(40, 110);
  ctx.lineTo(760, 110);
  ctx.stroke();

  // isi
  ctx.font = "22px Sans";
  ctx.fillStyle = "#ffffff";

  ctx.fillText(`Nama Barang : ${nama}`, 60, 160);
  ctx.fillText(`Jumlah      : ${jumlah}`, 60, 200);

  // warna status
  ctx.fillStyle = status === "MASUK" ? "#22c55e" : "#ef4444";
  ctx.fillText(`Status      : ${status}`, 60, 240);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Tanggal     : ${tanggal}`, 60, 280);
  ctx.fillText(`Keterangan  : ${keterangan}`, 60, 320);

  return new AttachmentBuilder(canvas.toBuffer(), {
    name: "inventory.png"
  });
}


// =======================
// 🚀 READY
// =======================
client.once("ready", () => {
  console.log(`Login sebagai ${client.user.tag}`);
});


// =======================
// 📦 COMMAND PANEL
// =======================
client.on(Events.InteractionCreate, async (interaction) => {

  // =======================
  // BUTTON PANEL
  // =======================
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "panel") {

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("masuk")
          .setLabel("📥 Barang Masuk")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("keluar")
          .setLabel("📤 Barang Keluar")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({
        content: "📦 **INVENTORY BETLEHEM**\nKlik tombol di bawah:",
        components: [row]
      });
    }
  }

  // =======================
  // BUTTON CLICK
  // =======================
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

  // =======================
  // MODAL SUBMIT
  // =======================
  if (interaction.isModalSubmit()) {

    const nama = interaction.fields.getTextInputValue("nama");
    const jumlah = interaction.fields.getTextInputValue("jumlah");
    const keterangan = interaction.fields.getTextInputValue("keterangan");

    const status = interaction.customId.includes("MASUK") ? "MASUK" : "KELUAR";

    const file = await generateInventory(nama, jumlah, status, keterangan);

    await interaction.reply({
      files: [file]
    });
  }

});


// =======================
// 🔑 LOGIN
// =======================
client.login(process.env.TOKEN);
