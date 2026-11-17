require("dotenv").config();
const fs = require("fs");
const path = require("path");

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
  EmbedBuilder,
  AttachmentBuilder,
  ChannelType,
  MessageFlags
} = require("discord.js");

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// =======================
// ⚙️ CONFIG
// =======================
// channelId & voiceChannelId tetap dibaca dari panel.json (yang ada di repo)
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "panel.json"), "utf8"));

// Di Railway, pasang Volume lalu isi env DATA_DIR = path mount-nya (misal /data)
// supaya saldo tidak hilang saat redeploy.
const DATA_DIR = process.env.DATA_DIR || __dirname;
const SALDO_FILE = path.join(DATA_DIR, "saldo.json");

const PANEL_TITLE = "💵 KEUANGAN BETLEHEM";
const LOGO_URL = "https://media.discordapp.net/attachments/1487590787284734143/1492050545219862598/bthl.png";
const FOOTER_TEXT = "Nuel • Copyright ©️2018 - BTHL";
const UPLOAD_TIME = 30000; // 30 detik

// =======================
// 💵 FORMAT DOLLAR
// =======================
function formatDollar(angka) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(angka);
}

// "$1,234.50" / "-$50.00" → angka
function parseDollar(text) {
  const n = parseFloat(String(text).replace(/[$,\s]/g, ""));
  return isNaN(n) ? null : n;
}

// input user: "1000", "1,000", "$1000", "1000.50"
function parseJumlah(text) {
  const clean = String(text).replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const n = parseFloat(clean);
  return n > 0 ? n : null;
}

function tanggalWIB() {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }) + " WIB";
}

// =======================
// 💰 SALDO SYSTEM
// =======================
let saldoCache = null;

function readSaldoFile() {
  try {
    const n = Number(JSON.parse(fs.readFileSync(SALDO_FILE, "utf8")).saldo);
    return isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

function getSaldo() {
  if (saldoCache === null) saldoCache = readSaldoFile() ?? 0;
  return saldoCache;
}

function setSaldo(newSaldo) {
  saldoCache = Math.round(newSaldo * 100) / 100;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SALDO_FILE, JSON.stringify({ saldo: saldoCache }, null, 2));
  } catch (err) {
    console.log("⚠️ Gagal simpan saldo:", err.message);
  }
}

