const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const crypto = require('crypto'); // For generating unique meeting IDs

function scheduleReminder(meetingId) {
    // meeting = {
    //      meetingDate,    // A date Object storing the date and time of the meeting
    //      details,
    //      comment,
    //      tags,           // Roles or Users to be tagged
    //      channelId       // ChannelID field of the interaction or message, Globally unique
    //  }
    const nowDate = new Date();
    const now = nowDate.getTime() // Use a timestamp for consistency
    let meeting = meetings[meetingId]; // Ensure this is defined and valid

    const reminderTimes = [
        [meeting.meetingDate.getTime() - 30 * 60 * 1000, false], // 30 minutes before
        [meeting.meetingDate.getTime(), true]                   // At the time of the meeting
    ];

    reminderTimes.forEach((reminderTime) => {
        if (reminderTime[0] > now) {
            const delay = reminderTime[0] - now;
            console.log(`Scheduling reminder for ${new Date(reminderTime[0]).toString()}`);
            setTimeout(() => sendReminder(meetingId, reminderTime[1]), delay);
        }
    });
}

function sendReminder(meetingId, lastReminder) {
    const meeting = meetings[meetingId];

    if (!meeting) {
        console.error(`Meeting with ID ${meetingId} not found.`);
        return;
    }

    const { meetingDate, details, comment, resolvedMentions, channelId} = meeting;

    const formattedDate = meetingDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const formattedTime = meetingDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    let messageContent = `
🔔 **Meeting Reminder** 🔔

${resolvedMentions?.join(' ') || ''}
You have a meeting scheduled on **${formattedDate}** at **${formattedTime}**.

**Details:** ${details}
`;

    // Add optional fields only if they exist
    if (comment)
        messageContent += `**Comment:** ${comment}\n`;

    messageContent += `\n*Reminder system*`;
    client.channels.fetch(channelId).then((channel) => {
        channel.send(messageContent).catch((error) => {
            console.error(`Failed to send reminder to channel ${channelId}:`, error);
        });
    });

    // Do not group those 2 conditions, because we need to know when deletion of a meeting failed
    if (lastReminder)
        if (!deleteMeeting(meetingId))
            console.error(`Failed to delete meeting with ID ${meetingId}`);
}

function deleteMeeting(meetingID) {
    if (!meetings[meetingID])
        return false;

    delete meetings[meetingID];
    return true;
}

