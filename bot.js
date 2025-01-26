const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const crypto = require('crypto'); // For generating unique meeting IDs

function scheduleReminder(meetingId) {
    // meeting = {
    //      meetingDate,    // A date Object storing the date and time of the meeting
    //      details,
    //      comment,
    //      tags,           // Roles or Users to be tagged
    //      channelId,      // ChannelID field of the interaction or message, Globally unique
    //      reminders       // Custom reminders set by the user, an array of integers of minutes
    //  }

    const nowDate = new Date();
    const now = nowDate.getTime(); // Use a timestamp for consistency
    let meeting = meetings[meetingId]; // Ensure this is defined and valid

    if (!meeting || !meeting.reminders || !Array.isArray(meeting.reminders)) {
        console.error(`Invalid meeting data or missing reminders for ID: ${meetingId}`);
        return;
    }

    const meetingTimestamp = new Date(meeting.meetingDate).getTime();

    // Calculate the reminder timestamps
    const reminderTimes = meeting.reminders.map(minutes => meetingTimestamp - minutes * 60 * 1000);

    // Find the latest reminder time (closest to the meeting date)
    const latestReminderTime = Math.max(...reminderTimes);

    // Schedule each reminder
    reminderTimes.forEach(reminderTime => {
        if (reminderTime > now) {
            const delay = reminderTime - now;
            const isLastReminder = reminderTime === latestReminderTime; // True if this is the last reminder (closest to the meeting)
            setTimeout(() => sendReminder(meetingId, isLastReminder), delay);
        }
    });
}