// Kalau saldo.json hilang (redeploy tanpa volume), ambil saldo terakhir dari
// embed transaksi terbaru di channel supaya saldo tidak balik ke $0.
async function restoreSaldoFromChannel(channel) {
  if (readSaldoFile() !== null) return;

  const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!recent) return;

  for (const m of recent.values()) { // terbaru dulu
    if (m.author.id !== client.user.id) continue;
    const field = m.embeds[0]?.fields?.find(f => f.name.includes("Saldo"));
    const value = field ? parseDollar(field.value.replace(/[>*`]/g, "")) : null;
    if (value !== null) {
      setSaldo(value);
      console.log(`♻️ Saldo dipulihkan dari channel: ${formatDollar(value)}`);
      return;
    }
  }
}

// =======================
// 🔘 BUTTON PANEL
// =======================
function getPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("masuk")
      .setLabel("Uang Masuk")
      .setEmoji("💰")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("keluar")
      .setLabel("Uang Keluar")
      .setEmoji("💸")
      .setStyle(ButtonStyle.Danger)
  );
}

// =======================
// 💵 EMBED KEUANGAN
// =======================
function generateEmbed({ jumlah, status, keterangan, saldo, hasImage, guild, member }) {
  const masuk = status === "MASUK";

  const embed = new EmbedBuilder()
    .setColor(masuk ? 0x16a34a : 0xdc2626)
    .setAuthor({ name: "BETLEHEM", iconURL: LOGO_URL })
    .setTitle(masuk ? "🟢 PEMASUKAN UANG" : "🔴 PENGELUARAN UANG")
    .setThumbnail(member.displayAvatarURL())
    .setDescription(`📅 **${tanggalWIB()}**\n👤 Dicatat oleh ${member}`)
    .addFields(
      { name: "💰 Jumlah", value: `> ${masuk ? "+" : "-"}${formatDollar(jumlah)}`, inline: true },
      { name: "💳 Saldo", value: `> ${formatDollar(saldo)}`, inline: true },
      { name: "📝 Keterangan", value: `> ${keterangan.replace(/\n/g, "\n> ")}`.slice(0, 1024) },
      { name: "📸 Bukti", value: hasImage ? "> Terlampir di bawah" : "> Tidak ada" }
    )
    .setFooter({ text: FOOTER_TEXT, iconURL: guild.iconURL() || undefined })
    .setTimestamp();

  if (hasImage) embed.setImage("attachment://bukti.png");

  return embed;
}

// =======================
// 📦 PANEL (TIDAK NYAMPAH)
// =======================
async function sendOrUpdatePanel() {
  const channel = await client.channels.fetch(CONFIG.channelId).catch(() => null);
  if (!channel) return console.log("❌ Channel tidak ditemukan");

  await restoreSaldoFromChannel(channel);

  const icon = channel.guild.iconURL() || undefined;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: "BETLEHEM", iconURL: LOGO_URL })
    .setTitle(PANEL_TITLE)
    .setThumbnail(icon || null)
    .setDescription(
      "Kelola pemasukan & pengeluaran uang dengan mudah.\n\n" +
      "> 🟢 **Uang Masuk** — catat pemasukan\n" +
      "> 🔴 **Uang Keluar** — catat pengeluaran\n\n" +
      "━━━━━━━━━━━━━━━━━━\n" +
      "Klik tombol di bawah untuk mulai input"
    )
    .setFooter({ text: FOOTER_TEXT, iconURL: icon });

  const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const panels = recent
    ? [...recent.filter(m =>
        m.author.id === client.user.id &&
        m.embeds[0]?.title === PANEL_TITLE
      ).values()] // urut terbaru dulu
    : [];

  for (const m of panels.slice(1)) {
    await m.delete().catch(() => {});
    console.log(`🧹 Hapus panel duplikat ${m.id}`);
  }

  const payload = { embeds: [embed], components: [getPanelButtons()] };

  if (panels[0]) {
    try {
      await panels[0].edit(payload);
      console.log("♻️ Panel di-update");
      return;
    } catch {
      await panels[0].delete().catch(() => {});
    }
  }

  await channel.send(payload);
  console.log("✅ Panel dikirim");
}

// =======================
// 🎧 AUTO JOIN + AUTO REJOIN VOICE
// =======================
async function joinVoice() {
  try {
    const vc = await client.channels.fetch(CONFIG.voiceChannelId).catch(() => null);
    if (!vc || vc.type !== ChannelType.GuildVoice) {
      return console.log("❌ Voice channel tidak ditemukan");
    }

    const connection = joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    console.log("🎧 Bot masuk voice channel");

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch {
        console.log("🔄 Bot keluar VC, rejoin...");
        try { connection.destroy(); } catch {}
        setTimeout(joinVoice, 3000);
      }
    });
  } catch (err) {
    console.log("❌ Gagal join voice:", err.message);
    setTimeout(joinVoice, 5000);
  }
}

// =======================
// 🚀 READY
// =======================
client.once(Events.ClientReady, async () => {
  console.log(`Login sebagai ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: "Sistem Keuangan", type: 0 }],
    status: "online"
  });

  setTimeout(joinVoice, 3000);

  try {
    await sendOrUpdatePanel();
  } catch (err) {
    console.log("❌ Error setup panel:", err);
  }
});