function parseArgs(input) {
    const regex = /(?:[^\s"]+|"([^"]*)")+/g; // Regex to match unquoted and quoted arguments
    return input.match(regex).map(arg => arg.replace(/^"|"$/g, '')); // Remove quotes if present
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
let adminRoleId = null; // Variable to store the selected admin role
let meetings = {}; // To store meetings

client.once('ready', () => {
    console.log(`${client.user.tag} is ready to work!`);

    const commands = [
        new SlashCommandBuilder()
            .setName('addmeeting')
            .setDescription('Schedule a new meeting')
            .addStringOption(option =>
                option.setName('details')
                    .setDescription('Details of the meeting')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('date')
                    .setDescription('The date for the meeting (DD-MM-YYYY or DD/MM/YYYY)')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('time')
                    .setDescription('The time for the meeting (HH:MM)')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('comment')
                    .setDescription('Comment about the meeting')
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
            .setName('removemeeting')
            .setDescription('Remove a scheduled meeting by its ID')
            .addStringOption(option =>
                option.setName('id')
                    .setDescription('ID of the meeting to remove')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('selectrole')
            .setDescription('Select a role to manage meetings (only server owner can use this)')
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('The role to select for managing meetings')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('removerole')
            .setDescription('Remove the selected admin role (only server owner can use this)'),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Show a list of available commands and their usage'),
    ];

    // Trying to register commands globally, but it may take more time
    client.application.commands.set(commands)
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Don't reply to bot messages

    if (!message.content.startsWith(PREFIX))
        return

    // Handle prefix commands
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch (command) {
        case 'addmeeting': {
            // if (!adminRoleId || !message.member.roles.cache.has(adminRoleId)) {
            //     return message.reply('❌ You do not have permission to schedule meetings.');
            // }

            let arguments = parseArgs(args.join(' '))

            const details = arguments[0]; // Meeting details
            const date = arguments[1];
            const time = arguments[2];
            const comment = arguments[3]; // Comment
            const tags = arguments[4];

            // Verify existence of required fields (details, date and time)
            if (!details || !date || !time)
                return message.reply('❌ Please provide a valid date, time, details, and comment.');

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

            const resolvedMentions = [];
            if (tags) {
                const mentions = tags.match(/<@!?(\d+)>|<@&(\d+)>|@\w+/g); // Matches Discord user mentions or plain usernames

                if (mentions)
                    for (const mention of mentions)
                        try {
                            const resolvedMention = await resolveMentions(mention, message.guild, message.author);
                            if (resolvedMention)
                                resolvedMentions.push(resolvedMention);
                        }
                        catch (error) {
                            console.error(`Failed to resolve mention: ${mention}`, error);
                        }
            }

            let channelId = message.channelId

            const meetingId = crypto.randomBytes(16).toString('hex');
            meetings[meetingId] = { meetingDate, details, comment, resolvedMentions, channelId };
            scheduleReminder(meetingId)

            await message.reply(`${resolvedMentions?.join(' ') || ''}\n✅ Meeting scheduled for **${date}** at **${time}**\nDetails: **${details}**\nComment: **${comment}**.`);
            break;
        }

        case 'removemeeting': {
            if (deleteMeeting(args[0]))
                await message.reply(`✅ Meeting with ID **${args[0]}** has been removed.`);
            else
                await message.reply(`❌ No meeting found with ID **${args[0]}**.`);

            break;
        }

        case 'selectrole':
            if (message.author.id !== message.guild.ownerId)
                return message.reply('❌ Only the server owner can select the admin role.');

            const role = message.mentions.roles.first();
            if (!role)
                return message.reply('❌ Please mention a role to select.');

            adminRoleId = role.id;
            await message.reply(`✅ Role **${role.name}** has been selected as the admin role.`);
            break;

        case 'meetings':
            if (!Object.keys(meetings).length)
                return message.reply('There are no meetings currently scheduled.');

            let msg1 = '📅 **Upcoming Meetings**:\n';
            let displayedMeetings = "";
            let guild = message.guild;

            const meetingPromises = Object.keys(meetings).map(async (meetingId) => {
                const { meetingDate, details, comment, resolvedMentions, channelId } = meetings[meetingId];
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
                    displayedMeetings += `**Date**: ${meetingDate}\n`;
                    displayedMeetings += `**Details**: ${details}\n`;
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

        case 'removerole':
            if (message.author.id !== message.guild.ownerId) {
                return message.reply('❌ Only the server owner can remove the admin role.');
            }

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
                    { name: '!removerole', value: 'Remove the selected admin role.' }
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

    // Handle /addmeeting (slash command)
    if (commandName === 'addmeeting') {
        // if (interaction.guild && !interaction.member.roles.cache.has(adminRoleId))
        //     return interaction.reply('❌ You do not have permission to schedule meetings.');

        const details = options.getString('details');
        const date = options.getString('date');
        const time = options.getString('time');
        const comment = options.getString('comment');
        const tags = options.getString('tags');

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

        const resolvedMentions = [];
        if (tags) {
            const mentions = tags.match(/<@!?(\d+)>|<@&(\d+)>|@\w+/g);

            if (mentions)
                for (const mention of mentions)
                    try {
                        const resolvedMention = await resolveMentions(mention, interaction.guild, interaction.user);
                        if (resolvedMention)
                            resolvedMentions.push(resolvedMention);
                    }
                    catch (error) {
                        console.error(`Failed to resolve mention: ${mention}`, error);
                    }
        }

        let channelId= interaction.channelId

        const meetingId = crypto.randomBytes(16).toString('hex');
        meetings[meetingId] = { meetingDate, details, comment, resolvedMentions, channelId };
        scheduleReminder(meetingId)

        await interaction.reply(`${resolvedMentions?.join(' ') || ''}\n✅ Meeting scheduled for **${date}** at **${time}**\nDetails: **${details}**\nComment: **${comment}**.`);
    }

    if (commandName === 'remind') {
        const meetingID = options.getString('id');
        if (!meetings[meetingID])
            return interaction.reply('❌ No meeting found with that ID.');

        sendReminder(meetingID, false)
        return;
    }
    // Handle /meetings (slash command)
    if (commandName === 'meetings') {
        if (!Object.keys(meetings).length)
            return interaction.reply('There are no meetings currently scheduled.');

        let msg1 = '📅 **Upcoming Meetings**:\n';
        let displayedMeetings = "";
        let guild = interaction.guild;

        const meetingPromises = Object.keys(meetings).map(async (meetingId) => {
            const { meetingDate, details, comment, resolvedMentions, channelId } = meetings[meetingId];
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
                displayedMeetings += `**Date**: ${meetingDate}\n`;
                displayedMeetings += `**Details**: ${details}\n`;
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
    }

    // Handle /removemeeting (slash command)
    if (commandName === 'removemeeting') {
        const meetingId = options.getString('id');
        if (!meetings[meetingId]) {
            return interaction.reply('❌ No meeting found with that ID.');
        }

        delete meetings[meetingId];
        await interaction.reply(`✅ Meeting with ID **${meetingId}** has been removed.`);
    }

    // Handle /selectrole (slash command)
    if (commandName === 'selectrole') {
        if (user.id !== interaction.guild.ownerId) {
            return interaction.reply('❌ Only the server owner can select the admin role.');
        }

        const role = options.getRole('role');
        adminRoleId = role.id;
        await interaction.reply(`✅ Role **${role.name}** has been selected as the admin role.`);
    }

    // Handle /removerole (slash command)
    if (commandName === 'removerole') {
        if (user.id !== interaction.guild.ownerId)
            return interaction.reply('❌ Only the server owner can remove the admin role.');

        adminRoleId = null;
        await interaction.reply('✅ Admin role has been removed.');
    }

    // Handle /help (slash command)
    if (commandName === 'help') {
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
    }
});

client.login(TOKEN);