import { getContext, loadExtensionSettings, extension_settings } from '../../../public/scripts/extensions.js';
import { eventSource, event_types } from '../../../public/scripts/script.js';
import { saveSettingsDebounced } from '../../../public/scripts/utils.js';

// Extension settings
extension_settings.discordChatter = extension_settings.discordChatter || {};
const settings = extension_settings.discordChatter;

let discordClient = null;
let discordChannel = null;

function log(message) {
    console.log(`[Discord Chatter] ${message}`);
}

async function setupDiscordBot() {
    log('Setting up Discord bot...');
    
    // We'll use a dynamic import for discord.js to avoid issues with CommonJS vs ES modules
    const { Client, GatewayIntentBits } = await import('discord.js');
    
    discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    discordClient.once('ready', () => {
        log(`Logged in as ${discordClient.user.tag}!`);
        discordChannel = discordClient.channels.cache.get(settings.channelId);
        if (!discordChannel) {
            log('Specified Discord channel not found!');
        } else {
            log('Discord channel found and set up.');
        }
    });

    try {
        await discordClient.login(settings.botToken);
        log('Login successful');
    } catch (error) {
        log(`Login error: ${error.message}`);
    }
}

async function sendToDiscord(message) {
    if (discordChannel) {
        try {
            await discordChannel.send(message);
            log('Message sent to Discord successfully');
        } catch (error) {
            log('Error sending message to Discord: ' + error.message);
        }
    } else {
        log('Discord channel not set up');
    }
}

// Register extension
jQuery(async () => {
    const context = getContext();
    loadExtensionSettings('discordChatter');

    // Create extension UI
    const settingsHtml = `
        <div id="discord_chatter_settings">
            <h3>Discord Chatter Settings</h3>
            <label for="discord_bot_token">Bot Token:</label>
            <input id="discord_bot_token" type="password" value="${settings.botToken || ''}"><br>
            <label for="discord_channel_id">Channel ID:</label>
            <input id="discord_channel_id" type="text" value="${settings.channelId || ''}"><br>
            <button id="discord_connect">Connect</button>
        </div>
    `;
    $('#extensions_settings').append(settingsHtml);

    // Handle settings changes
    $('#discord_bot_token, #discord_channel_id').on('input', function() {
        settings.botToken = $('#discord_bot_token').val();
        settings.channelId = $('#discord_channel_id').val();
        saveSettingsDebounced();
    });

    // Handle connect button
    $('#discord_connect').on('click', setupDiscordBot);

    // Listen for outgoing messages from SillyTavern
    eventSource.on(event_types.MESSAGE_SENT, async (messageData) => {
        if (messageData.mes && !messageData.is_system && !messageData.is_user) {
            await sendToDiscord(`${messageData.name}: ${messageData.mes}`);
        }
    });

    // Handle incoming messages from Discord
    if (discordClient) {
        discordClient.on('messageCreate', async (message) => {
            if (message.channel.id === settings.channelId && !message.author.bot) {
                log(`Message received from Discord: ${message.content}`);
                context.sendSystemMessage(`Discord user ${message.author.username}: ${message.content}`);
            }
        });
    }

    log("Discord Chatter extension loaded");
});