async function sendReminder(meetingId, lastReminder) {
    const meeting = meetings[meetingId];

    if (!meeting) {
        console.error(`Meeting with ID ${meetingId} not found.`);
        return;
    }

    const { meetingDate, details, comment, resolvedMentions, channelId } = meeting;

    const meetingTimeObject = new Date(meetingDate);
    const now = new Date();
    const timeRemaining = Math.max(0, meetingTimeObject.getTime() - now.getTime() + 1000); // Ensure non-negative time remaining
    const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));

    // Convert minutes to a human-readable format
    const timeAnnouncement =
        minutesRemaining === 0
            ? "now"
            : minutesRemaining < 60
                ? `in ${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'}`
                : `in ${Math.floor(minutesRemaining / 60)} hour${Math.floor(minutesRemaining / 60) === 1 ? '' : 's'} and ${minutesRemaining % 60} minute${minutesRemaining % 60 === 1 ? '' : 's'}`;

    const formattedDate = meetingTimeObject.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const formattedTime = meetingTimeObject.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    // Create the embed
    const reminderEmbed = new EmbedBuilder()
        .setColor(0x0099ff) // Use a color to represent the reminder (e.g., blue)
        .setTitle('🔔 Meeting Reminder 🔔')
        .setDescription(`You have a meeting scheduled ${timeAnnouncement}.`)
        .addFields(
            { name: '📅 Date', value: formattedDate, inline: true },
            { name: '⏰ Time', value: formattedTime, inline: true },
            { name: '📜 Details', value: details || 'No details provided.', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Reminder System by Shellmates' });

    // Add comment if it exists
    if (comment) {
        reminderEmbed.addFields({
            name: '📝 Comment',
            value: comment || 'No comment provided.',
            inline: false,
        });
    }

    try {
        const channel = await client.channels.fetch(channelId);

        // Send the mentions as plain text to trigger notifications
        const mentionText = resolvedMentions?.join(' ') || '';

        // Send the embed with mentions
        await channel.send({ content: mentionText, embeds: [reminderEmbed] });
    } catch (error) {
        console.error(`Failed to send reminder to channel ${channelId}:`, error);
    }

    // Handle meeting deletion after the last reminder
    if (lastReminder) {
        if (!deleteMeeting(meetingId))
            console.error(`Failed to delete meeting with ID ${meetingId}`);
        await deleteFromJSON(meetingId, MEETINGS_FILE);
    }
}


function deleteMeeting(meetingID) {
    if (!meetings[meetingID])
        return false;

    delete meetings[meetingID];
    return true;
}

function parseArgs(input) {
    const regex = /(?:[^\s'"]+|['"]([^'"]+)['"])+/g; // Regex to match unquoted and quoted arguments
    return input.match(regex).map(arg => arg.replace(/^['"]|['"]$/g, '')); // Remove quotes if present
}

async function resolveMentions(mention, guild, author) {
    if (mention === '@everyone' || mention === '@here')
        return mention;

    // Handle user mentions (formatted as <@userID>)
    else if (mention.startsWith('<@') && mention.endsWith('>') && !mention.startsWith('<@&')) {
        const userId = mention.slice(2, -1); // Extract userID

        // Check if it's a DM (no guild available)
        if (!guild) {
            if (userId === author.id) // Mention is the author
                return `<@${author.id}>`;
            if (userId === client.user.id) // If the bot itself
                return `<@${client.user.id}>`;

            // return mention; // Return as is for unknown cases
            console.error(`Unresolved mention0: ${mention}`)
            return null;
        }

        // Handle guild-based resolution
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member)
            return `<@${member.user.id}>`; // Mention resolved to username

        console.error(`Unresolved mention1: ${mention}`)
        return null;
    }

    // Handle role mentions (formatted as <@&roleID>)
    else if (mention.startsWith('<@&') && mention.endsWith('>')) {
        const roleId = mention.match(/\d+/)[0];
        const role = guild.roles.cache.get(roleId);

        if (role)
            return `<@&${role.id}>`
    }

    else if (mention.startsWith('@')) { // Plain text mentions (could be usernames or roles)
        const mentionString = mention.slice(1); // Remove '@'

        // If there is no guild (DM), resolving mentions ends here
        if (!guild) {
            if (mentionString === author.username)         // Mention resolved to the author
                return `@${author.username}`;
            if (mentionString === client.user.username)    // Mention resolved to the bot
                return `@${guild.client.user.username}`;
            // return mention; // Return as-is for unknown cases in DMs

            console.error(`Unresolved mention2: ${mention}`)
            return null;
        }

        // In a guild, check for roles first
        const role = guild.roles.cache.find((r) => r.name === mentionString);
        if (role)
            return `@${role.name}`; // Resolve to role name without tagging

        // Then check for members with matching usernames
        const member = await guild.members
            .fetch({ query: mentionString, limit: 1 })
            .then((members) => members.first())
            .catch(() => null);
        if (member)
            return `<@${member.id}>`; // Resolve to user mention

        console.error(`Unresolved mention3: ${mention}`)
    }
    return null
}

function resolveCustomReminders(customReminders) {
    const reminderRegex = /^(\d+h)?(\d+m)?$/; // Updated regex to support '2h30m', '2h', '30m', etc.
    return customReminders.split(' ').map(reminder => {
        if (reminderRegex.test(reminder)) {
            let totalMinutes = 0;

            // Match hours and minutes
            const match = reminder.match(reminderRegex);
            if (match[1]) totalMinutes += parseInt(match[1].slice(0, -1), 10) * 60; // Convert hours to minutes
            if (match[2]) totalMinutes += parseInt(match[2].slice(0, -1), 10); // Add minutes

            return totalMinutes;
        }
        else if (!isNaN(reminder))      // Treat plain numbers as minutes
            return parseInt(reminder, 10);
        else                             // Invalid format
            return null;
    }).filter(reminder => reminder !== null);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
    ],
    partials: ['CHANNEL'],
});

const TOKEN = 'MTMyMjIxOTIwNzI4NjMyNTI5OQ.G30yQv.GJRwN_VEOBFgS6OP2WVWvY1rBY-hBESqgFAFj8'; // Replace with your bot's token
const PREFIX = '!'; // The prefix for the commands
const MEETINGS_FILE = 'meetings.json'
const DEFAULT_REMINDERS = [0, 10]
let adminRoleId = null; // Variable to store the selected admin role
let meetings = {}; // To store meetings

//add to json file
const fs = require('fs');

// Creating MEETINGS_FILE in here, if not already created
if (!fs.existsSync(MEETINGS_FILE)) {
    fs.writeFileSync(MEETINGS_FILE, JSON.stringify({}, null, 4)); // Create an empty JSON object
    console.log(`File '${MEETINGS_FILE}' has been created.`);
}

// Updated saveToJSON function with async/await
async function saveToJSON(meetingId, data, filename) {
    try {
        let existingData = {};

        try {
            const fileContent = await fs.promises.readFile(filename, 'utf8');
            existingData = JSON.parse(fileContent);
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(err);
                return;
            }
            console.log(`File '${filename}' does not exist. Creating a new file...`);
        }

        if (typeof existingData !== 'object' || Array.isArray(existingData)) {
            console.error('Invalid JSON structure in file. Overwriting with a new object.');
            existingData = {};
        }

        existingData[meetingId] = data;
        await fs.promises.writeFile(filename, JSON.stringify(existingData, null, 4), 'utf8');
    }
    catch (err) {
        console.error('Error saving to JSON file:', err);
    }
}

async function deleteFromJSON(meetingId, filename) {
    try {
        let existingData = {};

        try {
            const fileContent = await fs.promises.readFile(filename, 'utf8');
            existingData = JSON.parse(fileContent);
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(err);
                return;
            }
            console.error(`File '${filename}' does not exist. Cannot delete meeting.`);
            return;
        }

        // Ensure the existing data is an object
        if (typeof existingData !== 'object' || Array.isArray(existingData)) {
            console.error('Invalid JSON structure in file. Cannot delete meeting.');
            return;
        }

        // Delete the meeting by ID
        if (meetingId in existingData)
            delete existingData[meetingId];
        else {
            console.error(`Meeting with ID '${meetingId}' not found.`);
            return;
        }

        await fs.promises.writeFile(filename, JSON.stringify(existingData, null, 4), 'utf8');
    }
    catch (err) {
        console.error('Error deleting from JSON file:', err);
    }
}