// =======================
// ⚙️ INTERACTION
// =======================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ===== BUTTON =====
    if (interaction.isButton()) {
      if (!["masuk", "keluar"].includes(interaction.customId)) return;

      const status = interaction.customId === "masuk" ? "MASUK" : "KELUAR";

      const modal = new ModalBuilder()
        .setCustomId(`modal_${status}`)
        .setTitle(status === "MASUK" ? "Input Uang Masuk" : "Input Uang Keluar");

      const jumlah = new TextInputBuilder()
        .setCustomId("jumlah")
        .setLabel("Jumlah Uang ($)")
        .setPlaceholder("Contoh: 1500 atau 1500.50")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(15)
        .setRequired(true);

      const ket = new TextInputBuilder()
        .setCustomId("keterangan")
        .setLabel("Keterangan")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(jumlah),
        new ActionRowBuilder().addComponents(ket)
      );

      return interaction.showModal(modal);
    }

    // ===== MODAL SUBMIT =====
    if (interaction.isModalSubmit()) {
      if (!["modal_MASUK", "modal_KELUAR"].includes(interaction.customId)) return;

      const jumlah = parseJumlah(interaction.fields.getTextInputValue("jumlah"));
      const keterangan = interaction.fields.getTextInputValue("keterangan").trim();

      if (jumlah === null) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xED4245)
              .setAuthor({ name: "BETLEHEM", iconURL: LOGO_URL })
              .setTitle("⚠️ Jumlah Tidak Valid")
              .setDescription("> Jumlah uang harus berupa **angka lebih dari 0**.\n> Contoh: `1500` atau `1500.50`")
          ],
          flags: MessageFlags.Ephemeral
        });
      }

      const status = interaction.customId === "modal_MASUK" ? "MASUK" : "KELUAR";

      // Saldo dihitung & disimpan SEKARANG, supaya angka di embed pas
      // walaupun ada transaksi lain selama 30 detik menunggu foto.
      const saldo = getSaldo() + (status === "MASUK" ? jumlah : -jumlah);
      setSaldo(saldo);
      const saldoSnapshot = getSaldo();

      console.log(`💵 ${interaction.user.tag} ${status} ${formatDollar(jumlah)} → saldo ${formatDollar(saldoSnapshot)}`);

      const icon = interaction.guild.iconURL() || undefined;

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: "BETLEHEM", iconURL: LOGO_URL })
            .setTitle("📸 Upload Bukti (Opsional)")
            .setDescription(
              `> Kirim foto / bukti di channel ini dalam **${UPLOAD_TIME / 1000} detik**.\n\n` +
              "Tidak ada foto?\n" +
              "> 👉 **Abaikan saja dan tunggu**, data tetap akan dikirim."
            )
            .setFooter({ text: FOOTER_TEXT, iconURL: icon })
        ],
        flags: MessageFlags.Ephemeral
      });

      const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === interaction.user.id && m.attachments.size > 0,
        time: UPLOAD_TIME,
        max: 1
      });

      collector.on("end", async (collected) => {
        try {
          const msg = collected.first();
          let file = null;

          // Foto di-upload ulang oleh bot, karena link foto asli mati
          // setelah pesan member dihapus.
          if (msg) {
            try {
              const res = await fetch(msg.attachments.first().url);
              file = new AttachmentBuilder(Buffer.from(await res.arrayBuffer()), { name: "bukti.png" });
            } catch (err) {
              console.log("⚠️ Gagal ambil foto bukti:", err.message);
            }
            await msg.delete().catch(() => {});
          }

          const embed = generateEmbed({
            jumlah,
            status,
            keterangan,
            saldo: saldoSnapshot,
            hasImage: !!file,
            guild: interaction.guild,
            member: interaction.member
          });

          await interaction.channel.send({
            embeds: [embed],
            files: file ? [file] : [],
            components: [getPanelButtons()]
          });
        } catch (err) {
          console.log("❌ Gagal kirim catatan:", err);
        }
      });
    }
  } catch (err) {
    console.log("❌ Error interaction:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      interaction.reply({
        content: "⚠️ Terjadi kendala, silahkan hubungi **ADMIN** ya.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
});

// =======================
// 🛡️ ANTI CRASH
// =======================
process.on("unhandledRejection", err => console.log("Unhandled Rejection:", err));
process.on("uncaughtException", err => console.log("Uncaught Exception:", err));

// =======================
// 🔑 LOGIN
// =======================
client.login(process.env.TOKEN);
