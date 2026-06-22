import { SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../types";

const playCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setNameLocalizations({ "zh-TW": "播放" })
    .setDescription("搜尋或加入 YouTube／Spotify 音樂。")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("query")
        .setNameLocalizations({ "zh-TW": "歌曲" })
        .setDescription("歌曲名稱、YouTube 或 Spotify 連結。")
        .setMinLength(1)
        .setMaxLength(500)
        .setRequired(true)
    ),
  async execute(interaction, context) {
    await context.music?.play(interaction, interaction.options.getString("query", true));
  }
};

const queueCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setNameLocalizations({ "zh-TW": "佇列" })
    .setDescription("查看音樂佇列。")
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName("page")
        .setNameLocalizations({ "zh-TW": "頁數" })
        .setDescription("要查看的頁數。")
        .setMinValue(1)
    ),
  async execute(interaction, context) {
    await context.music?.showQueue(interaction, interaction.options.getInteger("page") ?? 1);
  }
};

const nowPlayingCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setNameLocalizations({ "zh-TW": "正在播放" })
    .setDescription("顯示目前歌曲與播放器控制。")
    .setDMPermission(false),
  async execute(interaction, context) {
    await context.music?.showNowPlaying(interaction);
  }
};

const pauseCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setNameLocalizations({ "zh-TW": "暫停" })
    .setDescription("暫停目前歌曲。")
    .setDMPermission(false),
  async execute(interaction, context) {
    await context.music?.pause(interaction);
  }
};

const resumeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setNameLocalizations({ "zh-TW": "繼續播放" })
    .setDescription("繼續播放目前歌曲。")
    .setDMPermission(false),
  async execute(interaction, context) {
    await context.music?.resume(interaction);
  }
};

const skipCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setNameLocalizations({ "zh-TW": "跳過" })
    .setDescription("跳過目前歌曲或發起跳歌投票。")
    .setDMPermission(false),
  async execute(interaction, context) {
    await context.music?.skip(interaction);
  }
};

const removeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setNameLocalizations({ "zh-TW": "移除歌曲" })
    .setDescription("從佇列移除歌曲。")
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName("position")
        .setNameLocalizations({ "zh-TW": "位置" })
        .setDescription("歌曲在佇列中的位置。")
        .setMinValue(1)
        .setRequired(true)
    ),
  async execute(interaction, context) {
    await context.music?.remove(interaction, interaction.options.getInteger("position", true));
  }
};

const shuffleCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setNameLocalizations({ "zh-TW": "隨機播放" })
    .setDescription("隨機排列等待中的歌曲。")
    .setDMPermission(false),
  async execute(interaction, context) {
    await context.music?.shuffle(interaction);
  }
};

const loopCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setNameLocalizations({ "zh-TW": "循環播放" })
    .setDescription("設定播放器循環模式。")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("mode")
        .setNameLocalizations({ "zh-TW": "模式" })
        .setDescription("關閉、單曲循環或佇列循環。")
        .setRequired(true)
        .addChoices(
          { name: "關閉", value: "off" },
          { name: "單曲循環", value: "track" },
          { name: "佇列循環", value: "queue" }
        )
    ),
  async execute(interaction, context) {
    await context.music?.setLoop(
      interaction,
      interaction.options.getString("mode", true) as "off" | "track" | "queue"
    );
  }
};

const volumeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setNameLocalizations({ "zh-TW": "音量" })
    .setDescription("調整播放器音量。")
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName("percent")
        .setNameLocalizations({ "zh-TW": "百分比" })
        .setDescription("音量百分比。")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),
  async execute(interaction, context) {
    await context.music?.setVolume(interaction, interaction.options.getInteger("percent", true));
  }
};

const stopCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setNameLocalizations({ "zh-TW": "停止播放" })
    .setDescription("清空佇列並讓 Hydrava 離開語音頻道。")
    .setDMPermission(false),
  async execute(interaction, context) {
    await context.music?.stop(interaction);
  }
};

export const musicCommands = [
  playCommand,
  queueCommand,
  nowPlayingCommand,
  pauseCommand,
  resumeCommand,
  skipCommand,
  removeCommand,
  shuffleCommand,
  loopCommand,
  volumeCommand,
  stopCommand
] satisfies BotCommand[];