//fiha prblm 
async function loadMeetingsFromJSON() {
    try {
        const data = await fs.promises.readFile(MEETINGS_FILE, 'utf-8');
        const allMeetings = JSON.parse(data);

        const now = new Date();

        // Filter meetings with dates greater than the current time
        for (const [key, meeting] of Object.entries(allMeetings)) {
            const meetingDate = new Date(meeting.meetingDate);
            // this is wrong; we must compare 'now' to the last (closest to meetingDate) reminder of the meetings[key]
            if (meetingDate > now) {
                meetings[key] = meeting;
                scheduleReminder(key);
            }
        }

        // Overwrite the JSON file with the filtered meetings to get a new version of json
        await fs.promises.writeFile(MEETINGS_FILE, JSON.stringify(meetings, null, 4), 'utf-8');

        console.log('Future meetings loaded and saved successfully ');
    }
    catch (error) {
          console.error('Error processing meetings.json:', error.message);
    }
  }

client.once('ready', async   () => {
    console.log(`${client.user.tag} is ready to work!`);

    const commands = [
        new SlashCommandBuilder()
            .setName('add_meeting')
            .setDescription('Schedule a new meeting')
            .addStringOption(option =>
                option.setName('details')
                    .setDescription('Details of the meeting.')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('date')
                    .setDescription('The date for the meeting in the format of YYYY-MM-DD.')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('time')
                    .setDescription('The time for the meeting (HH:MM), in 24-Hours format.')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('custom_reminders')
                    .setDescription('Customized reminders for the meeting; m for minutes, h for hours; default are 0m 10m. ')
                    .setRequired(false)
            )
            .addStringOption(option =>
                option.setName('comment')
                    .setDescription('Comment about the meeting.')
                    .setRequired(false)
            )
            .addStringOption(option =>
                option.setName('tags')
                    .setDescription('Roles and Users to be tagged')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('meetings')
            .setDescription('Show all scheduled meetings.'),
        new SlashCommandBuilder()
            .setName('remind')
            .setDescription('Manually send a reminder for an existing meeting.')
            .addStringOption(option =>
                option.setName('id')
                    .setDescription('ID of the meeting to send a notification')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('remove_meeting')
            .setDescription('Remove a scheduled meeting by its ID')
            .addStringOption(option =>
                option.setName('id')
                    .setDescription('ID of the meeting to remove')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('select_role')
            .setDescription('Select a role to manage meetings (only server owner can use this)')
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('The role to select for managing meetings')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('remove_role')
            .setDescription('Remove the selected admin role (only server owner can use this)'),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Show a list of available commands and their usage'),
    ];

    // Trying to register commands globally, but it may take more time
    await client.application.commands.set(commands)
    await loadMeetingsFromJSON();//there is a problem , mindak ytfa lbot wahdo

});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Don't reply to bot messages

    if (!message.content.startsWith(PREFIX))
        return

    const rawArgs = message.content.slice(PREFIX.length).trim();
    const args = parseArgs(rawArgs); // Use your custom parseArgs function
    const command = args.shift().toLowerCase(); // First argument is the command

    switch (command) {
        case 'add_meeting': {
            // if (interaction.guild && !interaction.member.roles.cache.has(adminRoleId))
            //     return interaction.reply('❌ You do not have permission to schedule meetings.');

            // Now, assign the parsed arguments
            const details = args[0]; // Meeting details
            const date = args[1];
            const time = args[2];
            const tags = args[3]?.trim();
            const customReminders = args[4]?.trim(); // Custom reminders (optional)
            const comment = args[5]; // Comment

            // Date treatment and filtering
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date))
                return message.reply('❌ Invalid date format. Please use yyyy-mm-dd.');

            const [year, month, day] = date.split('-');
            const meetingDate = new Date(`${year}-${month}-${day}T${time}:00`);

            if (isNaN(meetingDate))
                return message.reply('❌ Invalid date or time format.');

            const now = new Date();
            if (meetingDate <= now)
                return message.reply('❌ You cannot schedule a meeting in the past.');

            // Validate and process custom reminders
            let reminders = [];

            if (customReminders)
                reminders = resolveCustomReminders(customReminders);

            // Default reminders if none provided
            if (!reminders.length)
                reminders = DEFAULT_REMINDERS; // Default reminders: 0m and 10m

            const resolvedMentions = [];
            if (tags) {
                const mentions = tags.match(/<@!?(\d+)>|<@&(\d+)>|@\w+/g);

                if (mentions)
                    for (const mention of mentions)
                        try {
                            const resolvedMention = await resolveMentions(mention, message.guild, message.author);
                            if (resolvedMention)
                                resolvedMentions.push(resolvedMention);
                        } catch (error) {
                            console.error(`Failed to resolve mention: ${mention}`, error);
                        }
            }

            const channelId = message.channelId;
            const meetingId = crypto.randomBytes(16).toString('hex');
            meetings[meetingId] = {meetingDate, details, comment, resolvedMentions, channelId, reminders};

            scheduleReminder(meetingId); // Ensure this function uses the reminders array
            await saveToJSON(meetingId, {
                meetingDate,
                details,
                comment,
                resolvedMentions,
                channelId,
                reminders
            }, MEETINGS_FILE);

            let replyMessage = `✅ Meeting scheduled for **${date}** at **${time}**\n/**Details**: ${details}\n`
            if (comment)
                replyMessage += `**Comment:** ${comment}\n`;

            replyMessage += `**Custom Reminders:** ${reminders.map(r => `${r}m`).join(', ')}`;

            const addMeetingEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('Meeting Scheduled')
                .setDescription(replyMessage)
                .setTimestamp()
                .setFooter({text: 'Created by Shellmates'});

            await message.reply({content: `${resolvedMentions?.join(' ') || ''}\n`, embeds: [addMeetingEmbed]});

            break;
        }

        case 'remind':
            const meetingID = args[0]
            if (!meetings[meetingID])
                return message.reply('❌ No meeting found with that ID.');

            await sendReminder(meetingID, false)
            return;

        case 'meetings':
            if (!Object.keys(meetings).length)
                return message.reply('There are no meetings currently scheduled.');

            let msg1 = '📅 **Upcoming Meetings**:\n';
            let displayedMeetings = "";
            let guild = message.guild;

            const meetingPromises = Object.keys(meetings).map(async (meetingId) => {
                const { meetingDate, details, comment, resolvedMentions, channelId } = meetings[meetingId];
                const meetingDateObject = new Date(meetingDate);
                if (channelId === message.channelId) {
                    const targets = await Promise.all(resolvedMentions?.map(async (mention) => {
                        if (mention.startsWith('<@&')) {
                            // For role mentions (e.g., <@&roleID>)
                            const roleId = mention.slice(3, -1); // Removes <@& and >
                            const role = await guild.roles.fetch(roleId);
                            return `@${role.name}`; // Display the role name with @
                        }
                        else if (mention.startsWith('<@')) {
                            // For user mentions (e.g., <@userID>)
                            let id = mention.slice(2, -1);
                            if (id === message.author.id)
                                return `@${message.author.username}`;
                            if (id === client.user.id)
                                return `@${client.user.username}`;

                            const user = await guild.members.fetch(id);
                            return `@${user.user.username}`; // Display the username with @
                        }
                        return mention; // If it's already a plain text mention, return as is
                    }));

                    // Format the meeting details more clearly
                    displayedMeetings += `\n**Meeting ID**: ${meetingId}\n`;
                    displayedMeetings += `**Date**: ${meetingDateObject}\n`;
                    displayedMeetings += `**Details**: ${details}\n`;
                    if (comment)
                        displayedMeetings += `**Comment**: ${comment}\n`;

                    displayedMeetings += `**Targets**: ${targets.length > 0 ? targets.join(', ') : 'No Targets'}\n`;
                    displayedMeetings += `-----------------------------\n`; // A separator line for each meeting
                }
            });
            await Promise.all(meetingPromises); // Wait for all promises to resolve before sending the response
            if (displayedMeetings === "")
                await message.reply('There are no meetings currently scheduled.');
            else
                await message.reply(msg1 + displayedMeetings);

            break;

        case 'remove_meeting':
            const meetingId = args[0];
            if (!meetings[meetingId]) {
                const noMeetingEmbed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('Remove Meeting')
                    .setDescription('❌ No meeting found with that ID.')
                    .setTimestamp()
                    .setFooter({ text: 'Created by Shellmates' })
                await message.reply({embeds:[noMeetingEmbed]});
                return;
            }

            delete meetings[meetingId];
            await deleteFromJSON(meetingId,MEETINGS_FILE)
            const meetingRemoved = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('Meeting Removed')
                .setDescription(`✅ Meeting with ID **${meetingId}** has been successfully removed.`)
                .setTimestamp()
                .setFooter({text : 'Created by Shellmates'});

            await message.reply({embeds:[meetingRemoved]});

            break;

        case 'select_role':
            if (user.id !== message.guild.ownerId)
                return message.reply('❌ Only the server owner can select the admin role.');

            const role = args[0];
            adminRoleId = role.id;
            await message.reply(`✅ Role **${role.name}** has been selected as the admin role.`);

            break;

        case 'remove_role':
            if (message.author.id !== message.guild.ownerId)
                return message.reply('❌ Only the server owner can remove the admin role.');

            adminRoleId = null;
            await message.reply('✅ Admin role has been removed.');
            break;

        case 'help':
            const helpEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('Shellmates Meeting Bot - Help')
                .setDescription('Here are the commands you can use:')
                .addFields(
                    { name: '!addmeeting', value: 'Schedule a new meeting.' },
                    { name: '!meetings', value: 'View all scheduled meetings.' },
                    { name: '!removemeeting', value: 'Remove a scheduled meeting by its ID.' },
                    { name: '!selectrole', value: 'Set the role that can manage meetings.' },
                    { name: '!removerole', value: 'Remove the selected admin role.' },
                    { name: '!remind', value: 'Manually send a reminder for an existing meeting.' },
                )
                .setTimestamp()
                .setFooter({ text: 'Created by Shellmates' });

            await message.reply({embeds: [helpEmbed]});
            break;

        default:
            await message.reply('Invalid Command!')
            break;
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options, user } = interaction;
    switch (commandName) {
        case 'add_meeting': {
            // if (interaction.guild && !interaction.member.roles.cache.has(adminRoleId))
            //     return interaction.reply('❌ You do not have permission to schedule meetings.');

            const details = options.getString('details');
            const date = options.getString('date');
            const time = options.getString('time');
            const comment = options.getString('comment');
            const tags = options.getString('tags');
            const customReminders = options.getString('custom_reminders');

            // Date treatment and filtering
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date))
                return interaction.reply('❌ Invalid date format. Please use yyyy-mm-dd.');

            const [year, month, day] = date.split('-');
            const meetingDate = new Date(`${year}-${month}-${day}T${time}:00`);

            if (isNaN(meetingDate))
                return interaction.reply('❌ Invalid date or time format.');

            const now = new Date();
            if (meetingDate <= now)
                return interaction.reply('❌ You cannot schedule a meeting in the past.');

            // Validate and process custom reminders
            let reminders = [];

            if (customReminders)
                reminders = resolveCustomReminders(customReminders);

            // Default reminders if none provided
            if (!reminders.length)
                reminders = DEFAULT_REMINDERS; // Default reminders: 0m and 10m

            const resolvedMentions = [];
            if (tags) {
                const mentions = tags.match(/<@!?(\d+)>|<@&(\d+)>|@\w+/g);

                if (mentions)
                    for (const mention of mentions)
                        try {
                            const resolvedMention = await resolveMentions(mention, interaction.guild, interaction.user);
                            if (resolvedMention)
                                resolvedMentions.push(resolvedMention);
                        } catch (error) {
                            console.error(`Failed to resolve mention: ${mention}`, error);
                        }
            }

            const channelId = interaction.channelId;
            const meetingId = crypto.randomBytes(16).toString('hex');
            meetings[meetingId] = {meetingDate, details, comment, resolvedMentions, channelId, reminders};

            scheduleReminder(meetingId); // Ensure this function uses the reminders array
            await saveToJSON(meetingId, {
                meetingDate,
                details,
                comment,
                resolvedMentions,
                channelId,
                reminders
            }, MEETINGS_FILE);

            let replyMessage = `✅ Meeting scheduled for **${date}** at **${time}**\n**Details**: ${details}\n`
            if (comment)
                replyMessage += `**Comment:** ${comment}\n`;

            replyMessage += `**Custom Reminders:** ${reminders.map(r => `${r}m`).join(', ')}`;

            const addMeetingEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('Meeting Scheduled')
                .setDescription(replyMessage)
                .setTimestamp()
                .setFooter({text: 'Created by Shellmates'});

            await interaction.reply({content: `${resolvedMentions?.join(' ') || ''}\n`, embeds: [addMeetingEmbed]});

            break;
        }

        case 'remind':
            const meetingID = options.getString('id');
            if (!meetings[meetingID])
                return interaction.reply('❌ No meeting found with that ID.');

            await sendReminder(meetingID, false)
            return;

        case 'meetings':
            if (!Object.keys(meetings).length)
                return interaction.reply('There are no meetings currently scheduled.');

            let msg1 = '📅 **Upcoming Meetings**:\n';
            let displayedMeetings = "";
            let guild = interaction.guild;

            const meetingPromises = Object.keys(meetings).map(async (meetingId) => {
                const { meetingDate, details, comment, resolvedMentions, channelId } = meetings[meetingId];
                const meetingDateObject = new Date(meetingDate);
                if (channelId === interaction.channelId) {
                    const targets = await Promise.all(resolvedMentions?.map(async (mention) => {
                        if (mention.startsWith('<@&')) {
                            // For role mentions (e.g., <@&roleID>)
                            const roleId = mention.slice(3, -1); // Removes <@& and >
                            const role = await guild.roles.fetch(roleId);
                            return `@${role.name}`; // Display the role name with @
                        }
                        else if (mention.startsWith('<@')) {
                            // For user mentions (e.g., <@userID>)
                            let id = mention.slice(2, -1);
                            if (id === interaction.user.id)
                                return `@${interaction.user.username}`;
                            if (id === client.user.id)
                                return `@${client.user.username}`;

                            const user = await guild.members.fetch(id);
                            return `@${user.user.username}`; // Display the username with @
                        }
                        return mention; // If it's already a plain text mention, return as is
                    }));

                    // Format the meeting details more clearly
                    displayedMeetings += `\n**Meeting ID**: ${meetingId}\n`;
                    displayedMeetings += `**Date**: ${meetingDateObject}\n`;
                    displayedMeetings += `**Details**: ${details}\n`;
                    if (comment)
                        displayedMeetings += `**Comment**: ${comment}\n`;

                    displayedMeetings += `**Targets**: ${targets.length > 0 ? targets.join(', ') : 'No Targets'}\n`;
                    displayedMeetings += `-----------------------------\n`; // A separator line for each meeting
                }
            });
            await Promise.all(meetingPromises); // Wait for all promises to resolve before sending the response
            if (displayedMeetings === "")
                await interaction.reply('There are no meetings currently scheduled.');
            else
                await interaction.reply(msg1 + displayedMeetings);

            break;

        case 'remove_meeting':
            const meetingId = options.getString('id');
            if (!meetings[meetingId]) {
                const noMeetingEmbed = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle('Remove Meeting')
                    .setDescription('❌ No meeting found with that ID.')
                    .setTimestamp()
                    .setFooter({ text: 'Created by Shellmates' })
                await interaction.reply({embeds:[noMeetingEmbed]});
                return;
            }

            delete meetings[meetingId];
            await deleteFromJSON(meetingId,MEETINGS_FILE)
            const meetingRemoved = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('Meeting Removed')
                .setDescription(`✅ Meeting with ID **${meetingId}** has been successfully removed.`)
                .setTimestamp()
                .setFooter({text : 'Created by Shellmates'});

            await interaction.reply({embeds:[meetingRemoved]});

            break;

        case 'select_role':
            if (user.id !== interaction.guild.ownerId)
                return interaction.reply('❌ Only the server owner can select the admin role.');

            const role = options.getRole('role');
            adminRoleId = role.id;
            await interaction.reply(`✅ Role **${role.name}** has been selected as the admin role.`);

            break;

        case 'remove_role':
            if (user.id !== interaction.guild.ownerId)
                return interaction.reply('❌ Only the server owner can remove the admin role.');

            adminRoleId = null;
            await interaction.reply('✅ Admin role has been removed.');

            break;

        case 'help':
            const helpEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('Shellmates Meeting Bot - Help')
                .setDescription('Here are the commands you can use:')
                .addFields(
                    { name: '/addmeeting', value: 'Schedule a new meeting.' },
                    { name: '/meetings', value: 'View all scheduled meetings.' },
                    { name: '/removemeeting', value: 'Remove a scheduled meeting by its ID.' },
                    { name: '/selectrole', value: 'Set the role that can manage meetings.' },
                    { name: '/removerole', value: 'Remove the selected admin role.' },
                    { name: '/remind', value: 'Manually send a reminder for an existing meeting.' },
                )
                .setTimestamp()
                .setFooter({ text: 'Created by Shellmates' });

            await interaction.reply({ embeds: [helpEmbed] });

            break;
    }
});

client.login(TOKEN);